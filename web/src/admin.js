// Tableau de bord administrateur : pilotage des utilisateurs, campagnes, clips, paiements et réglages du site.
// Chaque action passe par l'API : les effets sont visibles immédiatement par les clippers et les agences.
// Rendu selon docs/design-system.md §6.4 (recettes et helpers de ui.js). Les helpers locaux sont préfixés « adm ».

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
const adminBadge = (id) => ({ moderation: pendingPubs().length, retraits: pendingWithdrawals().length + pendingRecharges().length, campagnes: db.campaigns.filter((c) => c.status === "En attente").length }[id] || 0);

// ---------- Helpers locaux ----------
const admSum = (list, f) => list.reduce((s, x) => s + (f(x) || 0), 0);
// Net à virer d'un retrait : montant demandé moins les frais (le serveur stocke le retrait en négatif).
const admNet = (t) => -t.amount - (t.fee || 0);
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
// Rangée défilante (bord à bord sous sm) pour plusieurs groupes de filtres ; chips() a déjà la sienne.
const admScrollRow = (items) =>
  `<div class="-mx-4 flex min-w-0 items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">${items.map((f) => `<div class="shrink-0">${f}</div>`).join("")}</div>`;
const admCountLine = (n, total, one, many) =>
  `<p class="mt-4 text-small tabular-nums text-fg-subtle">${n === total ? plural(n, one, many) : `${plural(n, one, many)} sur ${fmt(total)}`}</p>`;
// Saisie numérique « 50 000 » ou « 2,5 » : espaces ignorés, virgule décimale ; vide = NaN.
const admParse = (v) => { const t = String(v ?? "").replace(/[\s\u00a0\u202f]/g, "").replace(",", "."); return t === "" ? NaN : Number(t); };
// Champ refusé avant l'envoi : bordure d'erreur (aria-invalid), focus et message.
function admInvalid(form, name, msg) {
  document.querySelectorAll(`[data-form="${form}"] [aria-invalid]`).forEach((el) => el.removeAttribute("aria-invalid"));
  const el = document.querySelector(`[data-form="${form}"] [name="${name}"]`);
  if (el) { el.setAttribute("aria-invalid", "true"); el.focus(); }
  toast(msg, "danger");
}
// Tableaux : chacun s'affiche à partir de la largeur où il tient en entier (colonne d'actions comprise), la liste en dessous.
// Le conteneur défile horizontalement en dernier recours au lieu de rogner ; « relative » garde l'en-tête sr-only dans le tableau.
const ADM_WRAP = TBL.wrap.replace("overflow-hidden", "overflow-x-auto");
const ADM_BP = {
  md: [TBL.table, TBL.list],
  xl: [TBL.table.replace("md:table", "xl:table"), TBL.list.replace("md:hidden", "xl:hidden")],
  wide: [TBL.table.replace("md:table", "min-[1400px]:table"), TBL.list.replace("md:hidden", "min-[1400px]:hidden")],
};
const ADM_TH_ACTIONS = `<th scope="col" class="${TBL.th} ${TBL.thNum} relative"><span class="sr-only">Actions</span></th>`;
// Cellule principale : prend la place restante et tronque son contenu (au lieu d'élargir le tableau).
const ADM_TD_MAIN = `${TBL.td} w-full max-w-0`;
const admTable = (bp, head, trs, lis) => `<div class="${ADM_WRAP}">
    <table class="${ADM_BP[bp][0]}"><thead><tr class="${TBL.headRow}">${head}</tr></thead><tbody>${trs}</tbody></table>
    <ul class="${ADM_BP[bp][1]}">${lis}</ul></div>`;
// publicationsTable (lot B) avec la colonne Décision : 6 colonnes, environ 1 130 px. Le tableau s'affiche à partir de 1 440 px,
// la liste (actions en boutons md) en dessous, pour ne jamais rogner ni faire défiler la colonne Décision.
const admPubTable = (html) => html
  .replace(`class="${TBL.wrap}"`, `class="${ADM_WRAP}"`)
  .replace(`class="${TBL.table}"`, `class="${TBL.table.replace("md:table", "min-[1440px]:table")}"`)
  .replace(`class="${TBL.list}"`, `class="${TBL.list.replace("md:hidden", "min-[1440px]:hidden")}"`);
