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
})();
