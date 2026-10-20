// Routeur, coquilles (navigation) et gestion des événements de l'application (/espace).
// Routes : #/connexion, #/inscription, #/inscription-agence, #/mot-de-passe, #/clipper/<page>, #/agence/<page>, #/admin/<page>.
// Un 3e segment désigne un élément de la page (lien d'une notification) : #/clipper/publications/<id>, voir applyRouteItem().
// Exception : les pages de ITEM_PAGES, dont le 3e segment fait partie de l'adresse (#/clipper/agence/<clé>, la conversation
// ouverte de Messages #/clipper/messages/<campagne>, #/agence/messages/<campagne>~<clipper>, voir onRoute()).
// Anciennes adresses (ROUTE_ALIASES, encore présentes dans des notifications et des favoris) : #/clipper/campagnes[/<id>]
// mène à Découvrir, #/clipper/statistiques à l'Accueil (qui réunit l'aperçu et les statistiques) ; l'adresse est corrigée.
// La page d'accueil publique est servie par Next.js à l'adresse / ; dans la version autonome (fichier HTML unique),
// elle est dans la même page et s'affiche sans route (voir web/offline/landing.js).

const state = {
  route: { area: "auth", view: "connexion" },
  session: null,
  drawer: false,
  notifOpen: false,
  // Menu du compte (avatar de la barre du haut) : exclusif avec le panneau des notifications.
  menuOpen: false,
  // Modale ouverte : { type, id?, …, draft?, back? }. draft : saisie en cours (captureDraft) ; back : modale qui
  // reprend sa place quand on ferme celle-ci (openStacked). Voir « Modales : brouillons, champs conditionnels, empilement ».
  modal: null,
  // Clipper : Découvrir (q, category, sort, layout ; scope = « Toutes » | « Rejointes » | « Favoris ») et Agences (aq).
  camp: { aq: "", q: "", category: "Toutes", sort: "recent", scope: "Toutes", layout: "grid" },
  pub: { status: "Toutes" },
  tx: { type: "tous" },
  period: 30,
  // Accueil du clipper : graphique par jour ou cumulé, tableau des clips récents ou les plus vus.
  clChart: "jour",
  clClips: "recent",
  adm: { userQ: "", userStatus: "Tous", userRole: "Tous les rôles", campQ: "", campStatus: "Toutes", modStatus: "En attente", modSort: "recent", payTab: "retraits", msgFilter: "all" },
  ag: { q: "", status: "Toutes", clipStatus: "Toutes", msgFilter: "all" },
  pwdError: "",
  auth: null,
};
resetAuth();

const root = document.getElementById("app");
const offlineLanding = window.__CLIPBOOST_LANDING__;

const ROUTE_ALIASES = { "clipper/campagnes": "decouvrir", "clipper/statistiques": "accueil" };

// { area, view, item?, rewrite? } ; rewrite : l'adresse n'est pas celle de la page affichée (ancienne adresse, page
// inconnue) et onRoute() la remplace par #/<espace>/<page>.
function parseRoute() {
  const h = location.hash;
  if (!h.startsWith("#/") || h === "#/") return { area: "home", view: "" };
  const [area, rawView, raw] = h.slice(2).split("/");
  if (area === "connexion" || area === "inscription" || area === "mot-de-passe") return { area: "auth", view: area };
  if (area === "inscription-agence") return { area: "auth", view: "inscription", role: "agence" };
  const views = { agence: [AGENCY_VIEWS, "apercu"], clipper: [CLIPPER_VIEWS, "accueil"], admin: [ADMIN_VIEWS, "apercu"] }[area];
  if (!views) return { area: "home", view: "" };
  const alias = ROUTE_ALIASES[`${area}/${rawView}`], view = alias || rawView;
  // Propriété propre seulement : #/clipper/constructor n'est pas une page.
  if (!view || !Object.prototype.hasOwnProperty.call(views[0], view)) return { area, view: views[1], rewrite: true };
  let item = "";
  // « ?… » après l'élément : paramètres qu'un site extérieur ajoute à l'adresse de retour (page de paiement), ignorés.
  try { item = raw ? decodeURIComponent(raw.split("?")[0]) : ""; } catch (e) {}
  const r = { area, view };
  if (item) r.item = item;
  if (alias) r.rewrite = true;
  return r;
}

// Pages dont le 3e segment est l'objet de la page (gardé dans l'adresse, rechargement possible) : la valeur est l'entrée
// de navigation affichée comme courante. Messages : la conversation ouverte.
const ITEM_PAGES = { "clipper/agence": "agences", "admin/utilisateur": "utilisateurs", "agence/paiement": "budget", "clipper/messages": "messages", "agence/messages": "messages", "admin/messages": "messages" };
const navView = (area, view) => ITEM_PAGES[`${area}/${view}`] || view;

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function onRoute() {
  const r = parseRoute(), prev = state.route, u = state.session ? me() : null;
  // Tout changement de page referme le tiroir, les panneaux de la barre du haut et la modale.
  state.drawer = false; state.notifOpen = false; state.menuOpen = false; state.modal = null;
  if (r.area === "home" && offlineLanding) { state.route = r; return offlineLanding.show(); }
  // Sans route précise : l'espace de l'utilisateur connecté, sinon la connexion.
  if (r.area === "home") return navigate(u ? homeOf(u) : "#/connexion");
  // Protection des espaces : il faut être connecté avec le bon rôle.
  if (["clipper", "agence", "admin"].includes(r.area) && (!u || u.role !== r.area)) return navigate(u ? homeOf(u) : "#/connexion");
  if (r.area === "auth" && u) return navigate(homeOf(u));
  if (r.area === "auth" && (prev.view !== r.view || r.role)) { const keepEmail = state.auth.email; resetAuth(); state.auth.email = keepEmail; }
  if (r.role) { state.auth.form.role = r.role; r.role = undefined; }
  const page = !!ITEM_PAGES[`${r.area}/${r.view}`], item = page ? "" : r.item;
  state.route = page ? { area: r.area, view: r.view, item: r.item || "" } : { area: r.area, view: r.view }; state.pwdError = "";
  const row = item ? applyRouteItem(r.area, r.view, item) : "";
  render();
  window.scrollTo(0, 0);
  // L'élément n'est appliqué qu'une fois et une ancienne adresse prend sa nouvelle forme : l'adresse redevient celle de
  // la page (un rechargement ne rouvre pas l'élément, l'historique ne garde pas l'ancienne adresse).
  if (item || r.rewrite) try { history.replaceState(history.state, "", `#/${r.area}/${r.view}`); } catch (e) {}
  if (row) flashRow(row);
}