const admSectionTitle = (title, extra = "") => `<div class="flex items-center gap-2"><h2 class="text-heading text-fg">${title}</h2>${extra}</div>`;

// ---------- Vue d'ensemble ----------

function aApercu() {
  const s = db.settings, users = clippers(), pubs = pendingPubs(), wd = pendingWithdrawals(), rc = pendingRecharges();
  const campPending = db.campaigns.filter((c) => c.status === "En attente").length;
  const under = pubs.filter(belowMin).length, toPay = admSum(wd, admNet), queue = pubs.length + campPending + wd.length + rc.length;

  // 1. À traiter : cartes interactives neutres (jamais de rose pour une file normale).
  // Sous sm : une liste compacte (une ligne par file, compteur à droite) ; au-delà : trois cartes kpi interactives.
  const paySub = [wd.length ? `${money(toPay)} à virer` : "", rc.length ? `${plural(rc.length, "recharge", "recharges")} à confirmer` : ""].filter(Boolean).join(" · ");
  const queues = [
    ["moderation", "Clips à modérer", pubs.length, pubs.length ? (under ? `dont ${fmt(under)} sous le seuil` : "En attente de décision") : "Tout est à jour"],
    ["campagnes", "Campagnes à approuver", campPending, campPending ? "Soumises par les agences" : "Aucune en attente"],
    ["retraits", "Paiements à traiter", wd.length + rc.length, paySub || "Tout est à jour"],
  ];
  const todoCards = queues.map(([id, label, n, sub]) =>
    kpi({ href: `#/admin/${id}`, label, value: kpiValue(fmt(n)), sub, ic: "chevronRight" }).replace("<a ", `<a data-action="adm-focus" data-value="${id}" `));
  const todoList = queues.map(([id, label, n, sub]) => `<li><a href="#/admin/${id}" data-action="adm-focus" data-value="${id}" class="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
      <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${label}</span><span class="mt-0.5 block truncate text-xs text-fg-subtle">${sub}</span></span>
      ${n ? countBadge(n, "queue") : `<span class="text-small tabular-nums text-fg-subtle">0</span>`}${icon("chevronRight", "size-4 shrink-0 text-fg-subtle")}</a></li>`).join("");

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

  // 3. Inscriptions (un comptage : barres entières) et activité récente.
  const period = state.period === 7 ? 7 : 30, series = (db.series.daily || []).slice(-period);
  const total = admSum(series, (v) => v), activeDays = series.filter((v) => v > 0).length;
  const chart = `<header class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0"><h2 class="text-section text-fg">Nouvelles inscriptions</h2>
        <p class="mt-2">${kpiValue(fmt(total))}</p>
        <p class="mt-0.5 text-small text-fg-subtle">sur ${period}${NB}jours · ${plural(activeDays, "jour actif", "jours actifs")}</p></div>
      ${segmented("adm-period", period, [[7, "7 j"], [30, "30 j"]], "Période du graphique")}
    </header>
    <div class="mt-5">${total
      ? barChart(series, { tone: "brand", unit: "inscription", integer: true, caption: `Nouvelles inscriptions par jour, ${period} derniers jours` })
      : emptyState("users", "Aucune inscription sur la période", "Les nouveaux comptes clippers et agences apparaîtront ici.", "", { inCard: true })}</div>`;
  const acts = (db.activity || []).slice(0, 6);
  const activity = `${cardHeader("Activité récente")}
    ${acts.length
      ? `<ul class="mt-3 divide-y divide-line">${acts.map((a) => `<li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">${eventIcon(a.icon)}
          <div class="min-w-0 flex-1"><p class="text-small text-fg">${esc(a.text)}</p><p class="mt-0.5 text-xs text-fg-subtle">${ago(a.at)}</p></div></li>`).join("")}</ul>`
      : `<div class="grid flex-1 place-items-center">${emptyState("clock", "Aucune activité sur les 7 derniers jours", "Inscriptions, validations et paiements s'afficheront ici.", "", { inCard: true })}</div>`}`;

  return `${pageHeader("Vue d'ensemble", "Pilotez l'activité de ClipBoost en temps réel.")}
    ${s.maintenance ? `<div class="mt-6">${alertBox("warning", `<strong class="font-semibold">Mode maintenance activé.</strong> Les clippers et les agences ne peuvent pas se connecter. <a href="#/admin/parametres" class="${btn("link")}">Modifier dans les réglages</a>`)}</div>` : ""}
    <section class="mt-6" aria-label="À traiter">
      ${admSectionTitle("À traiter", queue ? countBadge(queue, "queue") : "")}
      <ul class="mt-3 divide-y divide-line overflow-hidden ${CARD} sm:hidden">${todoList}</ul>
      <div class="mt-3 hidden gap-4 sm:grid sm:grid-cols-3 lg:gap-5">${todoCards.join("")}</div>
    </section>
    <section class="mt-8" aria-label="Plateforme">
      ${admSectionTitle("Plateforme")}
      <div class="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-4">${kpis.join("")}</div>
    </section>
    <div class="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-5">
      ${card(chart)}
      ${card(activity, "flex flex-col p-5")}
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

function admUserActions(u, size) {
  if (u.role === "admin") return `<span class="text-xs text-fg-subtle">Administrateur</span>`;
  return `<button type="button" data-action="adm-user-view" data-id="${u.id}" class="${btn("ghost", size)}">Détails</button>
    <button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="${btn("secondary", size)}">${u.status === "Actif" ? "Suspendre" : "Réactiver"}</button>`;
}

function aUtilisateurs() {
  const f = state.adm, q = f.userQ.trim().toLowerCase();
  const byRole = (r) => db.users.filter((u) => !ADM_ROLES[r] || u.role === ADM_ROLES[r]);
  const list = byRole(f.userRole).filter((u) => (f.userStatus === "Tous" || u.status === f.userStatus) && (!q || `${u.name} ${u.email} ${u.country}`.toLowerCase().includes(q)));
  const roles = Object.keys(ADM_ROLES).map((r) => [r, r === "Tous les rôles" ? "Tous" : r, byRole(r).length]);
  const statuses = [["Tous", "Tous les statuts"], ["Actif", "Actifs"], ["Suspendu", "Suspendus"]];

  const rows = list.map((u) => {
    const money_ = u.role === "admin" ? admDash : `${money(admBalance(u))}<span class="${TBL.tdSub} font-normal">${admBalanceLabel(u)}</span>`;
    return {
      tr: `<tr class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}"><div class="flex min-w-0 items-center gap-3">${avatar(u, "sm")}<div class="min-w-0"><div class="flex min-w-0 items-center gap-1.5"><span class="truncate font-medium text-fg">${esc(u.name)}</span>${roleTag(u)}</div><span class="${TBL.tdSub} truncate">${esc(u.email)}</span></div></div></td>
        <td class="${TBL.td} hidden xl:table-cell"><span class="whitespace-nowrap text-fg-muted">${esc(u.country)}</span></td>
        <td class="${TBL.td} hidden xl:table-cell"><span class="whitespace-nowrap tabular-nums text-fg-muted">${date(u.joined)}</span></td>
        <td class="${TBL.td} ${TBL.tdNum}">${money_}</td>
        <td class="${TBL.td}">${statusBadge(u.status)}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admUserActions(u, "sm")}</div></td>
      </tr>`,
      li: `<li class="${TBL.item}">
        <div class="flex items-start gap-3">${avatar(u, "md")}<div class="min-w-0 flex-1"><div class="flex min-w-0 items-center gap-1.5"><p class="truncate text-sm font-medium text-fg">${esc(u.name)}</p>${roleTag(u)}</div><p class="truncate text-xs text-fg-subtle">${esc(u.email)}</p></div>${statusBadge(u.status)}</div>
        <div class="flex items-center justify-between gap-3 text-small"><span class="min-w-0 truncate text-fg-subtle">${esc(u.country)} · inscrit le ${date(u.joined)}</span>${u.role === "admin" ? "" : `<span class="shrink-0 font-medium">${money(admBalance(u))}<span class="font-normal text-fg-subtle"> ${admBalanceLabel(u)}</span></span>`}</div>
        ${u.role === "admin" ? "" : `<div class="grid grid-cols-2 gap-2">${admUserActions(u, "md")}</div>`}
      </li>`,
    };
  });

  // Pays et date d'inscription : visibles à partir de xl (et toujours dans Détails et dans la liste mobile).
  const table = admTable("md", `<th scope="col" class="${TBL.th}">Utilisateur</th><th scope="col" class="${TBL.th} hidden xl:table-cell">Pays</th><th scope="col" class="${TBL.th} hidden xl:table-cell">Inscription</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Solde</th><th scope="col" class="${TBL.th}">Statut</th>${ADM_TH_ACTIONS}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));

  return `${pageHeader("Utilisateurs", "Clippers, agences et administrateurs. Les nouvelles inscriptions apparaissent ici automatiquement.")}
    ${admToolbar(searchInput("adm-user-q", f.userQ, "Nom, email ou pays", "Rechercher un utilisateur", "w-full xl:max-w-xs"),
      admScrollRow([segmented("adm-user-role", f.userRole, roles, "Rôle"), segmented("adm-user-status", f.userStatus, statuses, "Statut")]))}
    ${admCountLine(list.length, db.users.length, "compte", "comptes")}
    <div class="mt-3">${list.length ? table
      : emptyState("search", "Aucun utilisateur ne correspond", "Essayez un autre nom, un autre rôle ou effacez les filtres.", `<button type="button" data-action="adm-user-clear" class="${btn("secondary")}">Effacer les filtres</button>`)}</div>`;
}

