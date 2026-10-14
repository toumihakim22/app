// Espace Agence : les créateurs de campagnes lancent et suivent leurs campagnes.
// Une nouvelle campagne part « En attente » et n'est visible des clippers qu'après approbation par l'administrateur.
// Tant qu'elle n'est pas approuvée, l'agence peut la modifier ou l'annuler ; refusée (motif de l'équipe : c.reviewNote),
// elle peut la modifier et la relancer (elle repasse « En attente ») ou la supprimer. Rien n'est prélevé avant l'approbation.
// Recettes : docs/design-system.md §4.4 à §4.8, §5 et §6.3. Les helpers propres à ce fichier sont préfixés « ag ».

const AGENCY_NAV = [
  { id: "apercu", label: "Accueil", short: "Accueil", icon: "home" },
  { id: "campagnes", label: "Mes campagnes", short: "Campagnes", icon: "target" },
  { id: "clips", label: "Clips reçus", short: "Clips", icon: "film" },
  { id: "budget", label: "Budget", icon: "wallet" },
  { id: "profil", label: "Profil de l'agence", short: "Profil", icon: "user" },
  { id: "parametres", label: "Paramètres", icon: "gear" },
];

const myCampaigns = () => db.campaigns.filter((c) => c.ownerId === state.session);
const agMine = (id) => myCampaigns().find((c) => c.id === id) || null;
const clipsOf = (ids) => db.publications.filter((p) => ids.includes(p.campaign));
// Vues cumulées des clips validés de la campagne.
const campaignViews = (c) => clipsOf([c.id]).filter((p) => p.status === "Validée").reduce((s, p) => s + p.views, 0);
// Montant prélevé sur le crédit : budget + commission ClipBoost.
const withCommission = (amount, rate = db.settings.commissionRate) => amount + Math.round((amount * rate) / 100);

// Campagne pas encore en ligne (jamais financée) : modifiable (PUT), annulable si elle est en attente ou supprimable si
// elle est refusée (DELETE), tant que rien n'est réservé ni dépensé. Mêmes règles que l'API.
const AG_EDITABLE = ["En attente", "Refusée"];
const agEditable = (c) => AG_EDITABLE.includes(c.status);
const agRemovable = (c) => agEditable(c) && !(c.reserved > 0) && !(c.spent > 0);

function agencyStatusHint(c) {
  return {
    "En attente": "En cours de vérification par l'équipe ClipBoost. Encore modifiable.",
    "Active": "Visible par les clippers.",
    "En pause": "Masquée aux clippers, aucun nouveau clip.",
    "Terminée": "Campagne archivée.",
    "Refusée": "Refusée par l'équipe ClipBoost. Modifiez-la pour la relancer.",
  }[c.status];
}

// ---------- Helpers locaux ----------
// Montant saisi (« 50 000 », « 50000 ») → entier positif, 0 si vide ou invalide.
const agNum = (v) => { const n = Math.floor(+String(v ?? "").replace(/\s/g, "")); return Number.isFinite(n) && n > 0 ? n : 0; };
const agToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const agClosed = (c) => c.status === "Terminée" || c.status === "Refusée";
// Motif cité dans une phrase : un seul point final, même si le motif se termine déjà par un point.
const agSentence = (t) => (/[.!?…]$/.test(t) ? t : `${t}.`);
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
// Filtre de statut de « Mes campagnes » qui ne montre plus rien (campagne relancée, annulée ou supprimée) : « Toutes ».
function agFixFilter() {
  if (state.ag.status !== "Toutes" && !myCampaigns().some((c) => c.status === state.ag.status)) state.ag.status = "Toutes";
}
const agNewBtn = () => `<button type="button" data-action="ag-new" class="${btn("primary")}">${icon("plus")}Nouvelle campagne</button>`;
// Rangée « Nouvelle campagne » qui complète la liste de l'accueil quand elle compte moins de 4 campagnes.
const agNewRow = `<li><button type="button" data-action="ag-new" class="flex w-full items-center gap-3 rounded-tile p-2 text-start text-sm font-medium text-fg-muted transition-colors duration-150 hover:bg-subtle hover:text-fg ${FOCUS}"><span class="grid size-10 shrink-0 place-items-center rounded-tile border border-dashed border-line-strong text-fg-subtle" aria-hidden="true">${icon("plus", "size-4")}</span>Nouvelle campagne</button></li>`;
const agMoreLink = (href, label = "Tout voir") =>
  `<a href="${href}" class="${HIT} inline-flex items-center gap-1 rounded-sm text-small font-medium text-brand-fg underline-offset-4 hover:underline ${FOCUS}">${label}${icon("chevronRight", "size-3.5 rtl:-scale-x-100")}</a>`;
// Pause ou reprise : seules actions de statut ouvertes à l'agence sur une campagne en ligne.
const agToggle = (c, size = "sm", extra = "") =>
  c.status === "Active" ? `<button type="button" data-action="ag-pause" data-id="${c.id}" class="${btn("secondary", size, extra)}">${icon("pause")}Mettre en pause</button>`
  : c.status === "En pause" ? `<button type="button" data-action="ag-resume" data-id="${c.id}" class="${btn("secondary", size, extra)}">${icon("play")}Reprendre</button>` : "";
// Campagne pas encore en ligne : « Modifier » (en attente) ou « Modifier et relancer » (refusée).
const agEditBtn = (c, size = "sm", extra = "", variant = "secondary") =>
  `<button type="button" data-action="ag-edit" data-id="${c.id}" class="${btn(variant, size, extra)}">${c.status === "Refusée" ? `${icon("refresh")}Modifier et relancer` : `${icon("pencil")}Modifier`}</button>`;
// Retrait d'une campagne pas encore en ligne : [action, icône, libellé].
const agRemoveAction = (c) => (c.status === "Refusée" ? ["ag-delete", "trash", "Supprimer la campagne"] : ["ag-cancel", "xCircle", "Annuler la campagne"]);
// Bouton-icône de retrait (cartes) : même hauteur que btn(…, "sm"), teinte danger comme dangerSoft.
const AG_ICON_DANGER = `inline-grid size-10 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface text-danger-fg shadow-control transition-colors duration-150 hover:border-danger-border hover:bg-danger-bg md:size-8 [&_svg]:size-4 ${FOCUS}`;
// Puce de tarif posée sur une couverture.
const agRateChip = (r) =>
  `<span class="absolute start-2.5 top-2.5 inline-flex items-baseline gap-1 rounded-badge bg-night/80 px-2 py-1 text-small font-semibold tabular-nums text-on-brand backdrop-blur-sm">${fmt(r)}${NB}DA<span class="text-[11px] font-medium text-on-brand/80">/ 1k${NB}vues</span></span>`;
// Pictogrammes des plateformes d'une campagne, dans l'ordre de PLATFORMS (nom accessible : la liste complète).
const agPlatformIcons = (list) => {
  const l = PLATFORMS.filter((p) => (list || []).includes(p));
  return `<span class="inline-flex items-center gap-1.5 text-fg-muted" role="img" aria-label="Plateformes : ${esc(l.join(", "))}" title="${esc(l.join(" · "))}">${l.map((p) => icon(PLATFORM_ICON[p] || "film", "size-4 shrink-0")).join("")}</span>`;
};
// Motif du refus d'une campagne (carte) : encadré danger, tronqué à 3 lignes (la fiche le montre en entier).
const agReasonBox = (c) => (c.reviewNote
  ? `<div class="rounded-tile border border-danger-border bg-danger-bg px-3 py-2 text-xs text-danger-fg"><p class="font-medium">Motif du refus</p><p class="mt-0.5 line-clamp-3 break-words">${esc(c.reviewNote)}</p></div>`
  : "");
// Montant d'une recharge : vert une fois le crédit reçu, neutre en attente, barré si refusée.
const agRechargeAmount = (t) =>
  t.status === "Validé" ? money(t.amount, { signed: true }) : t.status === "Refusé" ? `<span class="line-through">${money(t.amount)}</span>` : money(t.amount);
const agRechargeStatus = (t) => statusBadge(t.status === "En cours" ? "En attente" : t.status);
// Moyen d'une recharge : « Virement bancaire », « Carte CIB »… ; carte internationale : « Carte Visa •••• 4242 »
// (marque et 4 derniers chiffres ajoutés au libellé par l'API).
const agMethod = (t) => {
  const card = t.method === AG_CARD && /· (Visa|Mastercard) •••• (\d{4})$/.exec(t.label || "");
  if (card) return `Carte ${card[1]} <span class="whitespace-nowrap" dir="ltr">••••${NB}${card[2]}</span>`;
  const m = t.method || t.label || "";
  return esc(m.charAt(0).toUpperCase() + m.slice(1));
};
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
// Ouvre une modale : par-dessus la modale affichée (elle revient à la fermeture, saisie comprise : openStacked de
// main.js), sinon seule.
function agOpen(modal) {
  state.drawer = false;
  if (state.modal) return openStacked(modal);
  state.modal = modal;
  render();
}

// ---------- Accueil ----------

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