// Élément visé par l'adresse (lien d'une notification) : filtres remis à zéro pour qu'il soit affiché, puis
// fiche ouverte (campagne, clip) ou identifiant de la ligne à mettre en évidence (data-row). Élément disparu : la page seule.
function applyRouteItem(area, view, id) {
  if (area === "clipper") {
    Object.assign(state.camp, { q: "", category: "Toutes", scope: "Toutes" });
    state.pub.status = "Toutes"; state.tx.type = "tous";
    if (view === "decouvrir") { if (campaignById(id)) state.modal = { type: "campaign", id }; return ""; }
  } else if (area === "agence") {
    Object.assign(state.ag, { q: "", status: "Toutes", clipStatus: "Toutes" });
    if (view === "campagnes") { if (myCampaigns().some((c) => c.id === id)) state.modal = { type: "ag-open", id }; return ""; }
    // Retour de la page de paiement de Chargily : la recharge en évidence, son état relu jusqu'à la confirmation.
    if (view === "budget") agWatchPayment(id);
  } else if (area === "admin") {
    state.adm.campQ = ""; state.adm.campStatus = "Toutes";
    // Campagne à examiner : sa fiche d'examen, la liste derrière montre toutes les campagnes.
    if (view === "campagnes") { if (campaignById(id)) state.modal = { type: "adm-camp", id }; return ""; }
    // Clip à examiner : sa fiche, la liste derrière filtrée sur son statut (« En attente » pour un nouveau clip).
    if (view === "moderation") {
      // Recours (lien de la notification d'un nouveau recours) : sa fiche, la liste derrière sur l'onglet « Recours ».
      if ((db.appeals || []).some((a) => a.id === id)) { state.adm.modStatus = "Recours"; state.modal = { type: "adm-appeal", id }; return ""; }
      const p = db.publications.find((x) => x.id === id);
      state.adm.modStatus = p && ["En attente", "Validée", "Refusée"].includes(p.status) ? p.status : "Toutes";
      if (p) state.modal = { type: "adm-clip", id };
      return "";
    }
    const tx = db.transactions.find((x) => x.id === id);
    if (view === "retraits" && tx) state.adm.payTab = tx.type === "recharge" ? "recharges" : "retraits";
  }
  return id;
}

// Ligne ou carte visée : sa copie affichée (tableau ou liste) défile au centre, reçoit le focus et s'éclaire brièvement.
function flashRow(id) {
  const el = visibleAll(`[data-row="${String(id).replace(/["\\]/g, "\\$&")}"]`)[0];
  if (!el) return;
  el.setAttribute("tabindex", "-1");
  el.classList.add("row-flash");
  el.scrollIntoView({ block: "center" });
  el.focus({ preventScroll: true });
  setTimeout(() => el.classList.remove("row-flash"), 2400);
}

// ---------- Coquille commune aux espaces Clipper, Agence et Admin ----------

// AREAS : navigation mobile = 4 onglets + « Plus » (qui ouvre le tiroir) ; libellés courts via n.short.
// title et libellés de navigation (n.label, n.short) : textes français, traduits à l'affichage par t().
// profile : page « Mon profil » (admin : « Mon compte ») du menu du compte.
const AREAS = {
  clipper: { nav: () => CLIPPER_NAV, views: () => CLIPPER_VIEWS, title: "Espace Clipper", mobile: ["accueil", "decouvrir", "publications", "portefeuille"], profile: "profil", modal: () => clipperModal() },
  agence: { nav: () => AGENCY_NAV, views: () => AGENCY_VIEWS, title: "Espace Agence", mobile: ["apercu", "campagnes", "clips", "budget"], profile: "profil", modal: () => agencyModal() },
  admin: { nav: () => ADMIN_NAV, views: () => ADMIN_VIEWS, title: "Administration", mobile: ["apercu", "utilisateurs", "campagnes", "moderation"], profile: "compte", modal: () => adminModal() },
};

const NAV_ITEM = `group flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-fg-muted transition-colors duration-150 hover:bg-muted hover:text-fg aria-[current=page]:bg-surface aria-[current=page]:text-fg aria-[current=page]:shadow-control aria-[current=page]:ring-1 aria-[current=page]:ring-line ${FOCUS}`;
const NAV_ICON = "size-[18px] shrink-0 text-fg-subtle transition-colors group-hover:text-fg-muted group-aria-[current=page]:text-brand-fg";
// Mini-crédit de l'agence dans la barre latérale : masqué là où le même chiffre est déjà le sujet de la page.
const MINI_HIDDEN = { agence: ["apercu", "budget"] };

// Pastille d'une entrée de navigation : files d'attente de l'admin, messages non lus (Messages, dans chaque espace).
const navCount = (area, id) => (id === "messages" ? msgUnread() : area === "admin" ? adminBadge(id) : 0);

// Barre latérale (≥ lg) et tiroir mobile : trois blocs posés dans un conteneur flex-col de hauteur fixe
// (h-dvh / plein écran) qui défile seulement si l'écran est trop bas pour eux :
//   logo (+ tools : bouton Fermer du tiroir) ; navigation, seule partie qui défile ; bloc du bas toujours visible
//   (agence : crédit et « Nouvelle campagne » ; site public ; compte avec nom et email entiers, renvoyés à la ligne).
// -mx-3 px-3 : la zone qui défile couvre le padding du conteneur, l'anneau de focus des liens n'est pas rogné.
function shellSidebar(area, tools = "") {
  const nav = AREAS[area].nav(), u = userById(state.session), view = navView(area, state.route.view);
  const mini = area === "agence" && !MINI_HIDDEN.agence.includes(view)
    ? `<a href="#/agence/budget" class="block rounded-tile border border-line bg-surface px-3 py-2.5 shadow-card transition-colors duration-150 hover:border-line-strong ${FOCUS}">
        <span class="block text-xs text-fg-subtle">${t("Crédit disponible")}</span>
        <span class="mt-0.5 block text-[15px] font-semibold">${money(u.credit)}</span></a>`
    : "";
  const cta = area === "agence" ? `<button type="button" data-action="ag-new" class="${btn("primary", "md", "w-full")}">${icon("plus")}${t("Nouvelle campagne")}</button>` : "";
  return `<div class="flex h-10 shrink-0 items-center gap-2 px-2">${logo({ size: "sm" })}${roleBadge(area)}${tools ? `<div class="-me-1 ms-auto flex items-center gap-0.5">${tools}</div>` : ""}</div>
    <div class="-mx-3 mt-6 min-h-32 flex-1 overflow-y-auto px-3 pb-2">
      <p class="px-2.5 text-micro font-medium uppercase tracking-[0.08em] text-fg-subtle">${t(AREAS[area].title)}</p>
      <nav class="mt-2 grid gap-0.5" aria-label="${esc(t("Navigation principale"))}">${nav.map((n) => {
        const on = view === n.id, count = navCount(area, n.id);
        return `<a href="#/${area}/${n.id}" ${on ? 'aria-current="page"' : ""} class="${NAV_ITEM}">${icon(n.icon, NAV_ICON)}<span class="min-w-0 flex-1 truncate">${t(n.label)}</span>${count ? `${countBadge(count, n.id === "messages" ? "unread" : "queue")}${n.id === "messages" ? `<span class="sr-only">${esc(t("(non lue)"))}</span>` : ""}` : ""}</a>`;
      }).join("")}</nav>
    </div>
    <div class="grid shrink-0 gap-3 pt-4">
      ${mini}${cta}
      <a href="/" class="${btn("ghost", "sm", "w-full justify-start")}">${icon("globe")}${t("Voir le site public")}</a>
      <div class="flex items-center gap-2.5 rounded-lg p-1.5">${avatar(u, "sm")}
        <div class="min-w-0 flex-1"><p class="break-words text-small font-medium leading-5 text-fg">${nameWithBadge(u, "size-3.5")}</p><p class="break-all text-xs text-fg-subtle"><span dir="ltr">${esc(u.email)}</span></p></div>
        <button type="button" data-action="logout" class="${iconBtn("sm", false, "hover:text-danger-fg")}" aria-label="${esc(t("Se déconnecter"))}" title="${esc(t("Se déconnecter"))}">${icon("logout")}</button>
      </div>
    </div>`;
}

