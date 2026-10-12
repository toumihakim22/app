// Routeur, coquilles (navigation) et gestion des événements de l'application (/espace).
// Routes : #/connexion, #/inscription, #/inscription-agence, #/mot-de-passe, #/clipper/<page>, #/agence/<page>, #/admin/<page>.
// La page d'accueil publique est servie par Next.js à l'adresse / ; dans la version autonome (fichier HTML unique),
// elle est dans la même page et s'affiche sans route (voir web/offline/landing.js).

const state = {
  route: { area: "auth", view: "connexion" },
  session: null,
  drawer: false,
  notifOpen: false,
  modal: null,
  camp: { q: "", category: "Toutes", sort: "recent", favOnly: false, layout: "grid" },
  pub: { status: "Toutes" },
  tx: { type: "tous" },
  period: 30,
  adm: { userQ: "", userStatus: "Tous", userRole: "Tous les rôles", campQ: "", campStatus: "Toutes", modStatus: "En attente", payTab: "retraits" },
  ag: { q: "", status: "Toutes", clipStatus: "Toutes" },
  pwdError: "",
  auth: null,
};
resetAuth();

const root = document.getElementById("app");
const offlineLanding = window.__CLIPBOOST_LANDING__;

function parseRoute() {
  const h = location.hash;
  if (!h.startsWith("#/") || h === "#/") return { area: "home", view: "" };
  const [area, view] = h.slice(2).split("/");
  if (area === "connexion" || area === "inscription" || area === "mot-de-passe") return { area: "auth", view: area };
  if (area === "inscription-agence") return { area: "auth", view: "inscription", role: "agence" };
  if (area === "agence") return { area, view: AGENCY_VIEWS[view] ? view : "apercu" };
  if (area === "clipper") return { area, view: CLIPPER_VIEWS[view] ? view : "accueil" };
  if (area === "admin") return { area, view: ADMIN_VIEWS[view] ? view : "apercu" };
  return { area: "home", view: "" };
}

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function onRoute() {
  const r = parseRoute(), prev = state.route, u = state.session ? me() : null;
  if (r.area === "home" && offlineLanding) {
    state.route = r; state.drawer = false; state.notifOpen = false; state.modal = null;
    return offlineLanding.show();
  }
  // Sans route précise : l'espace de l'utilisateur connecté, sinon la connexion.
  if (r.area === "home") return navigate(u ? homeOf(u) : "#/connexion");
  // Protection des espaces : il faut être connecté avec le bon rôle.
  if (["clipper", "agence", "admin"].includes(r.area) && (!u || u.role !== r.area)) return navigate(u ? homeOf(u) : "#/connexion");
  if (r.area === "auth" && u) return navigate(homeOf(u));
  if (r.area === "auth" && (prev.view !== r.view || r.role)) { const keepEmail = state.auth.email; resetAuth(); state.auth.email = keepEmail; }
  if (r.role) { state.auth.form.role = r.role; r.role = undefined; }
  state.route = r; state.drawer = false; state.notifOpen = false; state.modal = null; state.pwdError = "";
  render();
  window.scrollTo(0, 0);
}

// ---------- Coquille commune aux espaces Clipper, Agence et Admin ----------

// AREAS : navigation mobile = 4 onglets + « Plus » (qui ouvre le tiroir) ; libellés courts via n.short.
const AREAS = {
  clipper: { nav: () => CLIPPER_NAV, views: () => CLIPPER_VIEWS, title: "Espace Clipper", mobile: ["accueil", "campagnes", "publications", "portefeuille"], profile: "profil", modal: () => clipperModal() },
  agence: { nav: () => AGENCY_NAV, views: () => AGENCY_VIEWS, title: "Espace Agence", mobile: ["apercu", "campagnes", "clips", "budget"], profile: "profil", modal: () => agencyModal() },
  admin: { nav: () => ADMIN_NAV, views: () => ADMIN_VIEWS, title: "Administration", mobile: ["apercu", "utilisateurs", "campagnes", "moderation"], profile: "parametres", modal: () => adminModal() },
};

