// Espace Agence : les créateurs de campagnes lancent et suivent leurs campagnes.
// Une nouvelle campagne part « En attente » et n'est visible des clippers qu'après approbation par l'administrateur.
// Recettes : docs/design-system.md §4.4 à §4.7, §5 et §6.3. Les helpers propres à ce fichier sont préfixés « ag ».

const AGENCY_NAV = [
  { id: "apercu", label: "Vue d'ensemble", short: "Aperçu", icon: "home" },
  { id: "campagnes", label: "Mes campagnes", short: "Campagnes", icon: "target" },
  { id: "clips", label: "Clips reçus", short: "Clips", icon: "film" },
  { id: "budget", label: "Budget", icon: "wallet" },
  { id: "profil", label: "Profil de l'agence", short: "Profil", icon: "user" },
];

const myCampaigns = () => db.campaigns.filter((c) => c.ownerId === state.session);
const clipsOf = (ids) => db.publications.filter((p) => ids.includes(p.campaign));
// Vues cumulées des clips validés de la campagne.
const campaignViews = (c) => clipsOf([c.id]).filter((p) => p.status === "Validée").reduce((s, p) => s + p.views, 0);
// Montant prélevé sur le crédit : budget + commission ClipBoost.
const withCommission = (amount, rate = db.settings.commissionRate) => amount + Math.round((amount * rate) / 100);

function agencyStatusHint(c) {
  return {
    "En attente": "En cours de vérification par l'équipe ClipBoost.",
    "Active": "Visible par les clippers.",
    "En pause": "Masquée aux clippers, aucun nouveau clip.",
    "Terminée": "Campagne archivée.",
    "Refusée": "Refusée par l'équipe ClipBoost.",
  }[c.status];
}

// ---------- Helpers locaux ----------
// Montant saisi (« 50 000 », « 50000 ») → entier positif, 0 si vide ou invalide.
const agNum = (v) => { const n = Math.floor(+String(v ?? "").replace(/\s/g, "")); return Number.isFinite(n) && n > 0 ? n : 0; };
const agToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const agClosed = (c) => c.status === "Terminée" || c.status === "Refusée";
// Recharges annoncées, pas encore confirmées par l'équipe.
const agPendingCredit = () => myTx().filter((t) => t.type === "recharge" && t.status === "En cours").reduce((s, t) => s + t.amount, 0);
// Engagé = consommé + restant. Une campagne terminée n'engage plus que ce qu'elle a consommé (le reste est rendu) ;
// une campagne refusée n'engage rien.
function agTotals(list) {
  const kept = list.filter((c) => c.status !== "Refusée");
  const spent = kept.reduce((s, c) => s + c.spent, 0);
  const left = kept.filter((c) => !agClosed(c)).reduce((s, c) => s + Math.max(0, c.budget - c.spent), 0);
  const awaiting = kept.filter((c) => c.status === "En attente").reduce((s, c) => s + c.budget, 0);
  return { spent, left, engaged: spent + left, awaiting, count: kept.length };
}
const agNewBtn = () => `<button type="button" data-action="ag-new" class="${btn("primary")}">${icon("plus")}Nouvelle campagne</button>`;
// Rangée « Nouvelle campagne » qui complète la liste de l'aperçu quand elle compte moins de 4 campagnes.
const agNewRow = `<li><button type="button" data-action="ag-new" class="flex w-full items-center gap-3 rounded-tile p-2 text-left text-sm font-medium text-fg-muted transition-colors duration-150 hover:bg-subtle hover:text-fg ${FOCUS}"><span class="grid size-10 shrink-0 place-items-center rounded-tile border border-dashed border-line-strong text-fg-subtle" aria-hidden="true">${icon("plus", "size-4")}</span>Nouvelle campagne</button></li>`;
const agMoreLink = (href, label = "Tout voir") =>
  `<a href="${href}" class="${HIT} inline-flex items-center gap-1 rounded-sm text-small font-medium text-brand-fg underline-offset-4 hover:underline ${FOCUS}">${label}${icon("chevronRight", "size-3.5")}</a>`;
// Pause ou reprise : seules actions de statut ouvertes à l'agence.
const agToggle = (c, size = "sm", extra = "") =>
  c.status === "Active" ? `<button type="button" data-action="ag-pause" data-id="${c.id}" class="${btn("secondary", size, extra)}">${icon("pause")}Mettre en pause</button>`
  : c.status === "En pause" ? `<button type="button" data-action="ag-resume" data-id="${c.id}" class="${btn("secondary", size, extra)}">${icon("play")}Reprendre</button>` : "";
// Puce de tarif posée sur une couverture.
const agRateChip = (r) =>
  `<span class="absolute left-2.5 top-2.5 inline-flex items-baseline gap-1 rounded-badge bg-night/80 px-2 py-1 text-small font-semibold tabular-nums text-on-brand backdrop-blur-sm">${fmt(r)}${NB}DA<span class="text-[11px] font-medium text-on-brand/80">/ 1k${NB}vues</span></span>`;
// Montant d'une recharge : vert une fois le crédit reçu, neutre en attente, barré si refusée.
const agRechargeAmount = (t) =>
  t.status === "Validé" ? money(t.amount, { signed: true }) : t.status === "Refusé" ? `<span class="line-through">${money(t.amount)}</span>` : money(t.amount);
const agRechargeStatus = (t) => statusBadge(t.status === "En cours" ? "En attente" : t.status);
const agMethod = (t) => { const m = t.method || t.label || ""; return esc(m.charAt(0).toUpperCase() + m.slice(1)); };
const agCopyBtn = (ref) =>
  `<button type="button" data-action="ag-copy" data-value="${esc(ref)}" class="${iconBtn("sm")}" aria-label="Copier la référence ${esc(ref)}" title="Copier">${icon("copy")}</button>`;
// Montants proposés sous un champ (raccourcis) : [[valeur, libellé]] ; celui qui correspond à la saisie est marqué.
const agPresets = (items, current) => items.map(([v, l]) =>
  `<button type="button" data-action="ag-amount" data-value="${v}" aria-pressed="${v === current}" ${l === da(v) ? "" : `title="${da(v)}"`} class="${btn("secondary", "sm", "tabular-nums aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-brand-fg")}">${l}</button>`).join("");