// Barre du haut : (< lg) logo ; contexte (recherche rapide du clipper, nom de l'agence, « Administration ») ;
// à droite, la cloche des notifications et l'avatar (photo ou 2 initiales) qui ouvre le menu du compte.
// Un panneau ouvert fait passer la barre au-dessus de la navigation mobile (z-40).
function shellTopbar(area) {
  const u = userById(state.session), notifs = myNotifs(), unread = notifs.filter((n) => n.unread).length;
  // Recherche rapide du clipper : absente de Découvrir, qui a sa propre recherche (un seul champ à l'écran).
  const ctx = area === "clipper"
    ? (state.route.view === "decouvrir" ? "" : searchInput("global-q", "", t("Rechercher une campagne…"), t("Recherche rapide"), "hidden w-full max-w-xs md:block"))
    : `<p class="hidden min-w-0 truncate text-small text-fg-muted lg:block">${area === "admin" ? t("Administration") : t("Agence · {name}", { name: nameWithBadge(u, "size-3.5") })}</p>`;
  return `<header class="sticky top-0 ${state.notifOpen || state.menuOpen ? "z-40" : "z-30"} flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
    <div class="flex items-center gap-2 lg:hidden">${logo({ size: "sm" })}${roleBadge(area)}</div>
    ${ctx}
    <div class="relative ms-auto flex items-center gap-1">
      <button type="button" data-action="notif" aria-expanded="${state.notifOpen}" aria-haspopup="dialog" aria-controls="notif-panel" aria-label="${esc(unread ? t("Notifications ({count})", { count: plural(unread, "non lue", "non lues") }) : t("Notifications"))}" class="${iconBtn("md", false, "relative")}">${icon("bell")}${unread ? `<span class="absolute end-1.5 top-1.5 size-2 rounded-full bg-brand ring-2 ring-canvas" aria-hidden="true"></span>` : ""}</button>
      ${state.notifOpen ? notifPanel(notifs) : ""}
      <button type="button" data-action="account-menu" aria-expanded="${state.menuOpen}" aria-haspopup="dialog" aria-controls="account-menu" aria-label="${esc(t("Mon compte"))}" title="${esc(u.name)}" class="grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-150 hover:bg-muted aria-expanded:bg-muted ${FOCUS}">${avatar(u, "sm")}</button>
      ${state.menuOpen ? accountMenu(area, u) : ""}
    </div></header>`;
}

// ---------- Menu du compte (clic sur l'avatar) ----------
// En-tête (avatar, nom entier avec badge vérifié, email, rôle) ; Mon profil / Mon compte ; Paramètres / Réglages du site ;
// langue (FR / EN / ع) ; Mentions légales et Aide et support (pages à venir : « Bientôt disponible ») ; déconnexion ;
// en pied, le thème (clair, sombre, système). Panneau non modal comme les notifications (même ouverture, fermeture et
// focus) : clic à l'extérieur, Échap ou changement de page le referment ; langue et thème le laissent ouvert.
const MENU_ROW = `group flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-start text-sm font-medium transition-colors duration-150 [&_svg]:size-[18px] [&_svg]:shrink-0 ${FOCUS_INSET}`;
const MENU_ITEM = `${MENU_ROW} text-fg-muted hover:bg-muted hover:text-fg aria-[current=page]:text-fg`;
const MENU_ICON = "text-fg-subtle transition-colors group-hover:text-fg-muted";

function accountMenu(area, u) {
  // Niveau du clipper (valeur du serveur : « Nouveau », « Clipper Bronze »…) traduit à l'affichage.
  const role = area === "admin" ? badge(esc(t("Administrateur")), "brand", { ic: "shield" })
    : area === "agence" ? badge(esc(t("Agence")), "info", { ic: "building" })
    : badge(esc(!u.level ? t("Clipper") : /clipper/i.test(u.level) ? t(u.level) : t("Clipper · {level}", { level: t(u.level) })), "brand", { ic: "medal" });
  const here = navView(area, state.route.view), views = AREAS[area].views();
  // Seules les pages qui existent dans l'espace (un lien vers une page absente ramènerait à l'accueil de l'espace).
  const links = [[AREAS[area].profile, "user", area === "admin" ? t("Mon compte") : t("Mon profil")], ["parametres", "gear", area === "admin" ? t("Réglages du site") : t("Paramètres")]]
    .filter(([view]) => Object.prototype.hasOwnProperty.call(views, view))
    .map(([view, ic, label]) => `<a href="#/${area}/${view}" ${here === view ? 'aria-current="page"' : ""} class="${MENU_ITEM}">${icon(ic, MENU_ICON)}${label}</a>`).join("");
  return `<div id="account-menu" tabindex="-1" role="dialog" aria-label="${esc(t("Mon compte"))}" class="absolute end-0 top-12 z-40 flex max-h-[calc(100dvh-8.5rem)] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-card border border-line bg-surface-raised shadow-popover animate-pop-in focus:outline-none lg:max-h-[calc(100dvh-4.5rem)]">
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="flex items-start gap-3 border-b border-line px-4 py-4">${avatar(u, "md")}
        <div class="min-w-0 flex-1">
          <p class="break-words text-sm font-semibold leading-5 text-fg">${nameWithBadge(u)}</p>
          <p class="mt-0.5 break-all text-xs text-fg-subtle"><span dir="ltr">${esc(u.email)}</span></p>
          <p class="mt-2 flex">${role}</p>
        </div>
      </div>
      ${links ? `<div class="grid gap-0.5 border-b border-line p-1.5">${links}</div>` : ""}
      <div class="flex items-center justify-between gap-3 py-2 pe-1.5 ps-4">
        <span class="flex min-w-0 items-center gap-3 text-sm font-medium text-fg-muted">${icon("globe", "size-[18px] shrink-0 text-fg-subtle")}${t("Langue")}</span>
        ${langSwitch({ cls: "w-[8.75rem] shrink-0" })}
      </div>
      <div class="grid gap-0.5 border-t border-line p-1.5">
        <button type="button" data-action="soon" data-value="mentions" class="${MENU_ITEM}">${icon("fileText", MENU_ICON)}${t("Mentions légales")}</button>
        <button type="button" data-action="soon" data-value="aide" class="${MENU_ITEM}">${icon("help", MENU_ICON)}${t("Aide et support")}</button>
      </div>
      <div class="border-t border-line p-1.5"><button type="button" data-action="logout" class="${MENU_ROW} text-danger-fg hover:bg-danger-bg">${icon("logout")}${t("Se déconnecter")}</button></div>
    </div>
    <div class="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-subtle py-2 pe-1.5 ps-4">
      <span class="text-small font-medium text-fg-muted">${t("Thème")}</span>
      ${themeModeSwitch({ cls: "w-[8.75rem] shrink-0" })}
    </div>
  </div>`;
}

// ---------- Panneau des notifications ----------

