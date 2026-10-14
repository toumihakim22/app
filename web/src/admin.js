// Tableau de bord administrateur : pilotage des utilisateurs, campagnes, clips, paiements et réglages du site.
// Chaque action passe par l'API : les effets sont visibles immédiatement par les clippers et les agences.
// Rendu selon docs/design-system.md §6.4 (recettes et helpers de ui.js). Les helpers locaux sont préfixés « adm ».
// Pages hors navigation : fiche d'un utilisateur (#/admin/utilisateur/<id>, ITEM_PAGES dans main.js : « Utilisateurs »
// reste l'entrée courante) et « Mon compte » (#/admin/compte, ouverte par le menu du compte).
// Fiches d'examen (modales) : campagne (adm-camp) et clip (adm-clip), ouvertes sur place depuis chaque liste, ou par les
// adresses #/admin/campagnes/<id> et #/admin/moderation/<id> (liens des notifications, applyRouteItem dans main.js).
// Tout nom d'agence ou de clipper affiché ici mène à sa fiche (admUserLink).

const ADMIN_NAV = [
  { id: "apercu", label: "Vue d'ensemble", short: "Aperçu", icon: "home" },
  { id: "utilisateurs", label: "Utilisateurs", icon: "users" },
  { id: "campagnes", label: "Campagnes", icon: "target" },
  { id: "moderation", label: "Modération des clips", short: "Clips", icon: "shield" },
  { id: "retraits", label: "Paiements", icon: "wallet" },
  { id: "parametres", label: "Réglages du site", short: "Réglages", icon: "gear" },
];

const clippers = () => db.users.filter((u) => u.role === "clipper");
const pendingPubs = () => db.publications.filter((p) => p.status === "En attente");
const pendingWithdrawals = () => db.transactions.filter((t) => t.type === "retrait" && t.status === "En cours");
const pendingRecharges = () => db.transactions.filter((t) => t.type === "recharge" && t.status === "En cours");
// Agences qui attendent une décision sur leur demande de badge de vérification.
const admPendingBadges = () => db.users.filter((u) => u.role === "agence" && u.verification === "pending");
const adminBadge = (id) => ({
  moderation: pendingPubs().length, retraits: pendingWithdrawals().length + pendingRecharges().length,
  campagnes: db.campaigns.filter((c) => c.status === "En attente").length, utilisateurs: admPendingBadges().length,
}[id] || 0);

// ---------- Helpers locaux ----------
const admSum = (list, f) => list.reduce((s, x) => s + (f(x) || 0), 0);
// Net à virer d'un retrait : montant demandé moins les frais (le serveur stocke le retrait en négatif).
const admNet = (t) => -t.amount - (t.fee || 0);
// Montant prélevé sur le crédit de l'agence pour un budget : budget + commission (même règle que fundingCost du serveur).
const admFunding = (budget, rate) => budget + Math.round((budget * (rate || 0)) / 100);
const admDash = `<span class="font-normal text-fg-subtle">—</span>`;
// Montant secondaire (frais) : même rendu que money(), en text-fg-muted.
const admMuted = (n) => money(n).replace("text-fg ", "text-fg-muted ");
// Gain de la plateforme en KPI : grand montant (comme bigMoney), signe « + » et vert, car l'argent entre chez ClipBoost.
const admIncome = (n) => `<span class="whitespace-nowrap text-income ${BIG.kpi[0]}">${n > 0 ? "+" : ""}${fmt(n)}<span class="font-medium tracking-normal text-fg-subtle ${BIG.kpi[1]}">${NB}DA</span></span>`;
const admCopyBtn = (value, label, msg) =>
  `<button type="button" data-action="adm-copy" data-value="${esc(value)}" data-msg="${esc(msg)}" class="${iconBtn("sm")}" aria-label="${esc(label)}" title="${esc(label)}">${icon("copy")}</button>`;
// Numéro de compte : groupé par 4 s'il n'a que des chiffres (RIB, BaridiMob), sinon tel quel (CCP « 0021234567 clé 89 »).
const admAccountValue = (raw) => { const a = String(raw || "").trim(); return /^[\d\s]+$/.test(a) ? a.replace(/\s+/g, "") : a.replace(/\s+/g, " "); };
const admAccount = (raw) => { const a = admAccountValue(raw); return /^\d+$/.test(a) ? groupAccount(a) : esc(a); };
const admCap = (s) => esc(String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1));
const admUser = (id) => userById(id) || { id: String(id), name: "Compte supprimé", email: "", role: "clipper", status: "Suspendu" };
// Ligne de filtres : recherche, puis une seule rangée défilante sous lg (jamais plus de 2 rangées avant le contenu).
const admToolbar = (search, filters) => `<div class="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">${search}${filters}</div>`;
const admCountLine = (n, total, one, many) =>
  `<p class="mt-4 text-small tabular-nums text-fg-subtle">${n === total ? plural(n, one, many) : `${plural(n, one, many)} sur ${fmt(total)}`}</p>`;
// Saisie numérique « 50 000 » ou « 2,5 » : espaces ignorés, virgule décimale ; vide = NaN.
const admParse = (v) => { const t = String(v ?? "").replace(/[\s  ]/g, "").replace(",", "."); return t === "" ? NaN : Number(t); };
// Champ refusé avant l'envoi : bordure d'erreur (aria-invalid), message sous le champ et focus (pas de toast éphémère).
// Sans message (relevé de vues), l'avertissement déjà affiché dans la modale suffit.
function admInvalid(form, name, msg = "") {
  markInvalid(root.querySelector(`form[data-form="${form}"]`), name, msg);
}
// Tableaux : chacun s'affiche à partir de la largeur où il tient en entier (colonne d'actions comprise), la liste en dessous.
// Le conteneur défile horizontalement en dernier recours au lieu de rogner ; « relative » garde l'en-tête sr-only dans le tableau.
const ADM_WRAP = TBL.wrap.replace("overflow-hidden", "overflow-x-auto");
const ADM_BP = {
  md: [TBL.table, TBL.list],
  xl: [TBL.table.replace("md:table", "xl:table"), TBL.list.replace("md:hidden", "xl:hidden")],
  wide: [TBL.table.replace("md:table", "min-[1400px]:table"), TBL.list.replace("md:hidden", "min-[1400px]:hidden")],
  pub: [TBL.table.replace("md:table", "min-[1440px]:table"), TBL.list.replace("md:hidden", "min-[1440px]:hidden")],
};
const ADM_TH_ACTIONS = `<th scope="col" class="${TBL.th} ${TBL.thNum} relative"><span class="sr-only">Actions</span></th>`;
// Cellule principale : prend la place restante et tronque son contenu (au lieu d'élargir le tableau).
const ADM_TD_MAIN = `${TBL.td} w-full max-w-0`;
const admTable = (bp, head, trs, lis) => `<div class="${ADM_WRAP}">
    <table class="${ADM_BP[bp][0]}"><thead><tr class="${TBL.headRow}">${head}</tr></thead><tbody>${trs}</tbody></table>
    <ul class="${ADM_BP[bp][1]}">${lis}</ul></div>`;
