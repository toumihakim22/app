// Routeur, coquilles (navigation) et gestion des événements de tout le site.
// Routes : #/ (accueil), #/connexion, #/inscription, #/clipper/<page>, #/admin/<page>.

const state = {
  route: { area: "landing", view: "" },
  session: null,
  drawer: false,
  notifOpen: false,
  modal: null,
  camp: { q: "", category: "Toutes", sort: "recent", favOnly: false, layout: "grid" },
  pub: { status: "Toutes" },
  tx: { type: "tous" },
  period: 30,
  settings: { email: true, push: true, weekly: false, newCampaigns: true },
  adm: { userQ: "", userStatus: "Tous", campStatus: "Toutes", modStatus: "En attente" },
  pwdError: "",
  auth: null,
};
resetAuth();

const root = document.getElementById("app");
const landing = document.getElementById("landing");

function parseRoute() {
  const h = location.hash;
  if (!h.startsWith("#/") || h === "#/") return { area: "landing", view: "" };
  const [area, view] = h.slice(2).split("/");
  if (area === "connexion" || area === "inscription") return { area: "auth", view: area };
  if (area === "clipper") return { area, view: CLIPPER_VIEWS[view] ? view : "accueil" };
  if (area === "admin") return { area, view: ADMIN_VIEWS[view] ? view : "apercu" };
  return { area: "landing", view: "" };
}

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function onRoute() {
  const r = parseRoute(), prev = state.route, u = state.session ? userById(state.session) : null;
  // Protection des espaces : il faut être connecté avec le bon rôle.
  if (r.area === "clipper" && (!u || u.role !== "clipper")) return navigate(u && u.role === "admin" ? "#/admin/apercu" : "#/connexion");
  if (r.area === "admin" && (!u || u.role !== "admin")) return navigate(u ? "#/clipper/accueil" : "#/connexion");
  if (r.area === "auth" && u) return navigate(u.role === "admin" ? "#/admin/apercu" : "#/clipper/accueil");
  if (r.area === "auth" && prev.view !== r.view) { const keepEmail = state.auth.email; resetAuth(); state.auth.email = keepEmail; }
  state.route = r; state.drawer = false; state.notifOpen = false; state.modal = null; state.pwdError = "";
  render();
  if (r.area !== "landing" || !location.hash || location.hash === "#/") window.scrollTo(0, 0);
}

// ---------- Coquille commune aux espaces Clipper et Admin ----------