// Campagnes refusées : à corriger avant tout le reste (motif, « Modifier et relancer »).
function agRefusedAlert(list) {
  const refused = list.filter((c) => c.status === "Refusée");
  if (!refused.length) return "";
  if (refused.length === 1) {
    const c = refused[0];
    return alertBox("danger", `<p><span class="font-medium">${c.reviewNote ? `« ${esc(c.title)} » a été refusée : ${esc(agSentence(c.reviewNote))}` : `« ${esc(c.title)} » a été refusée par l'équipe ClipBoost.`}</span> Modifiez-la pour la relancer, ou supprimez-la.</p>
      <p class="mt-2 flex flex-wrap gap-x-4 gap-y-1"><button type="button" data-action="ag-edit" data-id="${c.id}" class="${btn("link")}">Modifier et relancer</button><button type="button" data-action="ag-open" data-id="${c.id}" class="${btn("link")}">Voir la campagne</button></p>`);
  }
  return alertBox("danger", `<p><span class="font-medium">${plural(refused.length, "campagne a été refusée", "campagnes ont été refusées")} par l'équipe ClipBoost.</span> Modifiez-les pour les relancer, ou supprimez-les.</p>
    <p class="mt-2"><button type="button" data-action="ag-show-refused" class="${btn("link")}">Voir les campagnes refusées</button></p>`);
}

// Ligne compacte « Vos campagnes » : toute la ligne ouvre le détail (bouton étiré sur le titre).
function agCampaignRow(c) {
  const sub = c.status === "Refusée" ? `<p class="mt-0.5 truncate text-xs text-danger-fg">Modifiez-la pour la relancer</p>`
    : c.status === "En attente" ? `<p class="mt-0.5 truncate text-xs tabular-nums text-fg-subtle">${rateShort(c.rate)} · en vérification</p>`
    : `<p class="mt-0.5 truncate text-xs tabular-nums text-fg-subtle">${rateShort(c.rate)} · ${plural(c.clippers, "clipper", "clippers")}</p>
      <div class="mt-2">${progress(c.spent, c.budget, { label: false, aria: `Budget consommé de ${c.title}` })}</div>`;
  return `<li class="relative flex min-w-0 items-center gap-3 rounded-tile p-2 transition-colors duration-150 hover:bg-subtle">
    ${coverThumb(c, "sm")}
    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-2">
        <button type="button" data-action="ag-open" data-id="${c.id}" class="min-w-0 truncate text-start text-sm font-medium text-fg after:absolute after:inset-0 after:rounded-tile focus-visible:outline-hidden focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus">${esc(c.title)}</button>
        <span class="shrink-0">${statusBadge(c.status)}</span>
      </div>
      ${sub}
    </div></li>`;
}

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

  const attention = agRefusedAlert(list);
  return `${pageHeader(hello, intro, `<span class="lg:hidden">${agNewBtn()}</span>`)}
    ${attention ? `<div class="mt-6">${attention}</div>` : ""}
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

// Carte campagne, variante agence (§4.4) : photo ou couverture, statut sous le titre, pas de favori.
// En ligne : chiffres, consommation, pause ou reprise + Détails. Pas encore en ligne : budget, plateformes,
// Modifier (ou Modifier et relancer, avec le motif du refus) et le retrait (annuler ou supprimer) en bouton-icône.
function agCampaignCard(c) {
  const live = !agEditable(c), refused = c.status === "Refusée";
  let actions;
  if (live) {
    const toggle = agToggle(c, "sm", "w-full");
    actions = `<div class="mt-auto grid grid-cols-2 gap-2 pt-1">${toggle}<button type="button" data-action="ag-open" data-id="${c.id}" class="${btn("ghost", "sm", toggle ? "w-full" : "col-span-2 w-full")}">Détails</button></div>`;
  } else {
    const [rmAction, rmIcon, label] = agRemoveAction(c);
    const remove = agRemovable(c) ? `<button type="button" data-action="${rmAction}" data-id="${c.id}" class="${AG_ICON_DANGER}" aria-label="${label} « ${esc(c.title)} »" title="${label}">${icon(rmIcon)}</button>` : "";
    const details = refused ? "" : `<button type="button" data-action="ag-open" data-id="${c.id}" class="${btn("ghost", "sm", "w-full")}">Détails</button>`;
    const cols = refused ? (remove ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1") : remove ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" : "grid-cols-2";
    actions = `<div class="mt-auto grid ${cols} gap-2 pt-1">${agEditBtn(c, "sm", "w-full")}${details}${remove}</div>`;
  }
  const rows = live
    ? [["Clippers", fmt(c.clippers)], ["Clips", fmt(clipsOf([c.id]).length)], ["Vues", compact(campaignViews(c))]]
    : [["Budget", da(c.budget)], ...(refused ? [] : [["Débité à l'approbation", da(withCommission(c.budget, c.commissionRate))]]), ["Plateformes", agPlatformIcons(c.platforms)]];
  return `<article class="group flex flex-col ${CARD} ${CARD_HOVER} p-2">
    <button type="button" data-action="ag-open" data-id="${c.id}" class="cover relative block aspect-[16/9] w-full overflow-hidden rounded-tile ${FOCUS}" ${coverAttr(c)} aria-label="Détails de ${esc(c.title)}">
      ${coverArt(c)}${agRateChip(c.rate)}
    </button>
    <div class="flex flex-1 flex-col gap-3 px-2 pb-1 pt-3">
      <div>
        <p class="truncate text-xs text-fg-subtle">${esc(c.category)}</p>
        <h3 class="mt-0.5 break-words font-sans text-[15px] font-semibold leading-snug text-fg">${esc(c.title)}</h3>
        <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">${statusBadge(c.status)}<span class="text-xs text-fg-subtle">${agencyStatusHint(c)}</span></div>
      </div>
      ${refused ? agReasonBox(c) : ""}
      <dl class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 text-small">${rows.map(([k, v]) =>
        `<dt class="text-fg-subtle">${k}</dt><dd class="flex justify-end text-end font-medium tabular-nums text-fg">${v}</dd>`).join("")}</dl>
      ${live ? progress(c.spent, c.budget, { aria: `Budget consommé de ${c.title}` }) : ""}
      ${actions}
    </div>
  </article>`;
}

function gCampagnes() {
  const all = myCampaigns(), q = state.ag.q.trim().toLowerCase();
  const list = all.filter((c) => (state.ag.status === "Toutes" || c.status === state.ag.status) && (!q || c.title.toLowerCase().includes(q)));
  const n = (s) => all.filter((c) => c.status === s).length;
  // « Refusées » n'apparaît que s'il y en a (ou si le filtre est déjà posé).
  const statuses = [["Toutes", "Toutes", all.length], ["Active", "Actives", n("Active")], ["En attente", "En attente", n("En attente")], ["En pause", "En pause", n("En pause")], ["Terminée", "Terminées", n("Terminée")],
    ...(n("Refusée") || state.ag.status === "Refusée" ? [["Refusée", "Refusées", n("Refusée")]] : [])];
  const body = list.length
    ? `<div class="grid gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3">${list.map(agCampaignCard).join("")}</div>`
    : all.length
      ? emptyState("search", "Aucune campagne ne correspond", "Essayez un autre statut ou effacez la recherche.", `<button type="button" data-action="ag-clear" class="${btn("secondary")}">Effacer les filtres</button>`)
      : emptyState("megaphone", "Aucune campagne", "Créez votre première campagne : elle sera publiée après vérification par l'équipe ClipBoost.", agNewBtn());
  return `${pageHeader("Mes campagnes", "Créez, suivez et pilotez vos campagnes. Chaque nouvelle campagne est vérifiée par ClipBoost avant publication : d'ici là, vous pouvez la modifier ou l'annuler.", all.length ? `<span class="lg:hidden">${agNewBtn()}</span>` : "")}
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
  const stat = (label, value, sub) => `<div class="flex items-start justify-between gap-4 sm:block sm:px-5 sm:first:ps-0 sm:last:pe-0">
      <dt class="text-small font-medium text-fg-muted">${label}</dt>
      <dd class="text-end sm:mt-1.5 sm:text-start">${bigMoney(value)}<span class="mt-0.5 block text-xs text-fg-subtle">${sub}</span></dd></div>`;
  const summaryCard = card(`<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between xl:flex-col xl:items-start">
        <div><p class="text-small font-medium text-fg-muted">Crédit disponible</p><p class="mt-1">${bigMoney(u.credit, "money")}</p>
          ${pending ? `<p class="mt-1 text-xs tabular-nums text-fg-subtle">${da(pending)} en attente de confirmation</p>` : ""}</div>
        <button type="button" data-action="ag-credit" class="${btn("primary")}">${icon("plus")}Recharger le crédit</button>
      </div>
      <dl class="grid gap-3 border-t border-line pt-5 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-line xl:border-s xl:border-t-0 xl:ps-6 xl:pt-0">
        ${stat("Engagé", t.engaged, t.awaiting ? `dont ${da(t.awaiting)} en attente d'approbation` : `sur ${plural(t.count, "campagne", "campagnes")}`)}
        ${stat("Consommé", t.spent, t.engaged ? `${pct((t.spent / t.engaged) * 100)} du budget engagé` : "Aucune dépense")}
        ${stat("Restant", t.left, "sur les campagnes en cours")}
      </dl></div>`);

  // Action d'une campagne : ajout de budget ; refusée : la relancer ; terminée : archivée.
  const action = (c, mobile) => c.status === "Terminée" ? `<span class="text-xs text-fg-subtle">Archivée</span>`
    : c.status === "Refusée" ? agEditBtn(c, mobile ? "md" : "sm", mobile ? "w-full sm:w-auto" : "", mobile ? "secondary" : "ghost")
    : `<button type="button" data-action="ag-topup" data-id="${c.id}" class="${mobile ? btn("secondary", "md", "w-full sm:w-auto") : btn("ghost", "sm")}">${icon("plus")}Ajouter du budget</button>`;
  const remaining = (c) => (agClosed(c) ? `<span class="text-fg-subtle">—</span>` : money(Math.max(0, c.budget - c.spent)));
  // 5 colonnes (environ 880 px) : le tableau à partir de xl, la liste en dessous.
  const perCampaign = list.length ? `<div class="${TBL.wrap}">
      <table class="${TBL.table.replace("md:table", "xl:table")}">
        <thead><tr class="${TBL.headRow}"><th scope="col" class="${TBL.th}">Campagne</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Tarif</th><th scope="col" class="${TBL.th}">Consommé</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Restant</th><th scope="col" class="${TBL.th} ${TBL.thNum}"><span class="sr-only">Action</span></th></tr></thead>
        <tbody>${list.map((c) => `<tr data-row="${c.id}" class="${TBL.tr}">
          <td class="${TBL.td}"><div class="flex min-w-0 items-center gap-3">${coverThumb(c, "sm")}<div class="min-w-0"><p class="max-w-56 truncate font-medium text-fg">${esc(c.title)}</p><div class="mt-1">${statusBadge(c.status)}</div></div></div></td>
          <td class="${TBL.td} ${TBL.tdNum}">${money(c.rate)}<span class="${TBL.tdSub} font-normal">pour 1${NB}000 vues</span></td>
          <td class="${TBL.td}">${c.status === "Refusée" ? `<span class="text-fg-subtle">—</span>` : `<div class="min-w-48 max-w-64">${progress(c.spent, c.budget, { aria: `Budget consommé de ${c.title}` })}</div>`}</td>
          <td class="${TBL.td} ${TBL.tdNum}">${remaining(c)}</td>
          <td class="${TBL.td} ${TBL.tdActions}">${action(c, false)}</td></tr>`).join("")}</tbody>
      </table>
      <ul class="${TBL.list.replace("md:hidden", "xl:hidden")}">${list.map((c) => `<li data-row="${c.id}" class="${TBL.item}">
        <div class="flex items-start gap-3">${coverThumb(c, "sm")}<div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(c.title)}</p><p class="truncate text-xs text-fg-subtle">${rate(c.rate)}</p></div>${statusBadge(c.status)}</div>
        ${c.status === "Refusée" ? "" : progress(c.spent, c.budget, { aria: `Budget consommé de ${c.title}` })}
        ${c.status === "Terminée" ? `<p class="text-xs text-fg-subtle">Archivée</p>`
          : `${c.status === "Refusée" ? "" : `<div class="flex items-center justify-between text-small"><span class="text-fg-subtle">Restant</span><span class="font-medium">${remaining(c)}</span></div>`}<div class="sm:flex sm:justify-end">${action(c, true)}</div>`}
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
        <span class="grid size-8 shrink-0 place-items-center rounded-full ${x.status === "Validé" ? "bg-income-soft text-income" : "bg-muted text-fg-muted"}" aria-hidden="true">${icon(x.method === AG_CARD ? "card" : "arrowDownLeft", "size-4")}</span>
        <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${agMethod(x)}</p><p class="flex items-center gap-1 truncate text-xs text-fg-subtle">${date(x.date)} · ${code(x.ref)}</p></div>
        <div class="shrink-0 text-end"><p class="text-sm font-medium">${agRechargeAmount(x)}</p>${x.status === "Validé" ? "" : `<div class="mt-1 flex justify-end">${agRechargeStatus(x)}</div>`}</div>
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

// ---------- Profil de l'agence ----------

// Catégorie principale (teinte de la couverture en dégradé, comme sur la page vue par les clippers) : celle de la
// première campagne en ligne, sinon de la première campagne.
const agMainCategory = (list) => { const c = list.find((x) => !agEditable(x)) || list[0]; return c && CATEGORIES.includes(c.category) ? c.category : "Autre"; };

// En-tête de la page de l'agence telle que les clippers la voient (#/clipper/agence/<id>) : couverture 3:1, logo en
// carré arrondi (une structure, pas une personne), nom avec le badge bleu, pays, présentation.
function agPublicHeader(u, cat) {
  const tone = AVATARS[[...String(u.id)].reduce((h, ch) => h + ch.charCodeAt(0), 0) % AVATARS.length];
  const cover = u.cover
    ? `<div class="relative aspect-[3/1] w-full overflow-hidden bg-muted"><img src="${esc(u.cover)}" alt="" class="absolute inset-0 size-full object-cover"/></div>`
    : `<div class="cover aspect-[3/1] w-full" data-cat="${cat}"></div>`;
  const mark = u.avatar
    ? `<img src="${esc(u.avatar)}" alt="" class="relative -mt-8 block size-16 rounded-tile bg-muted object-cover ring-4 ring-surface"/>`
    : `<span class="relative -mt-8 grid size-16 select-none place-items-center rounded-tile text-xl font-semibold text-on-brand ring-4 ring-surface ${tone}">${esc(initials(u.name))}</span>`;
  return `<div aria-hidden="true">${cover}</div>
    <div class="px-4 pb-4">
      <div aria-hidden="true">${mark}</div>
      <p class="mt-2.5 break-words text-section text-fg">${nameWithBadge(u)}</p>
      <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-fg-muted">${badge("Agence", "info")}<span class="inline-flex items-center gap-1.5">${esc(u.country || "Algérie")}${(u.country || "Algérie") === "Algérie" ? flagDz() : ""}</span></p>
      ${u.bio ? `<p class="mt-3 line-clamp-4 break-words text-small text-fg-muted">${esc(u.bio)}</p>`
        : `<p class="mt-3 text-small text-fg-subtle">Ajoutez une présentation : les clippers la lisent avant de rejoindre vos campagnes.</p>`}
    </div>`;
}

// Aperçu en direct pendant la saisie du profil (nom, présentation, pays, logo, couverture).
LIVE.agProfile = (d) => {
  const u = me();
  return { preview: agPublicHeader({ ...u, name: String(d.name || "").trim() || u.name, bio: String(d.bio || "").trim(), country: d.country || u.country, avatar: d.avatar || null, cover: d.cover || null }, agMainCategory(myCampaigns())) };
};

// Badge de vérification : aucune demande (ou badge retiré, motif rappelé), demande en cours, refusée (motif), vérifiée.
function agVerifyCard(u) {
  const st = u.verification || "none", note = u.verificationNote || "";
  if (st === "verified") {
    return card(`<div class="flex items-start gap-3">${verifiedBadge("size-8", "Agence vérifiée")}
      <div class="min-w-0"><h2 class="text-section text-fg">Votre agence est vérifiée</h2>
        <p class="mt-1 text-small text-fg-muted">Le badge bleu s'affiche à côté de son nom : sur sa page, sur ses campagnes et dans la liste des agences.</p></div></div>`);
  }
  const head = (right = "") => `<header class="flex flex-wrap items-center justify-between gap-2"><h2 class="flex items-center gap-2 text-section text-fg">${icon("shield", "size-5 text-fg-subtle")}Badge de vérification</h2>${right}</header>`;
  const intro = `<p class="mt-3 text-small text-fg-muted">Le badge bleu <span aria-hidden="true">${verifiedBadge("size-4")}</span> montre aux clippers que votre agence a été vérifiée par l'équipe ClipBoost. Il s'affiche à côté de son nom, sur sa page et sur ses campagnes.</p>`;
  const ask = (label) => `<button type="button" data-action="ag-verify" class="${btn("secondary", "md", "mt-4 w-full")}">${icon("send")}${label}</button>`;
  if (st === "pending") {
    return card(`${head(badge("En cours d'examen", "warning", { ic: "clock" }))}
      <p class="mt-3 text-sm font-medium text-fg">Demande en cours d'examen</p>
      <p class="mt-0.5 text-small text-fg-muted">L'équipe ClipBoost examine votre demande. Vous serez prévenu de sa décision par notification.</p>
      ${note ? `<figure class="mt-3 rounded-tile bg-subtle p-3"><figcaption class="text-xs text-fg-subtle">Votre message</figcaption><blockquote class="mt-1 whitespace-pre-line break-words text-small text-fg">${esc(note)}</blockquote></figure>` : ""}`);
  }
  if (st === "rejected") {
    return card(`${head(badge("Refusée", "danger", { dot: true }))}
      <div class="mt-3">${alertBox("danger", `<p class="font-medium">Votre demande a été refusée</p>${note ? `<p class="mt-0.5 break-words">${esc(note)}</p>` : ""}`)}</div>
      ${intro}${ask("Refaire une demande")}`);
  }
  return card(`${head()}
    ${note ? `<div class="mt-3">${alertBox("warning", `<p class="font-medium">Le badge de votre agence a été retiré</p><p class="mt-0.5 break-words">${esc(note)}</p>`)}</div>` : ""}
    ${intro}${ask("Demander le badge")}`);
}

// Formulaire de page (brouillon gardé par main.js d'un réaffichage à l'autre, photos comprises) qui couvre aussi la
// colonne de droite : l'aperçu de la page publique suit la saisie (LIVE.agProfile).
function gProfil() {
  const u = me(), list = myCampaigns(), cat = agMainCategory(list);
  const coverFallback = `<span class="cover absolute inset-0" data-cat="${cat}"></span>`;
  const logoFallback = avatar({ ...u, avatar: null }, "size-full text-2xl");
  const edit = card(`<h2 class="text-section text-fg">Logo et couverture</h2>
      <p class="mt-0.5 text-small text-fg-muted">Ils illustrent la page de votre agence et vos campagnes auprès des clippers.</p>
      <div class="mt-5 grid gap-5">
        ${imageField({ name: "cover", value: u.cover || "", shape: "cover", label: "Photo de couverture", hint: "Bandeau en haut de la page de votre agence, recadré au format 3:1. JPEG, PNG ou WebP.", fallback: coverFallback })}
        ${imageField({ name: "avatar", value: u.avatar || "", shape: "avatar", label: "Logo ou photo de l'agence", hint: "Recadré en carré. Il s'affiche à côté du nom de l'agence.", fallback: logoFallback })}
      </div>
      <div class="mt-6 border-t border-line pt-6">
        <h2 class="text-section text-fg">Informations de l'agence</h2>
        <p class="mt-0.5 text-small text-fg-muted">Le nom de l'agence sert de marque sur vos nouvelles campagnes.</p>
        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          ${field("Nom de l'agence ou de la marque", `<input name="name" required maxlength="80" value="${esc(u.name)}" autocomplete="organization" class="${inputCls}"/>`)}
          ${field("Nom du contact", `<input name="contact" maxlength="80" value="${esc(u.contact || "")}" autocomplete="name" class="${inputCls}"/>`)}
          ${field("Pays", countrySelect("country", u.country))}
          <div class="sm:col-span-2">${field(`Présentation de l'agence ${OPTIONAL}`, `<textarea name="bio" rows="3" maxlength="300" placeholder="Votre activité, vos marques, le type de clips que vous recherchez…" class="${textareaCls}">${esc(u.bio || "")}</textarea>`, "Visible par les clippers sur la page de votre agence. 300 caractères maximum.")}</div>
        </div>
      </div>
      <div class="mt-6 flex justify-end border-t border-line pt-4"><button type="submit" class="${btn("primary")}">Enregistrer</button></div>`, "p-5 self-start");
  const preview = `<section class="overflow-hidden ${CARD}">
      <header class="flex items-center justify-between gap-3 border-b border-line px-4 py-3"><h2 class="flex items-center gap-2 text-small font-medium text-fg">${icon("eye", "size-4 text-fg-subtle")}Aperçu de votre page</h2><span class="text-xs text-fg-subtle">Vue par les clippers</span></header>
      <div data-live-out="preview">${agPublicHeader(u, cat)}</div>
      <dl class="grid grid-cols-2 gap-2 border-t border-line p-4">
        <div class="${TILE}"><dt class="text-xs text-fg-subtle">Campagnes</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${fmt(list.length)}</dd></div>
        <div class="${TILE}"><dt class="text-xs text-fg-subtle">Clips reçus</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${fmt(clipsOf(list.map((c) => c.id)).length)}</dd></div>
      </dl>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line px-4 py-3 text-xs text-fg-subtle"><span>Membre depuis le ${date(u.joined)}</span>${agMoreLink("#/agence/parametres", "Compte, langue et thème")}</div>
    </section>`;
  return `${pageHeader("Profil de l'agence", "Votre vitrine auprès des clippers : logo, couverture, présentation et badge de vérification.")}
    <form data-form="ag-profile" data-live="agProfile" novalidate class="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-5">
      ${edit}
      <div class="grid content-start gap-4 lg:gap-5">${preview}${agVerifyCard(u)}</div>
    </form>`;
}

// ---------- Paramètres ----------

function gParametres() {
  const u = me();
  const pref = (title, text, control) => `<div class="grid gap-3 py-4 first:pt-0 last:pb-0">
      <div class="min-w-0"><p class="text-sm font-medium text-fg">${title}</p><p class="mt-0.5 text-xs text-fg-subtle">${text}</p></div>${control}</div>`;
  const prefs = card(`${cardHeader("Préférences", "La langue et l'apparence de votre espace.")}
      <div class="mt-4 divide-y divide-line">
        ${pref("Langue", "Enregistrée sur votre compte : elle vous suit sur tous vos appareils.", langSwitch({ full: true, cls: "w-full sm:w-auto" }))}
        ${pref("Thème", "Clair, sombre, ou selon le réglage de votre appareil.", themeModeSwitch({ labels: true, cls: "w-full sm:w-auto" }))}
      </div>`);
  const profile = card(`<div class="flex items-center gap-3">${avatar(u, "md")}
      <div class="min-w-0 flex-1"><p class="break-words text-sm font-semibold text-fg">${nameWithBadge(u)}</p><p class="mt-0.5 text-xs text-fg-subtle">Logo, couverture, présentation et badge de vérification.</p></div>
      <a href="#/agence/profil" class="${btn("secondary", "sm")}">Modifier</a></div>`);
  return `${pageHeader("Paramètres", "Langue, thème et sécurité de votre compte.")}
    <div class="mt-6 grid items-start gap-4 lg:gap-5 xl:grid-cols-2">
      <div class="grid content-start gap-4 lg:gap-5">${prefs}${profile}</div>
      ${accountCard(u)}
    </div>`;
}

const AGENCY_VIEWS = { apercu: gApercu, campagnes: gCampagnes, clips: gClips, budget: gBudget, profil: gProfil, parametres: gParametres };

// ---------- Formulaire de campagne (partagé avec admin.js) ----------

const AG_EMOJIS = ["🎬", "⚽", "🍔", "📱", "👗", "🎵", "😂", "🚗", "💄", "🏝️", "🥤", "👕"];
// Choix de pictogramme (emoji) : même logique que SEG_CHOICE, en carré de 44 px.
const AG_EMOJI_CHOICE = "grid size-11 cursor-pointer place-items-center rounded-control border border-line-strong bg-surface text-xl transition-colors duration-150 hover:border-line-control peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus";
const AG_FIELDSET = "mt-6 border-t border-line pt-6 first:mt-0 first:border-0 first:pt-0";
// Légende flottante : rendue dans le flux (et non dans la bordure du fieldset).
const AG_LEGEND = "float-start mb-4 w-full text-section text-fg";
// Tuile de plateforme : vraie case à cocher (coin de la tuile), pictogramme et nom, visibles à toutes les tailles.
// Cochée : bordure et fond de la marque. Groupe en erreur (aucune plateforme) : toutes les tuiles bordées de rouge.
const AG_PF_TILE = "relative flex min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border border-line-strong bg-surface px-2 pb-3 pt-5 text-fg-muted transition-colors duration-150 hover:border-line-control hover:text-fg has-checked:border-brand has-checked:bg-brand-soft has-checked:text-brand-fg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus group-has-[[data-pf][aria-invalid=true]]/pf:border-danger-solid";
// Case d'une tuile : pas d'anneau propre, la tuile porte l'indicateur de focus (comme RADIO dans CHOICE).
const AG_PF_BOX = "absolute start-2.5 top-2.5 size-4 cursor-pointer rounded-[4px] accent-brand focus-visible:outline-none";
const agHint = (txt, error = false) => (error ? `<span class="inline-flex items-center gap-1 font-medium text-danger-fg">${icon("alert", "size-3.5 shrink-0")}${txt}</span>` : txt);

// Catégorie envoyée à l'API : celle de la liste, sinon (« Autre ») le texte précisé par l'agence ; une catégorie de la
// liste écrite autrement (« sport », « evenementiel ») reprend son nom exact.
const agFold = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
function agCategoryOf(d) {
  if (d.category !== "Autre") return String(d.category || "");
  const other = String(d.categoryOther || "").trim().replace(/\s+/g, " ");
  return CATEGORIES.find((x) => x !== "Autre" && agFold(x) === agFold(other)) || other;
}

// Récapitulatif en direct de la campagne (équivalents en vues, budget débité, couverture : photo choisie, sinon
// pictogramme sur la teinte de la catégorie, avec la puce de tarif).
LIVE.campaign = (d) => {
  const admin = state.route.area === "admin", s = db.settings, commission = admin ? 0 : s.commissionRate;
  const r = agNum(d.rate), b = agNum(d.budget), mn = agNum(d.minPayout), mx = agNum(d.maxPayout);
  const views = (amount) => (r && amount ? `=${NB}${plural(Math.ceil((amount * 1000) / r), "vue", "vues")}` : "");
  const fee = Math.round((b * commission) / 100), cost = b + fee, credit = admin ? 0 : me().credit, waiting = admin ? 0 : agPendingCredit();
  const category = agCategoryOf(d), cat = CATEGORIES.includes(category) ? category : "Autre";
  const art = d.image
    ? `<img src="${esc(d.image)}" alt="" class="absolute inset-0 size-full object-cover"/>`
    : `<span class="text-4xl drop-shadow-[0_6px_14px_rgb(0_0_0/0.22)]">${esc(d.emoji || AG_EMOJIS[0])}</span>`;
  const waitingNote = waiting ? ` Recharge de ${da(waiting)} en attente de confirmation.` : "";
  return {
    cover: `<span class="cover absolute inset-0 grid place-items-center overflow-hidden" data-cat="${cat}">${art}${r ? agRateChip(r) : ""}</span>`,
    rate: r < 20 || r > 2000 ? agHint(`Entre 20 et 2${NB}000${NB}DA pour 1${NB}000${NB}vues.`, !!d.rate) : `100${NB}000 vues = ${da(r * 100)}`,
    min: views(mn) || "Gain minimum d'un clip",
    max: mx && mx <= mn ? agHint("Doit dépasser le seuil.", true) : b && mx > b ? agHint("Ne peut pas dépasser le budget.", true) : views(mx) || "Gain maximum d'un clip",
    budget: `${summary(admin
      ? [["Budget", money(b)], ["Commission ClipBoost", "Aucune"], ["Engagé à la publication", money(b), true]]
      : [["Budget", money(b)], [`Commission ClipBoost (${commission}${NB}%)`, money(fee)], ["Débité à l'approbation", money(cost), true]])}
      ${b && b < s.minBudget ? `<div class="mt-3">${alertBox("warning", `Le budget minimum est de ${da(s.minBudget)}.`)}</div>`
        : !admin && cost > credit ? `<div class="mt-3">${alertBox("warning", `Crédit actuel : ${da(credit)}. Il manque <strong class="font-semibold tabular-nums">${da(cost - credit)}</strong> pour l'approbation.${waitingNote} <button type="button" data-action="ag-credit" class="${btn("link")}">Recharger le crédit</button>`)}</div>`
        : !admin ? `<p class="mt-3 text-xs tabular-nums text-fg-subtle">Crédit actuel : ${da(credit)}. Il restera ${da(credit - cost)} après l'approbation.</p>` : ""}`,
  };
};

// campaignForm(formName, submitLabel, note, c = null) : contenu du formulaire de campagne, en 4 fieldsets.
// À placer dans modalShell({ title, description, size: "xl", form: formName, live: "campaign", body: campaignForm(…), footer }).
// c : campagne modifiée ou relancée (champs préremplis ; une catégorie hors liste s'affiche « Autre » + son texte).
// Valeurs : brouillon de la modale (state.modal.draft, gardé par main.js à chaque réaffichage), sinon c, sinon des
// valeurs proposées. Le <form data-form> d'ouverture n'est volontairement pas refermé : dans une modale qui est déjà le
// formulaire, le navigateur ignore cette balise imbriquée ; dans un conteneur qui n'est pas un formulaire, elle crée le
// formulaire, refermé avec son parent. La rangée d'envoi interne disparaît quand la modale-formulaire a son propre pied.
function campaignForm(formName, submitLabel, note, c = null) {
  const s = db.settings, admin = formName === "adm-campaign";
  const known = !!c && CATEGORIES.includes(c.category) && c.category !== "Autre";
  const base = c
    ? { title: c.title, brand: c.brand || "", category: known ? c.category : "Autre", categoryOther: known ? "" : c.category, emoji: c.emoji, image: c.image || "",
      rate: fmt(c.rate), budget: fmt(c.budget), minPayout: fmt(c.minPayout), maxPayout: fmt(c.maxPayout), rules: (c.rules || []).join("\n"),
      ...Object.fromEntries(PLATFORMS.map((pl) => [`pf-${pl}`, (c.platforms || []).includes(pl)])) }
    : { title: "", brand: "", category: CATEGORIES[0], categoryOther: "", emoji: AG_EMOJIS[0], image: "",
      rate: fmt(120), budget: fmt(Math.max(200000, s.minBudget)), minPayout: fmt(240), maxPayout: fmt(24000), rules: "Clip de 15 à 60 secondes\nMentionner la marque",
      ...Object.fromEntries(PLATFORMS.map((pl) => [`pf-${pl}`, true])) };
  const v = { ...base, ...((state.modal && state.modal.draft) || {}) };
  const live = LIVE.campaign(v);
  const out = (k) => `<span data-live-out="${k}">${live[k]}</span>`;
  const emoji = v.emoji || AG_EMOJIS[0], emojis = AG_EMOJIS.includes(emoji) ? AG_EMOJIS : [emoji, ...AG_EMOJIS];
  const on = PLATFORMS.filter((pl) => !!v[`pf-${pl}`]), all = on.length === PLATFORMS.length;
  // Sans photo, l'aperçu de l'imageField est la couverture en direct (LIVE.campaign → data-live-out="cover").
  const coverFallback = `<span data-live-out="cover" class="absolute inset-0">${live.cover}</span>`;
  return `<form data-form="${formName}" data-live="campaign" novalidate class="contents">
    <fieldset class="${AG_FIELDSET}">
      <legend class="${AG_LEGEND}">Campagne</legend>
      <div class="clear-both grid gap-5 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div class="grid content-start gap-4">
          ${field("Titre de la campagne", `<input name="title" required maxlength="40" value="${esc(v.title)}" placeholder="Ex. Spécial Ramadan" autocomplete="off" autofocus class="${inputCls}"/>`)}
          ${admin ? field("Marque", `<input name="brand" required maxlength="30" value="${esc(v.brand || "")}" autocomplete="off" class="${inputCls}"/>`) : ""}
          <div class="group/cat grid gap-4">
            ${field("Catégorie", `<span class="relative block"><select name="category" class="${selectCls}">${CATEGORIES.map((x) => `<option value="${esc(x)}"${x === "Autre" ? " data-other" : ""}${x === v.category ? " selected" : ""}>${esc(x === "Autre" ? "Autre (à préciser)" : x)}</option>`).join("")}</select>${CHEVRON}</span>`, "La catégorie donne sa teinte à la couverture.")}
            <div class="hidden group-has-[[data-other]:checked]/cat:block">${field("Précisez la catégorie", `<input name="categoryOther" maxlength="30" value="${esc(v.categoryOther || "")}" placeholder="Ex. Artisanat, Restauration, Sport automobile" autocomplete="off" class="${inputCls}"/>`, "2 à 30 caractères. Affichée telle quelle aux clippers.")}</div>
          </div>
        </div>
        ${imageField({ name: "image", value: v.image || "", shape: "campaign", label: "Photo de la campagne", hint: "Facultatif. Remplace la couverture en dégradé.", fallback: coverFallback })}
      </div>
      <div class="mt-5 grid gap-1.5" role="radiogroup" aria-labelledby="${formName}-emoji">
        <span id="${formName}-emoji" class="text-small font-medium text-fg">Pictogramme</span>
        <div class="flex flex-wrap gap-2">${emojis.map((e) => `<label class="cursor-pointer"><input type="radio" name="emoji" value="${esc(e)}" ${e === emoji ? "checked" : ""} class="peer sr-only"/><span class="${AG_EMOJI_CHOICE}">${e}</span></label>`).join("")}</div>
        <span class="text-xs text-fg-subtle">Affiché sur la couverture en dégradé, quand la campagne n'a pas de photo.</span>
      </div>
    </fieldset>
    <fieldset class="${AG_FIELDSET}">
      <legend class="${AG_LEGEND}">Rémunération des clippers</legend>
      <div class="clear-both grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        ${field("Tarif", unitInput(`name="rate" value="${esc(v.rate)}" required autocomplete="off"`, `DA${NB}/${NB}1${NB}000${NB}vues`), out("rate"))}
        ${field("Seuil par clip", unitInput(`name="minPayout" value="${esc(v.minPayout)}" required autocomplete="off"`, "DA"), out("min"))}
        ${field("Plafond par clip", unitInput(`name="maxPayout" value="${esc(v.maxPayout)}" required autocomplete="off"`, "DA"), out("max"))}
      </div>
      <p class="mt-3 text-xs text-fg-subtle">Seuil : gain à atteindre avant que le clip soit examiné. Plafond : un clip viral ne peut pas dépasser ce montant.</p>
    </fieldset>
    <fieldset class="${AG_FIELDSET}">
      <legend class="${AG_LEGEND}">Budget</legend>
      <div class="clear-both grid gap-4 sm:grid-cols-2">
        ${field("Budget de la campagne", unitInput(`name="budget" value="${esc(v.budget)}" required autocomplete="off"`, "DA"), `Minimum ${da(s.minBudget)}.`)}
      </div>
      <div data-live-out="budget">${live.budget}</div>
      ${note ? `<p class="mt-3 text-xs text-fg-subtle">${note}</p>` : ""}
    </fieldset>
    <fieldset class="${AG_FIELDSET}">
      <legend class="${AG_LEGEND}">Diffusion</legend>
      <div class="clear-both grid gap-5">
        <div class="group/pf grid gap-2" role="group" aria-labelledby="${formName}-pf" data-field data-pf-group>
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <span id="${formName}-pf" class="text-small font-medium text-fg">Plateformes</span>
            <label class="inline-flex cursor-pointer items-center gap-2 text-small font-medium text-fg-muted transition-colors duration-150 hover:text-fg"><input type="checkbox" data-pf-all ${all ? "checked" : on.length ? "data-indeterminate" : ""} class="${CHECKBOX}"/>Toutes les plateformes</label>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">${PLATFORMS.map((pl) => `<label class="${AG_PF_TILE}"><input type="checkbox" name="pf-${pl}" data-pf ${v[`pf-${pl}`] ? "checked" : ""} class="${AG_PF_BOX}"/>${icon(PLATFORM_ICON[pl] || "film", "size-6 shrink-0")}<span class="max-w-full truncate text-sm font-medium">${pl}</span></label>`).join("")}</div>
          <span class="text-xs text-fg-subtle">Les clippers publient leur clip sur l'une de ces plateformes, ou sur toutes.</span>
        </div>
        ${field("Règles", `<textarea name="rules" rows="3" class="${textareaCls}">${esc(v.rules || "")}</textarea>`, "Une règle par ligne, affichée aux clippers.")}
      </div>
    </fieldset>
    <div class="mt-6 flex justify-end [form[role=dialog]:has(>footer)_&]:hidden"><button type="submit" class="${btn("primary", "md", "w-full sm:w-auto")}">${submitLabel}</button></div>`;
}

// Case « Toutes les plateformes » : elle coche ou décoche les quatre, et suit leur état (cochée, en partie, vide) sans
// réafficher le formulaire. main.js applique data-indeterminate après chaque rendu ; cet écouteur (document) passe
// avant celui des brouillons (window) : le brouillon enregistre l'état final des cases. Une case cochée efface aussi
// l'erreur « Choisissez au moins une plateforme ».
document.addEventListener("change", (e) => {
  const el = e.target, group = el && el.closest ? el.closest("[data-pf-group]") : null;
  if (!group || el.type !== "checkbox") return;
  const master = group.querySelector("[data-pf-all]"), boxes = [...group.querySelectorAll("[data-pf]")];
  if (el === master) boxes.forEach((b) => { b.checked = master.checked; });
  const n = boxes.filter((b) => b.checked).length;
  if (master) { master.checked = n === boxes.length; master.indeterminate = n > 0 && n < boxes.length; }
  if (n) {
    group.querySelectorAll('[aria-invalid="true"]').forEach((b) => b.removeAttribute("aria-invalid"));
    group.querySelectorAll("[data-field-error]").forEach((x) => x.remove());
  }
});

// Données du formulaire de campagne au format attendu par l'API.
// image : data URL (nouvelle photo), adresse actuelle (inchangée) ou "" (aucune / retirée), voir imageField (ui.js).
function campaignPayload(data) {
  const num = (v) => +String(v ?? "").replace(/\s/g, ""); // « 200 000 » saisi avec des espaces
  return {
    title: String(data.title || "").trim(), brand: data.brand, category: agCategoryOf(data),
    rate: num(data.rate), budget: num(data.budget), minPayout: num(data.minPayout), maxPayout: num(data.maxPayout),
    emoji: data.emoji, platforms: PLATFORMS.filter((pl) => data[`pf-${pl}`]),
    rules: String(data.rules || "").split("\n").map((r) => r.trim()).filter(Boolean),
    image: data.image || "",
  };
}

// ---------- Paiement par carte Visa / Mastercard ----------
// Le numéro complet ne quitte jamais le navigateur : seuls la marque et les 4 derniers chiffres sont envoyés.
const AG_CARD = "carte Visa / Mastercard";
const agDigits = (v) => String(v || "").replace(/\D/g, "");
// Marque d'après les premiers chiffres : Visa 4… ; Mastercard 51–55 ou 2221–2720.
function agCardBrand(d) {
  if (/^4/.test(d)) return "Visa";
  if (/^5[1-5]/.test(d)) return "Mastercard";
  const p = +d.slice(0, 4);
  return d.length >= 4 && p >= 2221 && p <= 2720 ? "Mastercard" : "";
}
// Clé de Luhn (chiffre de contrôle des numéros de carte).
function agLuhn(d) {
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}
// Contrôles de la carte ; renvoie [champ, message] ou null.
function agCardError(d) {
  const digits = agDigits(d.cardNumber), brand = agCardBrand(digits);
  if (String(d.cardName || "").trim().length < 2) return ["cardName", "Indiquez le nom du titulaire, tel qu'il est inscrit sur la carte."];
  if (!digits) return ["cardNumber", "Indiquez le numéro de la carte."];
  if (!brand) return ["cardNumber", "Seules les cartes Visa et Mastercard sont acceptées."];
  const lengths = brand === "Visa" ? [13, 16, 19] : [16];
  if (!lengths.includes(digits.length) || !agLuhn(digits)) return ["cardNumber", "Numéro de carte invalide : vérifiez-le."];
  const exp = /^(\d{2})\/(\d{2})$/.exec(String(d.cardExp || "").trim()), month = exp ? +exp[1] : 0;
  if (!exp || month < 1 || month > 12) return ["cardExp", "Date d'expiration invalide (MM/AA)."];
  const now = new Date(), year = 2000 + +exp[2];
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return ["cardExp", "Cette carte a expiré."];
  if (!/^\d{3}$/.test(String(d.cardCvc || "").trim())) return ["cardCvc", "Le code de sécurité compte 3 chiffres (au dos de la carte)."];
  return null;
}
const agBrandMark = (b) => `<span class="inline-flex h-5 items-center rounded-[4px] border border-line-strong bg-surface px-1.5 text-[10px] font-bold uppercase tracking-wider text-fg">${b}</span>`;
// Mise en forme pendant la saisie (numéro par groupes de 4, MM/AA, 3 chiffres), curseur gardé après le même chiffre.
function agFormatField(el, format) {
  const v = el.value, next = format(v);
  if (next === v) return;
  const pos = el.selectionStart ?? v.length, atEnd = pos >= v.length, before = agDigits(v.slice(0, pos)).length;
  el.value = next;
  let i = 0;
  if (atEnd) i = next.length;
  else for (let seen = 0; i < next.length && seen < before; i++) if (/\d/.test(next[i])) seen++;
  try { el.setSelectionRange(i, i); } catch (err) {}
}
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el || !el.matches) return;
  if (el.matches("[data-card-number]")) agFormatField(el, (v) => agDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 "));
  else if (el.matches("[data-card-exp]")) agFormatField(el, (v) => { let d = agDigits(v); if (/^[2-9]/.test(d)) d = `0${d}`; d = d.slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; });
  else if (el.matches("[data-card-cvc]")) agFormatField(el, (v) => agDigits(v).slice(0, 3));
});

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

// Recharger le crédit : rien n'est débité, le crédit arrive à la confirmation du paiement par l'équipe.
LIVE.recharge = (d) => {
  const a = agNum(d.amount), u = me(), brand = agCardBrand(agDigits(d.cardNumber));
  return {
    "": summary([["Crédit actuel", money(u.credit)], ["Recharge demandée", money(a)], ["Crédit après confirmation", money(u.credit + a), true]]),
    btn: a ? `Demander ${da(a)}` : "Envoyer la demande de recharge",
    presets: agPresets(AG_RECHARGES.map((v) => [v, da(v)]), a),
    brand: brand ? agBrandMark(brand) : "",
    note: d.method === AG_CARD ? "" : `<p class="mt-3 flex items-start gap-2 text-small text-fg-muted">${icon("info", "mt-0.5 size-4 shrink-0 text-fg-subtle")}Après l'envoi, vous recevez une référence à indiquer dans votre paiement.</p>`,
  };
};

const AG_METHODS = [
  ["virement bancaire", "Virement bancaire", "bank", "Indiquez la référence reçue dans le libellé du virement."],
  ["carte Edahabia", "Carte Edahabia", "wallet", "Carte Algérie Poste."],
  ["carte CIB", "Carte CIB", "wallet", "Carte bancaire interbancaire."],
  [AG_CARD, "Carte Visa / Mastercard", "card", "Carte bancaire internationale."],
];

// Fiche de retrait (annuler une campagne en attente, supprimer une campagne refusée) : rappel de la campagne.
const agCampaignSummary = (c) => `<div class="flex items-center gap-3 rounded-tile bg-muted p-3">${coverThumb(c, "md")}
    <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(c.title)}</p><p class="truncate text-xs tabular-nums text-fg-subtle">${esc(c.category)} · budget ${da(c.budget)}</p></div>${statusBadge(c.status)}</div>`;

function agencyModal() {
  const m = state.modal;
  if (!m) return "";
  const cancel = `<button type="button" data-action="close-modal" class="${btn("ghost")}">Annuler</button>`;
  const closeBtn = `<button type="button" data-action="close-modal" class="${btn("ghost")}">Fermer</button>`;
  if (m.type === "ag-new") {
    return modalShell({
      title: "Nouvelle campagne", description: "Elle sera publiée après vérification par l'équipe ClipBoost.", size: "xl", form: "ag-campaign", live: "campaign",
      body: campaignForm("ag-campaign", "Envoyer pour validation", "Le budget non consommé vous est rendu à la fin de la campagne."),
      footer: `${cancel}<button type="submit" class="${btn("primary")}">Envoyer pour validation</button>`,
    });
  }
  if (m.type === "ag-edit") {
    const c = agMine(m.id);
    if (!c) return "";
    // Approuvée entre-temps (données rechargées pendant la saisie) : plus modifiable.
    if (!agEditable(c)) {
      return modalShell({
        title: "Modification impossible", description: esc(c.title),
        body: alertBox("info", "Cette campagne a changé de statut entre-temps : elle ne peut plus être modifiée. Vous pouvez encore lui ajouter du budget ou la mettre en pause."),
        footer: closeBtn,
      });
    }
    const relaunch = c.status === "Refusée";
    return modalShell({
      title: relaunch ? "Modifier et relancer" : "Modifier la campagne",
      description: relaunch ? "Corrigez la campagne : elle repassera en vérification par l'équipe ClipBoost." : "Elle reste en attente de vérification par l'équipe ClipBoost.",
      size: "xl", form: "ag-edit", live: "campaign",
      body: `${relaunch ? alertBox("danger", `<p class="font-medium">Motif du refus</p><p class="mt-0.5 break-words">${c.reviewNote ? esc(c.reviewNote) : "L'équipe ClipBoost n'a pas précisé de motif."}</p>`) : ""}
        ${campaignForm("ag-edit", relaunch ? "Relancer la campagne" : "Enregistrer les modifications", "Rien n'est prélevé avant l'approbation. Le budget non consommé vous est rendu à la fin de la campagne.", c)}`,
      footer: `${cancel}<button type="submit" class="${btn("primary")}">${relaunch ? `${icon("refresh")}Relancer la campagne` : "Enregistrer les modifications"}</button>`,
    });
  }
  if (m.type === "ag-cancel" || m.type === "ag-delete") {
    const c = agMine(m.id), del = m.type === "ag-delete";
    if (!c) return "";
    if (!agRemovable(c) || c.status !== (del ? "Refusée" : "En attente")) {
      return modalShell({ title: "Action impossible", description: esc(c.title), body: alertBox("info", "Cette campagne a changé de statut entre-temps : elle ne peut plus être retirée."), footer: closeBtn });
    }
    return modalShell({
      title: del ? `Supprimer la campagne${NB}?` : `Annuler la campagne${NB}?`,
      body: `${agCampaignSummary(c)}
        <p class="mt-4 text-sm text-fg-muted">${del
          ? "La campagne refusée et sa photo seront supprimées définitivement. Pour la corriger plutôt, choisissez « Modifier et relancer »."
          : "La campagne n'a pas encore été vérifiée : elle est retirée de la file d'examen et supprimée définitivement."} Rien n'a été prélevé sur votre crédit.</p>`,
      footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${del ? "Annuler" : "Garder la campagne"}</button><button type="button" data-action="${m.type}-confirm" data-id="${c.id}" class="${btn("danger")}">${del ? `${icon("trash")}Supprimer définitivement` : `${icon("xCircle")}Annuler la campagne`}</button>`,
    });
  }
  if (m.type === "ag-open") {
    const c = agMine(m.id);
    if (!c) return "";
    const live = !agEditable(c), pending = c.status === "En attente", refused = c.status === "Refusée", u = me();
    const clips = clipsOf([c.id]), views = campaignViews(c), cost = withCommission(c.budget, c.commissionRate);
    const tiles = [
      ["Tarif", `${fmt(c.rate)}${NB}DA`, `pour 1${NB}000 vues`], ["Seuil", da(c.minPayout), `dès ${plural(viewsFor(c, c.minPayout), "vue", "vues")}`], ["Plafond", da(c.maxPayout), `atteint à ${plural(viewsFor(c, c.maxPayout), "vue", "vues")}`],
      ...(live ? [["Clippers", fmt(c.clippers), "ont rejoint"], ["Clips", fmt(clips.length), `${fmt(clips.filter((p) => p.status === "En attente").length)} en modération`], ["Vues", fmt(views), "clips validés"]] : []),
    ];
    const notice = refused
      ? alertBox("danger", `<p class="font-medium">Motif du refus</p><p class="mt-0.5 break-words">${c.reviewNote ? esc(c.reviewNote) : "L'équipe ClipBoost n'a pas précisé de motif."}</p><p class="mt-2">Corrigez la campagne puis relancez-la : elle repassera en vérification. Vous pouvez aussi la supprimer.</p>`)
      : pending ? alertBox("info", "L'équipe ClipBoost vérifie la campagne avant sa mise en ligne. D'ici là, vous pouvez la modifier ou l'annuler : rien n'est prélevé sur votre crédit avant l'approbation.")
      : "";
    const short = pending && cost > u.credit
      ? `<div class="mt-3">${alertBox("warning", `Crédit insuffisant pour l'approbation : il manque <strong class="font-semibold tabular-nums">${da(cost - u.credit)}</strong>. <button type="button" data-action="ag-credit" class="${btn("link")}">Recharger le crédit</button>`)}</div>` : "";
    const budgetBlock = live
      ? `<div class="mt-5"><p class="mb-2 text-small font-medium text-fg">Budget</p>${progress(c.spent, c.budget, { aria: `Budget consommé de ${c.title}` })}
          <p class="mt-1.5 text-xs tabular-nums text-fg-subtle">${agClosed(c) ? "Le budget non consommé a été rendu à votre crédit." : `Reste ${da(Math.max(0, c.budget - c.spent))} à consommer.`}</p></div>`
      : `${summary([["Budget", money(c.budget)], [`Commission ClipBoost (${c.commissionRate}${NB}%)`, money(cost - c.budget)], ["Débité à l'approbation", money(cost), true]])}${short}`;
    const [rmAction, rmIcon] = agRemoveAction(c);
    const remove = agRemovable(c) ? `<button type="button" data-action="${rmAction}" data-id="${c.id}" class="${btn("dangerSoft", "md", "sm:me-auto")}">${icon(rmIcon)}${refused ? "Supprimer" : "Annuler la campagne"}</button>` : "";
    const footer = !live ? `${remove}${agEditBtn(c, "md", "", "primary")}`
      : c.status === "Terminée" ? closeBtn
      : `${agToggle(c, "md")}<button type="button" data-action="ag-topup" data-id="${c.id}" class="${btn("primary")}">${icon("plus")}Ajouter du budget</button>`;
    const edited = pending && c.updatedAt && date(c.updatedAt) !== date(c.createdAt) ? ` · modifiée le ${date(c.updatedAt)}` : "";
    return modalShell({
      title: esc(c.title), description: `${esc(c.category)} · créée le ${date(c.createdAt)}${edited}`, size: "lg", footer,
      body: `<div class="cover relative grid ${c.image ? "aspect-[2/1] sm:aspect-[5/2]" : "h-28 sm:h-32"} place-items-center overflow-hidden rounded-tile" ${coverAttr(c)} aria-hidden="true">${coverArt(c)}${agRateChip(c.rate)}</div>
        <div class="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1">${statusBadge(c.status)}<span class="text-small text-fg-muted">${agencyStatusHint(c)}</span></div>
        ${notice ? `<div class="mt-4">${notice}</div>` : ""}
        <dl class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">${tiles.map(([k, v, sub]) => `<div class="${TILE}"><dt class="text-xs text-fg-subtle">${k}</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${v}<span class="block text-xs font-normal text-fg-subtle">${sub}</span></dd></div>`).join("")}</dl>
        ${budgetBlock}
        <div class="mt-5 grid gap-5 sm:grid-cols-2">
          <div><p class="text-small font-medium text-fg">Règles</p>${c.rules.length ? `<ul class="mt-2 grid gap-1.5">${c.rules.map((r) => `<li class="flex gap-2 text-sm text-fg">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span class="min-w-0 break-words">${esc(r)}</span></li>`).join("")}</ul>` : `<p class="mt-2 text-sm text-fg-subtle">Aucune règle particulière.</p>`}</div>
          <div><p class="text-small font-medium text-fg">Plateformes</p><div class="mt-2 flex flex-wrap gap-1.5">${PLATFORMS.filter((p) => (c.platforms || []).includes(p)).map(platformTag).join("")}</div></div>
        </div>
        ${live ? `<div class="mt-6"><div class="mb-2 flex items-baseline justify-between gap-3"><p class="text-small font-medium text-fg">Clips reçus</p>${clips.length > 5 ? agMoreLink("#/agence/clips", `Voir les ${fmt(clips.length)}`) : ""}</div>
          ${clips.length ? `<ul class="divide-y divide-line rounded-tile border border-line px-3">${clips.slice(0, 5).map((p) => { const owner = userById(p.userId); return `<li class="flex items-center gap-3 py-2.5">
            ${owner ? avatar(owner, "sm") : ""}
            <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="rounded-sm hover:underline ${FOCUS}">${esc(p.title)}</a>` : esc(p.title)}</p>
              <p class="flex min-w-0 items-center gap-1 text-xs tabular-nums text-fg-subtle"><span class="min-w-0 truncate">${esc((owner || {}).name || "Clipper")}</span><span class="shrink-0" aria-hidden="true">·</span>${icon(PLATFORM_ICON[p.platform] || "film", "size-3.5 shrink-0")}<span class="shrink-0">${esc(p.platform)} · ${plural(p.views, "vue", "vues")}</span></p></div>
            <div class="flex shrink-0 flex-col items-end gap-1"><span class="text-sm font-medium">${p.status === "Validée" ? money(earningsOf(p)) : `<span class="text-fg-subtle">—</span>`}</span>${statusBadge(p.status)}</div></li>`; }).join("")}</ul>`
            : `<p class="rounded-tile border border-dashed border-line-strong px-4 py-6 text-center text-small text-fg-muted">Aucun clip pour l'instant.</p>`}</div>` : ""}`,
    });
  }
  if (m.type === "ag-topup") {
    const c = agMine(m.id), u = me();
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
    const init = LIVE.recharge({ amount: fmt(250000), method: AG_METHODS[0][0] });
    return modalShell({
      title: "Recharger le crédit", description: "Le crédit est ajouté dès que l'équipe ClipBoost confirme la réception de votre paiement.", form: "ag-credit", live: "recharge",
      body: `<div class="group/pay grid gap-5">
          <div class="grid gap-3">
            ${field("Montant", unitInput(`name="amount" value="${fmt(250000)}" autocomplete="off" autofocus`, "DA", { lg: true }), `Minimum ${da(10000)}.`)}
            ${agPresetRow(init.presets)}
          </div>
          <fieldset class="grid gap-2"><legend class="mb-1.5 text-small font-medium text-fg">Moyen de paiement</legend>
            <div class="grid gap-2 sm:grid-cols-2">${AG_METHODS.map(([v, l, ic, d], i) => `<label class="${CHOICE}"><input type="radio" name="method" value="${esc(v)}" ${i === 0 ? "checked" : ""}${v === AG_CARD ? " data-card-method" : ""} class="${RADIO}"/>
              <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${l}</span><span class="block text-xs text-fg-subtle">${d}</span></span>${icon(ic, "mt-0.5 size-4 shrink-0 text-fg-subtle")}</label>`).join("")}</div>
          </fieldset>
          <div class="hidden gap-4 rounded-tile border border-line p-4 group-has-[[data-card-method]:checked]/pay:grid" data-nodraft>
            <div class="flex flex-wrap items-center justify-between gap-2"><p class="text-small font-medium text-fg">Carte bancaire</p><span class="flex gap-1.5" aria-hidden="true">${agBrandMark("Visa")}${agBrandMark("Mastercard")}</span></div>
            ${field("Titulaire de la carte", `<input name="cardName" maxlength="60" autocomplete="cc-name" autocapitalize="characters" spellcheck="false" placeholder="Nom inscrit sur la carte" class="${inputCls}"/>`)}
            ${field("Numéro de carte", `<span class="relative block" dir="ltr"><input name="cardNumber" inputmode="numeric" autocomplete="cc-number" maxlength="23" spellcheck="false" placeholder="1234 5678 9012 3456" data-card-number class="${inputCls} pe-28 tabular-nums"/><span data-live-out="brand" class="pointer-events-none absolute inset-y-0 end-3 flex items-center" aria-hidden="true">${init.brand}</span></span>`)}
            <div class="grid grid-cols-2 gap-4">
              ${field("Expiration", `<input name="cardExp" inputmode="numeric" autocomplete="cc-exp" maxlength="5" spellcheck="false" placeholder="MM/AA" dir="ltr" data-card-exp class="${inputCls} tabular-nums"/>`)}
              ${field("Code de sécurité", `<input name="cardCvc" inputmode="numeric" autocomplete="cc-csc" maxlength="3" spellcheck="false" placeholder="123" dir="ltr" data-card-cvc class="${inputCls} tabular-nums"/>`, "3 chiffres, au dos de la carte.")}
            </div>
            <p class="flex items-start gap-2 text-xs text-fg-muted">${icon("lock", "mt-px size-3.5 shrink-0 text-fg-subtle")}<span>Le numéro complet de votre carte ne quitte jamais votre navigateur : seuls la marque et les 4 derniers chiffres sont transmis. Comme pour les autres moyens, le crédit est ajouté après confirmation du paiement par l'équipe ClipBoost.</span></p>
          </div>
        </div>
        <div data-live-out>${init[""]}</div>
        <div data-live-out="note">${init.note}</div>`,
      footer: `${cancel}<button type="submit" class="${btn("primary")}" data-live-out="btn">${init.btn}</button>`,
    });
  }
  if (m.type === "ag-verify") {
    const u = me();
    // Demande déjà envoyée ou badge accordé entre-temps (données rechargées) : l'état seul.
    if (u.verification === "pending" || u.verification === "verified") {
      return modalShell({
        title: "Badge de vérification",
        body: alertBox("info", u.verification === "verified" ? "Votre agence est déjà vérifiée : le badge bleu s'affiche à côté de son nom." : "Votre demande est déjà en cours d'examen par l'équipe ClipBoost."),
        footer: closeBtn,
      });
    }
    const perks = [
      "Le badge s'affiche à côté du nom de l'agence : sur sa page, sur ses campagnes et dans la liste des agences.",
      "Les clippers savent que l'agence et ses campagnes sont authentiques.",
    ];
    return modalShell({
      title: "Demander le badge de vérification", description: "Le badge bleu indique aux clippers que votre agence a été vérifiée par l'équipe ClipBoost.", form: "ag-verify",
      body: `<div class="flex items-center gap-3 rounded-tile bg-muted p-3">${avatar(u, "md")}<p class="min-w-0 break-words text-sm font-semibold text-fg">${esc(u.name)}${NB}<span aria-hidden="true">${verifiedBadge("size-4")}</span></p></div>
        <ul class="mt-4 grid gap-2">${perks.map((p) => `<li class="flex gap-2 text-sm text-fg-muted">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span>${p}</span></li>`).join("")}</ul>
        <div class="mt-5">${field(`Message pour l'équipe ${OPTIONAL}`, `<textarea name="message" rows="3" maxlength="300" placeholder="Site web, comptes officiels de la marque, registre du commerce…" class="${textareaCls}"></textarea>`, "300 caractères maximum.")}</div>
        <p class="mt-4 flex items-start gap-2 text-small text-fg-muted">${icon("info", "mt-0.5 size-4 shrink-0 text-fg-subtle")}<span>L'équipe ClipBoost examine chaque demande et vous informe de sa décision par notification. Des justificatifs pourront vous être demandés.</span></p>`,
      footer: `${cancel}<button type="submit" class="${btn("primary")}">${icon("send")}Envoyer la demande</button>`,
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
    case "ag-show-refused": state.ag.q = ""; state.ag.status = "Refusée"; return navigate("#/agence/campagnes");
    case "ag-period": state.period = +t.dataset.value; return render();
    // Formulaires de campagne : toujours vierges à l'ouverture (draft: {}), le brouillon d'une autre ouverture n'est pas repris.
    case "ag-new": state.modal = { type: "ag-new", draft: {} }; state.drawer = false; return render();
    case "ag-open": state.modal = { type: "ag-open", id }; return render();
    // Depuis la fiche d'une campagne, ces modales s'empilent : « Annuler » ramène à la fiche.
    case "ag-edit": return agOpen({ type: "ag-edit", id, draft: {} });
    case "ag-cancel": case "ag-delete": return agOpen({ type: action, id });
    case "ag-topup": return agOpen({ type: "ag-topup", id });
    // Depuis un formulaire (campagne, ajout de budget) ou une fiche, la recharge s'empile : le formulaire revient ensuite.
    case "ag-credit": return agOpen({ type: "ag-credit" });
    case "ag-verify": return agOpen({ type: "ag-verify" });
    case "ag-copy": return copy(t.dataset.value, "Référence copiée");
    case "ag-amount": {
      const input = root.querySelector('[aria-modal="true"] [name="amount"]');
      if (input) { input.value = fmt(+t.dataset.value); input.dispatchEvent(new Event("input", { bubbles: true })); }
      return;
    }
    case "ag-pause": case "ag-resume":
      return act("PATCH", `/api/campaigns/${id}`, { status: action === "ag-pause" ? "En pause" : "Active" }, action === "ag-pause" ? "Campagne mise en pause" : "Campagne relancée");
    case "ag-cancel-confirm": case "ag-delete-confirm":
      return act("DELETE", `/api/campaigns/${id}`, null, action === "ag-delete-confirm" ? "Campagne supprimée" : "Campagne annulée", () => { state.modal = null; agFixFilter(); });
  }
}

// Erreur de saisie dans un formulaire de l'agence : message sous le champ, focus dessus (pas de toast éphémère).
function agInvalid(form, name, msg) {
  markInvalid(root.querySelector(`form[data-form="${form}"]`), name, msg);
}

// Contrôles côté client, mêmes règles que l'API ; renvoie [champ, message] ou null.
function agCampaignError(d) {
  const n = campaignPayload(d), min = db.settings.minBudget;
  if (!n.title) return ["title", "Donnez un titre à la campagne."];
  if (d.category === "Autre" && (n.category.length < 2 || agFold(n.category) === "autre")) return ["categoryOther", "Précisez la catégorie de la campagne (2 caractères minimum)."];
  if (n.category.length > 30) return ["categoryOther", "Catégorie trop longue : 30 caractères maximum."];
  if (!(n.rate >= 20)) return ["rate", `Tarif minimum : 20${NB}DA pour 1${NB}000 vues.`];
  if (n.rate > 2000) return ["rate", `Tarif maximum : 2${NB}000${NB}DA pour 1${NB}000 vues.`];
  if (!(n.maxPayout > n.minPayout)) return ["maxPayout", "Le plafond doit être supérieur au seuil."];
  if (!(n.budget >= min)) return ["budget", `Le budget minimum est de ${da(min)}.`];
  if (n.maxPayout > n.budget) return ["maxPayout", "Le plafond par clip ne peut pas dépasser le budget."];
  if (!n.platforms.length) return [`pf-${PLATFORMS[0]}`, "Choisissez au moins une plateforme."];
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
  if (form === "ag-edit") {
    const c = agMine(state.modal && state.modal.id);
    if (!c) return;
    const err = agCampaignError(data);
    if (err) return agInvalid(form, ...err);
    const relaunch = c.status === "Refusée";
    // Ouverte depuis la fiche : la fiche revient, à jour ; sinon plus aucune modale.
    return act("PUT", `/api/campaigns/${c.id}`, campaignPayload(data), relaunch ? "Campagne relancée : elle repasse en vérification" : "Campagne modifiée", () => { closeStacked(); agFixFilter(); });
  }
  if (form === "ag-topup") {
    const amount = agNum(data.amount);
    if (!amount) return agInvalid(form, "amount", "Indiquez le montant à ajouter.");
    return act("POST", `/api/campaigns/${state.modal.id}/budget`, { amount }, `${da(amount)} ajoutés au budget`, () => closeStacked());
  }
  if (form === "ag-credit") {
    const amount = agNum(data.amount), method = AG_METHODS.some(([v]) => v === data.method) ? data.method : AG_METHODS[0][0];
    if (amount < 10000) return agInvalid(form, "amount", `Recharge minimum : ${da(10000)}.`);
    let card = null;
    if (method === AG_CARD) {
      const err = agCardError(data);
      if (err) return agInvalid(form, ...err);
      const digits = agDigits(data.cardNumber);
      card = { brand: agCardBrand(digits), last4: digits.slice(-4) };
    }
    // Recharge empilée (depuis un formulaire de campagne, un ajout de budget ou une fiche) : ce qui était ouvert revient.
    return act("POST", "/api/credit", card ? { amount, method, card } : { amount, method },
      (r) => (card ? `Demande envoyée · ${card.brand} •••• ${card.last4} · référence ${r.ref}` : `Demande envoyée · référence ${r.ref} à indiquer dans votre paiement`),
      () => closeStacked());
  }
  if (form === "ag-verify") {
    const message = String(data.message || "").trim();
    return act("POST", "/api/verification", message ? { message } : {}, "Demande de badge envoyée à l'équipe ClipBoost", () => { state.modal = null; });
  }
  if (form === "ag-profile") {
    if (!String(data.name || "").trim()) return agInvalid(form, "name", "Indiquez le nom de l'agence.");
    // avatar, cover : data URL (nouvelle photo), adresse actuelle (inchangée) ou "" (retirée), voir imageField (ui.js).
    return act("PATCH", "/api/me", { name: data.name, contact: data.contact, country: data.country, bio: data.bio, avatar: data.avatar, cover: data.cover }, "Profil de l'agence mis à jour");
  }
}