// publicationsTable (clipper.js) dans l'administration. Avec la colonne Clippeur (6 colonnes, environ 1 130 px), le tableau
// s'affiche à partir de 1 440 px (bp « pub »), la liste (actions en boutons md) en dessous, pour ne jamais rogner ni faire
// défiler la colonne Décision ; sans elle (fiche d'un clipper), à partir de xl.
// Ses liens vers les fiches d'examen (#/admin/moderation/<id>, #/admin/campagnes/<id>) deviennent des boutons qui ouvrent
// la fiche sur place : la liste ne change pas de page et ne remonte pas en haut ; les liens vers les profils restent des liens.
const admDecode = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
const admPubTable = (html, bp = "pub") => html
  .replace(`class="${TBL.wrap}"`, `class="${ADM_WRAP}"`)
  .replace(`class="${TBL.table}"`, `class="${ADM_BP[bp][0]}"`)
  .replace(`class="${TBL.list}"`, `class="${ADM_BP[bp][1]}"`)
  .replace(/<a href="#\/admin\/moderation\/([^"]+)" class="([^"]*)"([^>]*)>([^<]*)<\/a>/g, (_, id, cls, rest, text) =>
    `<button type="button" data-action="adm-clip" data-id="${esc(admDecode(id))}" class="max-w-full text-start ${cls.replace(/(^|\s)truncate(?=\s|$)/, " ")}"${rest}><span class="block truncate">${text}</span></button>`)
  .replace(/<a href="#\/admin\/campagnes\/([^"]+)" class="([^"]*)"([^>]*)>(<span class="truncate">[^<]*<\/span>)<\/a>/g, (_, id, cls, rest, inner) =>
    `<button type="button" data-action="adm-camp" data-id="${esc(admDecode(id))}" class="${cls}"${rest}>${inner}</button>`);
const admSectionTitle = (title, extra = "") => `<div class="flex items-center gap-2"><h2 class="text-heading text-fg">${title}</h2>${extra}</div>`;
// Titre d'une ligne qui ouvre une fiche : bouton au rendu de lien (tronqué dans un span intérieur).
const ADM_ROW_LINK = `block min-w-0 max-w-full rounded-sm text-start font-medium text-fg underline-offset-2 hover:underline ${FOCUS}`;

// ---------- Liens vers les fiches (noms, campagnes, clips) ----------
const admUserHref = (u) => `#/admin/utilisateur/${encodeURIComponent(u.id)}`;
// Nom d'une agence ou d'un clipper : lien vers sa fiche, badge bleu compris (nameWithBadge : nom échappé + badge si
// u.verified). Le nom se tronque dans un span intérieur et le badge reste entier ; zone tactile HIT sous md.
// Compte supprimé : texte simple. inModal : dans une fiche, le lien la referme avant d'ouvrir le profil.
function admUserLink(u, cls = "", { inModal = false } = {}) {
  if (!u || !u.id || !userById(u.id)) return `<span class="min-w-0 truncate ${cls}">${esc(u && u.name ? u.name : "Compte supprimé")}</span>`;
  return `<a href="${admUserHref(u)}"${inModal ? ' data-action="close-modal"' : ""} title="Voir le profil de ${esc(u.name)}" class="${HIT} inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm underline-offset-2 transition-colors duration-150 hover:underline ${FOCUS} ${cls}"><span class="min-w-0 truncate">${esc(u.name)}</span>${u.verified ? verifiedBadge("size-3.5") : ""}</a>`;
}
// Fiche ouverte depuis une liste : en remplacement de rien (page), ou par-dessus une autre fiche (openStacked, main.js) ;
// la fiche demandée qui est déjà celle d'en dessous revient simplement (campagne → clip → sa campagne).
// Même genre de fiche (autre plateforme du même lot) : elle prend la place de la fiche affichée.
function admOpenSheet(type, id) {
  const m = state.modal;
  if (!m) { state.modal = { type, id }; return render(); }
  if (m.type === type && m.id === id) return;
  if (m.type === type) { state.modal = { type, id, back: m.back || null }; return render(); }
  if (m.back && m.back.type === type && m.back.id === id) { dismissModal(); return render(); }
  return openStacked({ type, id });
}
// Modale de décision (motif, relevé, confirmation) : par-dessus la fiche ouverte, sinon seule.
function admOpen(modal) {
  if (state.modal) return openStacked(modal);
  state.modal = modal;
  return render();
}
// Après une action réussie : referme les modales du dessus qui concernent cet élément (types donnés, même id), la modale
// d'en dessous éventuelle (autre fiche) reprend sa place. Appelé dans le `after` d'act() (qui réaffiche ensuite).
function admPop(types, id) {
  let m = state.modal;
  while (m && types.includes(m.type) && m.id === id) m = m.back || null;
  state.modal = m;
}
// Fiche dont l'élément n'existe plus (campagne annulée par son agence pendant l'examen…).
const admGone = (title, text) => modalShell({
  title, body: emptyState("info", title, text, "", { inCard: true }),
  footer: `<button type="button" data-action="close-modal" class="${btn("secondary")}">Fermer</button>`,
});
// Carte Visa / Mastercard d'une recharge : marque et 4 derniers chiffres, ajoutés au libellé par l'API (« … · Visa •••• 4242 »).
const admCardOf = (t) => { const m = /(Visa|Mastercard)\s*•+\s*(\d{4})\s*$/.exec(String(t.label || "")); return m ? { brand: m[1], last4: m[2] } : null; };
const admCardNumber = (card) => `<span class="whitespace-nowrap font-mono text-xs text-fg-muted" dir="ltr">••••${NB}${card.last4}</span>`;

// ---------- Vue d'ensemble ----------

function aApercu() {
  const s = db.settings, users = clippers(), pubs = pendingPubs(), wd = pendingWithdrawals(), rc = pendingRecharges();
  const campPending = db.campaigns.filter((c) => c.status === "En attente").length, badges = admPendingBadges().length;
  const under = pubs.filter(belowMin).length, toPay = admSum(wd, admNet), queue = pubs.length + campPending + wd.length + rc.length + badges;

  // 1. À traiter : cartes interactives neutres (jamais de rose pour une file normale). Les demandes de badge n'ont leur
  // carte que lorsqu'il y en a. Sous sm : une liste compacte (une ligne par file, compteur à droite).
  const paySub = [wd.length ? `${money(toPay)} à virer` : "", rc.length ? `${plural(rc.length, "recharge", "recharges")} à confirmer` : ""].filter(Boolean).join(" · ");
  const queues = [
    ["moderation", "Clips à modérer", pubs.length, pubs.length ? (under ? `dont ${fmt(under)} sous le seuil` : "En attente de décision") : "Tout est à jour"],
    ["campagnes", "Campagnes à approuver", campPending, campPending ? "Soumises par les agences" : "Aucune en attente"],
    ["retraits", "Paiements à traiter", wd.length + rc.length, paySub || "Tout est à jour"],
    ...(badges ? [["utilisateurs", "Badges à vérifier", badges, "Demandes des agences"]] : []),
  ];
  const todoCards = queues.map(([id, label, n, sub]) =>
    kpi({ href: `#/admin/${id}`, label, value: kpiValue(fmt(n)), sub, ic: "chevronRight" }).replace("<a ", `<a data-action="adm-focus" data-value="${id}" `));
  const todoList = queues.map(([id, label, n, sub]) => `<li><a href="#/admin/${id}" data-action="adm-focus" data-value="${id}" class="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
      <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${label}</span><span class="mt-0.5 block truncate text-xs text-fg-subtle">${sub}</span></span>
      ${n ? countBadge(n, "queue") : `<span class="text-small tabular-nums text-fg-subtle">0</span>`}${icon("chevronRight", "size-4 shrink-0 text-fg-subtle rtl:-scale-x-100")}</a></li>`).join("");

  // 2. KPI plateforme : chaque chiffre une seule fois sur l'écran.
  const active = db.campaigns.filter((c) => c.status === "Active").length, suspended = users.filter((u) => u.status === "Suspendu").length;
  const spent = admSum(db.campaigns, (c) => c.spent), commission = admSum(db.campaigns, (c) => Math.round((c.spent * c.commissionRate) / 100));
  const validated = db.publications.filter((p) => p.status === "Validée"), views = admSum(validated, (p) => p.views);
  const kpis = [
    kpi({ label: "Clippers inscrits", value: kpiValue(fmt(users.length)), sub: plural(suspended, "suspendu", "suspendus") }),
    kpi({ label: "Campagnes actives", value: kpiValue(fmt(active)), sub: `sur ${plural(db.campaigns.length, "campagne", "campagnes")}` }),
    kpi({ label: "Budget consommé", value: bigMoney(spent), sub: `${plural(validated.length, "clip validé", "clips validés")} · ${compact(views)}${NB}vues` }),
    kpi({ label: "Commissions ClipBoost", value: admIncome(commission), sub: "sur le budget consommé" }),
  ];

  // 3. Inscriptions (un comptage : barres entières) et activité récente (textes du serveur, traduits à l'affichage).
  const period = state.period === 7 ? 7 : 30, series = (db.series.daily || []).slice(-period);
  const total = admSum(series, (v) => v), activeDays = series.filter((v) => v > 0).length;
  const chart = `<header class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0"><h2 class="text-section text-fg">Nouvelles inscriptions</h2>
        <p class="mt-2">${kpiValue(fmt(total))}</p>
        <p class="mt-0.5 text-small text-fg-subtle">sur ${period}${NB}jours · ${plural(activeDays, "jour actif", "jours actifs")}</p></div>
      ${segmented("adm-period", period, [[7, "7 j"], [30, "30 j"]], "Période du graphique")}
    </header>
    <div class="mt-5" dir="ltr">${total
      ? barChart(series, { tone: "brand", unit: "inscription", integer: true, caption: `Nouvelles inscriptions par jour, ${period} derniers jours` })
      : emptyState("users", "Aucune inscription sur la période", "Les nouveaux comptes clippers et agences apparaîtront ici.", "", { inCard: true })}</div>`;
  const acts = (db.activity || []).slice(0, 6);
  const activity = `${cardHeader("Activité récente")}
    ${acts.length
      ? `<ul class="mt-3 divide-y divide-line">${acts.map((a) => `<li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">${eventIcon(a.icon)}
          <div class="min-w-0 flex-1"><p class="break-words text-small text-fg">${esc(tServer(a.text))}</p><p class="mt-0.5 text-xs text-fg-subtle">${ago(a.at)}</p></div></li>`).join("")}</ul>`
      : `<div class="grid flex-1 place-items-center">${emptyState("clock", "Aucune activité sur les 7 derniers jours", "Inscriptions, validations et paiements s'afficheront ici.", "", { inCard: true })}</div>`}`;

  return `${pageHeader("Vue d'ensemble", "Pilotez l'activité de ClipBoost en temps réel.")}
    ${s.maintenance ? `<div class="mt-6">${alertBox("warning", `<strong class="font-semibold">Mode maintenance activé.</strong> Les clippers et les agences ne peuvent pas se connecter. <a href="#/admin/parametres" class="${btn("link")}">Modifier dans les réglages</a>`)}</div>` : ""}
    <section class="mt-6" aria-label="À traiter">
      ${admSectionTitle("À traiter", queue ? countBadge(queue, "queue") : "")}
      <ul class="mt-3 divide-y divide-line overflow-hidden ${CARD} sm:hidden">${todoList}</ul>
      <div class="mt-3 hidden gap-4 sm:grid ${queues.length > 3 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"} lg:gap-5">${todoCards.join("")}</div>
    </section>
    <section class="mt-8" aria-label="Plateforme">
      ${admSectionTitle("Plateforme")}
      <div class="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-4">${kpis.join("")}</div>
    </section>
    <div class="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-5">
      ${card(chart, acts.length ? "" : "lg:col-span-2")}
      ${acts.length ? card(activity, "flex flex-col p-5") : ""}
    </div>
    ${sectionHeader("Clips en attente", pubs.length ? "#/admin/moderation" : "")}
    ${pubs.length ? admPubTable(publicationsTable(pubs.slice(0, 3), { showUser: true, actions: true }))
      : emptyState("check", "Aucun clip en attente", "Les nouveaux clips soumis par les clippers apparaîtront ici.")}`;
}

// ---------- Utilisateurs ----------

const roleTag = (u) => roleBadge(u.role);
const ADM_ROLES = { "Tous les rôles": null, Clippers: "clipper", Agences: "agence", Admins: "admin" };
// Solde : gains disponibles d'un clipper, crédit d'une agence.
const admBalance = (u) => (u.role === "agence" ? u.credit || 0 : balance(u));
const admBalanceLabel = (u) => (u.role === "agence" ? "crédit" : "gains");
// Étiquette « Badge demandé » (même gabarit que roleBadge) : l'agence attend une décision sur le badge bleu.
const admBadgeAsked = `<span class="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] bg-info-bg px-1.5 text-micro font-semibold text-info-fg ring-1 ring-inset ring-info-border">${icon("shield", "size-3")}Badge demandé</span>`;

// Colonne d'actions : « Profil » partout ; un compte admin ne se suspend pas, un espace vide garde l'alignement du tableau.
function admUserActions(u, size, table = false) {
  const profile = `<a href="${admUserHref(u)}" class="${btn("ghost", size)}">Profil</a>`;
  if (u.role === "admin") return table ? `${profile}<span class="w-[6.5rem] shrink-0" aria-hidden="true"></span>` : profile;
  return `${profile}
    <button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="${btn("secondary", size, "sm:min-w-[6.5rem]")}">${u.status === "Actif" ? "Suspendre" : "Réactiver"}</button>`;
}

// Demandes de badge en attente (haut de la page Utilisateurs) : message de l'agence, puis refuser (motif) ou accorder.
function admBadgeRequests(list) {
  if (!list.length) return "";
  const items = list.map((u) => {
    const n = db.campaigns.filter((c) => c.ownerId === u.id).length;
    return `<li data-row="${u.id}" class="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-6 sm:px-5">
      <div class="flex min-w-0 items-start gap-3">${avatar(u, "md")}
        <div class="min-w-0 flex-1">
          <p class="flex min-w-0 text-sm font-medium text-fg">${admUserLink(u)}</p>
          <p class="mt-0.5 truncate text-xs text-fg-subtle"><span dir="ltr">${esc(u.email)}</span> · ${plural(n, "campagne", "campagnes")} · inscrite le ${date(u.joined)}</p>
          ${u.verificationNote
            ? `<p class="mt-2 break-words border-s-2 border-line-strong ps-3 text-small text-fg-muted">${esc(u.verificationNote)}</p>`
            : `<p class="mt-2 text-small text-fg-subtle">Aucun message joint à la demande.</p>`}
        </div></div>
      <div class="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" data-action="adm-verify" data-id="${u.id}" data-value="reject" class="${btn("dangerSoft", "md")}">Refuser</button>
        <button type="button" data-action="adm-verify-approve" data-id="${u.id}" class="${btn("primary", "md")}">${icon("shield")}Accorder le badge</button>
      </div></li>`;
  }).join("");
  return `<section class="mt-6" aria-labelledby="adm-badges-title">
      <div class="flex items-center gap-2"><h2 id="adm-badges-title" class="text-heading text-fg">Badges à vérifier</h2>${countBadge(list.length, "queue")}</div>
      <p class="mt-1 max-w-2xl text-small text-fg-muted">Ces agences demandent le badge bleu. Vérifiez leur identité avant de l'accorder : il s'affiche à côté de leur nom, partout sur ClipBoost.</p>
      <ul class="mt-3 divide-y divide-line overflow-hidden ${CARD}">${items}</ul>
    </section>`;
}

function aUtilisateurs() {
  const f = state.adm, q = f.userQ.trim().toLowerCase();
  const byRole = (r) => db.users.filter((u) => !ADM_ROLES[r] || u.role === ADM_ROLES[r]);
  const list = byRole(f.userRole).filter((u) => (f.userStatus === "Tous" || u.status === f.userStatus) && (!q || `${u.name} ${u.email} ${u.country}`.toLowerCase().includes(q)));
  const roles = Object.keys(ADM_ROLES).map((r) => [r, r === "Tous les rôles" ? "Tous" : r, byRole(r).length]);
  const statuses = [["Tous", "Tous les statuts"], ["Actif", "Actifs"], ["Suspendu", "Suspendus"]];
  const requests = admPendingBadges();
  const nameLine = (u, cls) => `<div class="flex min-w-0 items-center gap-1.5">${admUserLink(u, cls)}${roleTag(u)}${u.verification === "pending" ? admBadgeAsked : ""}</div>`;

  const rows = list.map((u) => {
    const money_ = u.role === "admin" ? admDash : `${money(admBalance(u))}<span class="${TBL.tdSub} font-normal">${admBalanceLabel(u)}</span>`;
    return {
      tr: `<tr data-row="${u.id}" class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}"><div class="flex min-w-0 items-center gap-3">${avatar(u, "sm")}<div class="min-w-0">${nameLine(u, "font-medium text-fg")}<span class="${TBL.tdSub} truncate"><span dir="ltr">${esc(u.email)}</span></span></div></div></td>
        <td class="${TBL.td} hidden xl:table-cell"><span class="whitespace-nowrap text-fg-muted">${esc(u.country)}</span></td>
        <td class="${TBL.td} hidden xl:table-cell"><span class="whitespace-nowrap tabular-nums text-fg-muted">${date(u.joined)}</span></td>
        <td class="${TBL.td} ${TBL.tdNum}">${money_}</td>
        <td class="${TBL.td}">${statusBadge(u.status)}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admUserActions(u, "sm", true)}</div></td>
      </tr>`,
      li: `<li data-row="${u.id}" class="${TBL.item}">
        <div class="flex items-start gap-3">${avatar(u, "md")}<div class="min-w-0 flex-1">${nameLine(u, "text-sm font-medium text-fg")}<p class="truncate text-xs text-fg-subtle"><span dir="ltr">${esc(u.email)}</span></p></div>${statusBadge(u.status)}</div>
        <div class="flex items-center justify-between gap-3 text-small"><span class="min-w-0 truncate text-fg-subtle">${esc(u.country)} · inscrit le ${date(u.joined)}</span>${u.role === "admin" ? "" : `<span class="shrink-0 font-medium">${money(admBalance(u))}<span class="font-normal text-fg-subtle"> ${admBalanceLabel(u)}</span></span>`}</div>
        <div class="grid grid-cols-2 gap-2">${admUserActions(u, "md")}</div>
      </li>`,
    };
  });

  // Pays et date d'inscription : visibles à partir de xl (et toujours sur la fiche et dans la liste mobile).
  const table = admTable("md", `<th scope="col" class="${TBL.th}">Utilisateur</th><th scope="col" class="${TBL.th} hidden xl:table-cell">Pays</th><th scope="col" class="${TBL.th} hidden xl:table-cell">Inscription</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Solde</th><th scope="col" class="${TBL.th}">Statut</th>${ADM_TH_ACTIONS}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));

  return `${pageHeader("Utilisateurs", "Clippers, agences et administrateurs. Les nouvelles inscriptions apparaissent ici automatiquement.")}
    ${admBadgeRequests(requests)}
    ${requests.length ? `<h2 class="mt-8 text-heading text-fg">Tous les comptes</h2>` : ""}
    ${admToolbar(`<div class="flex min-w-0 gap-2 xl:contents">${searchInput("adm-user-q", f.userQ, "Nom, email, pays", "Rechercher un utilisateur", "min-w-0 flex-1 xl:max-w-xs")}${select("adm-user-status", f.userStatus, [["Tous", "Tous statuts"], ...statuses.slice(1)], { label: "Statut", cls: "w-36 shrink-0 sm:hidden" })}</div>`,
      `<div class="flex min-w-0 items-center gap-2">${segmented("adm-user-role", f.userRole, roles, "Rôle", { scroll: true })}<span class="hidden sm:contents">${segmented("adm-user-status", f.userStatus, statuses, "Statut")}</span></div>`)}
    ${admCountLine(list.length, db.users.length, "compte", "comptes")}
    <div class="mt-3">${list.length ? table
      : emptyState("search", "Aucun utilisateur ne correspond", "Essayez un autre nom, un autre rôle ou effacez les filtres.", `<button type="button" data-action="adm-user-clear" class="${btn("secondary")}">Effacer les filtres</button>`)}</div>`;
}

// ---------- Fiche d'un utilisateur (#/admin/utilisateur/<id>) ----------

// Bannière d'une agence : sa photo de couverture (3:1), sinon le dégradé de la catégorie de ses campagnes.
function admCoverBanner(u, camps) {
  if (u.cover) return `<div class="relative aspect-[3/1] w-full overflow-hidden bg-muted" aria-hidden="true"><img src="${esc(u.cover)}" alt="" loading="lazy" decoding="async" class="absolute inset-0 size-full object-cover"/></div>`;
  const c = camps.find((x) => x.status === "Active") || camps[0];
  return `<div class="cover aspect-[3/1] w-full" data-cat="${c && CATEGORIES.includes(c.category) ? c.category : "Autre"}" aria-hidden="true"></div>`;
}

// Badge de vérification d'une agence : état de la demande et décision (accorder, refuser avec motif, retirer).
const ADM_VERIF_TAG = {
  pending: () => badge("Demande en attente", "info", { ic: "clock" }),
  verified: () => badge(`${verifiedBadge("size-3.5")}Vérifiée`, "info"),
  rejected: () => badge("Demande refusée", "danger", { dot: true }),
  none: () => badge("Non vérifiée", "idle", { dot: true }),
};
function admVerifCard(u) {
  const v = ADM_VERIF_TAG[u.verification] ? u.verification : "none";
  const note = u.verificationNote ? esc(u.verificationNote) : "";
  const act_ = (action, variant, label, ic = "", value = "") => `<button type="button" data-action="${action}" data-id="${u.id}"${value ? ` data-value="${value}"` : ""} class="${btn(variant, "md")}">${ic ? icon(ic) : ""}${label}</button>`;
  const body = {
    pending: `<div class="mt-4 rounded-tile bg-subtle p-3.5">
        <p class="text-xs font-medium text-fg-subtle">Message de l'agence</p>
        <p class="mt-1 break-words text-sm ${note ? "text-fg" : "text-fg-subtle"}">${note || "Aucun message joint à la demande."}</p></div>
      <p class="mt-3 text-small text-fg-muted">Vérifiez l'identité de l'agence (registre du commerce, site officiel, comptes de la marque) avant d'accorder le badge.</p>
      <div class="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">${act_("adm-verify", "dangerSoft", "Refuser", "", "reject")}${act_("adm-verify-approve", "primary", "Accorder le badge", "shield")}</div>`,
    verified: `<p class="mt-4 flex items-start gap-2.5 text-sm text-fg">${verifiedBadge("mt-0.5 size-5")}<span>Le badge bleu s'affiche à côté du nom de l'agence, sur ses campagnes et sur sa page.</span></p>
      <div class="mt-4 flex sm:justify-end">${act_("adm-verify", "dangerSoft", "Retirer le badge", "", "revoke")}</div>`,
    rejected: `${note ? `<div class="mt-4">${alertBox("danger", `<p class="font-medium">Motif du refus</p><p class="mt-0.5 break-words">${note}</p>`)}</div>` : ""}
      <p class="mt-3 text-small text-fg-muted">L'agence peut envoyer une nouvelle demande depuis son profil. Vous pouvez aussi lui accorder le badge directement.</p>
      <div class="mt-4 flex sm:justify-end">${act_("adm-verify-approve", "secondary", "Accorder le badge", "shield")}</div>`,
    none: `${note ? `<p class="mt-4 text-small text-fg-muted">Badge retiré${NB}: ${note}</p>` : `<p class="mt-4 text-small text-fg-muted">Aucune demande en cours. L'agence peut demander le badge depuis son profil, ou vous pouvez le lui accorder directement.</p>`}
      <div class="mt-4 flex sm:justify-end">${act_("adm-verify-approve", "secondary", "Accorder le badge", "shield")}</div>`,
  }[v];
  return card(`${cardHeader("Badge de vérification", "Le badge bleu certifie l'identité de l'agence.", ADM_VERIF_TAG[v]())}${body}`);
}

// Mouvements d'argent d'un compte (retraits d'un clipper, recharges d'une agence) : une demande en cours mène à
// Paiements, sur sa ligne (#/admin/retraits/<id>).
function admTxList(list) {
  return `<ul class="divide-y divide-line overflow-hidden ${CARD}">${list.map((t) => {
    const card_ = t.type === "recharge" ? admCardOf(t) : null, out = t.type === "retrait";
    const how = card_ ? `${card_.brand} •••• ${card_.last4}` : t.method ? admCap(t.method) : "";
    return `<li data-row="${t.id}" class="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-fg-muted" aria-hidden="true">${icon(out ? "arrowUpRight" : card_ ? "card" : "arrowDownLeft", "size-4")}</span>
      <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(t.label)}</p>
        <p class="truncate text-xs tabular-nums text-fg-subtle">${admWhen(t)}${how && !card_ && !out ? ` · ${how}` : ""} · ${code(t.ref)}${t.fee ? ` · frais ${da(t.fee)}` : ""}</p></div>
      <div class="flex shrink-0 flex-col items-end gap-1"><span class="text-sm font-medium">${money(Math.abs(t.amount))}</span>
        ${t.status === "En cours" ? `<a href="#/admin/retraits/${encodeURIComponent(t.id)}" class="${btn("link", "", "text-xs")}">À traiter</a>` : statusBadge(t.status)}</div>
    </li>`;
  }).join("")}</ul>`;
}

function aUtilisateur() {
  const u = userById(state.route.item || "");
  const crumb = (name) => `<nav aria-label="Fil d'Ariane"><ol class="flex min-w-0 items-center gap-1.5 text-small">
      <li class="shrink-0"><a href="#/admin/utilisateurs" class="${HIT} inline-flex items-center gap-1 rounded-sm font-medium text-fg-muted transition-colors duration-150 hover:text-fg ${FOCUS}">${icon("arrowLeft", "size-4 sm:hidden rtl:-scale-x-100")}Utilisateurs</a></li>
      <li class="hidden shrink-0 text-fg-subtle sm:block" aria-hidden="true">${icon("chevronRight", "size-3.5 rtl:-scale-x-100")}</li>
      <li class="hidden min-w-0 truncate text-fg-subtle sm:block" aria-current="page">${esc(name)}</li></ol></nav>`;
  if (!u) {
    return `${crumb("Compte introuvable")}
      <h1 class="sr-only">Compte introuvable</h1>
      <div class="mt-6">${emptyState("users", "Compte introuvable", "Ce compte n'existe pas ou a été supprimé.", `<a href="#/admin/utilisateurs" class="${btn("secondary")}">Voir les utilisateurs</a>`)}</div>`;
  }
  const agency = u.role === "agence", clipper = u.role === "clipper", admin = u.role === "admin", self = u.id === state.session;
  const camps = agency ? db.campaigns.filter((c) => c.ownerId === u.id) : [];
  const pubs = clipper ? db.publications.filter((p) => p.userId === u.id) : [];
  const txs = db.transactions.filter((t) => t.userId === u.id && t.type === (agency ? "recharge" : "retrait"));

  // En-tête : couverture (agence), photo, nom et badge, rôle et statut, coordonnées.
  const tags = [
    admin ? badge("Administrateur", "brand", { ic: "shield" }) : agency ? badge("Agence", "info", { ic: "building" }) : badge(esc(u.level || "Clipper"), "brand", { ic: "medal" }),
    statusBadge(u.status),
    agency && u.verification === "pending" ? badge("Badge demandé", "info", { ic: "clock" }) : "",
  ].filter(Boolean).join("");
  const toggle = admin ? (self ? `<a href="#/admin/compte" class="${btn("secondary")}">${icon("pencil")}Modifier mon compte</a>` : "")
    : u.status === "Actif"
      ? `<button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="${btn("dangerSoft")}">${icon("ban")}Suspendre le compte</button>`
      : `<button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="${btn("secondary")}">${icon("play")}Réactiver le compte</button>`;
  const fact = (label, value) => `<div class="min-w-0"><dt class="text-xs text-fg-subtle">${label}</dt><dd class="mt-0.5 flex min-w-0 items-center gap-1 text-sm text-fg">${value}</dd></div>`;
  const country = u.country || "Algérie";
  const facts = [
    fact("Email", `<span class="min-w-0 break-all" dir="ltr">${esc(u.email || "")}</span>${u.email ? admCopyBtn(u.email, "Copier l'adresse email", "Adresse copiée") : ""}`),
    agency ? fact("Contact", u.contact ? `<span class="min-w-0 break-words">${esc(u.contact)}</span>` : `<span class="text-fg-subtle">Non renseigné</span>`) : "",
    clipper && u.handle ? fact("Compte principal", `<span class="min-w-0 truncate" dir="ltr">${esc(u.handle)}</span>`) : "",
    fact("Pays", `<span class="inline-flex items-center gap-1.5">${esc(country)}${country === "Algérie" ? flagDz() : ""}</span>`),
    fact(agency ? "Inscrite le" : "Inscrit le", `<span class="tabular-nums">${date(u.joined)}</span>`),
    u.locale && LOCALES[u.locale] ? fact("Langue", `<span lang="${u.locale}">${esc(LOCALES[u.locale].label)}</span>`) : "",
  ].filter(Boolean).join("");
  const header = `<section class="mt-4 overflow-hidden ${CARD}">
      ${agency ? admCoverBanner(u, camps) : ""}
      <div class="px-4 pb-5 sm:px-6 sm:pb-6 ${agency ? "" : "pt-5 sm:pt-6"}">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            ${avatar(u, `size-20 text-2xl sm:size-24 sm:text-3xl ${agency ? "relative -mt-10 ring-4 ring-surface sm:-mt-12" : ""}`)}
            <h1 class="mt-3 break-words text-title-sm text-fg sm:text-title">${nameWithBadge(u, "size-5 sm:size-6")}</h1>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">${tags}</div>
          </div>
          ${toggle ? `<div class="flex shrink-0 flex-wrap gap-2">${toggle}</div>` : ""}
        </div>
        ${u.bio ? `<p class="mt-4 max-w-2xl break-words text-sm leading-6 text-fg-muted">${esc(u.bio)}</p>` : ""}
        <dl class="mt-5 grid gap-x-8 gap-y-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3">${facts}</dl>
      </div>
    </section>`;

  if (admin) {
    return `${crumb(u.name)}${header}
      <div class="mt-4 lg:mt-5">${alertBox("info", `Compte administrateur : accès complet à l'espace d'administration. Il ne peut pas être suspendu depuis l'administration.`)}</div>`;
  }

  if (agency) {
    const running = camps.filter((c) => c.status === "Active" || c.status === "En pause"), clips = db.publications.filter((p) => camps.some((c) => c.id === p.campaign));
    const waiting = camps.filter((c) => c.status === "En attente").length, toModerate = clips.filter((p) => p.status === "En attente").length;
    const kpis = [
      kpi({ label: "Crédit disponible", value: bigMoney(u.credit || 0), sub: (() => { const r = admSum(txs.filter((t) => t.status === "En cours"), (t) => t.amount); return r ? `${da(r)} de recharge à confirmer` : "pour financer ses campagnes"; })() }),
      kpi({ label: "Campagnes en cours", value: kpiValue(fmt(running.length)), sub: waiting ? `${plural(waiting, "en attente", "en attente")} de vérification` : `sur ${plural(camps.length, "campagne", "campagnes")}` }),
      kpi({ label: "Budget consommé", value: bigMoney(admSum(camps, (c) => c.spent)), sub: `sur ${da(admSum(running, (c) => c.budget))} engagés` }),
      kpi({ label: "Clips reçus", value: kpiValue(fmt(clips.length)), sub: toModerate ? `${fmt(toModerate)} à modérer` : "Tout est modéré" }),
    ];
    return `${crumb(u.name)}${header}
      <div class="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-5 lg:gap-5 xl:grid-cols-4">${kpis.join("")}</div>
      <div class="mt-4 max-w-3xl lg:mt-5">${admVerifCard(u)}</div>
      ${sectionHeader("Campagnes de l'agence")}
      ${camps.length ? admCampTable(camps, { owner: false }) : emptyState("target", "Aucune campagne", "Les campagnes créées par cette agence apparaîtront ici.")}
      ${sectionHeader("Recharges de crédit")}
      ${txs.length ? admTxList(txs) : emptyState("bank", "Aucune recharge", "Les recharges de crédit annoncées par l'agence apparaîtront ici.")}`;
  }

  // Clipper : gains, moyen de retrait, clips (décision possible depuis sa fiche) et retraits.
  const count = (s) => pubs.filter((p) => p.status === s).length;
  const views = admSum(pubs.filter((p) => p.status === "Validée"), (p) => p.views), acc = admAccountValue(u.payoutAccount);
  const kpis = [
    kpi({ label: "Gains totaux", value: bigMoney(totalEarned(u)), sub: "depuis l'inscription" }),
    kpi({ label: "Solde retirable", value: bigMoney(balance(u)), sub: pendingAmount(u) ? `${da(pendingAmount(u))} en rétention` : "aucun gain en rétention" }),
    kpi({ label: "Clips soumis", value: kpiValue(fmt(pubs.length)), sub: `${plural(count("Validée"), "validé", "validés")} · ${fmt(count("En attente"))} en attente` }),
    kpi({ label: "Vues validées", value: kpiValue(compact(views)), sub: count("Refusée") ? plural(count("Refusée"), "clip refusé", "clips refusés") : "aucun clip refusé" }),
  ];
  const payout = card(`${cardHeader("Moyen de retrait", "Compte sur lequel ses retraits sont virés.")}
      <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">${u.payoutMethod
        ? `${badge(esc(u.payoutMethod), "idle")}${acc ? `<span class="flex min-w-0 items-center gap-0.5"><span class="min-w-0 break-all font-mono text-small font-medium text-fg" dir="ltr">${admAccount(acc)}</span>${admCopyBtn(acc, "Copier le numéro", "Numéro copié")}</span>` : `<span class="text-small text-fg-subtle">Numéro non renseigné</span>`}`
        : `<span class="text-small text-fg-subtle">Aucun moyen de retrait enregistré.</span>`}</div>`);
  const handles = u.handles ? Object.entries({ tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" }).filter(([k]) => u.handles[k]) : [];
  const accounts = card(`${cardHeader("Comptes de publication", "Déclarés par le clipper dans son profil.")}
      ${handles.length ? `<ul class="mt-4 grid gap-2">${handles.map(([k, label]) => `<li class="flex min-w-0 items-center gap-2 text-sm text-fg">${icon(PLATFORM_ICON[label] || "film", "size-4 shrink-0 text-fg-muted")}<span class="text-fg-muted">${label}</span><span class="min-w-0 truncate font-medium" dir="ltr">${esc(u.handles[k])}</span></li>`).join("")}</ul>`
        : `<p class="mt-4 text-small text-fg-subtle">Aucun compte déclaré.</p>`}`);
  return `${crumb(u.name)}${header}
    <div class="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-5 lg:gap-5 xl:grid-cols-4">${kpis.join("")}</div>
    <div class="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">${payout}${accounts}</div>
    ${sectionHeader("Clips")}
    ${pubs.length ? admPubTable(publicationsTable(pubs, { actions: true, amountLabel: "Gain" }), "xl") : emptyState("film", "Aucun clip soumis", "Les clips soumis par ce clipper apparaîtront ici.")}
    ${sectionHeader("Retraits")}
    ${txs.length ? admTxList(txs) : emptyState("wallet", "Aucun retrait", "Les demandes de retrait de ce clipper apparaîtront ici.")}`;
}

// ---------- Campagnes ----------

const ADM_CAMP_STATUS = [["Toutes", "Toutes"], ["Active", "Actives"], ["En attente", "En attente"], ["En pause", "En pause"], ["Terminée", "Terminées"], ["Refusée", "Refusées"]];
const admTopTag = `<span class="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] bg-warning-bg px-1.5 text-micro font-semibold text-warning-fg ring-1 ring-inset ring-warning-border" title="Top campagne">${icon("star", "size-3", true)}Top</span>`;

// Sous-ligne d'une campagne : agence (lien vers sa fiche) ou ClipBoost, marque si elle diffère, catégorie.
function admCampSub(c, withOwner = true) {
  const o = c.ownerId ? userById(c.ownerId) : null;
  const sep = `<span class="shrink-0" aria-hidden="true">·</span>`;
  const who = !withOwner ? ""
    : o ? `${admUserLink(o, "font-medium text-fg-muted hover:text-fg")}${sep}`
    : `<span class="shrink-0">${c.ownerId ? "Agence supprimée" : "ClipBoost"}</span>${sep}`;
  const brand = !o || c.brand !== o.name ? `${esc(c.brand)} · ` : "";
  return `${who}<span class="min-w-0 truncate">${brand}${esc(c.category)}</span>`;
}

// Actions par statut, sur une ligne ; l'action principale est à droite (comme la colonne Décision de la modération).
// Une campagne en attente s'examine dans sa fiche (approbation) ; un refus passe toujours par son motif ; « Terminer »
// demande une confirmation (définitif, le budget non consommé est rendu à l'agence).
function admCampActions(c, size) {
  // Action secondaire à largeur fixe dès sm : « Terminer » garde la même position d'une ligne à l'autre.
  const b = (action, variant, label, ic = "") => `<button type="button" data-action="${action}" data-id="${c.id}" class="${btn(variant, size, variant === "ghost" || variant === "dangerSoft" ? "" : "sm:min-w-[7.5rem]")}">${ic ? icon(ic) : ""}${label}</button>`;
  return {
    "En attente": b("adm-camp-refuse", "dangerSoft", "Refuser") + b("adm-camp", "primary", "Examiner"),
    "Active": b("adm-camp-end", "ghost", "Terminer") + b("adm-camp-pause", "secondary", "Pause", "pause"),
    "En pause": b("adm-camp-end", "ghost", "Terminer") + b("adm-camp-resume", "secondary", "Reprendre", "play"),
  }[c.status] || b("adm-camp", "ghost", "Détails");
}

// Tableau des campagnes (page Campagnes, fiche d'une agence) : la vignette et le titre ouvrent la fiche d'examen.
function admCampTable(list, { owner = true } = {}) {
  const thumb = (c) => `<button type="button" data-action="adm-camp" data-id="${c.id}" tabindex="-1" aria-hidden="true" class="shrink-0 rounded-tile">${coverThumb(c, "sm")}</button>`;
  const title = (c, cls = "") => `<p class="flex min-w-0 items-center gap-1.5"><button type="button" data-action="adm-camp" data-id="${c.id}" class="${ADM_ROW_LINK} ${cls}" title="Examiner la campagne"><span class="block truncate">${esc(c.title)}</span></button>${c.top ? admTopTag : ""}</p>`;
  const trs = list.map((c) => `<tr data-row="${c.id}" class="${TBL.tr}">
      <td class="${ADM_TD_MAIN}"><div class="flex min-w-0 items-center gap-3">${thumb(c)}<div class="min-w-0">${title(c)}<p class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${admCampSub(c, owner)}</p></div></div></td>
      <td class="${TBL.td}">${statusBadge(c.status)}</td>
      <td class="${TBL.td} ${TBL.tdNum}">${money(c.rate)}<span class="${TBL.tdSub} font-normal">/ 1${NB}000${NB}vues</span></td>
      <td class="${TBL.td}"><div class="min-w-44">${progress(c.spent, c.budget)}</div></td>
      <td class="${TBL.td} ${TBL.tdNum}">${fmt(c.clippers)}</td>
      <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admCampActions(c, "sm")}</div></td>
    </tr>`).join("");
  // Sous xl : une ligne par campagne (identité | budget), actions en boutons md dessous, alignées à droite dès sm.
  const lis = list.map((c) => `<li data-row="${c.id}" class="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:items-center sm:gap-x-8 sm:px-5">
      <div class="flex min-w-0 items-start gap-3">${thumb(c)}<div class="min-w-0 flex-1">${title(c, "text-sm")}<p class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${admCampSub(c, owner)}</p>
        <p class="mt-1 text-xs tabular-nums text-fg-subtle">${rateShort(c.rate)} · ${plural(c.clippers, "clipper", "clippers")}</p></div>${statusBadge(c.status)}</div>
      <div class="min-w-0">${progress(c.spent, c.budget)}</div>
      <div class="grid grid-cols-2 gap-2 sm:col-span-2 sm:flex sm:justify-end [&>:only-child]:col-span-2">${admCampActions(c, "md")}</div>
    </li>`).join("");
  return admTable("xl", `<th scope="col" class="${TBL.th}">Campagne</th><th scope="col" class="${TBL.th}">Statut</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Tarif</th><th scope="col" class="${TBL.th}">Budget</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Clippers</th>${ADM_TH_ACTIONS}`, trs, lis);
}

function aCampagnes() {
  const f = state.adm, q = f.campQ.trim().toLowerCase();
  const owner = (c) => (c.ownerId ? userById(c.ownerId) : null);
  const searched = db.campaigns.filter((c) => { const o = owner(c); return !q || `${c.title} ${c.brand} ${c.category} ${o ? o.name : ""}`.toLowerCase().includes(q); });
  const list = searched.filter((c) => f.campStatus === "Toutes" || c.status === f.campStatus);
  const options = ADM_CAMP_STATUS.map(([v, l]) => [v, l, v === "Toutes" ? searched.length : searched.filter((c) => c.status === v).length]);
  return `${pageHeader("Campagnes", "Examinez, approuvez, mettez en pause ou créez des campagnes. Seules les campagnes actives sont visibles par les clippers.",
      `<button type="button" data-action="adm-new-campaign" class="${btn("primary")}">${icon("plus")}Nouvelle campagne</button>`)}
    ${admToolbar(searchInput("adm-camp-q", f.campQ, "Titre, marque, catégorie ou agence", "Rechercher une campagne", "w-full xl:max-w-xs"),
      chips("adm-camp-status", f.campStatus, options, "Statut"))}
    ${admCountLine(list.length, db.campaigns.length, "campagne", "campagnes")}
    <div class="mt-3">${list.length ? admCampTable(list)
      : emptyState("search", "Aucune campagne ne correspond", "Essayez un autre statut ou effacez la recherche.", `<button type="button" data-action="adm-camp-clear" class="${btn("secondary")}">Effacer les filtres</button>`)}</div>`;
}

// ---------- Modération ----------

function aModeration() {
  const f = state.adm, s = db.settings, all = db.publications;
  const n = (st) => all.filter((p) => p.status === st).length;
  const list = all.filter((p) => f.modStatus === "Toutes" || p.status === f.modStatus);
  // Règles longues repliées : un résumé d'une ligne, le détail au clic.
  const rules = alertBox("info", `<details class="group">
      <summary class="flex cursor-pointer list-none items-center gap-1.5 font-medium [&::-webkit-details-marker]:hidden">Gains crédités : seuil, plafond et rétention${icon("chevronDown", "size-4 shrink-0 transition-transform duration-150 group-open:rotate-180")}</summary>
      <p class="mt-1.5">Les gains d'un clip validé sont crédités au clipper, seuil et plafond appliqués, et restent ${plural(s.holdDays, "jour", "jours")} en rétention. Pendant ${plural(s.earningDays, "jour", "jours")} après la validation, chaque nouveau relevé paie les vues supplémentaires.</p>
    </details>`);
  const empty = f.modStatus === "En attente"
    ? emptyState("check", "Tout est à jour", "Aucun clip en attente de modération.")
    : emptyState("film", "Aucun clip dans cette catégorie", "Changez de filtre pour voir les autres clips.");
  return `${pageHeader("Modération des clips", "Ouvrez chaque clip pour vérifier sa vidéo et ses vues, puis validez ceux qui respectent les règles de la campagne.")}
    <div class="mt-6">${rules}</div>
    <div class="mt-6">${segmented("adm-mod-status", f.modStatus, [["En attente", "En attente", n("En attente")], ["Validée", "Validées", n("Validée")], ["Refusée", "Refusées", n("Refusée")], ["Toutes", "Toutes", all.length]], "Statut", { scroll: true })}</div>
    <div class="mt-4">${list.length ? admPubTable(publicationsTable(list, { showUser: true, actions: true, amountLabel: f.modStatus === "En attente" ? "Gain estimé" : "Gain" })) : empty}</div>`;
}

// ---------- Paiements ----------

const admPayActions = (t, size, approveLabel) => (t.status === "En cours"
  ? `<button type="button" data-action="adm-tx-reject" data-id="${t.id}" class="${btn("dangerSoft", size)}">Rejeter</button><button type="button" data-action="adm-tx-approve" data-id="${t.id}" class="${btn("primary", size)}">${approveLabel}</button>`
  : "");
// Ligne mono + Copier (compte, référence) des cartes.
const admMonoLine = (label, html, value, copyLabel, msg) =>
  `<div class="grid gap-0.5"><dt class="text-xs text-fg-subtle">${label}</dt><dd class="flex min-w-0 items-center justify-between gap-2"><span class="min-w-0 truncate font-mono text-sm text-fg" dir="ltr">${html}</span>${value ? admCopyBtn(value, copyLabel, msg) : ""}</dd></div>`;
const admMoneyRows = (rows) => `<dl class="grid gap-1.5 text-small">${rows.map(([l, v, strong]) => `<div class="flex items-baseline justify-between gap-4 ${strong ? "border-t border-line pt-2 font-semibold text-fg first:border-t-0 first:pt-0" : "text-fg-muted"}"><dt>${l}</dt><dd class="text-end">${v}</dd></div>`).join("")}</dl>`;
const admWhen = (t) => `${date(t.date)}${t.time ? ` · ${esc(t.time)}` : ""}`;
// Carte d'une demande (sous la largeur du tableau) : identité et coordonnées à gauche, argent et décision à droite dès sm.
const admPayItem = (u, sub, badgeHtml, details, moneyHtml, actions, id) => `<li data-row="${id}" class="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] sm:gap-x-8 sm:px-5">
    <div class="grid min-w-0 content-start gap-3">
      <div class="flex items-start gap-3">${avatar(u, "md")}<div class="min-w-0 flex-1"><p class="flex min-w-0 text-sm font-medium text-fg">${admUserLink(u)}</p><p class="truncate text-xs tabular-nums text-fg-subtle">${sub}</p></div>${badgeHtml}</div>
      <dl class="grid gap-2.5 rounded-tile bg-subtle p-3">${details}</dl>
    </div>
    <div class="grid content-start gap-3 sm:pt-1">${moneyHtml}${actions ? `<div class="grid grid-cols-2 gap-2 sm:flex sm:flex-col-reverse">${actions}</div>` : ""}</div>
  </li>`;
const admPayer = (u, t) => `<div class="flex min-w-0 items-center gap-2.5">${avatar(u, "sm")}<div class="min-w-0"><p class="flex min-w-0 font-medium text-fg">${admUserLink(u)}</p><span class="${TBL.tdSub} tabular-nums">${admWhen(t)}</span></div></div>`;
// Moyen d'une recharge : la carte (marque et 4 derniers chiffres) pour un paiement Visa / Mastercard, sinon le moyen.
const admRechargeMethod = (t) => {
  const card_ = admCardOf(t);
  if (card_) return `<span class="flex flex-wrap items-center gap-1.5">${badge(card_.brand, "idle", { ic: "card" })}${admCardNumber(card_)}</span>`;
  return t.method ? badge(admCap(t.method), "idle") : admDash;
};

// Retraits : tableau à partir de 1 400 px (7 colonnes), cartes en dessous. La date de la demande est sous le nom.
function admWithdrawals(list) {
  const rows = list.map((t) => {
    const u = admUser(t.userId), acc = admAccountValue(u.payoutAccount), method = t.method || u.payoutMethod || "", pending = t.status === "En cours";
    const fee = t.fee ? admMuted(t.fee) : admDash;
    return {
      tr: `<tr data-row="${t.id}" class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}">${admPayer(u, t)}</td>
        <td class="${TBL.td}"><div class="flex items-center gap-1.5"><div class="grid justify-items-start gap-1">${method ? badge(esc(method), "idle") : ""}${acc ? `<span class="whitespace-nowrap font-mono text-small text-fg" dir="ltr">${admAccount(acc)}</span>` : `<span class="text-xs text-fg-subtle">Aucun compte enregistré</span>`}</div>${acc ? admCopyBtn(acc, "Copier le numéro", "Numéro copié") : ""}</div></td>
        <td class="${TBL.td}"><span class="whitespace-nowrap text-small text-fg">${code(t.ref)}</span></td>
        <td class="${TBL.td} ${TBL.tdNum}">${money(-t.amount)}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${fee}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${money(admNet(t), { cls: "font-semibold" })}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admPayActions(t, "sm", "Virement effectué") || statusBadge(t.status)}</div></td>
      </tr>`,
      li: admPayItem(u, `Demandé le ${admWhen(t)}`, pending ? badge("À virer", "info", { dot: true }) : statusBadge(t.status),
        admMonoLine(method ? `Compte ${esc(method)}` : "Compte", acc ? admAccount(acc) : `<span class="font-sans text-small text-fg-subtle">Aucun compte enregistré</span>`, acc, "Copier le numéro", "Numéro copié")
        + admMonoLine("Référence", esc(t.ref), t.ref, "Copier la référence", "Référence copiée"),
        admMoneyRows([["Montant demandé", money(-t.amount)], ["Frais", fee], ["Net à virer", money(admNet(t)), true]]),
        admPayActions(t, "md", "Virement effectué"), t.id),
    };
  });
  return admTable("wide", `<th scope="col" class="${TBL.th}">Bénéficiaire</th><th scope="col" class="${TBL.th}">Moyen et compte</th><th scope="col" class="${TBL.th}">Référence</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Montant</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Frais</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Net à virer</th>${ADM_TH_ACTIONS}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));
}