// ---------- Campagnes ----------

const ADM_CAMP_STATUS = [["Toutes", "Toutes"], ["Active", "Actives"], ["En attente", "En attente"], ["En pause", "En pause"], ["Terminée", "Terminées"], ["Refusée", "Refusées"]];

// Actions par statut, sur une ligne ; l'action principale est à droite (comme la colonne Décision de la modération).
function admCampActions(c, size) {
  const b = (action, variant, label, ic = "") => `<button type="button" data-action="${action}" data-id="${c.id}" class="${btn(variant, size)}">${ic ? icon(ic) : ""}${label}</button>`;
  return {
    "En attente": b("adm-camp-refuse", "dangerSoft", "Refuser") + b("adm-camp-approve", "primary", "Approuver"),
    "Active": b("adm-camp-end", "ghost", "Terminer") + b("adm-camp-pause", "secondary", "Pause", "pause"),
    "En pause": b("adm-camp-end", "ghost", "Terminer") + b("adm-camp-approve", "secondary", "Reprendre", "play"),
  }[c.status] || "";
}

function aCampagnes() {
  const f = state.adm, q = f.campQ.trim().toLowerCase();
  const owner = (c) => (c.ownerId ? userById(c.ownerId) : null);
  const searched = db.campaigns.filter((c) => { const o = owner(c); return !q || `${c.title} ${c.brand} ${c.category} ${o ? o.name : ""}`.toLowerCase().includes(q); });
  const list = searched.filter((c) => f.campStatus === "Toutes" || c.status === f.campStatus);
  const options = ADM_CAMP_STATUS.map(([v, l]) => [v, l, v === "Toutes" ? searched.length : searched.filter((c) => c.status === v).length]);
  const sub = (c) => { const o = owner(c); return `${esc(c.brand)} · ${esc(c.category)} · ${o ? `par l'agence ${esc(o.name)}` : c.ownerId ? "agence supprimée" : "gérée par ClipBoost"}`; };
  const fallback = (c) => (c.status === "Terminée" ? `<span class="text-xs text-fg-subtle">Archivée</span>` : admDash);

  const trs = list.map((c) => `<tr class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}"><div class="flex min-w-0 items-center gap-3">${coverThumb(c, "sm")}<div class="min-w-0"><p class="truncate font-medium text-fg">${esc(c.title)}</p><span class="${TBL.tdSub} truncate">${sub(c)}</span></div></div></td>
        <td class="${TBL.td}">${statusBadge(c.status)}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${money(c.rate)}<span class="${TBL.tdSub} font-normal">/ 1${NB}000${NB}vues</span></td>
        <td class="${TBL.td}"><div class="min-w-44">${progress(c.spent, c.budget)}</div></td>
        <td class="${TBL.td} ${TBL.tdNum}">${fmt(c.clippers)}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admCampActions(c, "sm") || fallback(c)}</div></td>
      </tr>`).join("");
  // Sous xl : une ligne par campagne (identité | budget), actions en boutons md dessous, alignées à droite dès sm.
  const lis = list.map((c) => { const acts = admCampActions(c, "md"); return `<li class="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:items-center sm:gap-x-8 sm:px-5">
      <div class="flex min-w-0 items-start gap-3">${coverThumb(c, "sm")}<div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(c.title)}</p><p class="line-clamp-2 text-xs text-fg-subtle">${sub(c)}</p>
        <p class="mt-1 text-xs tabular-nums text-fg-subtle">${rateShort(c.rate)} · ${plural(c.clippers, "clipper", "clippers")}</p></div>${statusBadge(c.status)}</div>
      <div class="min-w-0">${progress(c.spent, c.budget)}</div>
      ${acts ? `<div class="grid grid-cols-2 gap-2 sm:col-span-2 sm:flex sm:justify-end">${acts}</div>` : ""}
    </li>`; }).join("");
  const table = admTable("xl", `<th scope="col" class="${TBL.th}">Campagne</th><th scope="col" class="${TBL.th}">Statut</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Tarif</th><th scope="col" class="${TBL.th}">Budget</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Clippers</th>${ADM_TH_ACTIONS}`, trs, lis);

  return `${pageHeader("Campagnes", "Approuvez, mettez en pause ou créez des campagnes. Seules les campagnes actives sont visibles par les clippers.",
      `<button type="button" data-action="adm-new-campaign" class="${btn("primary")}">${icon("plus")}Nouvelle campagne</button>`)}
    ${admToolbar(searchInput("adm-camp-q", f.campQ, "Titre, marque, catégorie ou agence", "Rechercher une campagne", "w-full xl:max-w-xs"),
      chips("adm-camp-status", f.campStatus, options, "Statut"))}
    ${admCountLine(list.length, db.campaigns.length, "campagne", "campagnes")}
    <div class="mt-3">${list.length ? table
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
  return `${pageHeader("Modération des clips", "Relevez les vues de chaque clip, puis validez ceux qui respectent les règles de la campagne.")}
    <div class="mt-6">${rules}</div>
    <div class="mt-6">${segmented("adm-mod-status", f.modStatus, [["En attente", "En attente", n("En attente")], ["Validée", "Validées", n("Validée")], ["Refusée", "Refusées", n("Refusée")], ["Toutes", "Toutes", all.length]], "Statut")}</div>
    <div class="mt-4">${list.length ? admPubTable(publicationsTable(list, { showUser: true, actions: true })) : empty}</div>`;
}

// ---------- Paiements ----------

const admPayActions = (t, size, approveLabel) => (t.status === "En cours"
  ? `<button type="button" data-action="adm-tx-reject" data-id="${t.id}" class="${btn("dangerSoft", size)}">Rejeter</button><button type="button" data-action="adm-tx-approve" data-id="${t.id}" class="${btn("primary", size)}">${approveLabel}</button>`
  : "");
// Ligne mono + Copier (compte, référence) des cartes.
const admMonoLine = (label, html, value, copyLabel, msg) =>
  `<div class="grid gap-0.5"><dt class="text-xs text-fg-subtle">${label}</dt><dd class="flex min-w-0 items-center justify-between gap-2"><span class="min-w-0 truncate font-mono text-sm text-fg">${html}</span>${value ? admCopyBtn(value, copyLabel, msg) : ""}</dd></div>`;
const admMoneyRows = (rows) => `<dl class="grid gap-1.5 text-small">${rows.map(([l, v, strong]) => `<div class="flex items-baseline justify-between gap-4 ${strong ? "border-t border-line pt-2 font-semibold text-fg first:border-t-0 first:pt-0" : "text-fg-muted"}"><dt>${l}</dt><dd class="text-right">${v}</dd></div>`).join("")}</dl>`;
const admWhen = (t) => `${date(t.date)}${t.time ? ` · ${esc(t.time)}` : ""}`;
// Carte d'une demande (sous la largeur du tableau) : identité et coordonnées à gauche, argent et décision à droite dès sm.
const admPayItem = (u, sub, badgeHtml, details, moneyHtml, actions) => `<li class="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] sm:gap-x-8 sm:px-5">
    <div class="grid min-w-0 content-start gap-3">
      <div class="flex items-start gap-3">${avatar(u, "md")}<div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(u.name)}</p><p class="truncate text-xs tabular-nums text-fg-subtle">${sub}</p></div>${badgeHtml}</div>
      <dl class="grid gap-2.5 rounded-tile bg-subtle p-3">${details}</dl>
    </div>
    <div class="grid content-start gap-3 sm:pt-1">${moneyHtml}${actions ? `<div class="grid grid-cols-2 gap-2 sm:flex sm:flex-col-reverse">${actions}</div>` : ""}</div>
  </li>`;
const admPayer = (u, t) => `<div class="flex min-w-0 items-center gap-2.5">${avatar(u, "sm")}<div class="min-w-0"><p class="truncate font-medium text-fg">${esc(u.name)}</p><span class="${TBL.tdSub} tabular-nums">${admWhen(t)}</span></div></div>`;

// Retraits : tableau à partir de 1 400 px (7 colonnes), cartes en dessous. La date de la demande est sous le nom.
function admWithdrawals(list) {
  const rows = list.map((t) => {
    const u = admUser(t.userId), acc = admAccountValue(u.payoutAccount), method = t.method || u.payoutMethod || "", pending = t.status === "En cours";
    const fee = t.fee ? admMuted(t.fee) : admDash;
    return {
      tr: `<tr class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}">${admPayer(u, t)}</td>
        <td class="${TBL.td}"><div class="flex items-center gap-1.5"><div class="grid justify-items-start gap-1">${method ? badge(esc(method), "idle") : ""}${acc ? `<span class="whitespace-nowrap font-mono text-small text-fg">${admAccount(acc)}</span>` : `<span class="text-xs text-fg-subtle">Aucun compte enregistré</span>`}</div>${acc ? admCopyBtn(acc, "Copier le numéro", "Numéro copié") : ""}</div></td>
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
        admPayActions(t, "md", "Virement effectué")),
    };
  });
  return admTable("wide", `<th scope="col" class="${TBL.th}">Bénéficiaire</th><th scope="col" class="${TBL.th}">Moyen et compte</th><th scope="col" class="${TBL.th}">Référence</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Montant</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Frais</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Net à virer</th>${ADM_TH_ACTIONS}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));
}

// Recharges : tableau à partir de xl (5 colonnes), cartes en dessous.
function admRecharges(list) {
  const rows = list.map((t) => {
    const u = admUser(t.userId), pending = t.status === "En cours", method = admCap(t.method);
    return {
      tr: `<tr class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}">${admPayer(u, t)}</td>
        <td class="${TBL.td}">${method ? badge(method, "idle") : admDash}</td>
        <td class="${TBL.td}"><span class="flex items-center gap-0.5"><span class="whitespace-nowrap text-small text-fg">${code(t.ref)}</span>${admCopyBtn(t.ref, "Copier la référence", "Référence copiée")}</span></td>
        <td class="${TBL.td} ${TBL.tdNum}">${money(t.amount, { cls: "font-semibold" })}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admPayActions(t, "sm", "Paiement reçu") || statusBadge(t.status)}</div></td>
      </tr>`,
      li: admPayItem(u, `${method || "Recharge"} · ${admWhen(t)}`, pending ? badge("À confirmer", "info", { dot: true }) : statusBadge(t.status),
        admMonoLine("Référence du paiement", esc(t.ref), t.ref, "Copier la référence", "Référence copiée"),
        admMoneyRows([["Montant annoncé", money(t.amount), true]]),
        admPayActions(t, "md", "Paiement reçu")),
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
    : ["Confirmez à réception du paiement : le montant est alors ajouté au crédit de l'agence.", pr.length ? `${plural(pr.length, "recharge", "recharges")} · ${da(admSum(pr, (t) => t.amount))} annoncés` : ""];
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
  `<div class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
    <div class="min-w-0"><label for="${id}" class="text-sm font-medium text-fg">${title}</label><p id="${id}-desc" class="mt-0.5 text-small text-fg-muted">${desc}</p></div>
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
        <div class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-4 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-popover backdrop-blur-md sm:px-5 lg:bottom-4">
          <p class="hidden text-small text-fg-muted sm:block">Annonce, montants et délais s'appliquent à tout le site dès l'enregistrement.</p>
          <button type="submit" class="${btn("primary", "md", "w-full sm:w-auto")}">Enregistrer</button>
        </div>
      </form>
      ${window.__CLIPBOOST_OFFLINE__ ? `<section class="mt-4 flex flex-col gap-3 rounded-card border border-dashed border-line-strong p-5 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0"><h2 class="text-section text-fg">Version de démonstration</h2><p class="mt-0.5 text-small text-fg-muted">Les données sont enregistrées dans ce navigateur.</p></div>
        <button type="button" data-action="adm-reset-demo" class="${btn("dangerSoft", "sm")}">Réinitialiser la démo</button></section>` : ""}
    </div>`;
}

const ADMIN_VIEWS = { apercu: aApercu, utilisateurs: aUtilisateurs, campagnes: aCampagnes, moderation: aModeration, retraits: aRetraits, parametres: aParametres };

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
  rows.push(["Gain estimé", est ? `${money(est)}${capped ? `<span class="ml-1.5 text-xs font-normal text-fg-subtle">plafond</span>` : ""}` : `<span class="font-normal text-fg-subtle">— sous le seuil</span>`, true]);
  return summary(rows);
};

function adminModal() {
  const m = state.modal;
  if (!m) return "";
  const cancel = (label = "Annuler") => `<button type="button" data-action="close-modal" class="${btn("ghost")}">${label}</button>`;

  if (m.type === "user") {
    const u = userById(m.id);
    if (!u) return "";
    const pubs = db.publications.filter((p) => p.userId === u.id), agency = u.role === "agence";
    const tile = (label, value, cls = "") => `<div class="${TILE} ${cls}"><dt class="text-xs text-fg-subtle">${label}</dt><dd class="mt-1 text-sm font-semibold text-fg">${value}</dd></div>`;
    const acc = admAccountValue(u.payoutAccount);
    const tiles = agency
      ? (() => { const cs = db.campaigns.filter((c) => c.ownerId === u.id); return [
          tile("Crédit", money(u.credit || 0)), tile("Budget engagé", money(admSum(cs, (c) => c.budget))), tile("Campagnes", `<span class="tabular-nums">${fmt(cs.length)}</span>`),
          tile("Contact", esc(u.contact || "—"), "col-span-2 sm:col-span-3")]; })()
      : [tile("Gains totaux", money(totalEarned(u))), tile("Solde retirable", money(balance(u))), tile("Clips soumis", `<span class="tabular-nums">${fmt(pubs.length)}</span>`),
          tile("Moyen de retrait", u.payoutMethod
            ? `<span class="flex flex-wrap items-center gap-x-2 gap-y-1">${badge(esc(u.payoutMethod), "idle")}${acc ? `<span class="flex items-center gap-0.5"><span class="font-mono text-small font-medium">${admAccount(acc)}</span>${admCopyBtn(acc, "Copier le numéro", "Numéro copié")}</span>` : ""}</span>`
            : `<span class="font-normal text-fg-subtle">Aucun moyen enregistré</span>`, "col-span-2 sm:col-span-3")];
    const toggle = u.role === "admin" ? ""
      : u.status === "Actif"
        ? `<button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="${btn("dangerSoft")}">Suspendre ce compte</button>`
        : `<button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="${btn("secondary")}">${icon("play")}Réactiver ce compte</button>`;
    return modalShell({
      title: esc(u.name), description: esc(u.email), size: "lg",
      body: `<div class="flex items-center gap-4">${avatar(u, "lg")}
          <div class="min-w-0"><div class="flex flex-wrap items-center gap-1.5">${roleTag(u) || (u.level ? badge(esc(u.level), "brand", { ic: "medal" }) : "")}${statusBadge(u.status)}${badge("Email vérifié", "success", { ic: "check" })}</div>
            <p class="mt-2 text-small text-fg-muted">${esc(u.country)} · inscrit le ${date(u.joined)}</p></div></div>
        <dl class="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">${tiles.join("")}</dl>`,
      footer: `${cancel("Fermer")}${toggle}`,
    });
  }
  if (m.type === "suspend") {
    const u = userById(m.id);
    if (!u) return "";
    return modalShell({
      title: `Suspendre ce compte${NB}?`, description: `${esc(u.name)} · ${esc(u.email)}`,
      body: `<p class="text-sm text-fg-muted">${esc(u.name)} sera déconnecté immédiatement et ne pourra plus se connecter. Vous pourrez réactiver le compte à tout moment depuis la liste des utilisateurs.</p>`,
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
        ${reasons.map((r, i) => `<label class="${CHOICE_DANGER}"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? "checked" : ""} class="mt-0.5 size-4 shrink-0 cursor-pointer accent-danger-solid"/><span class="text-sm font-medium text-fg">${esc(r)}</span></label>`).join("")}</fieldset>`,
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
        ${p.url ? `<p class="mt-4"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="${btn("link", "", "text-small")}">${icon("external", "size-4")}Ouvrir le clip</a></p>` : ""}`,
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
    // Carte « À traiter » : le lien ouvre la page (changement d'adresse), on y présélectionne la file concernée.
    case "adm-focus":
      if (v === "moderation") state.adm.modStatus = "En attente";
      if (v === "campagnes" && db.campaigns.some((c) => c.status === "En attente")) Object.assign(state.adm, { campQ: "", campStatus: "En attente" });
      if (v === "retraits") state.adm.payTab = pendingWithdrawals().length || !pendingRecharges().length ? "retraits" : "recharges";
      return;
    case "adm-copy": return copy(v, t.dataset.msg || "Copié");
    case "adm-user-view": state.modal = { type: "user", id }; return render();
    case "adm-user-toggle": {
      const u = userById(id);
      if (!u) return;
      // La suspension demande une confirmation ; la réactivation est immédiate.
      if (u.status === "Actif" && !t.dataset.confirm) { state.modal = { type: "suspend", id }; return render(); }
      const next = u.status === "Actif" ? "Suspendu" : "Actif";
      return act("PATCH", `/api/admin/users/${id}`, { status: next }, `${u.name} : compte ${next === "Suspendu" ? "suspendu" : "réactivé"}`,
        () => { if (state.modal && state.modal.type === "suspend") state.modal = null; });
    }
    case "adm-camp-approve": case "adm-camp-pause": case "adm-camp-end": case "adm-camp-refuse": {
      const c = campaignById(id), status = { "adm-camp-approve": "Active", "adm-camp-pause": "En pause", "adm-camp-end": "Terminée", "adm-camp-refuse": "Refusée" }[action];
      return act("PATCH", `/api/campaigns/${id}`, { status }, `« ${c.title} » est maintenant ${status.toLowerCase()}`);
    }
    case "adm-new-campaign": state.modal = { type: "new-campaign" }; return render();
    case "adm-validate": return act("POST", `/api/clips/${id}/review`, { approve: true }, "Clip validé, gains crédités au clipper");
    case "adm-reject": state.modal = { type: "reject", id }; return render();
    case "adm-views": state.modal = { type: "views", id }; return render();
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
  if (form === "adm-reject") {
    return act("POST", `/api/clips/${state.modal.id}/review`, { approve: false, reason: data.reason }, "Clip refusé, le clipper est notifié", () => { state.modal = null; });
  }
  if (form === "adm-views") {
    const p = db.publications.find((x) => x.id === state.modal.id), views = Math.floor(admParse(data.views));
    if (!Number.isFinite(views) || (p && views < p.views)) return admInvalid("adm-views", "views", p ? `Le nombre de vues ne peut pas être inférieur au dernier relevé (${fmt(p.views)}).` : "Nombre de vues invalide.");
    return act("POST", `/api/clips/${state.modal.id}/views`, { views }, "Vues enregistrées", () => { state.modal = null; });
  }
  if (form === "adm-campaign") {
    return act("POST", "/api/campaigns", campaignPayload(data), "Campagne publiée", () => { state.modal = null; state.adm.campStatus = "Toutes"; });
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