const agPresetRow = (html) => `<div class="flex flex-wrap gap-2" role="group" aria-label="Montants rapides" data-live-out="presets">${html}</div>`;
// Raccourcis de l'ajout de budget ; « Tout le crédit » = le plus grand ajout (commission comprise) que le crédit couvre.
function agTopupPresets(c, u) {
  const max = c.status === "En attente" ? 0 : Math.floor(u.credit / (1 + c.commissionRate / 100) / 1000) * 1000;
  return [...[50000, 100000, 200000].map((v) => [v, da(v)]), ...(max >= 1000 ? [[max, "Tout le crédit"]] : [])];
}
const AG_RECHARGES = [100000, 250000, 500000];

// ---------- Aperçu ----------

// Agence sans campagne : premier pas, sur fond nuit (aucun KPI vide).
function agOnboarding(u, pending) {
  const steps = [
    ["Créez la campagne", `Budget, tarif pour 1${NB}000 vues, seuil et plafond par clip.`],
    ["ClipBoost la vérifie", `Le budget et la commission de ${db.settings.commissionRate}${NB}% sont débités à l'approbation.`],
    ["Les clippers publient", "Vous ne payez que les vues des clips validés."],
  ];
  return `<section class="rounded-card bg-night p-6 text-on-brand sm:p-8">
    <div class="max-w-2xl">
      <h2 class="text-heading text-on-brand">Lancez votre première campagne</h2>
      <p class="mt-2 text-sm text-on-brand/80">Fixez un budget et un tarif pour 1${NB}000 vues : des centaines de clippers diffusent votre marque.</p>
    </div>
    <ol class="mt-6 grid gap-4 sm:grid-cols-3">${steps.map(([t, d], i) => `<li class="flex gap-3">
      <span class="grid size-6 shrink-0 place-items-center rounded-full bg-on-brand/15 text-xs font-semibold tabular-nums text-on-brand">${i + 1}</span>
      <span class="min-w-0"><span class="block text-sm font-medium text-on-brand">${t}</span><span class="mt-0.5 block text-small text-on-brand/80">${d}</span></span></li>`).join("")}</ol>
    <div class="mt-7 flex flex-col gap-2 sm:flex-row sm:items-center">
      <button type="button" data-action="ag-new" class="${btn("onColor")}">${icon("plus")}Créer ma première campagne</button>
      <button type="button" data-action="ag-credit" class="${btn("onColorGhost")}">Recharger le crédit</button>
    </div>
    <p class="mt-5 text-xs tabular-nums text-on-brand/65">Crédit disponible : ${da(u.credit)}${pending ? ` · ${da(pending)} en attente de confirmation` : ""}</p>
  </section>`;
}

// Ligne compacte « Vos campagnes » : toute la ligne ouvre le détail (bouton étiré sur le titre).
const agCampaignRow = (c) => `<li class="relative flex min-w-0 items-center gap-3 rounded-tile p-2 transition-colors duration-150 hover:bg-subtle">
    ${coverThumb(c, "sm")}
    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-2">
        <button type="button" data-action="ag-open" data-id="${c.id}" class="min-w-0 truncate text-left text-sm font-medium text-fg after:absolute after:inset-0 after:rounded-tile focus-visible:outline-hidden focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus">${esc(c.title)}</button>
        <span class="shrink-0">${statusBadge(c.status)}</span>
      </div>
      <p class="mt-0.5 truncate text-xs tabular-nums text-fg-subtle">${rateShort(c.rate)} · ${plural(c.clippers, "clipper", "clippers")}</p>
      <div class="mt-2">${progress(c.spent, c.budget, { label: false, aria: `Budget consommé de ${c.title}` })}</div>
    </div></li>`;

function gApercu() {
  const u = me(), list = myCampaigns(), clips = clipsOf(list.map((c) => c.id)), pending = agPendingCredit();
  const hello = `Bonjour ${esc((u.contact || u.name).split(" ")[0])}`, intro = `${esc(u.name)} · activité au ${date(agToday())}`;
  if (!list.length) return `${pageHeader(hello, `${esc(u.name)} · bienvenue sur ClipBoost`)}<div class="mt-6">${agOnboarding(u, pending)}</div>`;

  const { spent, engaged, left } = agTotals(list);
  const views = list.reduce((s, c) => s + campaignViews(c), 0), inReview = clips.filter((p) => p.status === "En attente").length;
  // Aucun KPI en vert : ce sont des dépenses.
  const kpis = [
    kpi({ label: "Crédit disponible", value: bigMoney(u.credit),
      sub: `<button type="button" data-action="ag-credit" class="${btn("link")}">Recharger</button>${pending ? `<span class="tabular-nums"> · ${da(pending)} en attente</span>` : ""}` }),
    kpi({ label: "Budget consommé", value: bigMoney(spent), sub: `sur ${da(engaged)} engagés`,
      extra: `<div class="mt-3">${progress(spent, engaged, { label: false, aria: "Part du budget engagé déjà consommée" })}</div>` }),
    kpi({ label: "Vues générées", value: kpiValue(fmt(views)), sub: views ? `soit ${rate(Math.round((spent / views) * 1000))}` : "Clips validés uniquement" }),
    kpi({ label: "Clips reçus", value: kpiValue(fmt(clips.length)), sub: inReview ? `${fmt(inReview)} en modération` : "Aucun en modération" }),
  ];

  const period = state.period === 7 ? 7 : 30, series = (db.series.daily || []).slice(-period);
  const total = series.reduce((s, v) => s + v, 0), activeDays = series.filter((v) => v > 0).length;
  const chart = `<header class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0"><h2 class="text-section text-fg">Budget consommé par jour</h2>
        <p class="mt-2">${bigMoney(total)}</p>
        <p class="mt-0.5 text-small text-fg-subtle">sur ${period}${NB}jours · ${plural(activeDays, "jour actif", "jours actifs")}</p></div>
      ${segmented("ag-period", period, [[7, "7 j"], [30, "30 j"]], "Période du graphique")}
    </header>
    <div class="mt-5">${total
      ? barChart(series, { tone: "brand", caption: `Budget consommé par jour, ${period} derniers jours` })
      : emptyState("chart", "Aucune dépense sur la période", "Le budget est consommé dès que les clips validés de vos campagnes génèrent des vues.", "", { inCard: true })}</div>`;

  return `${pageHeader(hello, intro, `<span class="lg:hidden">${agNewBtn()}</span>`)}
    <div class="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-4">${kpis.join("")}</div>
    <div class="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-5">
      ${card(chart)}
      ${card(`${cardHeader("Vos campagnes", "", agMoreLink("#/agence/campagnes"))}
        <ul class="-mx-2 mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">${list.slice(0, 4).map(agCampaignRow).join("")}${list.length < 4 ? agNewRow : ""}</ul>
        <div class="mt-auto pt-5"><dl class="flex items-baseline justify-between gap-3 border-t border-line pt-4 text-small"><dt class="text-fg-muted">Restant à consommer</dt><dd class="font-medium">${money(left)}</dd></dl></div>`, "flex flex-col p-5")}
    </div>
    ${sectionHeader("Derniers clips reçus", clips.length ? "#/agence/clips" : "")}
    ${clips.length ? publicationsTable(clips.slice(0, 4), { showUser: true, amountLabel: "Coût" })
      : emptyState("film", "Aucun clip reçu pour l'instant", "Les clips publiés par les clippers sur vos campagnes apparaîtront ici.")}`;
}