// Recharges : tableau à partir de xl (5 colonnes), cartes en dessous. Carte Visa / Mastercard : marque et •••• 4242.
function admRecharges(list) {
  const rows = list.map((t) => {
    const u = admUser(t.userId), pending = t.status === "En cours", card_ = admCardOf(t);
    const how = card_ ? `${card_.brand} •••• ${card_.last4}` : admCap(t.method);
    return {
      tr: `<tr data-row="${t.id}" class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}">${admPayer(u, t)}</td>
        <td class="${TBL.td}">${admRechargeMethod(t)}</td>
        <td class="${TBL.td}"><span class="flex items-center gap-0.5"><span class="whitespace-nowrap text-small text-fg">${code(t.ref)}</span>${admCopyBtn(t.ref, "Copier la référence", "Référence copiée")}</span></td>
        <td class="${TBL.td} ${TBL.tdNum}">${money(t.amount, { cls: "font-semibold" })}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admPayActions(t, "sm", "Paiement reçu") || statusBadge(t.status)}</div></td>
      </tr>`,
      li: admPayItem(u, `${how || "Recharge"} · ${admWhen(t)}`, pending ? badge("À confirmer", "info", { dot: true }) : statusBadge(t.status),
        (card_ ? `<div class="grid gap-0.5"><dt class="text-xs text-fg-subtle">Carte</dt><dd class="flex items-center gap-1.5">${badge(card_.brand, "idle", { ic: "card" })}${admCardNumber(card_)}</dd></div>` : "")
        + admMonoLine("Référence du paiement", esc(t.ref), t.ref, "Copier la référence", "Référence copiée"),
        admMoneyRows([["Montant annoncé", money(t.amount), true]]),
        admPayActions(t, "md", "Paiement reçu"), t.id),
    };
  });
  return admTable("xl", `<th scope="col" class="${TBL.th}">Agence</th><th scope="col" class="${TBL.th}">Moyen</th><th scope="col" class="${TBL.th}">Référence</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Montant</th>${ADM_TH_ACTIONS}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));
}

function aRetraits() {
  const tab = state.adm.payTab === "recharges" ? "recharges" : "retraits";
  // Les demandes à traiter d'abord, puis l'historique (ordre du serveur conservé).
  const byType = (type) => db.transactions.filter((t) => t.type === type).sort((a, b) => (b.status === "En cours") - (a.status === "En cours"));
  const pw = pendingWithdrawals(), pr = pendingRecharges();
  const tabs = [["retraits", "Retraits", "Retraits des clippers", pw.length], ["recharges", "Recharges", "Recharges des agences", pr.length]];
  const tablist = `<div class="${TABLIST}" role="tablist" aria-label="Type de paiement">${tabs.map(([v, short, long, n]) =>
    `<button type="button" role="tab" id="adm-tab-${v}" aria-controls="adm-pay-panel" aria-selected="${tab === v}" data-action="adm-pay-tab" data-value="${v}" class="${TAB}"><span class="sm:hidden">${short}</span><span class="hidden sm:inline">${long}</span>${n ? countBadge(n, "queue") : ""}</button>`).join("")}</div>`;
  const list = byType(tab === "retraits" ? "retrait" : "recharge");
  const intro = tab === "retraits"
    ? ["Approuvez après avoir effectué le virement vers le compte indiqué.", pw.length ? `${plural(pw.length, "demande", "demandes")} · ${da(admSum(pw, admNet))} à virer` : ""]
    : ["Confirmez à réception du paiement (virement, carte Edahabia, CIB, Visa ou Mastercard) : le montant est alors ajouté au crédit de l'agence.", pr.length ? `${plural(pr.length, "recharge", "recharges")} · ${da(admSum(pr, (t) => t.amount))} annoncés` : ""];
  const body = list.length
    ? (tab === "retraits" ? admWithdrawals(list) : admRecharges(list))
    : tab === "retraits"
      ? emptyState("wallet", "Aucune demande de retrait", "Les demandes des clippers apparaîtront ici.")
      : emptyState("bank", "Aucune recharge", "Les recharges annoncées par les agences apparaîtront ici.");
  return `${pageHeader("Paiements", `Retraits des clippers (minimum ${da(db.settings.minWithdraw)}) et recharges de crédit des agences.`)}
    <div class="mt-6">${tablist}</div>
    <div id="adm-pay-panel" role="tabpanel" aria-labelledby="adm-tab-${tab}">
      <div class="mt-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"><p class="text-small text-fg-muted">${intro[0]}</p>${intro[1] ? `<p class="shrink-0 text-small font-medium tabular-nums text-fg">${intro[1]}</p>` : ""}</div>
      <div class="mt-4">${body}</div>
    </div>`;
}

// ---------- Réglages ----------

// Aperçu en direct du formulaire de réglages : compteur et bandeau d'annonce.
LIVE.admSettings = (d) => {
  const text = String(d.announcement || "").trim();
  return {
    count: `${fmt(String(d.announcement || "").length)}${NB}/${NB}140`,
    preview: text
      ? `<div class="flex items-center gap-2 rounded-control border border-brand-line bg-brand-soft px-3 py-2 text-small font-medium text-brand-fg">${icon("megaphone", "size-4 shrink-0")}<span class="min-w-0 truncate">${esc(text)}</span></div>`
      : `<p class="text-xs text-fg-subtle">Aucun bandeau affiché.</p>`,
  };
};

const admSettingRow = (title, desc, control, id) =>
  `<div data-field class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-8 sm:gap-y-2 [&>[data-field-error]]:basis-full sm:[&>[data-field-error]]:justify-end">
    <div class="min-w-0 sm:flex-1"><label for="${id}" class="text-sm font-medium text-fg">${title}</label><p id="${id}-desc" class="mt-0.5 text-small text-fg-muted">${desc}</p></div>
    <div class="shrink-0 sm:w-48">${control}</div></div>`;
const admSwitchRow = (s, key, title, desc) =>
  `<div class="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
    <div class="min-w-0"><p class="text-sm font-medium text-fg">${title}</p><p class="mt-0.5 text-small text-fg-muted">${desc}</p></div>
    ${switchBtn(!!s[key], "adm-setting", key, title)}</div>`;
// Champs numériques des réglages : bornes vérifiées avant l'envoi (mêmes règles que le serveur), message en français.
const ADM_LIMITS = {
  minWithdraw: ["Retrait minimum", 0, Infinity], minBudget: ["Budget minimum d'une campagne", 0, Infinity], commissionRate: ["Commission ClipBoost", 0, 50],
  instantFeePercent: ["Frais du retrait instantané", 0, 20, true], instantMinFee: ["Frais minimum du retrait instantané", 0, Infinity],
  holdDays: ["Rétention des gains", 0, 60], earningDays: ["Fenêtre de gains", 1, 60],
};
// Valeur affichée avec séparateur de milliers (« 50 000 ») ou virgule décimale (« 2,5 »).
const admNumber = (s, key, unit) => {
  const decimal = ADM_LIMITS[key][3], v = Number(s[key]) || 0;
  return unitInput(`id="set-${key}" name="${key}" type="text" ${decimal ? 'inputmode="decimal" ' : ""}value="${decimal ? String(v).replace(".", ",") : fmt(v)}" autocomplete="off" aria-describedby="set-${key}-desc"`, unit);
};

function aParametres() {
  const s = db.settings, live = LIVE.admSettings(s);
  const group = (title, desc, rows) => card(`${cardHeader(title, desc)}<div class="mt-4 divide-y divide-line">${rows}</div>`);
  return `${pageHeader("Réglages du site", "Ces réglages s'appliquent immédiatement à tout le site.")}
    <div class="mt-6 grid max-w-3xl gap-4 lg:gap-5">
      ${group("Accès", "Ces interrupteurs prennent effet dès le clic.",
        admSwitchRow(s, "signupsOpen", "Inscriptions ouvertes", "Autoriser la création de nouveaux comptes Clipper et Agence.")
        + admSwitchRow(s, "maintenance", "Mode maintenance", "Bloque la connexion des clippers et des agences et affiche un bandeau."))}
      <form data-form="adm-settings" data-live="admSettings" novalidate class="grid gap-4 lg:gap-5">
        ${card(`${cardHeader("Annonce", "Bandeau affiché en haut du site et des espaces.")}
          <div class="mt-4 grid gap-1.5">
            <div class="flex items-baseline justify-between gap-3"><label for="set-announcement" class="text-small font-medium text-fg">Texte de l'annonce</label><span data-live-out="count" class="text-xs tabular-nums text-fg-subtle">${live.count}</span></div>
            <textarea id="set-announcement" name="announcement" rows="3" maxlength="140" placeholder="Ex. Nouvelle campagne Ramadan disponible" aria-describedby="set-announcement-desc" class="${textareaCls}">${esc(s.announcement)}</textarea>
            <span id="set-announcement-desc" class="text-xs text-fg-subtle">Laisser vide pour masquer le bandeau.</span>
          </div>
          <div class="mt-4 grid gap-1.5"><span class="text-small font-medium text-fg">Aperçu</span><div data-live-out="preview">${live.preview}</div></div>`)}
        ${group("Argent", "Montants et commissions appliqués aux retraits et aux campagnes.",
          admSettingRow("Retrait minimum", "Montant minimum qu'un clipper peut retirer.", admNumber(s, "minWithdraw", "DA"), "set-minWithdraw")
          + admSettingRow("Budget minimum d'une campagne", "Budget exigé pour créer une campagne.", admNumber(s, "minBudget", "DA"), "set-minBudget")
          + admSettingRow("Commission ClipBoost", "Ajoutée au budget des nouvelles campagnes.", admNumber(s, "commissionRate", "%"), "set-commissionRate")
          + admSettingRow("Frais du retrait instantané", "Pourcentage prélevé sur un retrait instantané.", admNumber(s, "instantFeePercent", "%"), "set-instantFeePercent")
          + admSettingRow("Frais minimum du retrait instantané", "Montant prélevé au minimum sur un retrait instantané.", admNumber(s, "instantMinFee", "DA"), "set-instantMinFee"))}
        ${group("Délais", "Contrôle et rémunération des clips validés.",
          admSettingRow("Rétention des gains", "Délai de contrôle avant qu'un gain validé devienne retirable.", admNumber(s, "holdDays", "jours"), "set-holdDays")
          + admSettingRow("Fenêtre de gains", "Après la validation, chaque nouveau relevé paie les vues supplémentaires pendant ce délai.", admNumber(s, "earningDays", "jours"), "set-earningDays"))}
        <div data-sticky-save class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-4 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-popover backdrop-blur-md sm:px-5 lg:bottom-4">
          <p class="hidden text-small text-fg-muted sm:block">Annonce, montants et délais s'appliquent à tout le site dès l'enregistrement.</p>
          <button type="submit" class="${btn("primary", "md", "w-full sm:w-auto")}">Enregistrer</button>
        </div>
      </form>
      ${window.__CLIPBOOST_OFFLINE__ ? `<section class="mt-4 flex flex-col gap-3 rounded-card border border-dashed border-line-strong p-5 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0"><h2 class="text-section text-fg">Version de démonstration</h2><p class="mt-0.5 text-small text-fg-muted">Les données sont enregistrées dans ce navigateur.</p></div>
        <button type="button" data-action="adm-reset-demo" class="${btn("dangerSoft", "sm")}">Réinitialiser la démo</button></section>` : ""}
    </div>`;
}

// ---------- Mon compte (#/admin/compte) ----------
// Photo et nom de l'administrateur (PATCH /api/me), langue et thème de l'interface, mot de passe (accountCard, ui.js).
function aCompte() {
  const u = me();
  // Sans photo : les initiales sur la teinte de l'avatar, à la taille du cadre de l'aperçu.
  const fallback = avatar({ ...u, avatar: null }, "size-full text-2xl");
  const pref = (title, text, control) => `<div class="grid gap-3 py-4 first:pt-0 last:pb-0">
      <div class="min-w-0"><p class="text-sm font-medium text-fg">${title}</p><p class="mt-0.5 text-xs text-fg-subtle">${text}</p></div>${control}</div>`;
  const profile = card(`<form data-form="adm-account" novalidate>
      ${cardHeader("Profil", "Votre photo et votre nom s'affichent dans la barre du haut et dans le journal d'activité.")}
      <div class="mt-5">${imageField({ name: "avatar", value: u.avatar || "", shape: "avatar", label: "Photo de profil", hint: "JPEG, PNG ou WebP. Elle est recadrée en carré et s'affiche en rond.", fallback })}</div>
      <div class="mt-5">${field("Nom", `<input name="name" required maxlength="80" value="${esc(u.name)}" autocomplete="name" class="${inputCls}"/>`)}</div>
      <div class="mt-6 flex justify-end"><button type="submit" class="${btn("primary", "md", "w-full sm:w-auto")}">Enregistrer</button></div>
    </form>`);
  const prefs = card(`${cardHeader("Préférences", "La langue et l'apparence de votre espace.")}
      <div class="mt-4 divide-y divide-line">
        ${pref("Langue", "Enregistrée sur votre compte : elle vous suit sur tous vos appareils.", langSwitch({ full: true, cls: "w-full sm:w-auto" }))}
        ${pref("Thème", "Clair, sombre, ou selon le réglage de votre appareil.", themeModeSwitch({ labels: true, cls: "w-full sm:w-auto" }))}
      </div>`);
  return `${pageHeader("Mon compte", "Votre photo, votre nom, la langue et le thème de l'administration, et la sécurité du compte.",
      `<a href="#/admin/parametres" class="${btn("secondary")}">${icon("gear")}Réglages du site</a>`)}
    <div class="mt-6 grid items-start gap-4 lg:gap-5 xl:grid-cols-2">
      <div class="grid content-start gap-4 lg:gap-5">${profile}${prefs}</div>
      <div class="grid content-start gap-4 lg:gap-5">${accountCard(u)}</div>
    </div>`;
}

// utilisateur : page hors navigation (ITEM_PAGES dans main.js) ; compte : « Mon compte », ouverte par le menu du compte.
const ADMIN_VIEWS = { apercu: aApercu, utilisateurs: aUtilisateurs, utilisateur: aUtilisateur, campagnes: aCampagnes, moderation: aModeration, retraits: aRetraits, parametres: aParametres, compte: aCompte };

// ---------- Fiches d'examen ----------

const admTile = (label, value, sub = "", cls = "") => `<div class="${TILE} ${cls}"><dt class="text-xs text-fg-subtle">${label}</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${value}${sub ? `<span class="mt-0.5 block text-xs font-normal text-fg-subtle">${sub}</span>` : ""}</dd></div>`;
const admH3 = (title, extra = "") => `<div class="mt-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"><h3 class="text-section text-fg">${title}</h3>${extra}</div>`;
const admRules = (c) => (c.rules && c.rules.length
  ? `<ul class="mt-2 grid gap-2">${c.rules.map((r) => `<li class="flex gap-2.5 text-sm text-fg-muted">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span class="min-w-0 break-words">${esc(r)}</span></li>`).join("")}</ul>`
  : `<p class="mt-2 text-sm text-fg-subtle">Aucune règle particulière.</p>`);
const admPlatforms = (c) => `<div class="mt-2 flex flex-wrap gap-1.5">${PLATFORMS.filter((p) => (c.platforms || []).includes(p)).concat((c.platforms || []).filter((p) => !PLATFORMS.includes(p))).map(platformTag).join("")}</div>`;

// Dernière modification de la campagne par son agence (journal d'activité), pour l'examen d'une campagne en attente.
function admCampEdit(c, o) {
  if (!o) return null;
  const edited = `${o.name} a modifié la campagne « ${c.title} ».`, relaunched = `${o.name} a modifié et relancé la campagne « ${c.title} ».`;
  const a = (db.activity || []).find((x) => x.text === edited || x.text === relaunched);
  if (a) return { at: a.at, relaunch: a.text === relaunched };
  return c.updatedAt && c.updatedAt.slice(0, 10) !== c.createdAt ? { at: c.updatedAt, relaunch: false } : null;
}

// Fiche d'examen d'une campagne : photo, agence (fiche, badge, crédit), chiffres, financement, clips, plateformes,
// règles, mise en avant ; décisions selon le statut (approuver, refuser avec motif, pause, reprise, fin).
function admCampSheet(m) {
  const c = campaignById(m.id);
  if (!c) return admGone("Campagne introuvable", "Cette campagne a été annulée ou supprimée par son agence.");
  const o = c.ownerId ? userById(c.ownerId) : null, pending = c.status === "En attente", refused = c.status === "Refusée";
  const funded = !pending && !refused, closed = c.status === "Terminée" || refused;
  const cost = admFunding(c.budget, c.commissionRate), fee = cost - c.budget, credit = o ? o.credit || 0 : 0;
  const short = pending && o ? Math.max(0, cost - credit) : 0;
  const clips = db.publications.filter((p) => p.campaign === c.id);
  const edit = pending ? admCampEdit(c, o) : null;

  const cover = `<div class="cover relative aspect-[16/9] overflow-hidden rounded-tile sm:aspect-[5/2]" ${coverAttr(c)}>${coverArt(c, "text-6xl")}
      <span class="absolute start-3 top-3 rounded-badge bg-night/80 px-2 py-1 text-small font-semibold tabular-nums text-on-brand backdrop-blur-sm"><span class="inline-flex items-baseline gap-1" dir="ltr">${fmt(c.rate)}${NB}DA<span class="text-[11px] font-medium text-on-brand/80">/ 1k${NB}vues</span></span></span>
      ${c.top ? `<span class="absolute bottom-3 start-3 inline-flex items-center gap-1 rounded-badge bg-on-brand/90 px-1.5 py-0.5 text-[11px] font-semibold text-night">${icon("star", "size-3", true)}Top campagne</span>` : ""}</div>`;

  const hint = {
    "En attente": edit ? (edit.relaunch ? `Relancée par l'agence le ${date(edit.at)} après un refus : vérifiez ses corrections.` : `Modifiée par l'agence le ${date(edit.at)}.`) : `Soumise le ${date(c.createdAt)}, en attente de votre vérification.`,
    "Active": "En ligne : visible par les clippers, qui peuvent la rejoindre et soumettre des clips.",
    "En pause": "En pause : elle n'accepte ni nouveaux clippers ni nouveaux clips.",
    "Terminée": o ? "Terminée : le budget non consommé a été rendu au crédit de l'agence." : "Terminée : elle n'accepte plus de clips.",
    "Refusée": `Refusée le ${date(c.updatedAt || c.createdAt)}. L'agence peut la modifier et la relancer, ou la supprimer.`,
  }[c.status] || "";
  const status = `<div class="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">${statusBadge(c.status)}<span class="min-w-0 text-small text-fg-muted">${hint}</span></div>`;
  const reason = refused && c.reviewNote ? `<div class="mt-4">${alertBox("danger", `<p class="font-medium">Motif du refus</p><p class="mt-0.5 break-words">${esc(c.reviewNote)}</p>`)}</div>` : "";

  // Organisateur : l'agence (lien vers sa fiche, badge, contact, crédit actuel), sinon ClipBoost.
  const org = o
    ? `<div class="mt-4 flex items-center gap-3 rounded-tile border border-line p-3">${avatar(o, "md")}
        <div class="min-w-0 flex-1"><p class="text-xs text-fg-subtle">Agence</p>
          <p class="flex min-w-0 text-sm font-medium text-fg">${admUserLink(o, "", { inModal: true })}</p>
          <p class="truncate text-xs text-fg-subtle"><span dir="ltr">${esc(o.email || "")}</span>${o.contact ? ` · ${esc(o.contact)}` : ""}</p></div>
        <div class="shrink-0 text-end"><p class="text-xs text-fg-subtle">Crédit</p><p class="text-sm font-semibold">${money(credit)}</p></div></div>`
    : `<div class="mt-4 flex items-center gap-3 rounded-tile border border-line p-3"><span class="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand">${icon("play", "size-4 translate-x-px", true)}</span>
        <div class="min-w-0"><p class="text-xs text-fg-subtle">Organisateur</p><p class="text-sm font-medium text-fg">${c.ownerId ? "Agence supprimée" : "Campagne gérée par ClipBoost"}</p></div></div>`;

  const custom = !CATEGORIES.includes(c.category);
  const facts = `<dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div class="min-w-0"><dt class="text-xs text-fg-subtle">Marque</dt><dd class="mt-0.5 break-words font-medium text-fg">${esc(c.brand)}</dd></div>
      <div class="min-w-0"><dt class="text-xs text-fg-subtle">Catégorie</dt><dd class="mt-0.5 break-words font-medium text-fg">${esc(c.category)}${custom ? `<span class="block text-xs font-normal text-fg-subtle">« Autre », précisée par l'agence</span>` : ""}</dd></div>
      <div class="min-w-0"><dt class="text-xs text-fg-subtle">Créée le</dt><dd class="mt-0.5 font-medium tabular-nums text-fg">${date(c.createdAt)}</dd></div>
      <div class="min-w-0"><dt class="text-xs text-fg-subtle">Dernière mise à jour</dt><dd class="mt-0.5 font-medium tabular-nums text-fg">${date(c.updatedAt || c.createdAt)}</dd></div>
    </dl>`;

  const pay = `${admH3("Rémunération des clippers")}
    <dl class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      ${admTile("Tarif", `${fmt(c.rate)}${NB}DA`, `pour 1${NB}000 vues · 100${NB}000 vues = ${da(c.rate * 100)}`, "col-span-2 sm:col-span-1")}
      ${admTile("Seuil par clip", da(c.minPayout), `payé dès ${plural(viewsFor(c, c.minPayout), "vue", "vues")}`)}
      ${admTile("Plafond par clip", da(c.maxPayout), `atteint à ${plural(viewsFor(c, c.maxPayout), "vue", "vues")}`)}
    </dl>`;

  // Financement : ce qui sera débité à l'approbation (et le crédit de l'agence), ou ce qui a été consommé.
  const waiting = o ? admSum(db.transactions.filter((t) => t.type === "recharge" && t.status === "En cours" && t.userId === o.id), (t) => t.amount) : 0;
  const payLink = `<a href="#/admin/retraits" data-action="adm-focus" data-value="recharges" class="${btn("link")}">Voir dans Paiements</a>`;
  let money_;
  if (pending || refused) {
    money_ = o
      ? `${summary([["Budget de la campagne", money(c.budget)], [`Commission ClipBoost (${c.commissionRate}${NB}%)`, money(fee)], [refused ? "Aurait été débité à l'approbation" : "Débité à l'approbation", money(cost), true]])}
        ${pending ? (short
          ? `<div class="mt-3" id="adm-credit-short">${alertBox("warning", `<p><strong class="font-semibold">Crédit de l'agence insuffisant.</strong> ${da(credit)} disponibles : il manque <strong class="font-semibold tabular-nums">${da(short)}</strong>. L'approbation sera possible dès que l'agence aura rechargé son crédit.</p>${waiting ? `<p class="mt-1">Une recharge de ${da(waiting)} attend votre confirmation${waiting >= short ? ", ce qui suffirait" : ""}. ${payLink}</p>` : ""}`)}</div>`
          : `<p class="mt-3 text-xs tabular-nums text-fg-subtle">Crédit actuel de l'agence : ${da(credit)}. Il restera ${da(credit - cost)} après l'approbation.</p>`)
          : `<p class="mt-3 text-xs text-fg-subtle">Rien n'a été débité du crédit de l'agence.</p>`}`
      : summary([["Budget de la campagne", money(c.budget)], ["Commission ClipBoost", "Aucune"]]);
  } else {
    const remaining = Math.max(0, c.budget - c.spent);
    money_ = `<div class="mt-2">${progress(c.spent, c.budget, { aria: `Budget consommé de ${c.title}` })}</div>
      ${summary([["Budget", money(c.budget)], ["Consommé (gains des clippers)", money(c.spent)],
        [c.status === "Terminée" ? (o ? "Rendu à l'agence" : "Non consommé") : "Restant", money(remaining)],
        o ? [`Commission ClipBoost (${c.commissionRate}${NB}%)`, money(Math.round((c.spent * c.commissionRate) / 100))] : ["Commission ClipBoost", "Aucune"]])}`;
  }
  const budget = `${admH3("Budget et financement")}${money_}`;

  // Clips reçus (campagne en ligne ou terminée) : chacun ouvre sa fiche par-dessus celle-ci.
  const toModerate = clips.filter((p) => p.status === "En attente").length;
  const clipList = !funded ? "" : `${admH3("Clips")}
    <dl class="mt-2 grid grid-cols-3 gap-2">
      ${admTile("Clippers", fmt(c.clippers), "ont rejoint")}
      ${admTile("Clips reçus", fmt(clips.length), toModerate ? `${fmt(toModerate)} à modérer` : "tout est modéré")}
      ${admTile("Vues validées", compact(admSum(clips.filter((p) => p.status === "Validée"), (p) => p.views)), "clips validés")}
    </dl>
    ${clips.length ? `<ul class="mt-3 divide-y divide-line overflow-hidden rounded-tile border border-line">${clips.slice(0, 5).map((p) => {
      const cu = userById(p.userId);
      return `<li><button type="button" data-action="adm-clip" data-id="${p.id}" class="flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors duration-150 hover:bg-subtle ${FOCUS_INSET}">
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-fg-muted" aria-hidden="true">${icon(PLATFORM_ICON[p.platform] || "film", "size-4")}</span>
        <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium text-fg">${esc(p.title)}</span><span class="block truncate text-xs tabular-nums text-fg-subtle">${esc(cu ? cu.name : "Compte supprimé")} · ${plural(p.views, "vue", "vues")} · ${date(p.date)}</span></span>
        ${statusBadge(p.status)}</button></li>`;
    }).join("")}</ul>${clips.length > 5 ? `<p class="mt-2 text-xs text-fg-subtle">${plural(clips.length - 5, "autre clip", "autres clips")} dans la modération.</p>` : ""}`
      : `<p class="mt-3 rounded-tile border border-dashed border-line-strong px-4 py-5 text-center text-small text-fg-muted">Aucun clip reçu pour l'instant.</p>`}`;

  const top = closed ? "" : `<div class="mt-6 flex items-center justify-between gap-6 rounded-tile border border-line p-3.5">
      <div class="min-w-0"><p class="flex items-center gap-1.5 text-sm font-medium text-fg">${icon("star", "size-4 shrink-0 text-fg-subtle")}Top campagne</p>
        <p class="mt-0.5 text-xs text-fg-subtle">Mise en avant en tête de Découvrir et de l'accueil public${pending ? ", dès son approbation" : ""}.</p></div>
      ${switchBtn(!!c.top, "adm-camp-top", c.id, "Top campagne")}</div>`;

  const b = (action, variant, label, extra = "") => `<button type="button" data-action="${action}" data-id="${c.id}" class="${btn(variant)}"${extra}>${label}</button>`;
  const close = `<button type="button" data-action="close-modal" class="${btn(closed ? "secondary" : "ghost")}">Fermer</button>`;
  const footer = close + ({
    "En attente": b("adm-camp-refuse", "dangerSoft", "Refuser") + b("adm-camp-approve", "primary", `${icon("check")}Approuver`, short ? ' disabled aria-describedby="adm-credit-short" title="Crédit de l\'agence insuffisant"' : ""),
    "Active": b("adm-camp-end", "dangerSoft", "Terminer") + b("adm-camp-pause", "secondary", `${icon("pause")}Mettre en pause`),
    "En pause": b("adm-camp-end", "dangerSoft", "Terminer") + b("adm-camp-resume", "primary", `${icon("play")}Reprendre`),
  }[c.status] || "");

  return modalShell({
    title: esc(c.title), description: `${esc(c.brand)} · ${esc(c.category)}`, size: "xl", footer,
    body: `${cover}${status}${reason}${org}${facts}${pay}${budget}${clipList}
      ${admH3((c.platforms || []).length > 1 ? "Plateformes acceptées" : "Plateforme acceptée")}${admPlatforms(c)}
      ${admH3("Règles de la campagne")}${admRules(c)}
      ${top}`,
  });
}

// Fiche d'examen d'un clip : lien de la vidéo (ouvrir, copier), clipper (fiche), campagne (sa fiche), vues, seuil et
// plafond, gain estimé ou crédité, autres plateformes du même envoi, motif d'un refus ; décision (valider, refuser).
function admClipSheet(m) {
  const p = db.publications.find((x) => x.id === m.id), c = p && campaignById(p.campaign);
  if (!p || !c) return admGone("Clip introuvable", "Ce clip n'existe plus.");
  const u = userById(p.userId), o = c.ownerId ? userById(c.ownerId) : null, pending = p.status === "En attente", validated = p.status === "Validée";
  const seuil = viewsFor(c, c.minPayout), cap = viewsFor(c, c.maxPayout);
  // Même calcul que le serveur (lib/server/rules.ts) : gain brut arrondi, rien sous le seuil, plafond, budget restant.
  const raw = Math.floor((p.views * c.rate) / 1000), under = raw < c.minPayout, capped = raw >= c.maxPayout;
  const due = under ? 0 : Math.min(raw, c.maxPayout), remaining = Math.max(0, c.budget - c.spent), est = Math.min(due, remaining);
  const siblings = p.batch ? db.publications.filter((x) => x.batch === p.batch && x.id !== p.id) : [];
  const ic = PLATFORM_ICON[p.platform] || "film";

  const linkBox = `<div class="flex flex-col gap-3 rounded-tile border border-line p-3 sm:flex-row sm:items-center">
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-tile bg-muted text-fg" aria-hidden="true">${icon(ic, "size-5")}</span>
        <div class="min-w-0 flex-1"><p class="text-xs text-fg-subtle">Lien ${esc(p.platform)}</p>
          <p class="mt-0.5 flex min-w-0 items-center gap-0.5"><span class="min-w-0 break-all font-mono text-small text-fg" dir="ltr">${esc(p.url || "")}</span>${p.url ? admCopyBtn(p.url, "Copier le lien", "Lien copié") : ""}</p></div>
      </div>
      ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="${btn("secondary", "md", "shrink-0")}">${icon("external")}Ouvrir sur ${esc(p.platform)}</a>` : ""}
    </div>`;
  const status = `<div class="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">${statusBadge(p.status)}<span class="text-small text-fg-muted">Soumis le ${date(p.date)}${pending && under ? " · seuil de paiement pas encore atteint" : ""}</span></div>`;
  const reason = p.status === "Refusée" && p.reason ? `<div class="mt-4">${alertBox("danger", `<p class="font-medium">Motif du refus</p><p class="mt-0.5 break-words">${esc(p.reason)}</p>`)}</div>` : "";
  const ended = pending && c.status === "Terminée" ? `<div class="mt-4">${alertBox("warning", "La campagne est terminée : son budget non consommé a été rendu à l'agence. Vérifiez avant de valider ce clip.")}</div>` : "";

  const people = `<div class="mt-4 grid gap-2 sm:grid-cols-2">
      <div class="flex min-w-0 items-center gap-3 rounded-tile border border-line p-3">${u ? avatar(u, "md") : avatar({ id: p.userId, name: "?", role: "clipper" }, "md")}
        <div class="min-w-0 flex-1"><p class="text-xs text-fg-subtle">Clipper</p><p class="flex min-w-0 text-sm font-medium text-fg">${admUserLink(u, "", { inModal: true })}</p>
          <p class="truncate text-xs text-fg-subtle">${u ? `${esc(u.level || "Clipper")}${u.handle ? ` · <span dir="ltr">${esc(u.handle)}</span>` : ""}` : ""}</p></div></div>
      <button type="button" data-action="adm-camp" data-id="${c.id}" class="flex min-w-0 items-center gap-3 rounded-tile border border-line p-3 text-start transition-colors duration-150 hover:border-line-strong hover:bg-subtle ${FOCUS}">${coverThumb(c, "sm")}
        <span class="min-w-0 flex-1"><span class="block text-xs text-fg-subtle">Campagne</span><span class="block truncate text-sm font-medium text-fg">${esc(c.title)}</span>
          <span class="block truncate text-xs text-fg-subtle">${esc(o ? o.name : c.brand)} · ${rateShort(c.rate)}</span></span>${icon("chevronRight", "size-4 shrink-0 text-fg-subtle rtl:-scale-x-100")}</button>
    </div>`;

  const viewsBtn = pending || validated ? `<button type="button" data-action="adm-views" data-id="${p.id}" class="${btn("secondary", "sm")}">${icon("eye")}Relever les vues</button>` : "";
  const threshold = under && !validated ? `<div class="mt-3">${progress(p.views, seuil, { label: false, aria: "Progression vers le seuil" })}
      <p class="mt-1.5 text-xs tabular-nums text-fg-subtle">${pct(Math.min(99, Math.floor((p.views / Math.max(1, seuil)) * 100)))} du seuil : il manque ${plural(seuil - p.views, "vue", "vues")}.</p></div>` : "";
  const capNote = (txt) => `<span class="ms-1.5 text-xs font-normal text-fg-subtle">${txt}</span>`;
  const rows = [["Tarif", rate(c.rate)], ["Gain brut des vues", money(raw)]];
  if (pending) {
    rows.push(["Gain estimé à la validation", under ? `<span class="font-normal text-fg-subtle">— sous le seuil</span>`
      : `${money(est)}${est < due ? capNote("budget restant") : capped ? capNote("plafond") : ""}`, true]);
  } else if (validated) rows.push(["Crédité au clipper", `${money(p.paid || 0)}${capped ? capNote("plafond") : ""}`, true]);
  else rows.push(["Gain", `<span class="font-normal text-fg-subtle">Aucun : clip refusé</span>`, true]);
  const payout = `${admH3("Vues et gain", viewsBtn)}
    <dl class="mt-2 grid grid-cols-3 gap-2">
      ${admTile("Vues relevées", fmt(p.views))}
      ${admTile("Seuil", plural(seuil, "vue", "vues"), da(c.minPayout))}
      ${admTile("Plafond", plural(cap, "vue", "vues"), da(c.maxPayout))}
    </dl>${threshold}${summary(rows)}
    ${validated ? `<p class="mt-2 text-xs text-fg-subtle">Les vues relevées pendant ${plural(db.settings.earningDays, "jour", "jours")} après la validation sont payées en plus, dans la limite du plafond et du budget restant.</p>` : ""}`;

  // Autres plateformes du même envoi : leur fiche remplace celle-ci (même fiche de retour).
  const batch = siblings.length ? `${admH3("Publié aussi sur")}
    <ul class="mt-2 grid gap-2">${siblings.map((s) => `<li><button type="button" data-action="adm-clip" data-id="${s.id}" class="flex w-full items-center gap-3 rounded-tile border border-line p-3 text-start transition-colors duration-150 hover:border-line-strong hover:bg-subtle ${FOCUS}">
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-fg-muted" aria-hidden="true">${icon(PLATFORM_ICON[s.platform] || "film", "size-4")}</span>
        <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${esc(s.platform)}</span><span class="block truncate text-xs tabular-nums text-fg-subtle">${plural(s.views, "vue", "vues")}</span></span>
        ${statusBadge(s.status)}${icon("chevronRight", "size-4 shrink-0 text-fg-subtle rtl:-scale-x-100")}</button></li>`).join("")}</ul>` : "";

  const rules = `<details class="group mt-6" ${pending ? "open" : ""}>
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-section text-fg [&::-webkit-details-marker]:hidden ${FOCUS}">Règles de la campagne${icon("chevronDown", "size-4 shrink-0 text-fg-subtle transition-transform duration-150 group-open:rotate-180")}</summary>
      ${admRules(c)}
      <div class="mt-3 flex flex-wrap items-center gap-1.5"><span class="text-xs text-fg-subtle">Plateformes acceptées :</span>${admPlatforms(c).replace('<div class="mt-2 flex flex-wrap gap-1.5">', "").replace(/<\/div>$/, "")}</div>
    </details>`;

  const footer = `<button type="button" data-action="close-modal" class="${btn(pending ? "ghost" : "secondary")}">Fermer</button>${pending
    ? `<button type="button" data-action="adm-reject" data-id="${p.id}" class="${btn("dangerSoft")}">Refuser</button>
      <button type="button" data-action="adm-validate" data-id="${p.id}" class="${btn("primary")}"${under ? ` disabled title="Seuil non atteint : ${plural(seuil, "vue", "vues")} minimum"` : ""}>${icon("check")}Valider</button>` : ""}`;

  return modalShell({
    title: esc(p.title), description: `${esc(p.platform)} · ${esc(c.title)}`, size: "xl", footer,
    body: `${linkBox}${status}${reason}${ended}${people}${payout}${batch}${rules}`,
  });
}