// Destination d'une notification (libellé visible et nom accessible), selon la page de son lien ; traduite à l'affichage.
const NOTIF_DEST = {
  "clipper/decouvrir": "Voir la campagne", "clipper/campagnes": "Voir la campagne", "clipper/publications": "Voir le clip",
  "clipper/portefeuille": "Voir l'opération", "clipper/accueil": "Ouvrir mon espace",
  "agence/campagnes": "Voir la campagne", "agence/budget": "Voir le budget", "agence/apercu": "Ouvrir mon espace", "agence/profil": "Voir le profil",
  "admin/campagnes": "Voir la campagne", "admin/moderation": "Voir le clip", "admin/retraits": "Voir la demande",
  "admin/utilisateur": "Voir le profil", "admin/apercu": "Ouvrir mon espace",
  "clipper/messages": "Voir la conversation", "agence/messages": "Voir la conversation", "admin/messages": "Voir la conversation",
};
// Lien vers un recours (#/admin/moderation/<id du recours>) : « Voir le recours ».
const notifDest = (href) => {
  const [area, view, item] = String(href || "").replace(/^#\//, "").split("/");
  if (area === "admin" && view === "moderation" && item && (db.appeals || []).some((a) => a.id === decodeURIComponent(item))) return t("Voir le recours");
  return t(NOTIF_DEST[`${area}/${view}`] || "Ouvrir");
};

// État vide propre à chaque rôle.
const NOTIF_EMPTY = {
  clipper: "Vous serez prévenu ici quand un clip est validé ou un paiement envoyé.",
  agence: "Vous serez prévenu ici quand une campagne est approuvée, terminée ou une recharge confirmée.",
  admin: "Les nouvelles campagnes, demandes de retrait et recharges à traiter s'afficheront ici.",
};
function notifPanel(list) {
  const anyUnread = list.some((n) => n.unread);
  return `<div id="notif-panel" tabindex="-1" class="absolute end-0 top-12 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-line bg-surface-raised shadow-popover animate-pop-in focus:outline-none" role="dialog" aria-label="${esc(t("Notifications"))}">
    <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3"><p class="text-sm font-semibold text-fg">${t("Notifications")}</p>${anyUnread ? `<button type="button" data-action="read-all" class="${btn("link", "", "text-small")}">${t("Tout marquer comme lu")}</button>` : ""}</div>
    ${list.length ? `<div class="max-h-[min(24rem,calc(100dvh-12rem))] divide-y divide-line overflow-y-auto">${list.map((n) => `<button type="button" data-action="read-one" data-id="${n.id}" class="group relative flex w-full gap-3 px-4 py-3 pe-9 text-start transition-colors duration-150 hover:bg-subtle ${FOCUS_INSET} ${n.unread ? "bg-brand-soft/50" : ""}">
      ${eventIcon(n.icon)}<span class="min-w-0 flex-1"><span class="block text-small leading-5 ${n.unread ? "font-medium text-fg" : "text-fg-muted"}">${esc(tServer(n.text))}</span>
        <span class="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-subtle"><span>${ago(n.at)}</span>${n.link ? `<span aria-hidden="true">·</span><span class="inline-flex items-center gap-0.5 font-medium text-fg-muted transition-colors duration-150 group-hover:text-brand-fg">${notifDest(n.link)}${icon("chevronRight", "size-3.5 rtl:-scale-x-100")}</span>` : ""}</span></span>
      ${n.unread ? '<span class="absolute end-4 top-4 size-2 rounded-full bg-brand"></span><span class="sr-only">${t("(non lue)")}</span>' : ""}</button>`).join("")}</div>`
      : emptyState("bell", t("Aucune notification"), t(NOTIF_EMPTY[state.route.area] || NOTIF_EMPTY.clipper), "", { inCard: true })}
  </div>`;
}

function shellMobileNav(area) {
  const ids = AREAS[area].mobile, nav = AREAS[area].nav(), view = navView(area, state.route.view), inMore = !ids.includes(view);
  const TABI = "relative flex flex-col items-center justify-center gap-1 text-micro font-medium text-fg-subtle transition-colors [&_svg]:size-5 before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full aria-[current=page]:text-brand-fg aria-[current=page]:before:bg-brand";
  const tabs = ids.map((id) => nav.find((x) => x.id === id)).filter(Boolean);
  // Messages non lus dans une page du tiroir (« Plus ») : point sur l'onglet.
  const moreUnread = !ids.includes("messages") && nav.some((n) => n.id === "messages") && msgUnread() > 0;
  return `<nav class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="${esc(t("Navigation mobile"))}">
    <div class="grid h-16 grid-cols-5">
      ${tabs.map((n) => `<a href="#/${area}/${n.id}" ${view === n.id ? 'aria-current="page"' : ""} class="${TABI} ${FOCUS}">${icon(n.icon)}${t(n.short || n.label)}</a>`).join("")}
      <button type="button" data-action="drawer" aria-expanded="${state.drawer}" ${inMore ? 'aria-current="page"' : ""} class="${TABI} ${FOCUS}"><span class="relative">${icon("more")}${moreUnread ? `<span class="absolute -end-1 -top-0.5 size-2 rounded-full bg-brand ring-2 ring-surface" aria-hidden="true"></span>` : ""}</span>${t("Plus")}${moreUnread ? `<span class="sr-only">${esc(t("Messages non lus"))}</span>` : ""}</button>
    </div></nav>`;
}

// Les bandeaux du site (maintenance, annonce) sont dans la colonne du contenu : la barre latérale garde toute la
// hauteur de l'écran (son bloc du bas reste visible) et la barre du haut se colle en haut une fois le bandeau passé.
function shell(area) {
  const view = AREAS[area].views()[state.route.view]();
  return `<button type="button" data-action="skip" class="fixed start-4 top-3 z-[70] -translate-y-24 rounded-control bg-surface-raised px-4 py-2 text-sm font-medium text-fg shadow-popover transition-transform duration-150 focus:translate-y-0">${t("Aller au contenu")}</button>
    <div class="flex min-h-dvh bg-canvas">
      <aside class="sticky top-0 hidden h-dvh w-[17rem] shrink-0 flex-col overflow-y-auto border-e border-line bg-canvas px-3 py-4 lg:flex">${shellSidebar(area)}</aside>
      <div class="min-w-0 flex-1">
        ${siteBanner()}
        ${shellTopbar(area)}
        <main id="main" tabindex="-1" class="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-6 outline-hidden sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">${view}</main>
      </div>
    </div>
    ${shellMobileNav(area)}
    ${state.drawer ? `<div class="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="${esc(t("Menu"))}">
      <div class="absolute inset-0 bg-overlay animate-fade-in" data-action="drawer"></div>
      <aside class="absolute inset-y-0 start-0 flex w-80 max-w-[85vw] flex-col overflow-y-auto bg-canvas px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-modal animate-drawer-in">
        ${shellSidebar(area, `<button type="button" data-action="drawer" class="${iconBtn("md")}" aria-label="${esc(t("Fermer le menu"))}" autofocus>${icon("close")}</button>`)}</aside></div>` : ""}
    ${AREAS[area].modal()}`;
}

// ---------- Focus des modales, du tiroir et des panneaux ----------
let focusReturn = null; // { key, index } : l'élément (visible) qui a ouvert la modale ou le tiroir

// Boîte de dialogue modale du dessus (modale, sinon tiroir) : la dernière dans l'ordre du document.
const topDialog = () => { const all = root.querySelectorAll('[aria-modal="true"]'); return all[all.length - 1] || null; };

// Sélecteur stable d'un bouton d'action (data-action + data-value + data-id) ou d'un bouton de langue
// (data-lang-set, qui réaffiche la page) : render() remplace tout le DOM.
function actionKey(el) {
  if (!el || !el.dataset || !root.contains(el)) return null;
  const q = (v) => String(v).replace(/["\\]/g, "\\$&"), d = el.dataset;
  if (!d.action) return d.langSet ? `[data-lang-set="${q(d.langSet)}"]` : null;
  return `[data-action="${q(d.action)}"]${d.value !== undefined ? `[data-value="${q(d.value)}"]` : ""}${d.id ? `[data-id="${q(d.id)}"]` : ""}`;
}
// Sélecteur stable d'un champ de formulaire (data-form + name, + value pour une case ou un bouton radio).
function fieldKey(el) {
  if (!el || !el.name || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || !root.contains(el)) return null;
  const form = el.closest("form[data-form]");
  if (!form) return null;
  const q = (v) => String(v).replace(/["\\]/g, "\\$&");
  return `[data-form="${q(form.dataset.form)}"] [name="${q(el.name)}"]${(el.type === "radio" || el.type === "checkbox") && el.hasAttribute("value") ? `[value="${q(el.value)}"]` : ""}`;
}
// Les tableaux existent en double (table ≥ md, liste < md) : seule la copie affichée compte.
const visibleAll = (sel) => { try { return [...root.querySelectorAll(sel)].filter((el) => el.getClientRects().length > 0); } catch (e) { return []; } };
const FIRST_FIELD = 'input:not([type="hidden"]):not([disabled]):not([data-image-input]), select:not([disabled]), textarea:not([disabled])';

// Appelé par render() quand une modale ou le tiroir s'ouvre ou se ferme : focus dedans à l'ouverture,
// retour à l'élément d'origine (sa copie visible) à la fermeture.
function placeOverlayFocus(hadOverlay, key, index) {
  const dlg = topDialog();
  if (dlg && !hadOverlay) {
    focusReturn = key ? { key, index: Math.max(0, index) } : null;
    const target = dlg.querySelector("[autofocus]") || (dlg.hasAttribute("tabindex") ? dlg : dlg.querySelector("button, a[href], input, select, textarea"));
    if (target) target.focus();
  } else if (!dlg && hadOverlay) {
    const list = focusReturn ? visibleAll(focusReturn.key) : [];
    const el = list[focusReturn ? Math.min(focusReturn.index, list.length - 1) : 0] || root.querySelector("#main");
    if (el) el.focus({ preventScroll: true });
    focusReturn = null;
  }
}

// Une modale en remplace une autre (Détails → Suspendre) : focus sur son champ [autofocus], sinon sur la boîte.
// Une modale qui revient après une modale empilée : focus sur le bouton qui avait ouvert celle-ci (returnFocus,
// posé par openStacked), sinon sur son premier champ.
function focusModal(dlg) {
  const m = state.modal, key = m && m.returnFocus;
  if (m && key) delete m.returnFocus;
  const opener = key ? [...dlg.querySelectorAll(key)].find((el) => el.getClientRects().length > 0) : null;
  const target = opener || (key ? dlg.querySelector(FIRST_FIELD) : null) || dlg.querySelector("[autofocus]") || dlg;
  target.focus();
}

// Tabulation bouclée dans la modale ou le tiroir ouvert.
function focusTrap(e) {
  if (e.key !== "Tab") return;
  const dlg = topDialog();
  if (!dlg) return;
  const f = [...dlg.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])')].filter((el) => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === dlg)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
document.addEventListener("keydown", focusTrap);

// Panneaux de la barre du haut : [id du panneau, bouton qui l'ouvre]. Focus sur leur première action à l'ouverture,
// retour au bouton à la fermeture.
const POPOVERS = [["notif-panel", '[data-action="notif"]'], ["account-menu", '[data-action="account-menu"]']];

// Récapitulatif en direct : LIVE[nom] renvoie une chaîne (pour [data-live-out=""]) ou un objet { clé: html } (pour [data-live-out="clé"]).
function runLive(form) {
  const fn = form && LIVE[form.dataset.live];
  if (!fn) return;
  const out = fn(Object.fromEntries(new FormData(form)));
  const parts = typeof out === "string" ? { "": out } : out;
  form.querySelectorAll("[data-live-out]").forEach((el) => { const k = el.dataset.liveOut; if (k in parts) el.innerHTML = parts[k]; });
}

// ---------- Modales : brouillons, champs conditionnels, empilement ----------
// Brouillon : chaque saisie (input, change) dans un formulaire de modale (form[data-form] dans [aria-modal="true"],
// ou qui l'est lui-même, cas de modalShell({ form })) est copiée dans state.modal.draft = { nom: valeur } :
//   case à cocher → booléen (plusieurs cases du même nom → tableau des valeurs cochées), bouton radio → valeur
//   choisie (null si aucune), <select multiple> → tableau, autres champs → .value. Ignorés : type=file,
//   type=password, tout ce qui est dans [data-nodraft] (champs de carte bancaire) et les champs cachés, sauf celui
//   d'un imageField (la photo choisie). Une clé dont le champ a disparu (champ conditionnel masqué) est gardée.
// Après chaque render() qui affiche la même modale (même objet, ou nouvel objet de même type et même id),
// restoreDraft() remet la saisie dans le formulaire (photo : setImageField, l'aperçu suit), puis relance runLive :
// un réaffichage (données rechargées, champ conditionnel, retour d'une modale empilée, erreur du serveur) ne perd
// jamais ce que la personne a tapé.
// Imposer une valeur (« Tout retirer », montant suggéré) : l'écrire dans le champ et déclencher un événement input
// (le brouillon suit). Repartir d'un formulaire vierge : state.modal = { type, id, draft: {} }.
let draftOwner = null;      // modale affichée au dernier rendu (sa saisie passe à une nouvelle copie de même type et id)
let restoringDraft = false; // restoreDraft() en cours : ses propres événements (setImageField) ne réécrivent pas le brouillon

const draftControls = (form) => [...form.elements].filter((el) => el.name && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)
  && !/^(file|password|submit|reset|button|image)$/.test(el.type) && !el.closest("[data-nodraft]")
  && (el.type !== "hidden" || !!el.closest("[data-image-field]")));
// Formulaires de la modale du dessus.
const modalForms = (dlg) => (!dlg ? [] : dlg.matches("form[data-form]") ? [dlg] : [...dlg.querySelectorAll("form[data-form]")]);
// Formulaire de modale qui contient le champ el (null hors d'une modale).
function modalFormOf(el) {
  const form = el && (el.form || (el.closest && el.closest("form[data-form]")));
  return form && form.matches("form[data-form]") && form.closest('[aria-modal="true"]') ? form : null;
}
const modalHasDraft = () => !!(state.modal && state.modal.draft && Object.keys(state.modal.draft).length);

// Copie la saisie du formulaire dans le brouillon de la modale (target : state.modal par défaut).
function captureDraft(form, target = state.modal) {
  if (!form || !target || restoringDraft) return;
  const draft = {}, controls = draftControls(form), boxes = {};
  controls.forEach((el) => { if (el.type === "checkbox") boxes[el.name] = (boxes[el.name] || 0) + 1; });
  for (const el of controls) {
    const n = el.name;
    if (el.type === "checkbox") {
      if (boxes[n] > 1) { if (!Array.isArray(draft[n])) draft[n] = []; if (el.checked) draft[n].push(el.value); }
      else draft[n] = el.checked;
    } else if (el.type === "radio") {
      if (!(n in draft)) draft[n] = null;
      if (el.checked) draft[n] = el.value;
    } else if (el.multiple) draft[n] = [...el.selectedOptions].map((o) => o.value);
    else draft[n] = el.value;
  }
  target.draft = { ...(target.draft || {}), ...draft };
}

// Remet un brouillon dans un formulaire (appelant : restoringDraft = true). Une valeur absente d'une liste déroulante
// (option disparue) est ignorée ; une photo passe par setImageField (aperçu, bouton « Retirer la photo »).
function fillForm(form, draft) {
  for (const el of draftControls(form)) {
    if (!(el.name in draft)) continue;
    const v = draft[el.name];
    if (el.type === "checkbox") el.checked = Array.isArray(v) ? v.includes(el.value) : !!v;
    else if (el.type === "radio") { if (v !== null && v !== undefined) el.checked = el.value === v; }
    else if (el.type === "hidden") { const f = el.closest("[data-image-field]"); if (f && el.value !== v) setImageField(f, v || ""); }
    else if (el.multiple) [...el.options].forEach((o) => { o.selected = Array.isArray(v) && v.includes(o.value); });
    else if (el.tagName === "SELECT") { if ([...el.options].some((o) => o.value === v)) el.value = v; }
    else if (el.value !== v) el.value = v;
  }
}

// Appelé par render() juste après l'affichage : remet le brouillon de state.modal dans ses formulaires.
function restoreDraft() {
  const m = state.modal, prev = draftOwner;
  if (m && !m.draft && prev && prev !== m && prev.draft && prev.type === m.type && prev.id === m.id) m.draft = prev.draft;
  draftOwner = m;
  if (!m || !m.draft) return;
  const forms = modalForms(topDialog()), draft = m.draft;
  if (!forms.length) return;
  restoringDraft = true;
  try {
    forms.forEach((form) => fillForm(form, draft));
  } finally {
    restoringDraft = false;
  }
  forms.forEach(runLive);
}

// ---------- Formulaires de page : saisie gardée d'un réaffichage à l'autre ----------
// render() remplace tout le DOM : sans brouillon, ouvrir les notifications ou le menu du compte, changer de langue, ou
// une action qui recharge les données (interrupteur des Réglages du site…) effaçait ce qui était tapé dans un formulaire
// de page (Profil, Paramètres, Réglages du site, photo choisie mais pas encore enregistrée). Chaque saisie dans un
// form[data-form] hors modale, dans un espace (Clipper, Agence, Admin ; les écrans de connexion ont leur propre
// mécanisme), est copiée dans pageDrafts[nom] avec les règles de captureDraft, puis remise en place après chaque
// render() de la même page. Un formulaire envoyé abandonne son brouillon au rechargement suivant des données
// (enregistrement réussi : les valeurs affichées sont celles du serveur) ; une nouvelle saisie le reprend. Changer de
// page les abandonne tous. Remettre volontairement un formulaire de page à zéro : dropPageDraft(nom), puis render().
let pageDrafts = Object.create(null); // { nom du formulaire: { draft, sentWith } } ; sentWith : `db` à l'envoi
let pageDraftRoute = ""; // page (#/<espace>/<page>/<élément>) à laquelle appartiennent ces brouillons

// Formulaire de page qui contient le champ el (null dans une modale, sur les écrans de connexion ou hors de l'app).
function pageFormOf(el) {
  if (!["clipper", "agence", "admin"].includes(state.route.area)) return null;
  const form = el && (el.form || (el.closest && el.closest("form[data-form]")));
  return form && form.matches("form[data-form]") && root.contains(form) && !form.closest('[aria-modal="true"]') ? form : null;
}
// Un événement sans nouvelle saisie (change émis par le champ actif quand render() le remplace, juste après l'envoi)
// laisse le formulaire envoyé : seul un brouillon modifié reprend.
function capturePageDraft(form) {
  const name = form.dataset.form, d = pageDrafts[name] || (pageDrafts[name] = { draft: null, sentWith: null });
  const before = JSON.stringify(d.draft);
  captureDraft(form, d);
  if (JSON.stringify(d.draft) !== before) d.sentWith = null;
}
const dropPageDraft = (name) => { delete pageDrafts[name]; };

// Appelé par render() juste après l'affichage, comme restoreDraft().
function restorePageDrafts() {
  const r = state.route, key = `${r.area}/${r.view}/${r.item || ""}`;
  if (key !== pageDraftRoute) { pageDrafts = Object.create(null); pageDraftRoute = key; return; }
  const filled = [];
  restoringDraft = true;
  try {
    for (const [name, d] of Object.entries(pageDrafts)) {
      if (d.sentWith && d.sentWith !== db) { delete pageDrafts[name]; continue; }
      const form = [...root.querySelectorAll(`form[data-form="${String(name).replace(/["\\]/g, "\\$&")}"]`)].find((f) => !f.closest('[aria-modal="true"]'));
      if (form && d.draft) { fillForm(form, d.draft); filled.push(form); }
    }
  } finally {
    restoringDraft = false;
  }
  filled.forEach(runLive);
}

// Modale empilée : s'ouvre par-dessus la modale courante, qui reprend sa place (saisie comprise) quand on ferme la
// nouvelle : ✕ ou « Annuler » (close-modal), Échap, ou closeStacked() dans le `after` d'act() après une action réussie
// (recharge envoyée depuis le formulaire de campagne…). Le focus revient alors sur le bouton qui l'avait ouverte.
function openStacked(modal) {
  const back = state.modal;
  if (back) {
    // La modale du dessous garde sa saisie, même modifiée sans événement (valeur posée par un script).
    if (back === draftOwner && modalHasDraft()) modalForms(topDialog()).forEach((f) => captureDraft(f, back));
    // Au retour : le bouton qui l'a ouverte (sa copie visible), sinon le premier champ du formulaire.
    back.returnFocus = actionKey(document.activeElement) || FIRST_FIELD;
  }
  state.modal = { ...modal, back: back || null };
  render();
}
// Ferme la modale du dessus : la modale d'en dessous (empilée) revient, sinon plus aucune modale. Réaffiche la page
// (act() réaffiche encore après son `after` : sans effet de bord).
function closeStacked() {
  dismissModal();
  render();
}
// Même chose sans réaffichage (bouton close-modal, Échap).
function dismissModal() {
  state.modal = (state.modal && state.modal.back) || null;
}

// ---------- Rendu ----------

// Titre de l'onglet : page courante (entrée de navigation, Mon compte de l'admin), puis l'espace, dans la langue choisie.
function pageTitle(area) {
  const view = navView(area, state.route.view), n = AREAS[area].nav().find((x) => x.id === view), title = t(AREAS[area].title);
  const label = n ? t(n.label) : area === "admin" && view === "compte" ? t("Mon compte") : "";
  return label ? `${label} · ${title} — ClipBoost` : `${title} — ClipBoost`;
}

function render() {
  const area = state.route.area;
  if (area === "home") return;
  if (offlineLanding) offlineLanding.hide();
  // L'accueil public de la version autonome reste en français ; l'application suit la langue choisie.
  applyLangAttrs();
  if (area === "auth") { state.drawer = false; state.notifOpen = false; state.menuOpen = false; }

  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.input : null;
  const caret = focusKey && "selectionStart" in active ? active.selectionStart : null;
  const oldDlg = topDialog(), hadOverlay = !!oldDlg;
  const dlgTitle = oldDlg ? (oldDlg.querySelector("#modal-title") || {}).textContent : undefined;
  const onDialog = !!oldDlg && active === oldDlg;
  const pops = POPOVERS.map(([id, toggle]) => ({ id, toggle, had: !!root.querySelector(`#${id}`), inside: !!(active && active.closest && active.closest(`#${id}`)) }));
  // Bouton d'action actif (filtre, favori, période, langue…) : son focus est rendu après le rendu (sinon il tombe sur <body>).
  const aKey = focusKey ? null : actionKey(active), aIndex = aKey ? visibleAll(aKey).indexOf(active) : -1;
  const group = aKey ? active.closest('[role="group"][aria-label]') : null, groupLabel = group ? group.getAttribute("aria-label") : "";
  // Champ de formulaire actif (réaffichage d'un champ conditionnel, données rechargées) : focus et sélection rendus.
  const fKey = focusKey || aKey ? null : fieldKey(active);
  let sel = null;
  if (fKey) try { sel = active.selectionStart === null ? null : [active.selectionStart, active.selectionEnd]; } catch (e) {}

  let html;
  if (area === "auth") html = { connexion: viewConnexion, inscription: viewInscription, "mot-de-passe": viewMotDePasse }[state.route.view]();
  else html = shell(area);
  // Les messages affichés juste avant un changement de page (connexion, clip envoyé…) restent visibles.
  const toasts = document.getElementById("toasts");
  root.innerHTML = `${html}<div id="toasts" aria-live="polite" class="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"></div>`;
  if (toasts) root.querySelector("#toasts").replaceWith(toasts);
  document.title = area === "auth" ? `${{ connexion: t("Connexion"), inscription: t("Inscription"), "mot-de-passe": t("Mot de passe oublié") }[state.route.view]} — ClipBoost` : pageTitle(area);
  // Saisie en cours (modale, formulaires de la page) remise en place avant tout placement du focus (le bouton qui avait
  // ouvert une modale empilée peut vivre dans un récapitulatif en direct).
  restoreDraft();
  restorePageDrafts();
  // Conversation ouverte (Messages) : affichée sur son dernier message ; zone de saisie à la hauteur de son texte.
  root.querySelectorAll("[data-msg-scroll]").forEach((el) => { el.scrollTop = el.scrollHeight; });
  root.querySelectorAll("textarea[data-autogrow]").forEach(autogrow);
  // Case « en partie cochée » (« Toutes les plateformes » quand certaines seulement le sont) : l'état indéterminé n'a pas
  // d'attribut HTML, le rendu pose data-indeterminate et il est appliqué ici.
  root.querySelectorAll('input[type="checkbox"][data-indeterminate]').forEach((el) => { el.indeterminate = !el.checked; });

  if (focusKey) {
    const el = root.querySelector(`[data-input="${focusKey}"]`);
    if (el) { el.focus(); if (caret !== null) try { el.setSelectionRange(caret, caret); } catch (e) {} }
    return;
  }
  const dlg = topDialog();
  // Modale ou tiroir : focus envoyé dedans à l'ouverture, rendu à l'élément d'origine à la fermeture.
  if (!!dlg !== hadOverlay) return placeOverlayFocus(hadOverlay, aKey, aIndex);
  // Une modale en remplace une autre, ou revient après une modale empilée : focus dans la nouvelle.
  if (dlg && (dlg.querySelector("#modal-title") || {}).textContent !== dlgTitle) return focusModal(dlg);
  // Panneau (notifications, menu du compte) : focus sur sa première action à l'ouverture.
  for (const p of pops) {
    const el = root.querySelector(`#${p.id}`);
    if (el && !p.had) return (el.querySelector("button, a[href]") || el).focus({ preventScroll: true });
  }
  // Panneau refermé (Échap, son bouton, un lien du panneau, un clic à côté) : retour à son bouton, sauf si un autre
  // bouton d'action a été cliqué (il garde le focus, plus bas).
  for (const p of pops) {
    if (p.had && !root.querySelector(`#${p.id}`) && (p.inside || aKey === p.toggle || !aKey)) {
      const b = visibleAll(p.toggle)[0];
      if (b) b.focus({ preventScroll: true });
      return;
    }
  }
  if (fKey) {
    const el = root.querySelector(fKey);
    if (el) {
      el.focus({ preventScroll: true });
      if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) {}
      return;
    }
  }
  if (onDialog && dlg) return dlg.focus({ preventScroll: true });
  if (aKey && !(document.activeElement && document.activeElement !== document.body && root.contains(document.activeElement))) {
    const list = visibleAll(aKey);
    const el = list[Math.min(Math.max(0, aIndex), list.length - 1)]
      || (groupLabel && visibleAll(`[role="group"][aria-label="${groupLabel.replace(/"/g, '\\"')}"] [aria-pressed="true"]`)[0])
      || dlg || root.querySelector("#notif-panel, #account-menu") || root.querySelector("#main");
    if (el) el.focus({ preventScroll: true });
  }
  // Filet : une modale ouverte garde le focus (jamais sur <body>, derrière elle).
  if (dlg && !dlg.contains(document.activeElement)) dlg.focus({ preventScroll: true });
}

// ---------- Événements ----------

// Élément sous le pointeur à l'appui : un clic ne ferme une modale par son fond que s'il a commencé sur ce fond.
let pointerDownTarget = null;
root.addEventListener("pointerdown", (e) => { pointerDownTarget = e.target; }, true);

// Actions de la coquille et des écrans de connexion. Renvoie false si l'action appartient à l'espace affiché.
function shellAction(action, el) {
  switch (action) {
    case "drawer": state.drawer = !state.drawer; state.notifOpen = false; state.menuOpen = false; break;
    case "notif": state.notifOpen = !state.notifOpen; state.menuOpen = false; break;
    case "account-menu": state.menuOpen = !state.menuOpen; state.notifOpen = false; break;
    // Mentions légales, Aide et support : pages à créer.
    case "soon": toast(t("Bientôt disponible"), "info"); return true;
    case "read-all": act("POST", "/api/notifications/read", {}); return true;
    case "read-one": {
      // Avec un lien : le panneau se ferme et la page de l'élément s'ouvre ; la lecture est enregistrée en arrière-plan.
      const n = myNotifs().find((x) => x.id === el.dataset.id);
      if (!n || !n.link) { act("POST", "/api/notifications/read", { ids: [el.dataset.id] }); return true; }
      state.notifOpen = false;
      if (n.unread) { n.unread = false; api("POST", "/api/notifications/read", { ids: [n.id] }).catch(() => {}); }
      // Déjà sur la page visée : l'entrée d'historique est remplacée (Retour ne repasse pas par la même page).
      const [, area, rawView] = n.link.split("/"), view = ROUTE_ALIASES[`${area}/${rawView}`] || rawView;
      if (location.hash === n.link || (area === state.route.area && view === state.route.view)) {
        try { history.replaceState(history.state, "", n.link); } catch (e) {}
        onRoute();
      } else location.hash = n.link;
      return true;
    }
    // Facture ou reçu PDF d'une transaction validée (bouton txDocBtn, dans chaque espace).
    case "tx-document": {
      const x = db.transactions.find((y) => y.id === el.dataset.id);
      if (x && x.document) downloadDocument(x);
      return true;
    }
    case "close-modal": dismissModal(); break;
    case "logout": state.menuOpen = false; state.notifOpen = false; state.drawer = false; logout(); return true;
    case "toast": toast(el.dataset.msg); return true;
    case "toggle-pwd": state.auth.showPwd = !state.auth.showPwd; break;
    case "signup-back": state.auth.step = "form"; state.auth.error = ""; break;
    case "signup-role": captureSignupForm(); state.auth.form.role = el.dataset.value; state.auth.fieldErrors = {}; break;
    case "resend-code": resendCode(); return true;
    case "auth-copy": copy(el.dataset.value, t("Adresse copiée")); return true;
    case "auth-demo": authUseDemo(el.dataset.value); return true;
    case "clear-search": {
      const input = root.querySelector(`[data-input="${el.dataset.value}"]`);
      if (input) { input.value = ""; input.focus(); input.dispatchEvent(new Event("input", { bubbles: true })); }
      return true;
    }
    case "skip": { const m = root.querySelector("#main"); if (m) m.focus(); return true; }
    default: return false;
  }
  render();
  return true;
}

root.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]"), action = el ? el.dataset.action : "";
  // Fond sombre d'une modale ([data-action="close-modal"] qui contient la boîte [data-stop]) : un clic dans la boîte
  // ne compte pas ; sur le fond, il ferme seulement si l'appui a commencé sur le fond (pas une sélection de texte
  // commencée dans la boîte) et si rien n'a été saisi (sinon : ✕, « Annuler » ou Échap).
  if (action === "close-modal" && el.querySelector("[data-stop]") && (e.target !== el || pointerDownTarget !== el || modalHasDraft())) return;
  // Clic hors du panneau ouvert (notifications, menu du compte) : il se referme ; l'action cliquée s'exécute quand même.
  const inPop = !!e.target.closest("#notif-panel, #account-menu");
  let closedPop = false;
  if ((state.notifOpen || state.menuOpen) && !inPop && action !== "notif" && action !== "account-menu") {
    state.notifOpen = false; state.menuOpen = false; closedPop = true;
  }
  if (!el) {
    // Lien du menu du compte (Mon profil, Paramètres) : le menu se ferme ; déjà sur cette page, simple réaffichage.
    const link = inPop && e.target.closest("#account-menu a[href]");
    if (link) {
      state.menuOpen = false;
      if (link.getAttribute("href") === location.hash) { e.preventDefault(); render(); }
      return;
    }
    if (closedPop) render();
    return;
  }
  if (!shellAction(action, el)) {
    const area = state.route.area;
    if (area === "admin") handleAdminAction(action, el);
    else if (area === "agence") handleAgencyAction(action, el);
    else if (area === "clipper") handleClipperAction(action, el);
    else if (area === "auth" && typeof handleAuthAction === "function") handleAuthAction(action, el);
  }
  // L'action n'a pas réaffiché la page : le panneau refermé disparaît quand même.
  if (closedPop && root.querySelector("#notif-panel, #account-menu")) render();
});

