// Interactions de la page d'accueil dans la version HTML autonome (sans React).
(function () {
  // Menu mobile
  var btn = document.querySelector("button[aria-controls='menu-mobile']");
  var menu = document.getElementById("menu-mobile");
  function setMenu(open) {
    menu.classList.toggle("hidden", !open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    btn.querySelector("path").setAttribute("d", open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16");
  }
  btn.addEventListener("click", function () { setMenu(menu.classList.contains("hidden")); });
  menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });

  // Filtres des campagnes
  var section = document.getElementById("campagnes");
  var tabs = section.querySelectorAll("[role='tab']");
  var input = section.querySelector("input[type='search']");
  var cards = section.querySelectorAll("article[data-category]");
  var grid = cards[0].parentElement;
  var empty = document.createElement("p");
  empty.className = "mt-10 rounded-3xl bg-white p-10 text-center text-gray-500 ring-1 ring-gray-100";
  empty.textContent = "Aucune campagne ne correspond à votre recherche.";
  empty.hidden = true;
  grid.after(empty);
  var active = "Toutes";
  var on = ["bg-ink", "text-white"], off = ["bg-white", "text-gray-600", "ring-1", "ring-gray-200", "hover:text-ink"];
  function apply() {
    var q = input.value.trim().toLowerCase(), n = 0;
    cards.forEach(function (c) {
      var ok = (active === "Toutes" || c.dataset.category === active) && (!q || c.dataset.search.indexOf(q) !== -1);
      c.hidden = !ok; if (ok) n++;
    });
    grid.hidden = n === 0; empty.hidden = n !== 0;
  }
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
  input.addEventListener("input", apply);

  // Copier le lien
  document.querySelectorAll("button[data-copy]").forEach(function (b) {
    var label = b.textContent, base = b.className;
    b.addEventListener("click", function () {
      try { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy).catch(function () {}); } catch (e) {}
      b.textContent = "Lien copié ✓";
      b.className = base.replace("bg-brand-50 text-brand-700 hover:bg-brand-100", "bg-emerald-50 text-emerald-700");
      setTimeout(function () { b.textContent = label; b.className = base; }, 1800);
    });
  });
})();