// ---------- Modales ----------

// Relevé de vues : gain estimé en direct (même règle que le serveur : rien sous le seuil, plafonné au-delà).
LIVE.admViews = (d) => {
  const p = state.modal && db.publications.find((x) => x.id === state.modal.id);
  if (!p) return "";
  const c = campaignById(p.campaign), seuil = viewsFor(c, c.minPayout || 0);
  const typed = Math.floor(admParse(d.views));
  if (!Number.isFinite(typed) || typed < p.views) return `<div class="mt-5">${alertBox("warning", `Indiquez au moins ${plural(p.views, "vue", "vues")} : le dernier relevé ne peut pas diminuer.`)}</div>`;
  const v = typed;
  const raw = Math.floor((v * c.rate) / 1000), capped = c.maxPayout && raw >= c.maxPayout;
  const est = raw < (c.minPayout || 0) ? 0 : Math.min(raw, c.maxPayout || Infinity);
  const rows = [["Seuil de paiement", v >= seuil ? "Atteint" : `${pct(Math.floor((v / Math.max(1, seuil)) * 100))} atteint`]];
  if (p.status === "Validée") {
    rows.push(["Déjà crédité", money(p.paid || 0), true]);
    return `${summary(rows)}<p class="mt-2 text-xs text-fg-subtle">Les vues supplémentaires sont payées pendant ${plural(db.settings.earningDays, "jour", "jours")} après la validation, dans la limite du plafond et du budget restant.</p>`;
  }
  rows.push(["Gain estimé", est ? `${money(est)}${capped ? `<span class="ms-1.5 text-xs font-normal text-fg-subtle">plafond</span>` : ""}` : `<span class="font-normal text-fg-subtle">— sous le seuil</span>`, true]);
  return summary(rows);
};