// Champs à effet immédiat (data-input) : recherches et filtres des pages. Une clé que la coquille ne connaît pas est
// passée au gestionnaire facultatif de l'espace affiché, s'il existe : handleClipperInput, handleAgencyInput ou
// handleAdminInput(clé, champ, événement) (saisie : événement input ; liste déroulante : change).
function areaInput(e) {
  const k = e.target.dataset && e.target.dataset.input, a = state.route.area;
  const fn = a === "clipper" ? typeof handleClipperInput === "function" && handleClipperInput
    : a === "agence" ? typeof handleAgencyInput === "function" && handleAgencyInput
    : a === "admin" ? typeof handleAdminInput === "function" && handleAdminInput : null;
  if (k && fn) fn(k, e.target, e);
}

root.addEventListener("input", (e) => {
  clearInvalid(e.target);
  if (e.target.form && e.target.form.dataset.live) runLive(e.target.form);
  const k = e.target.dataset.input;
  if (k === "camp-q") { state.camp.q = e.target.value; return render(); }
  if (k === "camp-aq") { state.camp.aq = e.target.value; return render(); }
  if (k === "adm-user-q") { state.adm.userQ = e.target.value; return render(); }
  if (k === "adm-camp-q") { state.adm.campQ = e.target.value; return render(); }
  if (k === "ag-q") { state.ag.q = e.target.value; return render(); }
  if (e.target.hasAttribute("data-autogrow")) autogrow(e.target);
  if (e.target.hasAttribute("data-strength")) {
    const meter = root.querySelector("[data-strength-meter]");
    if (meter) meter.innerHTML = strengthMeter(e.target.value);
  }
  if (k && k !== "global-q" && e.target.tagName !== "SELECT") areaInput(e);
});