const NAV_ITEM = `group flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-fg-muted transition-colors duration-150 hover:bg-muted hover:text-fg aria-[current=page]:bg-surface aria-[current=page]:text-fg aria-[current=page]:shadow-control aria-[current=page]:ring-1 aria-[current=page]:ring-line ${FOCUS}`;
const NAV_ICON = "size-[18px] shrink-0 text-fg-subtle transition-colors group-hover:text-fg-muted group-aria-[current=page]:text-brand-fg";
// Mini-solde de la barre latérale : masqué là où le même chiffre est déjà le sujet de la page.
const MINI_HIDDEN = { clipper: ["accueil", "portefeuille"], agence: ["apercu", "budget"] };

// tools : boutons du tiroir (thème, fermer), alignés à droite sur la ligne du logo.
function shellSidebar(area, tools = "") {
  const nav = AREAS[area].nav(), u = userById(state.session), view = state.route.view;
  const mini = area !== "admin" && !MINI_HIDDEN[area].includes(view)
    ? `<a href="#/${area}/${area === "clipper" ? "portefeuille" : "budget"}" class="block rounded-tile border border-line bg-surface px-3 py-2.5 shadow-card transition-colors duration-150 hover:border-line-strong ${FOCUS}">
        <span class="block text-xs text-fg-subtle">${area === "clipper" ? "Solde disponible" : "Crédit disponible"}</span>
        <span class="mt-0.5 block text-[15px] font-semibold">${money(area === "clipper" ? balance() : u.credit)}</span></a>`
    : "";
  const cta = { clipper: ["submit-clip", "Soumettre un clip"], agence: ["ag-new", "Nouvelle campagne"] }[area];
  return `<div class="flex h-full flex-col">
    <div class="flex h-10 items-center gap-2 px-2">${logo({ size: "sm" })}${roleBadge(area)}${tools ? `<div class="-mr-1 ml-auto flex items-center gap-0.5">${tools}</div>` : ""}</div>
    <p class="mt-6 px-2.5 text-micro font-medium uppercase tracking-[0.08em] text-fg-subtle">${AREAS[area].title}</p>
    <nav class="mt-2 grid gap-0.5" aria-label="Navigation principale">${nav.map((n) => {
      const on = view === n.id, count = area === "admin" ? adminBadge(n.id) : 0;
      return `<a href="#/${area}/${n.id}" ${on ? 'aria-current="page"' : ""} class="${NAV_ITEM}">${icon(n.icon, NAV_ICON)}<span class="min-w-0 flex-1 truncate">${n.label}</span>${count ? countBadge(count, "queue") : ""}</a>`;
    }).join("")}</nav>
    <div class="mt-auto grid gap-3 pt-6">
      ${mini}
      ${cta ? `<button type="button" data-action="${cta[0]}" class="${btn("primary", "md", "w-full")}">${icon("plus")}${cta[1]}</button>` : ""}
      <a href="/" class="${btn("ghost", "sm", "w-full justify-start")}">${icon("globe")}Voir le site public</a>
      <div class="flex items-center gap-2.5 rounded-lg p-1.5">${avatar(u, "sm")}
        <div class="min-w-0 flex-1"><p class="truncate text-small font-medium text-fg">${esc(u.name)}</p><p class="truncate text-xs text-fg-subtle">${esc(u.email)}</p></div>
        <button type="button" data-action="logout" class="${iconBtn("sm", false, "hover:text-danger-fg")}" aria-label="Se déconnecter" title="Se déconnecter">${icon("logout")}</button>
      </div>
    </div></div>`;
}