// ---------- Mes campagnes ----------

// Carte campagne, variante agence (§4.4) : statut sous le titre, pas de favori, pause ou reprise + détails.
function agCampaignCard(c) {
  const toggle = agToggle(c, "sm", "w-full");
  return `<article class="group flex flex-col ${CARD} ${CARD_HOVER} p-2">
    <button type="button" data-action="ag-open" data-id="${c.id}" class="cover relative block aspect-[16/9] w-full overflow-hidden rounded-tile ${FOCUS}" ${coverAttr(c)} aria-label="Détails de ${esc(c.title)}">
      <span class="absolute inset-0 grid place-items-center text-5xl drop-shadow-[0_6px_14px_rgb(0_0_0/0.22)]" aria-hidden="true">${c.emoji}</span>
      ${agRateChip(c.rate)}
    </button>
    <div class="flex flex-1 flex-col gap-3 px-2 pb-1 pt-3">
      <div>
        <p class="text-xs text-fg-subtle">${esc(c.category)}</p>
        <h3 class="mt-0.5 font-sans text-[15px] font-semibold leading-snug text-fg">${esc(c.title)}</h3>
        <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">${statusBadge(c.status)}<span class="text-xs text-fg-subtle">${agencyStatusHint(c)}</span></div>
      </div>
      <dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-small">
        <dt class="text-fg-subtle">Clippers</dt><dd class="text-right font-medium tabular-nums text-fg">${fmt(c.clippers)}</dd>
        <dt class="text-fg-subtle">Clips</dt><dd class="text-right font-medium tabular-nums text-fg">${fmt(clipsOf([c.id]).length)}</dd>
        <dt class="text-fg-subtle">Vues</dt><dd class="text-right font-medium tabular-nums text-fg">${compact(campaignViews(c))}</dd>
      </dl>
      ${progress(c.spent, c.budget, { aria: `Budget consommé de ${c.title}` })}
      <div class="mt-auto grid grid-cols-2 gap-2 pt-1">${toggle}<button type="button" data-action="ag-open" data-id="${c.id}" class="${btn("ghost", "sm", toggle ? "w-full" : "col-span-2 w-full")}">Détails</button></div>
    </div>
  </article>`;
}

function gCampagnes() {
  const all = myCampaigns(), q = state.ag.q.trim().toLowerCase();
  const list = all.filter((c) => (state.ag.status === "Toutes" || c.status === state.ag.status) && (!q || c.title.toLowerCase().includes(q)));
  const n = (s) => all.filter((c) => c.status === s).length;
  const statuses = [["Toutes", "Toutes", all.length], ["Active", "Actives", n("Active")], ["En attente", "En attente", n("En attente")], ["En pause", "En pause", n("En pause")], ["Terminée", "Terminées", n("Terminée")]];
  const body = list.length
    ? `<div class="grid gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3">${list.map(agCampaignCard).join("")}</div>`
    : all.length
      ? emptyState("search", "Aucune campagne ne correspond", "Essayez un autre statut ou effacez la recherche.", `<button type="button" data-action="ag-clear" class="${btn("secondary")}">Effacer les filtres</button>`)
      : emptyState("megaphone", "Aucune campagne", "Créez votre première campagne : elle sera publiée après vérification par l'équipe ClipBoost.", agNewBtn());
  return `${pageHeader("Mes campagnes", "Créez, suivez et pilotez vos campagnes. Chaque nouvelle campagne est vérifiée par ClipBoost avant publication.", all.length ? `<span class="lg:hidden">${agNewBtn()}</span>` : "")}
    ${all.length ? `<div class="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      ${searchInput("ag-q", state.ag.q, "Rechercher une campagne", "Rechercher une campagne", "w-full xl:max-w-xs")}
      ${segmented("ag-status", state.ag.status, statuses, "Filtrer par statut", { scroll: true })}
    </div>` : ""}
    <div class="mt-5">${body}</div>`;
}

// ---------- Clips reçus ----------

function gClips() {
  const all = clipsOf(myCampaigns().map((c) => c.id));
  const list = all.filter((p) => state.ag.clipStatus === "Toutes" || p.status === state.ag.clipStatus);
  const n = (s) => all.filter((p) => p.status === s).length;
  const statuses = [["Toutes", "Tous", all.length], ["Validée", "Validés", n("Validée")], ["En attente", "En attente", n("En attente")], ["Refusée", "Refusés", n("Refusée")]];
  const label = { "Validée": "validé", "En attente": "en attente", "Refusée": "refusé" }[state.ag.clipStatus];
  const body = list.length ? publicationsTable(list, { showUser: true, amountLabel: "Coût" })
    : all.length ? emptyState("film", `Aucun clip ${label}`, "Les autres clips restent visibles dans « Tous ».", `<button type="button" data-action="ag-clip-status" data-value="Toutes" class="${btn("secondary")}">Voir tous les clips</button>`)
    : emptyState("film", "Aucun clip reçu", "Dès qu'un clipper publie sur l'une de vos campagnes, son clip apparaît ici avec ses vues et son coût.");
  return `${pageHeader("Clips reçus", "Les clips publiés par les clippers sur vos campagnes. Modération assurée par l'équipe ClipBoost.")}
    ${all.length ? `<div class="mt-6">${segmented("ag-clip-status", state.ag.clipStatus, statuses, "Filtrer par statut", { scroll: true })}</div>` : ""}
    <div class="${all.length ? "mt-4" : "mt-6"}">${body}</div>`;
}

// ---------- Budget ----------

