// Version autonome : la page d'accueil (HTML statique de Next.js) vit dans le même fichier que l'application.
// Ce script remplace les quelques interactions React de l'accueil et bascule entre l'accueil et l'application
// (voir onRoute() et render() dans web/src/main.js).
(function () {
  var landing = document.getElementById("landing");
  if (!landing) return;
  var title = document.title;

  function setView(view) {
    var html = document.documentElement;
    if (html.getAttribute("data-view") === view) return false;
    html.setAttribute("data-view", view);
    document.getElementById("css-landing").media = view === "landing" ? "all" : "not all";
    document.getElementById("css-app").media = view === "app" ? "all" : "not all";
    return true;
  }

  window.__CLIPBOOST_LANDING__ = {
    // L'accueil reste en français, de gauche à droite, quelle que soit la langue choisie dans l'application
    // (render() de web/src/main.js réapplique cette langue en revenant à l'application, voir applyLangAttrs()).
    show: function () {
      document.title = title;
      document.documentElement.lang = "fr";
      document.documentElement.dir = "ltr";
      if (!setView("landing")) return;
      var id = location.hash.slice(1), target = id && document.getElementById(id);
      if (target) target.scrollIntoView();
      else window.scrollTo(0, 0);
    },
    hide: function () { setView("app"); },
  };

  // Liens absolus restants (« / », « /espace#/… ») : ancres de ce fichier, jamais la racine du disque.
  // target=_blank (conditions d'utilisation depuis l'inscription) : ce même fichier, ouvert sur l'ancre dans un nouvel onglet.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href^='/']");
    if (!a || a.getAttribute("href").indexOf("//") === 0) return;
    var href = a.getAttribute("href"), hash = href.indexOf("#") >= 0 ? href.slice(href.indexOf("#")) : "";
    var target = href.indexOf("/espace") === 0 ? hash || "#/connexion" : hash;
    e.preventDefault();
    if (a.getAttribute("target") === "_blank") window.open(location.href.split("#")[0] + target, "_blank", "noopener");
    else location.hash = target;
  });

  // Menu mobile (Échap le referme et rend le focus au bouton)
  var btn = landing.querySelector("button[aria-controls='menu-mobile']");
  var menu = document.getElementById("menu-mobile");
  if (btn && menu) {
    var setMenu = function (open) {
      menu.classList.toggle("hidden", !open);
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
      var path = btn.querySelector("path");
      if (path) path.setAttribute("d", open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16");
    };
    btn.addEventListener("click", function () { setMenu(menu.classList.contains("hidden")); });
    menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || menu.classList.contains("hidden")) return;
      setMenu(false);
      btn.focus();
    });
  }

  // Filtres des campagnes (catégorie et recherche) : l'état vide est déjà dans le HTML statique ([data-empty]).
  var section = document.getElementById("campagnes");
  var cards = section ? section.querySelectorAll("article[data-category]") : [];
  if (cards.length) {
    var tabs = Array.prototype.slice.call(section.querySelectorAll("[role='tab']"));
    var panel = document.getElementById("campagnes-liste");
    var input = section.querySelector("input[type='search']");
    var grid = cards[0].parentElement;
    var empty = section.querySelector("[data-empty]");
    var active = "Toutes";
    var apply = function () {
      var q = input ? input.value.trim().toLowerCase() : "", n = 0;
      cards.forEach(function (c) {
        var ok = (active === "Toutes" || c.dataset.category === active) && (!q || (c.dataset.search || "").indexOf(q) !== -1);
        c.hidden = !ok;
        if (ok) n++;
      });
      grid.hidden = n === 0;
      if (empty) empty.hidden = n !== 0;
    };
    // Onglets ARIA : un seul arrêt de tabulation (tabindex mobile), flèches / Début / Fin pour changer de catégorie.
    var select = function (t, focus) {
      active = t.textContent.trim();
      tabs.forEach(function (o) {
        var sel = o === t;
        o.setAttribute("aria-selected", String(sel));
        o.tabIndex = sel ? 0 : -1;
      });
      if (panel && t.id) panel.setAttribute("aria-labelledby", t.id);
      if (focus) t.focus();
      apply();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t, false); });
      t.addEventListener("keydown", function (e) {
        var last = tabs.length - 1;
        var next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select(tabs[next], true);
      });
    });
    if (input) input.addEventListener("input", apply);
    var reset = empty && empty.querySelector("[data-reset]");
    if (reset) reset.addEventListener("click", function () {
      if (input) input.value = "";
      select(tabs[0], false);
      if (input) input.focus();
    });
  }

  // Bouton « Copier le lien » des campagnes : icône coche, libellé et couleur de succès, annonce pour les lecteurs d'écran.
  landing.querySelectorAll("button[data-copy]").forEach(function (b) {
    var label = b.querySelector("[data-label]"), svg = b.querySelector("svg");
    var status = b.parentElement && b.parentElement.querySelector("[role='status']");
    var title = b.closest("article") && b.closest("article").querySelector("h3");
    var text = label ? label.textContent : "", icon = svg ? svg.innerHTML : "", timer;
    var set = function (copied) {
      if (label) label.textContent = copied ? "Lien copié" : text;
      if (svg) svg.innerHTML = copied ? '<path d="M5 12l5 5L20 7"></path>' : icon;
      b.classList.toggle("text-success-fg", copied);
      b.classList.toggle("text-fg", !copied);
      if (status) status.textContent = copied ? "Lien de la campagne " + (title ? title.textContent : "") + " copié" : "";
    };
    b.addEventListener("click", function () {
      try { navigator.clipboard.writeText(b.dataset.copy).catch(function () {}); } catch (err) {}
      set(true);
      clearTimeout(timer);
      timer = setTimeout(function () { set(false); }, 1800);
    });
  });
})();
