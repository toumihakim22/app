// Thème clair, sombre ou celui du système (par défaut), mémorisé dans le navigateur (clé clipboost-theme :
// "light", "dark" ou absente = système). Boutons : [data-theme-set="light|dark|system"] (menu du compte, écrans de
// connexion) et [data-theme-toggle] (bascule simple de l'accueil). La couleur de la barre du navigateur mobile
// (meta theme-color) suit le thème affiché.
(function () {
  var KEY = "clipboost-theme";
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function mode() {
    try { var m = localStorage.getItem(KEY); return m === "light" || m === "dark" ? m : "system"; } catch (e) { return "system"; }
  }
  function apply() {
    var m = mode(), dark = m === "dark" || (m === "system" && !!mq && mq.matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", dark ? "#0b0d12" : "#f5f6f8");
    var btns = document.querySelectorAll("[data-theme-set]");
    for (var j = 0; j < btns.length; j++) btns[j].setAttribute("aria-pressed", String(btns[j].getAttribute("data-theme-set") === m));
  }
  function set(m) {
    try { if (m === "light" || m === "dark") localStorage.setItem(KEY, m); else localStorage.removeItem(KEY); } catch (e) {}
    apply();
  }
  window.clipboostTheme = { mode: mode, set: set, apply: apply };
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    var b = t.closest("[data-theme-set]");
    if (b) { set(b.getAttribute("data-theme-set")); return; }
    if (t.closest("[data-theme-toggle]")) set(document.documentElement.classList.contains("dark") ? "light" : "dark");
  });
  if (mq) {
    var onChange = function () { if (mode() === "system") apply(); };
    if (mq.addEventListener) mq.addEventListener("change", onChange); else if (mq.addListener) mq.addListener(onChange);
  }
  apply();
})();
