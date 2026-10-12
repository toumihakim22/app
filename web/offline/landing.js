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
    show: function () {
      document.title = title;
      if (!setView("landing")) return;
      var id = location.hash.slice(1), target = id && document.getElementById(id);
      if (target) target.scrollIntoView();
      else window.scrollTo(0, 0);
    },
    hide: function () { setView("app"); },
  };

  // Liens absolus restants (« / », « /espace#/… ») : ancres de ce fichier, jamais la racine du disque.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href^='/']");
    if (!a || a.getAttribute("href").indexOf("//") === 0) return;
    var href = a.getAttribute("href"), hash = href.indexOf("#") >= 0 ? href.slice(href.indexOf("#")) : "";
    e.preventDefault();
    location.hash = href.indexOf("/espace") === 0 ? hash || "#/connexion" : hash;
  });

  // Menu mobile
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
  }

  // Filtres des campagnes (catégorie et recherche)
  var section = document.getElementById("campagnes");
  var cards = section ? section.querySelectorAll("article[data-category]") : [];
  if (cards.length) {
    var tabs = section.querySelectorAll("[role='tab']");
    var input = section.querySelector("input[type='search']");
    var grid = cards[0].parentElement;
    var empty = document.createElement("p");
    empty.className = "mt-10 rounded-3xl bg-white p-10 text-center text-gray-500 ring-1 ring-gray-100";
    empty.textContent = "Aucune campagne ne correspond à votre recherche.";
    empty.hidden = true;
    grid.after(empty);
    var active = "Toutes";
    var on = ["bg-ink", "text-white"], off = ["bg-white", "text-gray-600", "ring-1", "ring-gray-200", "hover:text-ink"];
    var apply = function () {
      var q = input ? input.value.trim().toLowerCase() : "", n = 0;
      cards.forEach(function (c) {
        var ok = (active === "Toutes" || c.dataset.category === active) && (!q || (c.dataset.search || "").indexOf(q) !== -1);
        c.hidden = !ok;
        if (ok) n++;
      });
      grid.hidden = n === 0;
      empty.hidden = n !== 0;
    };
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        active = t.textContent.trim();
        tabs.forEach(function (o) {
          var sel = o === t;
          o.setAttribute("aria-selected", String(sel));
          on.forEach(function (k) { o.classList.toggle(k, sel); });
          off.forEach(function (k) { o.classList.toggle(k, !sel); });
        });
        apply();
      });
    });
    if (input) input.addEventListener("input", apply);
  }

  // Bouton « Copier le lien » des campagnes
  landing.querySelectorAll("button[data-copy]").forEach(function (b) {
    var label = b.textContent, base = b.className, timer;
    b.addEventListener("click", function () {
      try { navigator.clipboard.writeText(b.dataset.copy).catch(function () {}); } catch (err) {}
      b.textContent = "Lien copié ✓";
      b.className = base.replace("bg-brand-50 text-brand-700 hover:bg-brand-100", "bg-emerald-50 text-emerald-700");
      clearTimeout(timer);
      timer = setTimeout(function () { b.textContent = label; b.className = base; }, 1800);
    });
  });
})();