function gBudget() {
  const u = me(), list = myCampaigns(), t = agTotals(list), pending = agPendingCredit();
  const recharges = myTx().filter((x) => x.type === "recharge");
  const stat = (label, value, sub) => `<div class="flex items-start justify-between gap-4 sm:block sm:px-5 sm:first:pl-0 sm:last:pr-0">
      <dt class="text-small font-medium text-fg-muted">${label}</dt>
      <dd class="text-right sm:mt-1.5 sm:text-left">${bigMoney(value)}<span class="mt-0.5 block text-xs text-fg-subtle">${sub}</span></dd></div>`;
  const summaryCard = card(`<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between xl:flex-col xl:items-start">
        <div><p class="text-small font-medium text-fg-muted">Crédit disponible</p><p class="mt-1">${bigMoney(u.credit, "money")}</p>
          ${pending ? `<p class="mt-1 text-xs tabular-nums text-fg-subtle">${da(pending)} en attente de confirmation</p>` : ""}</div>
        <button type="button" data-action="ag-credit" class="${btn("primary")}">${icon("plus")}Recharger le crédit</button>
      </div>
      <dl class="grid gap-3 border-t border-line pt-5 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-line xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
        ${stat("Engagé", t.engaged, t.awaiting ? `dont ${da(t.awaiting)} en attente d'approbation` : `sur ${plural(t.count, "campagne", "campagnes")}`)}
        ${stat("Consommé", t.spent, t.engaged ? `${pct((t.spent / t.engaged) * 100)} du budget engagé` : "Aucune dépense")}
        ${stat("Restant", t.left, "sur les campagnes en cours")}
      </dl></div>`);

  const action = (c, mobile) => agClosed(c) ? `<span class="text-xs text-fg-subtle">Archivée</span>`
    : `<button type="button" data-action="ag-topup" data-id="${c.id}" class="${mobile ? btn("secondary", "md", "w-full sm:w-auto") : btn("ghost", "sm")}">${icon("plus")}Ajouter du budget</button>`;
  // 5 colonnes (environ 880 px) : le tableau à partir de xl, la liste en dessous.
  const perCampaign = list.length ? `<div class="${TBL.wrap}">
      <table class="${TBL.table.replace("md:table", "xl:table")}">
        <thead><tr class="${TBL.headRow}"><th scope="col" class="${TBL.th}">Campagne</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Tarif</th><th scope="col" class="${TBL.th}">Consommé</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Restant</th><th scope="col" class="${TBL.th} ${TBL.thNum}"><span class="sr-only">Action</span></th></tr></thead>
        <tbody>${list.map((c) => `<tr data-row="${c.id}" class="${TBL.tr}">
          <td class="${TBL.td}"><div class="flex min-w-0 items-center gap-3">${coverThumb(c, "sm")}<div class="min-w-0"><p class="max-w-56 truncate font-medium text-fg">${esc(c.title)}</p><div class="mt-1">${statusBadge(c.status)}</div></div></div></td>
          <td class="${TBL.td} ${TBL.tdNum}">${money(c.rate)}<span class="${TBL.tdSub} font-normal">pour 1${NB}000 vues</span></td>
          <td class="${TBL.td}"><div class="min-w-48 max-w-64">${progress(c.spent, c.budget, { aria: `Budget consommé de ${c.title}` })}</div></td>
          <td class="${TBL.td} ${TBL.tdNum}">${agClosed(c) ? `<span class="text-fg-subtle">—</span>` : money(Math.max(0, c.budget - c.spent))}</td>
          <td class="${TBL.td} ${TBL.tdActions}">${action(c, false)}</td></tr>`).join("")}</tbody>
      </table>
      <ul class="${TBL.list.replace("md:hidden", "xl:hidden")}">${list.map((c) => `<li data-row="${c.id}" class="${TBL.item}">
        <div class="flex items-start gap-3">${coverThumb(c, "sm")}<div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(c.title)}</p><p class="truncate text-xs text-fg-subtle">${rate(c.rate)}</p></div>${statusBadge(c.status)}</div>
        ${progress(c.spent, c.budget, { aria: `Budget consommé de ${c.title}` })}
        ${agClosed(c) ? `<p class="text-xs text-fg-subtle">Archivée</p>` : `<div class="flex items-center justify-between text-small"><span class="text-fg-subtle">Restant</span><span class="font-medium">${money(Math.max(0, c.budget - c.spent))}</span></div><div class="sm:flex sm:justify-end">${action(c, true)}</div>`}
      </li>`).join("")}</ul>
    </div>` : emptyState("wallet", "Aucune campagne pour l'instant", "Le budget de chaque campagne s'affichera ici dès sa création.", agNewBtn());

  const history = `<div class="${TBL.wrap}">
      <table class="${TBL.table}">
        <thead><tr class="${TBL.headRow}"><th scope="col" class="${TBL.th}">Date</th><th scope="col" class="${TBL.th}">Moyen</th><th scope="col" class="${TBL.th}">Référence</th><th scope="col" class="${TBL.th}">Statut</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Montant</th></tr></thead>
        <tbody>${recharges.map((x) => `<tr data-row="${x.id}" class="${TBL.tr}">
          <td class="${TBL.td} whitespace-nowrap tabular-nums">${date(x.date)}<span class="${TBL.tdSub}">${esc(x.time || "")}</span></td>
          <td class="${TBL.td}">${agMethod(x)}</td>
          <td class="${TBL.td}"><span class="inline-flex items-center gap-1 text-fg">${code(x.ref)}${agCopyBtn(x.ref)}</span></td>
          <td class="${TBL.td}">${agRechargeStatus(x)}</td>
          <td class="${TBL.td} ${TBL.tdNum}">${agRechargeAmount(x)}</td></tr>`).join("")}</tbody>
      </table>
      <ul class="${TBL.list}">${recharges.map((x) => `<li data-row="${x.id}" class="flex items-center gap-3 px-4 py-3">
        <span class="grid size-8 shrink-0 place-items-center rounded-full ${x.status === "Validé" ? "bg-income-soft text-income" : "bg-muted text-fg-muted"}" aria-hidden="true">${icon("arrowDownLeft", "size-4")}</span>
        <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${agMethod(x)}</p><p class="flex items-center gap-1 truncate text-xs text-fg-subtle">${date(x.date)} · ${code(x.ref)}</p></div>
        <div class="shrink-0 text-right"><p class="text-sm font-medium">${agRechargeAmount(x)}</p>${x.status === "Validé" ? "" : `<div class="mt-1 flex justify-end">${agRechargeStatus(x)}</div>`}</div>
        ${agCopyBtn(x.ref)}
      </li>`).join("")}</ul>
    </div>`;

  return `${pageHeader("Budget", "Suivez la consommation de vos campagnes et rechargez votre crédit.")}
    <div class="mt-6">${summaryCard}</div>
    ${sectionHeader("Par campagne")}
    ${perCampaign}
    ${recharges.length ? `${sectionHeader("Recharges")}${history}
      <p class="mt-3 text-xs text-fg-subtle">Le crédit est ajouté dès que l'équipe ClipBoost confirme la réception de votre paiement.</p>` : ""}`;
}

// ---------- Profil ----------

function gProfil() {
  const u = me(), list = myCampaigns();
  const identity = card(`<div class="flex flex-col items-center text-center">
      ${avatar(u, "xl")}
      <h2 class="mt-4 text-section text-fg">${esc(u.name)}</h2>
      <p class="mt-0.5 text-small text-fg-muted">${u.contact ? `${esc(u.contact)} · ` : ""}${esc(u.country)}</p>
      <div class="mt-3">${roleBadge("agence")}</div>
    </div>
    <dl class="mt-5 grid grid-cols-2 gap-2">
      <div class="${TILE}"><dt class="text-xs text-fg-subtle">Campagnes</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${fmt(list.length)}</dd></div>
      <div class="${TILE}"><dt class="text-xs text-fg-subtle">Clips reçus</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${fmt(clipsOf(list.map((c) => c.id)).length)}</dd></div>
    </dl>
    <p class="mt-4 text-center text-xs text-fg-subtle">Membre depuis le ${date(u.joined)}</p>`);
  return `${pageHeader("Profil de l'agence", "Les informations de votre structure.")}
    <div class="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5">
      ${card(`${cardHeader("Informations de l'agence", "Le nom de l'agence sert de marque sur vos nouvelles campagnes.")}
        <form data-form="ag-profile" class="mt-5 grid gap-4 sm:grid-cols-2">
          ${field("Nom de l'agence ou de la marque", `<input name="name" value="${esc(u.name)}" autocomplete="organization" class="${inputCls}"/>`)}
          ${field("Nom du contact", `<input name="contact" value="${esc(u.contact || "")}" autocomplete="name" class="${inputCls}"/>`)}
          ${field("Pays", countrySelect("country", u.country))}
          <div class="flex justify-end border-t border-line pt-4 sm:col-span-2"><button class="${btn("primary")}">Enregistrer</button></div>
        </form>`, "p-5 self-start")}
      <div class="grid content-start gap-4 lg:gap-5">${identity}${accountCard(u)}</div>
    </div>`;
}

const AGENCY_VIEWS = { apercu: gApercu, campagnes: gCampagnes, clips: gClips, budget: gBudget, profil: gProfil };

// ---------- Formulaire de campagne (partagé avec admin.js) ----------

const AG_EMOJIS = ["🎬", "⚽", "🍔", "📱", "👗", "🎵", "😂", "🚗", "💄", "🏝️", "🥤", "👕"];
// Choix de visuel (emoji) : même logique que SEG_CHOICE, en carré de 44 px.
const AG_EMOJI_CHOICE = "grid size-11 cursor-pointer place-items-center rounded-control border border-line-strong bg-surface text-xl transition-colors duration-150 hover:border-line-control peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus";
const AG_FIELDSET = "mt-6 border-t border-line pt-6 first:mt-0 first:border-0 first:pt-0";
// Légende flottante : rendue dans le flux (et non dans la bordure du fieldset).
const AG_LEGEND = "float-left mb-4 w-full text-section text-fg";
const agHint = (txt, error = false) => (error ? `<span class="inline-flex items-center gap-1 font-medium text-danger-fg">${icon("alert", "size-3.5 shrink-0")}${txt}</span>` : txt);

// Récapitulatif en direct de la nouvelle campagne (équivalents en vues, budget débité, aperçu de la couverture).
LIVE.campaign = (d) => {
  const admin = state.route.area === "admin", s = db.settings, commission = admin ? 0 : s.commissionRate;
  const r = agNum(d.rate), b = agNum(d.budget), mn = agNum(d.minPayout), mx = agNum(d.maxPayout);
  const views = (amount) => (r && amount ? `=${NB}${plural(Math.ceil((amount * 1000) / r), "vue", "vues")}` : "");
  const fee = Math.round((b * commission) / 100), cost = b + fee, credit = admin ? 0 : me().credit;
  const cat = CATEGORIES.includes(d.category) ? d.category : "Autre", emoji = esc(d.emoji || AG_EMOJIS[0]);
  return {
    cover: `<span class="cover relative grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-tile pt-6" data-cat="${cat}"><span class="text-3xl drop-shadow-[0_6px_14px_rgb(0_0_0/0.22)]">${emoji}</span>${r ? agRateChip(r) : ""}</span>`,
    rate: r < 20 || r > 2000 ? agHint(`Entre 20 et 2${NB}000${NB}DA pour 1${NB}000${NB}vues.`, !!d.rate) : `100${NB}000 vues = ${da(r * 100)}`,
    min: views(mn) || "Gain minimum d'un clip",
    max: mx && mx <= mn ? agHint("Doit dépasser le seuil.", true) : b && mx > b ? agHint("Ne peut pas dépasser le budget.", true) : views(mx) || "Gain maximum d'un clip",
    budget: `${summary(admin
      ? [["Budget", money(b)], ["Commission ClipBoost", "Aucune"], ["Engagé à la publication", money(b), true]]
      : [["Budget", money(b)], [`Commission ClipBoost (${commission}${NB}%)`, money(fee)], ["Débité à l'approbation", money(cost), true]])}
      ${b && b < s.minBudget ? `<div class="mt-3">${alertBox("warning", `Le budget minimum est de ${da(s.minBudget)}.`)}</div>`
        : !admin && cost > credit ? `<div class="mt-3">${alertBox("warning", `Crédit actuel : ${da(credit)}. Il manque <strong class="font-semibold tabular-nums">${da(cost - credit)}</strong> pour l'approbation. <button type="button" data-action="ag-credit" class="${btn("link")}">Recharger le crédit</button>`)}</div>`
        : !admin ? `<p class="mt-3 text-xs tabular-nums text-fg-subtle">Crédit actuel : ${da(credit)}. Il restera ${da(credit - cost)} après l'approbation.</p>` : ""}`,
  };
};

// campaignForm(formName, submitLabel, note) : contenu du formulaire de campagne, en 4 fieldsets.
// À placer dans modalShell({ title, description, size: "xl", form: formName, live: "campaign", body: campaignForm(…), footer }).
// Le <form data-form> d'ouverture n'est volontairement pas refermé : dans une modale qui est déjà le formulaire,
// le navigateur ignore cette balise imbriquée ; dans un conteneur qui n'est pas un formulaire, elle crée le formulaire,
// refermé avec son parent. La rangée d'envoi interne disparaît quand la modale-formulaire a son propre pied (footer).
function campaignForm(formName, submitLabel, note) {
  const s = db.settings, admin = formName === "adm-campaign";
  const init = { title: "", category: CATEGORIES[0], emoji: AG_EMOJIS[0], rate: fmt(120), budget: fmt(Math.max(200000, s.minBudget)), minPayout: fmt(240), maxPayout: fmt(24000) };
  const live = LIVE.campaign(init);
  const out = (k) => `<span data-live-out="${k}">${live[k]}</span>`;
  return `<form data-form="${formName}" data-live="campaign" novalidate class="contents">
    <fieldset class="${AG_FIELDSET}">
      <legend class="${AG_LEGEND}">Campagne</legend>
      <div class="clear-both grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <div class="grid content-start gap-4">
          ${field("Titre de la campagne", `<input name="title" required maxlength="40" placeholder="Ex. Spécial Ramadan" autocomplete="off" autofocus class="${inputCls}"/>`)}
          ${admin ? field("Marque", `<input name="brand" required maxlength="30" autocomplete="off" class="${inputCls}"/>`) : ""}
          ${field("Catégorie", `<span class="relative block"><select name="category" class="${selectCls}">${CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join("")}</select>${CHEVRON}</span>`, "La catégorie donne sa teinte à la couverture.")}
        </div>
        <div class="hidden sm:block" aria-hidden="true"><p class="mb-1.5 text-small font-medium text-fg">Aperçu</p><div data-live-out="cover">${live.cover}</div></div>
      </div>
      <div class="mt-4 grid gap-1.5" role="radiogroup" aria-label="Visuel">
        <span class="text-small font-medium text-fg">Visuel</span>
        <div class="flex flex-wrap gap-2">${AG_EMOJIS.map((e, i) => `<label class="cursor-pointer"><input type="radio" name="emoji" value="${e}" ${i === 0 ? "checked" : ""} class="peer sr-only"/><span class="${AG_EMOJI_CHOICE}">${e}</span></label>`).join("")}</div>
      </div>
    </fieldset>
    <fieldset class="${AG_FIELDSET}">
      <legend class="${AG_LEGEND}">Rémunération des clippers</legend>
      <div class="clear-both grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        ${field("Tarif", unitInput(`name="rate" value="${init.rate}" required autocomplete="off"`, `DA${NB}/${NB}1${NB}000${NB}vues`), out("rate"))}
        ${field("Seuil par clip", unitInput(`name="minPayout" value="${init.minPayout}" required autocomplete="off"`, "DA"), out("min"))}
        ${field("Plafond par clip", unitInput(`name="maxPayout" value="${init.maxPayout}" required autocomplete="off"`, "DA"), out("max"))}
      </div>
      <p class="mt-3 text-xs text-fg-subtle">Seuil : gain à atteindre avant que le clip soit examiné. Plafond : un clip viral ne peut pas dépasser ce montant.</p>
    </fieldset>
    <fieldset class="${AG_FIELDSET}">
      <legend class="${AG_LEGEND}">Budget</legend>
      <div class="clear-both grid gap-4 sm:grid-cols-2">
        ${field("Budget de la campagne", unitInput(`name="budget" value="${init.budget}" required autocomplete="off"`, "DA"), `Minimum ${da(s.minBudget)}.`)}
      </div>
      <div data-live-out="budget">${live.budget}</div>
      ${note ? `<p class="mt-3 text-xs text-fg-subtle">${note}</p>` : ""}
    </fieldset>
    <fieldset class="${AG_FIELDSET}">
      <legend class="${AG_LEGEND}">Diffusion</legend>
      <div class="clear-both grid gap-4">
        <div class="grid gap-1.5" role="group" aria-label="Plateformes">
          <span class="text-small font-medium text-fg">Plateformes</span>
          <div class="grid grid-cols-3 gap-2">${["TikTok", "Instagram", "YouTube"].map((pl) => `<label class="min-w-0"><input type="checkbox" name="pf-${pl}" checked class="peer sr-only"/><span class="${SEG_CHOICE}"><span class="hidden sm:contents">${icon(PLATFORM_ICON[pl])}</span><span class="truncate">${pl}</span></span></label>`).join("")}</div>
        </div>
        ${field("Règles", `<textarea name="rules" rows="3" class="${textareaCls}">Clip de 15 à 60 secondes\nMentionner la marque</textarea>`, "Une règle par ligne, affichée aux clippers.")}
      </div>
    </fieldset>
    <div class="mt-6 flex justify-end [form[role=dialog]:has(>footer)_&]:hidden"><button type="submit" class="${btn("primary", "md", "w-full sm:w-auto")}">${submitLabel}</button></div>`;
}

// Données du formulaire de campagne au format attendu par l'API.
function campaignPayload(data) {
  const num = (v) => +String(v ?? "").replace(/\s/g, ""); // « 200 000 » saisi avec des espaces
  return {
    title: data.title, brand: data.brand, category: data.category, rate: num(data.rate), budget: num(data.budget), minPayout: num(data.minPayout), maxPayout: num(data.maxPayout),
    emoji: data.emoji, platforms: ["TikTok", "Instagram", "YouTube"].filter((pl) => data[`pf-${pl}`]),
    rules: (data.rules || "").split("\n").map((r) => r.trim()).filter(Boolean),
  };
}

// ---------- Modales ----------

// Ajouter du budget : débit immédiat (budget + commission) si la campagne est déjà financée.
LIVE.budget = (d) => {
  const c = state.modal && campaignById(state.modal.id), u = me();
  if (!c) return {};
  const a = agNum(d.amount);
  if (c.status === "En attente") {
    return { "": summary([["Budget actuel", money(c.budget)], ["Ajout", money(a)], ["Nouveau budget", money(c.budget + a), true]]), btn: a ? `Ajouter ${da(a)} au budget` : "Ajouter au budget", presets: agPresets(agTopupPresets(c, u), a) };
  }
  const cost = withCommission(a, c.commissionRate), fee = cost - a;
  return {
    "": `${summary([["Ajouté au budget", money(a)], [`Commission ClipBoost (${c.commissionRate}${NB}%)`, money(fee)], ["Débité de votre crédit", money(cost), true]])}
      <div class="mt-3">${cost > u.credit
        ? alertBox("warning", `Crédit insuffisant : il manque <strong class="font-semibold tabular-nums">${da(cost - u.credit)}</strong>. <button type="button" data-action="ag-credit" class="${btn("link")}">Recharger le crédit</button>`)
        : `<p class="text-xs tabular-nums text-fg-subtle">Crédit restant après l'opération : ${da(u.credit - cost)}</p>`}</div>`,
    btn: a ? `Ajouter ${da(a)} au budget` : "Ajouter au budget",
    presets: agPresets(agTopupPresets(c, u), a),
  };
};

// Recharger le crédit : rien n'est débité, le crédit arrive à la confirmation du paiement.
LIVE.recharge = (d) => {
  const a = agNum(d.amount), u = me();
  return {
    "": summary([["Crédit actuel", money(u.credit)], ["Recharge demandée", money(a)], ["Crédit après confirmation", money(u.credit + a), true]]),
    btn: a ? `Demander ${da(a)}` : "Envoyer la demande de recharge",
    presets: agPresets(AG_RECHARGES.map((v) => [v, da(v)]), a),
  };
};

const AG_METHODS = [
  ["virement bancaire", "Virement bancaire", "bank", "Indiquez la référence reçue dans le libellé du virement."],
  ["carte Edahabia", "Carte Edahabia", "wallet", "Carte Algérie Poste."],
  ["carte CIB", "Carte CIB", "wallet", "Carte bancaire interbancaire."],
];

function agencyModal() {
  const m = state.modal;
  if (!m) return "";
  const cancel = `<button type="button" data-action="close-modal" class="${btn("ghost")}">Annuler</button>`;
  if (m.type === "ag-new") {
    return modalShell({
      title: "Nouvelle campagne", description: "Elle sera publiée après vérification par l'équipe ClipBoost.", size: "xl", form: "ag-campaign", live: "campaign",
      body: campaignForm("ag-campaign", "Envoyer pour validation", "Le budget non consommé vous est rendu à la fin de la campagne."),
      footer: `${cancel}<button type="submit" class="${btn("primary")}">Envoyer pour validation</button>`,
    });
  }
  if (m.type === "ag-open") {
    const c = campaignById(m.id);
    if (!c) return "";
    const clips = clipsOf([c.id]), views = campaignViews(c);
    const tiles = [
      ["Tarif", `${fmt(c.rate)}${NB}DA`, `pour 1${NB}000 vues`], ["Seuil", da(c.minPayout), `dès ${plural(viewsFor(c, c.minPayout), "vue", "vues")}`], ["Plafond", da(c.maxPayout), `atteint à ${plural(viewsFor(c, c.maxPayout), "vue", "vues")}`],
      ["Clippers", fmt(c.clippers), "ont rejoint"], ["Clips", fmt(clips.length), `${fmt(clips.filter((p) => p.status === "En attente").length)} en modération`], ["Vues", fmt(views), "clips validés"],
    ];
    const footer = `${agClosed(c) ? `<button type="button" data-action="close-modal" class="${btn("ghost")}">Fermer</button>` : ""}${agToggle(c, "md")}${agClosed(c) ? "" : `<button type="button" data-action="ag-topup" data-id="${c.id}" class="${btn("primary")}">${icon("plus")}Ajouter du budget</button>`}`;
    return modalShell({
      title: esc(c.title), description: `${esc(c.category)} · créée le ${date(c.createdAt)}`, size: "lg", footer,
      body: `<div class="cover relative grid h-28 place-items-center overflow-hidden rounded-tile sm:h-32" ${coverAttr(c)} aria-hidden="true"><span class="text-5xl drop-shadow-[0_6px_14px_rgb(0_0_0/0.22)]">${c.emoji}</span>${agRateChip(c.rate)}</div>
        <div class="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1">${statusBadge(c.status)}<span class="text-small text-fg-muted">${agencyStatusHint(c)}</span></div>
        <dl class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">${tiles.map(([k, v, sub]) => `<div class="${TILE}"><dt class="text-xs text-fg-subtle">${k}</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${v}<span class="block text-xs font-normal text-fg-subtle">${sub}</span></dd></div>`).join("")}</dl>
        <div class="mt-5"><p class="mb-2 text-small font-medium text-fg">Budget</p>${progress(c.spent, c.budget, { aria: `Budget consommé de ${c.title}` })}
          <p class="mt-1.5 text-xs tabular-nums text-fg-subtle">${agClosed(c) ? "Le budget non consommé a été rendu à votre crédit." : `Reste ${da(Math.max(0, c.budget - c.spent))} à consommer.`}</p></div>
        <div class="mt-5 grid gap-5 sm:grid-cols-2">
          <div><p class="text-small font-medium text-fg">Règles</p>${c.rules.length ? `<ul class="mt-2 grid gap-1.5">${c.rules.map((r) => `<li class="flex gap-2 text-sm text-fg">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span>${esc(r)}</span></li>`).join("")}</ul>` : `<p class="mt-2 text-sm text-fg-subtle">Aucune règle particulière.</p>`}</div>
          <div><p class="text-small font-medium text-fg">Plateformes</p><div class="mt-2 flex flex-wrap gap-1.5">${(c.platforms || []).map(platformTag).join("")}</div></div>
        </div>
        <div class="mt-6"><div class="mb-2 flex items-baseline justify-between gap-3"><p class="text-small font-medium text-fg">Clips reçus</p>${clips.length > 5 ? agMoreLink("#/agence/clips", `Voir les ${fmt(clips.length)}`) : ""}</div>
          ${clips.length ? `<ul class="divide-y divide-line rounded-tile border border-line px-3">${clips.slice(0, 5).map((p) => `<li class="flex items-center gap-3 py-2.5">
            <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="rounded-sm hover:underline ${FOCUS}">${esc(p.title)}</a>` : esc(p.title)}</p>
              <p class="truncate text-xs tabular-nums text-fg-subtle">${esc((userById(p.userId) || {}).name || "Clipper")} · ${esc(p.platform)} · ${plural(p.views, "vue", "vues")}</p></div>
            <div class="flex shrink-0 flex-col items-end gap-1"><span class="text-sm font-medium">${p.status === "Validée" ? money(earningsOf(p)) : `<span class="text-fg-subtle">—</span>`}</span>${statusBadge(p.status)}</div></li>`).join("")}</ul>`
            : `<p class="rounded-tile border border-dashed border-line-strong px-4 py-6 text-center text-small text-fg-muted">Aucun clip pour l'instant.</p>`}</div>`,
    });
  }
  if (m.type === "ag-topup") {
    const c = campaignById(m.id), u = me();
    if (!c) return "";
    const funded = c.status !== "En attente", init = LIVE.budget({ amount: 50000 });
    return modalShell({
      title: "Ajouter du budget", description: `« ${esc(c.title)} » · crédit disponible : ${da(u.credit)}`, form: "ag-topup", live: "budget",
      body: `<div class="grid gap-3">
          ${field("Montant ajouté au budget", unitInput(`name="amount" value="${fmt(50000)}" autocomplete="off" autofocus`, "DA", { lg: true }), funded ? `Commission ClipBoost de ${c.commissionRate}${NB}% en plus, prélevée sur votre crédit.` : "")}
          ${agPresetRow(init.presets)}
        </div>
        ${funded ? "" : `<div class="mt-4">${alertBox("info", "La campagne n'est pas encore approuvée : rien n'est prélevé pour l'instant. Le budget et la commission seront débités à l'approbation.")}</div>`}
        <div data-live-out>${init[""]}</div>`,
      footer: `${cancel}<button type="submit" class="${btn("primary")}" data-live-out="btn">${init.btn}</button>`,
    });
  }
  if (m.type === "ag-credit") {
    const init = LIVE.recharge({ amount: 250000 });
    return modalShell({
      title: "Recharger le crédit", description: "Le crédit est ajouté dès que l'équipe ClipBoost confirme la réception de votre paiement.", form: "ag-credit", live: "recharge",
      body: `<div class="grid gap-5">
          <div class="grid gap-3">
            ${field("Montant", unitInput(`name="amount" value="${fmt(250000)}" autocomplete="off" autofocus`, "DA", { lg: true }), `Minimum ${da(10000)}.`)}
            ${agPresetRow(init.presets)}
          </div>
          <fieldset class="grid gap-2"><legend class="mb-1.5 text-small font-medium text-fg">Moyen de paiement</legend>
            ${AG_METHODS.map(([v, l, ic, d], i) => `<label class="${CHOICE}"><input type="radio" name="method" value="${v}" ${i === 0 ? "checked" : ""} class="${RADIO}"/>
              <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${l}</span><span class="block text-xs text-fg-subtle">${d}</span></span>${icon(ic, "mt-0.5 size-4 shrink-0 text-fg-subtle")}</label>`).join("")}
          </fieldset>
        </div>
        <div data-live-out>${init[""]}</div>
        <p class="mt-3 flex items-start gap-2 text-small text-fg-muted">${icon("info", "mt-0.5 size-4 shrink-0 text-fg-subtle")}Après l'envoi, vous recevez une référence à indiquer dans votre paiement.</p>`,
      footer: `${cancel}<button type="submit" class="${btn("primary")}" data-live-out="btn">${init.btn}</button>`,
    });
  }
  return "";
}