function shellTopbar(area) {
  const u = userById(state.session), notifs = myNotifs(), unread = notifs.filter((n) => n.unread).length;
  const ctx = area === "clipper"
    ? searchInput("global-q", "", "Rechercher une campagne…", "Recherche rapide", "hidden w-full max-w-xs md:block")
    : `<p class="hidden min-w-0 truncate text-small text-fg-muted lg:block">${area === "admin" ? "Administration" : `Agence · ${esc(u.name)}`}</p>`;
  return `<header class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
    <div class="flex items-center gap-2 lg:hidden">${logo({ size: "sm" })}${roleBadge(area)}</div>
    ${ctx}
    <div class="relative ml-auto flex items-center gap-1">
      <span class="hidden sm:contents">${themeToggle()}</span>
      <button type="button" data-action="notif" aria-expanded="${state.notifOpen}" aria-haspopup="dialog" aria-label="Notifications${unread ? ` (${unread} non lues)` : ""}" class="${iconBtn("md", false, "relative")}">${icon("bell")}${unread ? `<span class="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand ring-2 ring-canvas" aria-hidden="true"></span>` : ""}</button>
      ${state.notifOpen ? notifPanel(notifs) : ""}
      <a href="#/${area}/${AREAS[area].profile}" class="flex items-center gap-2 rounded-lg p-1 transition-colors duration-150 hover:bg-muted sm:pr-2 ${FOCUS}" aria-label="Mon compte">${avatar(u, "sm")}
        <span class="hidden text-left sm:block"><span class="block text-small font-medium leading-tight text-fg">${esc(u.name)}</span><span class="block text-xs text-fg-subtle">${area === "admin" ? "Administrateur" : area === "agence" ? "Agence" : esc(u.level)}</span></span></a>
    </div></header>`;
}

function notifPanel(list) {
  const anyUnread = list.some((n) => n.unread);
  return `<div class="absolute right-0 top-12 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-line bg-surface-raised shadow-popover animate-pop-in" role="dialog" aria-label="Notifications">
    <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3"><p class="text-sm font-semibold text-fg">Notifications</p>${anyUnread ? `<button type="button" data-action="read-all" class="${btn("link", "", "text-small")}">Tout marquer comme lu</button>` : ""}</div>
    ${list.length ? `<div class="max-h-96 divide-y divide-line overflow-y-auto">${list.map((n) => `<button type="button" data-action="read-one" data-id="${n.id}" class="relative flex w-full gap-3 px-4 py-3 pr-9 text-left transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${n.unread ? "bg-brand-soft/50" : ""}">
      ${eventIcon(n.icon)}<span class="min-w-0 flex-1"><span class="block text-small leading-5 ${n.unread ? "font-medium text-fg" : "text-fg-muted"}">${esc(n.text)}</span><span class="mt-0.5 block text-xs text-fg-subtle">${ago(n.at)}</span></span>
      ${n.unread ? '<span class="absolute right-4 top-4 size-2 rounded-full bg-brand"></span><span class="sr-only">(non lue)</span>' : ""}</button>`).join("")}</div>`
      : emptyState("bell", "Aucune notification", "Vous serez prévenu ici quand un clip est validé ou un paiement envoyé.", "", { inCard: true })}
  </div>`;
}

function shellMobileNav(area) {
  const ids = AREAS[area].mobile, nav = AREAS[area].nav(), inMore = !ids.includes(state.route.view);
  const TABI = "relative flex flex-col items-center justify-center gap-1 text-micro font-medium text-fg-subtle transition-colors [&_svg]:size-5 before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full aria-[current=page]:text-brand-fg aria-[current=page]:before:bg-brand";
  return `<nav class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Navigation mobile">
    <div class="grid h-16 grid-cols-5">
      ${ids.map((id) => { const n = nav.find((x) => x.id === id); return `<a href="#/${area}/${id}" ${state.route.view === id ? 'aria-current="page"' : ""} class="${TABI} ${FOCUS}">${icon(n.icon)}${n.short || n.label}</a>`; }).join("")}
      <button type="button" data-action="drawer" aria-expanded="${state.drawer}" ${inMore ? 'aria-current="page"' : ""} class="${TABI} ${FOCUS}">${icon("more")}Plus</button>
    </div></nav>`;
}