root.addEventListener("change", (e) => {
  if (e.target.form && e.target.form.dataset.live) runLive(e.target.form);
  const k = e.target.dataset.input;
  if (k === "camp-category") { state.camp.category = e.target.value; return render(); }
  if (k === "camp-sort") { state.camp.sort = e.target.value; return render(); }
  if (k === "adm-user-status") { state.adm.userStatus = e.target.value; return render(); }
  if (k && e.target.tagName === "SELECT") areaInput(e);
});

// Brouillons (modales, formulaires de page) et champs conditionnels : écoutés sur window, donc après les écouteurs des
// espaces (une case « Toutes les plateformes » qui coche les autres sans événement est capturée dans son état final).
// Les événements émis par la remise en place d'un brouillon (setImageField) sont ignorés.
function captureAny(target) {
  const form = modalFormOf(target);
  if (form) { captureDraft(form); return form; }
  const page = pageFormOf(target);
  if (page) capturePageDraft(page);
  return page;
}
window.addEventListener("input", (e) => {
  if (!restoringDraft) captureAny(e.target);
});
window.addEventListener("change", (e) => {
  if (restoringDraft || !captureAny(e.target)) return;
  // [data-rerender] : réaffichage, le rendu lit le brouillon. Pas pour un choix de fichier : la photo est lue ensuite
  // (ui.js) et se pose d'elle-même dans le champ.
  if (e.target.type !== "file" && e.target.closest("[data-rerender]")) render();
});