function handleAgencyAction(action, t) {
  const id = t.dataset.id;
  switch (action) {
    case "ag-status": state.ag.status = t.dataset.value; return render();
    case "ag-clip-status": state.ag.clipStatus = t.dataset.value; return render();
    case "ag-clear": state.ag.q = ""; state.ag.status = "Toutes"; return render();
    case "ag-period": state.period = +t.dataset.value; return render();
    case "ag-new": state.modal = { type: "ag-new" }; state.drawer = false; return render();
    case "ag-open": state.modal = { type: "ag-open", id }; return render();
    case "ag-topup": state.modal = { type: "ag-topup", id }; return render();
    case "ag-credit": state.modal = { type: "ag-credit" }; state.drawer = false; return render();
    case "ag-copy": return copy(t.dataset.value, "Référence copiée");
    case "ag-amount": {
      const input = root.querySelector('[aria-modal="true"] [name="amount"]');
      if (input) { input.value = fmt(+t.dataset.value); input.dispatchEvent(new Event("input", { bubbles: true })); }
      return;
    }
    case "ag-pause": case "ag-resume":
      return act("PATCH", `/api/campaigns/${id}`, { status: action === "ag-pause" ? "En pause" : "Active" }, action === "ag-pause" ? "Campagne mise en pause" : "Campagne relancée");
  }
}