function shell(area) {
  const view = AREAS[area].views()[state.route.view]();
  return `<button type="button" data-action="skip" class="fixed left-4 top-3 z-[70] -translate-y-24 rounded-control bg-surface-raised px-4 py-2 text-sm font-medium text-fg shadow-popover transition-transform duration-150 focus:translate-y-0">Aller au contenu</button>
    ${siteBanner()}
    <div class="flex min-h-dvh bg-canvas">
      <aside class="sticky top-0 hidden h-dvh w-60 shrink-0 overflow-y-auto border-r border-line bg-canvas px-3 py-4 lg:block">${shellSidebar(area)}</aside>
      <div class="min-w-0 flex-1">
        ${shellTopbar(area)}
        <main id="main" tabindex="-1" class="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-6 outline-hidden sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">${view}</main>
      </div>
    </div>
    ${shellMobileNav(area)}
    ${state.drawer ? `<div class="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="absolute inset-0 bg-overlay animate-fade-in" data-action="drawer"></div>
      <aside class="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col overflow-y-auto bg-canvas px-3 py-4 shadow-modal animate-drawer-in">
        ${shellSidebar(area, `${themeToggle()}<button type="button" data-action="drawer" class="${iconBtn("md")}" aria-label="Fermer le menu" autofocus>${icon("close")}</button>`)}</aside></div>` : ""}
    ${AREAS[area].modal()}`;
}

// ---------- Focus des modales et du tiroir, récapitulatifs en direct ----------
let focusReturn = null; // sélecteur de l'élément qui a ouvert la modale ou le tiroir

// Appelé par render() : focus dans la modale ou le tiroir à l'ouverture, retour à l'élément d'origine à la fermeture.
function placeOverlayFocus(hadOverlay, active) {
  const dlg = root.querySelector('[aria-modal="true"]');
  if (dlg && !hadOverlay) {
    const d = active && active.dataset ? active.dataset : {};
    focusReturn = d.action ? `[data-action="${d.action}"]${d.id ? `[data-id="${d.id}"]` : ""}` : null;
    const target = dlg.querySelector("[autofocus]") || (dlg.hasAttribute("tabindex") ? dlg : dlg.querySelector("button, a[href], input, select, textarea"));
    if (target) target.focus();
  } else if (!dlg && hadOverlay && focusReturn) {
    const el = root.querySelector(focusReturn);
    if (el) el.focus();
    focusReturn = null;
  }
}

// Tabulation bouclée dans la modale ou le tiroir ouvert.
function focusTrap(e) {
  if (e.key !== "Tab") return;
  const dlg = root.querySelector('[aria-modal="true"]');
  if (!dlg) return;
  const f = [...dlg.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])')].filter((el) => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === dlg)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
document.addEventListener("keydown", focusTrap);

// Récapitulatif en direct : LIVE[nom] renvoie une chaîne (pour [data-live-out=""]) ou un objet { clé: html } (pour [data-live-out="clé"]).
function runLive(form) {
  const fn = form && LIVE[form.dataset.live];
  if (!fn) return;
  const out = fn(Object.fromEntries(new FormData(form)));
  const parts = typeof out === "string" ? { "": out } : out;
  form.querySelectorAll("[data-live-out]").forEach((el) => { const k = el.dataset.liveOut; if (k in parts) el.innerHTML = parts[k]; });
}

// ---------- Rendu ----------