function shellSidebar(area) {
  const isAdmin = area === "admin", nav = isAdmin ? ADMIN_NAV : CLIPPER_NAV, u = userById(state.session);
  return `<div class="flex h-full flex-col">
    <div class="px-2">${logo(isAdmin)}</div>
    <p class="mt-8 px-3 text-xs font-semibold uppercase tracking-widest ${isAdmin ? "text-white/40" : "text-gray-400"}">${isAdmin ? "Administration" : "Espace Clipper"}</p>
    <nav class="mt-3 space-y-1" aria-label="Navigation principale">
      ${nav.map((n) => {
        const on = state.route.view === n.id, badge = isAdmin ? adminBadge(n.id) : 0;
        const cls = isAdmin
          ? on ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
          : on ? "bg-white text-ink shadow-sm ring-1 ring-gray-100" : "text-gray-500 hover:bg-white/70 hover:text-ink";
        return `<a href="#/${area}/${n.id}" ${on ? 'aria-current="page"' : ""} class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${cls}">${icon(n.icon)}<span class="flex-1">${n.label}</span>${badge ? `<span class="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">${badge}</span>` : ""}</a>`;
      }).join("")}
    </nav>
    <div class="mt-auto space-y-3 pt-8">
      ${isAdmin
        ? `<a href="#/" class="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 hover:text-white">${icon("globe", "h-4 w-4")} Voir le site public</a>`
        : `<div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"><p class="text-xs text-gray-500">Solde disponible</p><p class="mt-1 text-xl font-extrabold">${da(balance())}</p></div>
           <button type="button" data-action="invite" class="w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700">Inviter un créateur 🙋</button>`}
      <div class="flex items-center gap-3 rounded-2xl px-2 py-2 ${isAdmin ? "text-white" : ""}">${avatar(u)}
        <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold">${esc(u.name)}</p><p class="truncate text-xs ${isAdmin ? "text-white/50" : "text-gray-500"}">${esc(u.email)}</p></div>
        <button type="button" data-action="logout" class="grid h-9 w-9 place-items-center rounded-xl ${isAdmin ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-white hover:text-rose-600"}" aria-label="Se déconnecter" title="Se déconnecter">${icon("logout", "h-4 w-4")}</button>
      </div>
    </div>
  </div>`;
}

function shellTopbar(area) {
  const u = userById(state.session), isAdmin = area === "admin";
  const notifs = isAdmin ? [] : myNotifs(), unread = notifs.filter((n) => n.unread).length;
  return `<header class="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
    <div class="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
      <button type="button" data-action="drawer" class="grid h-10 w-10 place-items-center rounded-xl ring-1 ring-gray-200 lg:hidden" aria-label="Ouvrir le menu">${icon("menu")}</button>
      <span class="text-xl font-black italic tracking-tight lg:hidden">ClipBoost${isAdmin ? ' <span class="not-italic text-xs font-bold text-brand-600">ADMIN</span>' : ""}</span>
      ${isAdmin
        ? `<p class="hidden text-sm text-gray-500 lg:block">Connecté en tant qu'administrateur</p>`
        : `<label class="relative ml-auto hidden w-full max-w-xs md:block lg:ml-0"><span class="sr-only">Recherche rapide</span>
            <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">${icon("search", "h-4 w-4")}</span>
            <input data-input="global-q" type="search" placeholder="Rechercher une campagne…" class="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"/></label>`}
      <div class="relative ml-auto flex items-center gap-2">
        ${isAdmin ? "" : `<button type="button" data-action="notif" aria-expanded="${state.notifOpen}" aria-label="Notifications${unread ? ` (${unread} non lues)` : ""}" class="relative grid h-10 w-10 place-items-center rounded-xl ring-1 ring-gray-200 hover:bg-gray-50">
          ${icon("bell")}${unread ? `<span class="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">${unread}</span>` : ""}</button>`}
        ${state.notifOpen ? notifPanel(notifs) : ""}
        <a href="#/${area}/${isAdmin ? "parametres" : "profil"}" class="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-gray-50" aria-label="Mon compte">
          ${avatar(u)}<span class="hidden text-left sm:block"><span class="block text-sm font-semibold leading-tight">${esc(u.name)}</span><span class="block text-xs text-gray-500">${isAdmin ? "Administrateur" : u.level}</span></span>
        </a>
      </div>
    </div>
  </header>`;
}

function notifPanel(list) {
  return `<div class="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-white p-2 shadow-xl ring-1 ring-gray-100" role="dialog" aria-label="Notifications">
    <div class="flex items-center justify-between px-3 py-2"><p class="font-bold">Notifications</p><button type="button" data-action="read-all" class="text-xs font-semibold text-brand-700 hover:underline">Tout marquer comme lu</button></div>
    <div class="max-h-96 overflow-y-auto">${list.length ? list.map((n) => `<button type="button" data-action="read-one" data-id="${n.id}" class="flex w-full gap-3 rounded-xl p-3 text-left hover:bg-gray-50 ${n.unread ? "bg-brand-50/60" : ""}">
      <span class="text-lg">${n.icon}</span><span class="flex-1"><span class="block text-sm ${n.unread ? "font-semibold" : "text-gray-600"}">${esc(n.text)}</span><span class="text-xs text-gray-400">${n.time}</span></span>
      ${n.unread ? '<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600"></span>' : ""}</button>`).join("") : `<p class="p-6 text-center text-sm text-gray-500">Aucune notification.</p>`}</div>
  </div>`;
}

function shellMobileNav(area) {
  const ids = area === "admin" ? ["apercu", "utilisateurs", "campagnes", "moderation"] : ["accueil", "campagnes", "publications", "portefeuille"];
  const nav = area === "admin" ? ADMIN_NAV : CLIPPER_NAV;
  return `<nav class="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur lg:hidden" aria-label="Navigation mobile">
    <div class="grid grid-cols-5">
      ${ids.map((id) => { const n = nav.find((x) => x.id === id), on = state.route.view === id; return `<a href="#/${area}/${id}" ${on ? 'aria-current="page"' : ""} class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${on ? "text-brand-600" : "text-gray-500"}">${icon(n.icon)}${n.short || n.label}</a>`; }).join("")}
      <button type="button" data-action="drawer" class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${ids.includes(state.route.view) ? "text-gray-500" : "text-brand-600"}">${icon("more")}Plus</button>
    </div>
  </nav>`;
}

function shell(area) {
  const isAdmin = area === "admin";
  const sideCls = isAdmin ? "bg-ink" : "bg-gray-50 border-r border-gray-100";
  const view = (isAdmin ? ADMIN_VIEWS : CLIPPER_VIEWS)[state.route.view]();
  return `${siteBanner()}
    <div class="flex min-h-screen">
      <aside class="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto p-5 lg:block ${sideCls}">${shellSidebar(area)}</aside>
      <div class="min-w-0 flex-1">
        ${shellTopbar(area)}
        <main class="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-12">${view}</main>
      </div>
    </div>
    ${shellMobileNav(area)}
    ${state.drawer ? `<div class="fixed inset-0 z-50 lg:hidden"><div class="absolute inset-0 bg-ink/40" data-action="drawer"></div>
      <aside class="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto p-5 shadow-2xl ${isAdmin ? "bg-ink" : "bg-gray-50"}">
        <button type="button" data-action="drawer" class="absolute right-4 top-5 z-10 grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm" aria-label="Fermer le menu">${icon("close", "h-4 w-4")}</button>
        ${shellSidebar(area)}</aside></div>` : ""}
    ${isAdmin ? adminModal() : clipperModal()}`;
}

// ---------- Rendu ----------

function render() {
  const area = state.route.area;
  landing.hidden = area !== "landing";
  root.hidden = area === "landing";
  const banner = document.getElementById("landing-banner");
  if (banner) banner.innerHTML = siteBanner();
  if (area === "landing") { document.title = "ClipBoost — Transformez vos clips en revenus"; return; }

  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.input : null;
  const caret = focusKey && "selectionStart" in active ? active.selectionStart : null;

  let html;
  if (area === "auth") html = state.route.view === "connexion" ? viewConnexion() : viewInscription();
  else html = shell(area);
  root.innerHTML = `${html}<div id="toasts" class="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"></div>`;
  document.title = { auth: state.route.view === "connexion" ? "Connexion — ClipBoost" : "Inscription — ClipBoost", clipper: "Espace Clipper — ClipBoost", admin: "Administration — ClipBoost" }[area];

  if (focusKey) {
    const el = root.querySelector(`[data-input="${focusKey}"]`);
    if (el) { el.focus(); if (caret !== null) try { el.setSelectionRange(caret, caret); } catch (e) {} }
  }
}

// ---------- Événements ----------

// Liens de la page d'accueil vers l'inscription et la connexion.
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-route]");
  if (link && landing.contains(link)) { e.preventDefault(); navigate(`#/${link.dataset.route}`); }
});