// Motif d'un refus (campagne : 300 caractères, badge : 200) : compteur en direct.
LIVE.admReason = (d) => ({ count: `${fmt(String(d.reason || "").length)}${NB}/${NB}${state.modal && state.modal.type === "adm-refuse" ? 300 : 200}` });

// Motifs fréquents de refus d'une campagne : [puce, texte inséré dans le motif].
const ADM_CAMP_REASONS = [
  ["Budget incohérent", "Le budget, le tarif et le plafond par clip ne sont pas cohérents entre eux."],
  ["Règles trop vagues", "Les règles de la campagne sont trop vagues : précisez ce que les clips doivent montrer."],
  ["Marque non autorisée", "Cette marque ou ce produit ne peut pas être promu sur ClipBoost."],
  ["Photo inappropriée", "La photo de la campagne n'est pas appropriée : remplacez-la."],
  ["Marque à préciser", "Les informations sur la marque sont insuffisantes : précisez qui finance la campagne."],
];
const ADM_REASON_CHIP = `inline-flex h-10 shrink-0 items-center rounded-full border border-line-strong bg-surface px-3.5 text-small font-medium text-fg-muted transition-colors duration-150 hover:border-line-control hover:text-fg md:h-8 ${FOCUS}`;
// Champ de motif avec compteur (refus d'une campagne, refus ou retrait d'un badge).
const admReasonField = (id, label, max, required, placeholder, hint) => `<div class="grid gap-1.5" data-field>
    <div class="flex items-baseline justify-between gap-3"><label for="${id}" class="text-small font-medium text-fg">${label}</label><span data-live-out="count" class="text-xs tabular-nums text-fg-subtle">0${NB}/${NB}${max}</span></div>
    <textarea id="${id}" name="reason" rows="4" maxlength="${max}" ${required ? "required " : ""}autofocus placeholder="${esc(placeholder)}" aria-describedby="${id}-hint" class="${textareaCls}"></textarea>
    <span id="${id}-hint" class="text-xs text-fg-subtle">${hint}</span>
  </div>`;