function render() {
  const area = state.route.area;
  if (area === "home") return;
  if (offlineLanding) offlineLanding.hide();

  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.input : null;
  const caret = focusKey && "selectionStart" in active ? active.selectionStart : null;
  const hadOverlay = !!root.querySelector('[aria-modal="true"]');

  let html;
  if (area === "auth") html = { connexion: viewConnexion, inscription: viewInscription, "mot-de-passe": viewMotDePasse }[state.route.view]();
  else html = shell(area);
  // Les messages affichés juste avant un changement de page (connexion, clip envoyé…) restent visibles.
  const toasts = document.getElementById("toasts");
  root.innerHTML = `${html}<div id="toasts" aria-live="polite" class="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"></div>`;
  if (toasts) root.querySelector("#toasts").replaceWith(toasts);
  document.title = area === "auth" ? `${{ connexion: "Connexion", inscription: "Inscription", "mot-de-passe": "Mot de passe oublié" }[state.route.view]} — ClipBoost` : `${AREAS[area].title} — ClipBoost`;

  if (focusKey) {
    const el = root.querySelector(`[data-input="${focusKey}"]`);
    if (el) { el.focus(); if (caret !== null) try { el.setSelectionRange(caret, caret); } catch (e) {} }
  }
  // Modale ou tiroir : focus envoyé dedans à l'ouverture, rendu à l'élément d'origine à la fermeture.
  if (!focusKey) placeOverlayFocus(hadOverlay, active);
}

// ---------- Événements ----------

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
    case "read-all": return act("POST", "/api/notifications/read", {});
    case "read-one": return act("POST", "/api/notifications/read", { ids: [t.dataset.id] });
    case "close-modal": state.modal = null; return render();
    case "logout": return logout();
    case "toast": return toast(t.dataset.msg);
    case "toggle-pwd": state.auth.showPwd = !state.auth.showPwd; return render();
    case "signup-back": state.auth.step = "form"; state.auth.error = ""; return render();
    case "signup-role": captureSignupForm(); state.auth.form.role = t.dataset.value; state.auth.fieldErrors = {}; return render();
    case "resend-code": return resendCode();
    case "auth-copy": return copy(t.dataset.value, "Adresse copiée");
    case "skip": { const m = root.querySelector("#main"); if (m) m.focus(); return; }
  }
  if (state.route.area === "admin") handleAdminAction(action, t);
  else if (state.route.area === "agence") handleAgencyAction(action, t);
  else if (state.route.area === "clipper") handleClipperAction(action, t);
});

root.addEventListener("input", (e) => {
  if (e.target.form && e.target.form.dataset.live) runLive(e.target.form);
  const k = e.target.dataset.input;
  if (k === "camp-q") { state.camp.q = e.target.value; render(); }
  if (k === "adm-user-q") { state.adm.userQ = e.target.value; render(); }
  if (k === "adm-camp-q") { state.adm.campQ = e.target.value; render(); }
  if (k === "ag-q") { state.ag.q = e.target.value; render(); }
  if (e.target.hasAttribute("data-strength")) {
    const meter = root.querySelector("[data-strength-meter]");
    if (meter) meter.innerHTML = strengthMeter(e.target.value);
  }
});

root.addEventListener("change", (e) => {
  if (e.target.form && e.target.form.dataset.live) runLive(e.target.form);
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
  if (["login", "signup", "verify", "forgot", "reset"].includes(form)) return handleAuthSubmit(form, data);
  if (form === "password") return handlePasswordSubmit(data);
  if (form.startsWith("adm-")) return handleAdminSubmit(form, data);
  if (form.startsWith("ag-")) return handleAgencySubmit(form, data);
  handleClipperSubmit(form, data);
});

window.addEventListener("hashchange", onRoute);

// Démarrage : on récupère la session éventuelle avant d'afficher la première page.
refresh()
  .then(onRoute)
  .catch((e) => {
    root.innerHTML = `<div class="grid min-h-dvh place-items-center bg-canvas p-6">${emptyState("alert", esc(e.message), "Vérifiez votre connexion puis réessayez.", `<button type="button" onclick="location.reload()" class="${btn("primary")}">Réessayer</button>`)}</div>`;
  });