root.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (!t) {
    if (state.notifOpen && !e.target.closest('[role="dialog"]')) { state.notifOpen = false; render(); }
    return;
  }
  // un clic à l'intérieur d'une modale ne doit pas la fermer
  if (t.dataset.action === "close-modal" && t.querySelector("[data-stop]") && e.target.closest("[data-stop]")) return;
  const action = t.dataset.action;
  switch (action) {
    case "drawer": state.drawer = !state.drawer; state.notifOpen = false; return render();
    case "notif": state.notifOpen = !state.notifOpen; return render();
    case "read-all": myNotifs().forEach((n) => (n.unread = false)); return render();
    case "read-one": { const n = db.notifications.find((x) => String(x.id) === t.dataset.id); if (n) n.unread = false; return render(); }
    case "close-modal": state.modal = null; return render();
    case "logout": return logout();
    case "toast": return toast(t.dataset.msg);
    case "toggle-pwd": state.auth.showPwd = !state.auth.showPwd; return render();
    case "forgot": return toast("Un lien de réinitialisation serait envoyé par email (démonstration).");
    case "demo-login": {
      const u = db.users.find((x) => x.email === t.dataset.email);
      const form = root.querySelector('[data-form="login"]');
      form.email.value = u.email; form.password.value = u.password;
      return;
    }
    case "signup-back": state.auth.step = "form"; state.auth.error = ""; return render();
    case "resend-code": state.auth.code = newCode(); state.auth.error = ""; render(); return toast("Nouveau code envoyé (démonstration)");
  }
  if (state.route.area === "admin") handleAdminAction(action, t);
  else if (state.route.area === "clipper") handleClipperAction(action, t);
});

root.addEventListener("input", (e) => {
  const k = e.target.dataset.input;
  if (k === "camp-q") { state.camp.q = e.target.value; render(); }
  if (k === "adm-user-q") { state.adm.userQ = e.target.value; render(); }
  if (e.target.hasAttribute("data-strength")) {
    const meter = root.querySelector("[data-strength-meter]");
    if (meter) meter.innerHTML = strengthMeter(e.target.value);
  }
});

root.addEventListener("change", (e) => {
  const k = e.target.dataset.input;
  if (k === "camp-category") { state.camp.category = e.target.value; render(); }
  if (k === "camp-sort") { state.camp.sort = e.target.value; render(); }
});

root.addEventListener("keydown", (e) => {
  if (e.target.dataset.input === "global-q" && e.key === "Enter") {
    state.camp.q = e.target.value; state.camp.category = "Toutes"; state.camp.favOnly = false;
    navigate("#/clipper/campagnes");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && (state.modal || state.drawer || state.notifOpen)) {
    state.modal = null; state.drawer = false; state.notifOpen = false; render();
  }
});

root.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target.dataset.form, data = Object.fromEntries(new FormData(e.target));
  if (["login", "signup", "verify"].includes(form)) return handleAuthSubmit(form, data);
  if (form.startsWith("adm-")) return handleAdminSubmit(form, data);
  handleClipperSubmit(form, data);
});

window.addEventListener("hashchange", onRoute);
onRoute();