function adminModal() {
  const m = state.modal;
  if (!m) return "";
  const cancel = (label = "Annuler") => `<button type="button" data-action="close-modal" class="${btn("ghost")}">${label}</button>`;

  if (m.type === "adm-camp") return admCampSheet(m);
  if (m.type === "adm-clip") return admClipSheet(m);
  if (m.type === "adm-refuse") {
    const c = campaignById(m.id);
    if (!c) return admGone("Campagne introuvable", "Cette campagne a été annulée ou supprimée par son agence.");
    const o = c.ownerId ? userById(c.ownerId) : null;
    return modalShell({
      title: "Refuser la campagne", description: `« ${esc(c.title)} »${o ? ` · ${esc(o.name)}` : ""}`, form: "adm-refuse", live: "admReason",
      body: `${admReasonField("adm-refuse-reason", "Motif du refus", 300, true, "Ex. Le plafond par clip est trop élevé pour ce budget.", "Entre 3 et 300 caractères. L'agence le lit dans sa notification et sur sa campagne.")}
        <div class="mt-4"><p class="text-xs text-fg-subtle">Motifs fréquents</p>
          <div class="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Motifs fréquents">${ADM_CAMP_REASONS.map(([l], i) => `<button type="button" data-action="adm-reason" data-value="${i}" class="${ADM_REASON_CHIP}">${esc(l)}</button>`).join("")}</div></div>
        <div class="mt-5">${alertBox("info", "L'agence est prévenue et peut modifier sa campagne puis la relancer, ou la supprimer. Rien n'est débité de son crédit.")}</div>`,
      footer: `${cancel()}<button type="submit" class="${btn("danger")}">Refuser la campagne</button>`,
    });
  }
  if (m.type === "adm-end") {
    const c = campaignById(m.id);
    if (!c) return admGone("Campagne introuvable", "Cette campagne n'existe plus.");
    const o = c.ownerId ? userById(c.ownerId) : null, unspent = Math.max(0, c.budget - c.spent);
    const refund = o && c.reserved > 0 ? admFunding(unspent, c.commissionRate) : 0;
    return modalShell({
      title: `Terminer la campagne${NB}?`, description: `« ${esc(c.title)} »${o ? ` · ${esc(o.name)}` : ""}`,
      body: `<p class="text-sm text-fg-muted">La campagne disparaît de Découvrir et n'accepte plus de nouveaux clips. Les gains déjà crédités aux clippers restent acquis. Cette action est définitive.</p>
        ${refund ? summary([["Budget non consommé", money(unspent)], [`Commission correspondante (${c.commissionRate}${NB}%)`, money(refund - unspent)], ["Rendu au crédit de l'agence", money(refund), true]]) : ""}`,
      footer: `${cancel()}<button type="button" data-action="adm-camp-end-confirm" data-id="${c.id}" class="${btn("danger")}">Terminer la campagne</button>`,
    });
  }
  if (m.type === "adm-verify") {
    const u = userById(m.id);
    if (!u) return admGone("Compte introuvable", "Ce compte n'existe plus.");
    const reject = m.decision !== "revoke";
    return modalShell({
      title: reject ? "Refuser la demande de badge" : "Retirer le badge de vérification", description: esc(u.name), form: "adm-verify", live: "admReason",
      body: `${reject ? `<div class="mb-4 rounded-tile bg-muted p-3"><p class="text-xs font-medium text-fg-subtle">Message de l'agence</p><p class="mt-1 break-words text-small ${u.verificationNote ? "text-fg" : "text-fg-subtle"}">${u.verificationNote ? esc(u.verificationNote) : "Aucun message joint à la demande."}</p></div>` : ""}
        ${reject
          ? admReasonField("adm-verify-reason", "Motif du refus", 200, true, "Ex. Impossible de vérifier le registre du commerce de l'agence.", "Entre 3 et 200 caractères. L'agence pourra faire une nouvelle demande.")
          : admReasonField("adm-verify-reason", `Motif ${OPTIONAL}`, 200, false, "Ex. Informations de l'agence devenues inexactes.", "Transmis à l'agence s'il est indiqué. Elle pourra demander de nouveau le badge.")}`,
      footer: `${cancel()}<button type="submit" class="${btn("danger")}">${reject ? "Refuser la demande" : "Retirer le badge"}</button>`,
    });
  }
  if (m.type === "suspend") {
    const u = userById(m.id);
    if (!u) return "";
    return modalShell({
      title: `Suspendre ce compte${NB}?`, description: `${esc(u.name)} · ${esc(u.email)}`,
      body: `<p class="text-sm text-fg-muted">${esc(u.name)} sera déconnecté immédiatement et ne pourra plus se connecter. Vous pourrez réactiver le compte à tout moment depuis sa fiche ou la liste des utilisateurs.</p>`,
      footer: `${cancel()}<button type="button" data-action="adm-user-toggle" data-id="${u.id}" data-confirm="true" class="${btn("danger")}">Suspendre le compte</button>`,
    });
  }
  if (m.type === "reject") {
    const p = db.publications.find((x) => x.id === m.id);
    if (!p) return "";
    const reasons = ["Règles de la campagne non respectées", "Vues suspectes ou achetées", "Contenu inapproprié", "Lien invalide ou vidéo supprimée", "Doublon d'un clip existant"];
    return modalShell({
      title: "Refuser le clip", description: `« ${esc(p.title)} » de ${esc(admUser(p.userId).name)}. Le clipper sera notifié du motif.`, form: "adm-reject",
      body: `<fieldset class="grid gap-2"><legend class="mb-1.5 text-small font-medium text-fg">Motif du refus</legend>
        ${reasons.map((r, i) => `<label class="${CHOICE_DANGER}"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? "checked autofocus" : ""} class="mt-0.5 size-4 shrink-0 cursor-pointer accent-danger-solid focus-visible:outline-none"/><span class="text-sm font-medium text-fg">${esc(r)}</span></label>`).join("")}</fieldset>`,
      footer: `${cancel()}<button type="submit" class="${btn("danger")}">Confirmer le refus</button>`,
    });
  }
  if (m.type === "views") {
    const p = db.publications.find((x) => x.id === m.id);
    if (!p) return "";
    const c = campaignById(p.campaign);
    return modalShell({
      title: "Relever les vues", description: `« ${esc(p.title)} » · ${esc(admUser(p.userId).name)}`, form: "adm-views", live: "admViews",
      body: `${field("Nombre de vues affiché sur la plateforme",
          unitInput(`name="views" type="text" value="${fmt(p.views)}" required autofocus autocomplete="off"`, "vues", { lg: true }),
          `Seuil ${plural(viewsFor(c, c.minPayout), "vue", "vues")} · plafond ${plural(viewsFor(c, c.maxPayout), "vue", "vues")}. Le nombre ne peut pas diminuer.`)}
        <div data-live-out>${LIVE.admViews({ views: p.views })}</div>
        ${p.url ? `<p class="mt-4"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="${btn("link", "", "text-small")}">${icon("external", "size-4")}Ouvrir le clip sur ${esc(p.platform)}</a></p>` : ""}`,
      footer: `${cancel()}<button type="submit" class="${btn("primary")}">Enregistrer</button>`,
    });
  }
  if (m.type === "reset-demo") {
    return modalShell({
      title: `Réinitialiser la démo${NB}?`,
      body: `<p class="text-sm text-fg-muted">Les comptes créés, campagnes, clips et paiements enregistrés dans ce navigateur seront effacés, puis les données d'exemple recréées. Vous serez déconnecté.</p>`,
      footer: `${cancel()}<button type="button" data-action="adm-reset-demo-confirm" class="${btn("danger")}">Effacer et recommencer</button>`,
    });
  }
  // Campagne créée par l'équipe : même formulaire que l'agence (agency.js : photo, catégories et « Autre », plateformes
  // dont Facebook), avec la marque en plus ; publiée aussitôt, sans crédit d'agence.
  if (m.type === "new-campaign") {
    return modalShell({
      title: "Nouvelle campagne", description: "Créée par ClipBoost, elle est immédiatement visible par les clippers.", size: "xl", form: "adm-campaign", live: "campaign",
      body: campaignForm("adm-campaign", "Publier la campagne", "Campagne gérée directement par ClipBoost : aucun crédit d'agence n'est prélevé."),
      footer: `${cancel()}<button type="submit" class="${btn("primary")}">Publier la campagne</button>`,
    });
  }
  return "";
}