// Erreur de saisie dans une modale de l'agence : message sous le champ, focus dessus (pas de toast éphémère).
function agInvalid(form, name, msg) {
  markInvalid(root.querySelector(`form[data-form="${form}"]`), name, msg);
}

// Contrôles côté client, mêmes règles que l'API ; renvoie [champ, message] ou null.
function agCampaignError(d) {
  const n = campaignPayload(d), min = db.settings.minBudget;
  if (!String(d.title || "").trim()) return ["title", "Donnez un titre à la campagne."];
  if (!(n.rate >= 20)) return ["rate", `Tarif minimum : 20${NB}DA pour 1${NB}000 vues.`];
  if (n.rate > 2000) return ["rate", `Tarif maximum : 2${NB}000${NB}DA pour 1${NB}000 vues.`];
  if (!(n.maxPayout > n.minPayout)) return ["maxPayout", "Le plafond doit être supérieur au seuil."];
  if (!(n.budget >= min)) return ["budget", `Le budget minimum est de ${da(min)}.`];
  if (n.maxPayout > n.budget) return ["maxPayout", "Le plafond par clip ne peut pas dépasser le budget."];
  if (!n.platforms.length) return ["pf-TikTok", "Choisissez au moins une plateforme."];
  return null;
}

function handleAgencySubmit(form, data) {
  if (form === "ag-campaign") {
    const err = agCampaignError(data);
    if (err) return agInvalid(form, ...err);
    return act("POST", "/api/campaigns", campaignPayload(data), "Campagne envoyée pour validation", () => {
      state.modal = null; state.ag.status = "Toutes";
      navigate("#/agence/campagnes");
    });
  }
  if (form === "ag-topup") {
    const amount = agNum(data.amount);
    if (!amount) return agInvalid(form, "amount", "Indiquez le montant à ajouter.");
    return act("POST", `/api/campaigns/${state.modal.id}/budget`, { amount }, `${da(amount)} ajoutés au budget`, () => { state.modal = null; });
  }
  if (form === "ag-credit") {
    if (agNum(data.amount) < 10000) return agInvalid(form, "amount", `Recharge minimum : ${da(10000)}.`);
    return act("POST", "/api/credit", { amount: agNum(data.amount), method: data.method }, (r) => `Demande envoyée · référence ${r.ref} à indiquer dans votre paiement`, () => { state.modal = null; });
  }
  if (form === "ag-profile") {
    return act("PATCH", "/api/me", { name: data.name, contact: data.contact, country: data.country }, "Profil de l'agence mis à jour");
  }
}