// Zone de saisie d'un message : sa hauteur suit le texte (jusqu'à sa hauteur maximale, puis elle défile).
function autogrow(el) {
  if (!el.value) { el.style.height = ""; return; }
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + 2}px`;
}

root.addEventListener("keydown", (e) => {
  // Message (Messages) : Entrée envoie, Maj + Entrée passe à la ligne ; pas pendant une composition (clavier IME).
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.target.matches && e.target.matches("textarea[data-send-on-enter]")) {
    e.preventDefault();
    if (e.target.form) e.target.form.requestSubmit();
    return;
  }
  // Recherche rapide du clipper (barre du haut) : Entrée ouvre Découvrir avec cette recherche.
  if (e.target.dataset.input === "global-q" && e.key === "Enter") {
    e.preventDefault();
    Object.assign(state.camp, { q: e.target.value.trim(), category: "Toutes", scope: "Toutes" });
    navigate("#/clipper/decouvrir");
  }
});

// Échap : la couche du dessus se ferme (modale empilée → modale d'en dessous, modale, panneau, tiroir).
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  if (state.modal) dismissModal();
  else if (state.notifOpen || state.menuOpen) { state.notifOpen = false; state.menuOpen = false; }
  else if (state.drawer) state.drawer = false;
  else return;
  render();
});

root.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target.dataset.form || "", data = Object.fromEntries(new FormData(e.target));
  // Formulaire de page envoyé : son brouillon tombe au prochain rechargement des données (enregistrement réussi).
  if (pageDrafts[form] && pageFormOf(e.target)) pageDrafts[form].sentWith = db;
  if (state.route.area === "auth" || ["login", "signup", "verify", "forgot", "reset"].includes(form)) return handleAuthSubmit(form, data);
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
    root.innerHTML = `<div class="grid min-h-dvh place-items-center bg-canvas p-6">${emptyState("alert", esc(tServer(e.message)), t("Vérifiez votre connexion puis réessayez."), `<button type="button" onclick="location.reload()" class="${btn("primary")}">${t("Réessayer")}</button>`)}</div>`;
  });