// ---------- Actions ----------

function handleAdminAction(action, t) {
  const id = t.dataset.id, v = t.dataset.value;
  switch (action) {
    case "adm-user-status": state.adm.userStatus = v; return render();
    case "adm-user-role": state.adm.userRole = v; return render();
    case "adm-user-clear": Object.assign(state.adm, { userQ: "", userRole: "Tous les rôles", userStatus: "Tous" }); return render();
    case "adm-camp-status": state.adm.campStatus = v; return render();
    case "adm-camp-clear": Object.assign(state.adm, { campQ: "", campStatus: "Toutes" }); return render();
    case "adm-mod-status": state.adm.modStatus = v; return render();
    case "adm-pay-tab": state.adm.payTab = v; return render();
    case "adm-period": state.period = Number(v) === 7 ? 7 : 30; return render();
    // Carte « À traiter », lien vers Paiements : le lien ouvre la page (changement d'adresse), on y présélectionne la file.
    case "adm-focus":
      if (v === "moderation") state.adm.modStatus = "En attente";
      if (v === "campagnes" && db.campaigns.some((c) => c.status === "En attente")) Object.assign(state.adm, { campQ: "", campStatus: "En attente" });
      if (v === "retraits") state.adm.payTab = pendingWithdrawals().length || !pendingRecharges().length ? "retraits" : "recharges";
      if (v === "recharges") state.adm.payTab = "recharges";
      return;
    case "adm-copy": return copy(v, t.dataset.msg || "Copié");
    case "adm-user-toggle": {
      const u = userById(id);
      if (!u) return;
      // La suspension demande une confirmation ; la réactivation est immédiate.
      if (u.status === "Actif" && !t.dataset.confirm) return admOpen({ type: "suspend", id });
      const next = u.status === "Actif" ? "Suspendu" : "Actif";
      return act("PATCH", `/api/admin/users/${id}`, { status: next }, `${u.name} : compte ${next === "Suspendu" ? "suspendu" : "réactivé"}`, () => admPop(["suspend"], id));
    }
    // Fiches d'examen, ouvertes sur place.
    case "adm-camp": return admOpenSheet("adm-camp", id);
    case "adm-clip": return admOpenSheet("adm-clip", id);
    // Décisions sur une campagne. L'approbation débite le crédit de l'agence (budget + commission) : le serveur la refuse
    // si le crédit ne suffit pas (message affiché tel quel) ; la fiche est refermée après une décision réussie.
    case "adm-camp-approve": {
      const c = campaignById(id);
      if (!c) return;
      return act("PATCH", `/api/campaigns/${id}`, { status: "Active" }, `« ${c.title} » est approuvée et en ligne`, () => admPop(["adm-camp"], id));
    }
    case "adm-camp-resume": case "adm-camp-pause": {
      const c = campaignById(id), pause = action === "adm-camp-pause";
      if (!c) return;
      return act("PATCH", `/api/campaigns/${id}`, { status: pause ? "En pause" : "Active" }, pause ? `« ${c.title} » est en pause` : `« ${c.title} » est de nouveau active`);
    }
    case "adm-camp-end": return admOpen({ type: "adm-end", id });
    case "adm-camp-end-confirm": {
      const c = campaignById(id);
      if (!c) return;
      return act("PATCH", `/api/campaigns/${id}`, { status: "Terminée" }, `« ${c.title} » est terminée`, () => admPop(["adm-end"], id));
    }
    case "adm-camp-refuse": return admOpen({ type: "adm-refuse", id });
    case "adm-camp-top": {
      const c = campaignById(t.dataset.key);
      if (!c) return;
      return act("PATCH", `/api/campaigns/${c.id}`, { top: !c.top }, c.top ? `« ${c.title} » n'est plus mise en avant` : `« ${c.title} » est mise en avant en Top campagne`);
    }
    // Motif fréquent : ajouté au motif saisi (sans doublon), dans la limite de 300 caractères ; le brouillon et le compteur suivent.
    case "adm-reason": {
      const area = root.querySelector('[aria-modal="true"] textarea[name="reason"]'), r = ADM_CAMP_REASONS[Number(v)];
      if (!area || !r) return;
      const cur = area.value.trim();
      const next = !cur ? r[1] : cur.includes(r[1]) ? cur : `${cur}${/[.!?…]$/.test(cur) ? "" : "."} ${r[1]}`;
      area.value = next.slice(0, 300);
      area.dispatchEvent(new Event("input", { bubbles: true }));
      area.focus();
      try { area.setSelectionRange(area.value.length, area.value.length); } catch (e) {}
      return;
    }
    case "adm-new-campaign": state.modal = { type: "new-campaign" }; return render();
    // Décisions sur un clip (tableaux et fiche) : la fiche est refermée après une décision réussie.
    case "adm-validate": return act("POST", `/api/clips/${id}/review`, { approve: true }, "Clip validé, gains crédités au clipper", () => admPop(["adm-clip"], id));
    case "adm-reject": return admOpen({ type: "reject", id });
    case "adm-views": return admOpen({ type: "views", id });
    // Badge de vérification des agences.
    case "adm-verify-approve": {
      const u = userById(id);
      if (!u) return;
      return act("POST", `/api/admin/users/${id}/verification`, { decision: "approve" }, `Badge de vérification accordé à ${u.name}`);
    }
    case "adm-verify": return admOpen({ type: "adm-verify", id, decision: v === "revoke" ? "revoke" : "reject" });
    case "adm-tx-approve": case "adm-tx-reject": {
      const tx = db.transactions.find((x) => x.id === id), approve = action === "adm-tx-approve";
      const msg = !tx ? (approve ? "Opération validée" : "Opération rejetée")
        : tx.type === "retrait" ? (approve ? `Virement de ${da(admNet(tx))} confirmé` : `Retrait de ${da(-tx.amount)} rejeté`)
        : approve ? `Recharge de ${da(tx.amount)} créditée à l'agence` : `Recharge de ${da(tx.amount)} rejetée`;
      return act("POST", `/api/transactions/${id}/review`, { approve }, msg);
    }
    case "adm-reset-demo": state.modal = { type: "reset-demo" }; return render();
    case "adm-reset-demo-confirm": return resetDemo();
    case "adm-setting": {
      const k = t.dataset.key, value = !db.settings[k];
      const labels = { maintenance: ["Mode maintenance activé", "Mode maintenance désactivé"], signupsOpen: ["Inscriptions ouvertes", "Inscriptions fermées"] };
      return act("PATCH", "/api/admin/settings", { [k]: value }, labels[k][value ? 0 : 1]);
    }
  }
  return false;
}

