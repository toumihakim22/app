// Bascule du thème clair / sombre, mémorisée dans le navigateur.
document.addEventListener("click", function (e) {
  if (!e.target.closest || !e.target.closest("[data-theme-toggle]")) return;
  var dark = document.documentElement.classList.toggle("dark");
  try { localStorage.setItem("clipboost-theme", dark ? "dark" : "light"); } catch (err) {}
});