// Version autonome : efface les données du navigateur ; les données d'exemple sont recréées au prochain appel.
async function resetDemo() {
  await window.__CLIPBOOST_OFFLINE__.reset();
  await refresh();
  state.modal = null;
  navigate("#/connexion");
  toast("Démo réinitialisée : données d'exemple recréées");
}

function handleAdminSubmit(form, data) {
  const m = state.modal;
  if (form === "adm-reject") {
    return act("POST", `/api/clips/${m.id}/review`, { approve: false, reason: data.reason }, "Clip refusé, le clipper est notifié", () => admPop(["reject", "adm-clip"], m.id));
  }
  if (form === "adm-views") {
    const p = db.publications.find((x) => x.id === m.id), views = Math.floor(admParse(data.views));
    if (!Number.isFinite(views) || (p && views < p.views)) return admInvalid("adm-views", "views");
    return act("POST", `/api/clips/${m.id}/views`, { views }, "Vues enregistrées", () => admPop(["views"], m.id));
  }
  // Refus d'une campagne : motif obligatoire (3 à 300 caractères), transmis à l'agence.
  if (form === "adm-refuse") {
    const reason = String(data.reason || "").trim(), c = campaignById(m.id);
    if (reason.length < 3) return admInvalid(form, "reason", "Indiquez le motif du refus (3 caractères minimum).");
    return act("PATCH", `/api/campaigns/${m.id}`, { status: "Refusée", reason }, `« ${c ? c.title : "La campagne"} » est refusée : l'agence est prévenue`, () => admPop(["adm-refuse", "adm-camp"], m.id));
  }
  // Badge : refus (motif obligatoire) ou retrait (motif facultatif).
  if (form === "adm-verify") {
    const reason = String(data.reason || "").trim(), u = userById(m.id), reject = m.decision !== "revoke";
    if (reject && reason.length < 3) return admInvalid(form, "reason", "Indiquez le motif du refus (3 caractères minimum).");
    const name = u ? u.name : "l'agence";
    return act("POST", `/api/admin/users/${m.id}/verification`, { decision: reject ? "reject" : "revoke", ...(reason ? { reason } : {}) },
      reject ? `Demande de badge de ${name} refusée` : `Badge de vérification retiré à ${name}`, () => admPop(["adm-verify"], m.id));
  }
  if (form === "adm-campaign") {
    const err = !String(data.brand || "").trim() ? ["brand", "Indiquez la marque."] : agCampaignError(data);
    if (err) return admInvalid(form, ...err);
    return act("POST", "/api/campaigns", campaignPayload(data), "Campagne publiée", () => { state.modal = null; state.adm.campStatus = "Toutes"; });
  }
  // Mon compte : nom et photo (data URL nouvelle, adresse actuelle inchangée, "" retirée : voir imageField).
  if (form === "adm-account") {
    const name = String(data.name || "").trim();
    if (!name) return admInvalid(form, "name", "Indiquez votre nom.");
    return act("PATCH", "/api/me", { name, avatar: data.avatar }, "Compte mis à jour");
  }
  if (form === "adm-settings") {
    const values = {};
    for (const [k, [label, min, max, decimal]] of Object.entries(ADM_LIMITS)) {
      const v = admParse(data[k]);
      if (!Number.isFinite(v) || v < min || v > max || (!decimal && !Number.isInteger(v))) {
        const range = max === Infinity ? (min ? `d'au moins ${fmt(min)}` : "positif") : `entre ${fmt(min)} et ${fmt(max)}`;
        return admInvalid("adm-settings", k, `${label}${NB}: indiquez un nombre${decimal ? "" : " entier"} ${range}.`);
      }
      values[k] = v;
    }
    return act("PATCH", "/api/admin/settings", { announcement: data.announcement.trim(), ...values }, "Réglages enregistrés");
  }
}
