// Espace Clipper : accueil, campagnes, publications, portefeuille, statistiques, profil, paramètres.
// Recettes et helpers : docs/design-system.md §4 et §6.2 (web/src/ui.js). Helpers locaux préfixés « cl ».

const me = () => db.me;
const myPubs = () => db.publications.filter((p) => p.userId === state.session);
const myTx = () => db.transactions.filter((t) => t.userId === state.session);
const myNotifs = () => db.notifications;
const activeCampaigns = () => db.campaigns.filter((c) => c.status === "Active");

// Soldes calculés par le serveur : gains validés, gains encore en rétention, solde retirable.
const totalEarned = (u = me()) => u.earned || 0;
const pendingAmount = (u = me()) => u.pending || 0;
const balance = (u = me()) => u.available || 0;
const dailySeries = () => (state.period === 7 ? db.series.daily.slice(-7) : db.series.daily);
// Masquage sur les chiffres seuls : « •••• 7890 ».
const maskAccount = (a) => { const d = String(a || "").replace(/\D/g, ""); return d ? `••••${NB}${d.slice(-4)}` : ""; };

const CLIPPER_NAV = [
  { id: "accueil", label: "Vue d'ensemble", short: "Accueil", icon: "home" },
  { id: "campagnes", label: "Campagnes", icon: "target" },
  { id: "publications", label: "Mes publications", short: "Clips", icon: "film" },
  { id: "portefeuille", label: "Portefeuille", icon: "wallet" },
  { id: "statistiques", label: "Statistiques", icon: "chart" },
  { id: "profil", label: "Profil", icon: "user" },
  { id: "parametres", label: "Paramètres", icon: "gear" },
];

// ---------- Helpers locaux ----------
const CL_MONTHS_LONG = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const CL_PAYOUT_ICON = { BaridiMob: "wallet", CCP: "mail", "RIB bancaire": "bank" };
// Le lien doit pointer vers la plateforme déclarée (mêmes règles que le serveur, lib/server/services/clips.ts).
const CL_HOSTS = { TikTok: /(^|\.)tiktok\.com$/, Instagram: /(^|\.)instagram\.com$/, YouTube: /(^|\.)(youtube\.com|youtu\.be)$/ };
const CL_CHIP = `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-small font-medium text-fg-muted transition-colors hover:border-line-control hover:text-fg aria-pressed:border-brand-line aria-pressed:bg-brand-soft aria-pressed:text-brand-fg [&_svg]:size-3.5 ${FOCUS}`;
const clSum = (a) => a.reduce((s, v) => s + v, 0);
const clFirst = (u) => esc(u.name.split(" ")[0]);
const clToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const clLink = (href, text) => `<a href="${href}" class="${HIT} inline-flex items-center gap-1 rounded-sm text-small font-medium text-brand-fg underline-offset-4 hover:underline ${FOCUS}">${text}${icon("chevronRight", "size-3.5")}</a>`;
const clThresholdViews = (c) => viewsFor(c, c.minPayout);
const clThresholdPct = (p) => Math.min(99, Math.floor((p.views / Math.max(1, clThresholdViews(campaignById(p.campaign)))) * 100));
const clMyEarnings = (c) => myPubs().filter((p) => p.campaign === c.id).reduce((s, p) => s + earningsOf(p), 0);
// Gain encore en rétention (contrôle anti-fraude) : pas encore retirable.
const clOnHold = (t) => t.type === "gain" && t.availableAt && new Date(t.availableAt).getTime() > Date.now();
const clTxBadge = (t) => (clOnHold(t) ? badge("En rétention", "idle", { ic: "clock" }) : statusBadge(t.status));
const clPeriodSeg = () => segmented("period", `${state.period} jours`, [["7 jours", "7 j"], ["30 jours", "30 j"]], "Période");

// Carte portefeuille : seule source du solde sur l'Accueil et le Portefeuille.
function clWalletCard({ curve = false } = {}) {
  const bal = balance(), hold = db.settings.holdDays, min = db.settings.minWithdraw;
  // Sous le minimum, « Retirer » n'est pas l'action principale de l'écran : bouton secondaire et seuil affiché.
  const canWithdraw = bal >= min, wdVariant = canWithdraw ? "primary" : "secondary";
  const actions = curve
    ? `<div class="flex flex-col items-start gap-1.5 sm:items-end"><div class="flex items-center gap-2"><button type="button" data-action="withdraw" class="${btn(wdVariant)}">Retirer</button><a href="#/clipper/portefeuille" class="${btn("ghost")}">Portefeuille</a></div>${canWithdraw ? "" : `<p class="text-xs text-fg-subtle">Disponible dès ${da(min)}</p>`}</div>`
    : "";
  const facts = `<dl class="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
      <div class="min-w-0"><dt class="flex items-center gap-1.5 text-small text-fg-muted">${icon("clock", "size-3.5 shrink-0 text-fg-subtle")}En rétention</dt>
        <dd class="mt-1 text-base font-semibold">${money(pendingAmount())}</dd><dd class="mt-0.5 text-xs text-fg-subtle">libéré après ${plural(hold, "jour", "jours")} de contrôle</dd></div>
      <div class="min-w-0"><dt class="text-small text-fg-muted">Total gagné</dt>
        <dd class="mt-1 text-base font-semibold">${money(totalEarned())}</dd><dd class="mt-0.5 text-xs text-fg-subtle">depuis l'inscription</dd></div></dl>`;
  if (!curve) {
    return card(`<p class="text-small font-medium text-fg-muted">Solde disponible</p>
      <p class="mt-1">${bigMoney(bal, "money")}</p>
      <button type="button" data-action="withdraw" class="${btn(wdVariant, "md", "mt-5 w-full")}">Demander un retrait</button>
      <p class="mt-2 text-center text-xs text-fg-subtle">${canWithdraw ? `Retrait minimum ${da(min)}` : `Disponible dès ${da(min)} de solde`}</p>
      ${facts}`, "p-5");
  }
  const series = dailySeries();
  return card(`<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div class="min-w-0"><p class="text-small font-medium text-fg-muted">Solde disponible</p><p class="mt-1">${bigMoney(bal, "money")}</p></div>
      ${actions}</div>
    ${facts}
    ${clSum(series) ? `<p class="mt-5 text-micro font-medium text-fg-subtle">Gains cumulés · ${state.period} derniers jours</p>
    <div class="-mx-5 -mb-5 mt-1 pr-4">${cumulativeChart(series, { h: "h-20", end: false })}</div>` : ""}`, "p-5 overflow-hidden");
}

// Ligne d'historique d'argent (§4.6), du point de vue du clipper.
function txRow(t) {
  const credit = t.amount > 0, final = t.status === "Validé" && !clOnHold(t);
  return `<li data-row="${t.id}" class="flex items-center gap-3 py-3">
    <span class="grid size-8 shrink-0 place-items-center rounded-full ${credit ? "bg-income-soft text-income" : "bg-muted text-fg-muted"}" aria-hidden="true">${icon(credit ? "arrowDownLeft" : "arrowUpRight", "size-4")}</span>
    <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(t.label)}</p>
      <p class="truncate text-xs text-fg-subtle">${date(t.date)} · ${code(t.ref)}${t.fee ? ` · frais ${da(t.fee)}` : ""}</p>
      ${final ? "" : `<div class="mt-1.5 sm:hidden">${clTxBadge(t)}</div>`}</div>
    <div class="shrink-0 text-right"><p class="text-sm font-medium">${money(t.amount, { signed: true, pending: !final })}</p><div class="mt-1 hidden justify-end sm:flex">${clTxBadge(t)}</div></div>
  </li>`;
}

// Carte campagne (§4.4).
function campaignCard(c) {
  const u = me(), fav = u.favorites.has(c.id), joined = u.joinedCampaigns.has(c.id);
  return `<article class="group flex flex-col ${CARD} ${CARD_HOVER} p-2">
    <div class="relative">
      <button type="button" data-action="open-campaign" data-id="${c.id}" class="cover relative block aspect-[16/9] w-full overflow-hidden rounded-tile ${FOCUS}" ${coverAttr(c)} aria-label="Voir la campagne ${esc(c.title)}">
        <span class="absolute inset-0 grid place-items-center text-5xl drop-shadow-[0_6px_14px_rgb(0_0_0/0.22)]" aria-hidden="true">${c.emoji}</span>
        <span class="absolute left-2.5 top-2.5 inline-flex items-baseline gap-1 rounded-badge bg-night/80 px-2 py-1 text-small font-semibold tabular-nums text-on-brand backdrop-blur-sm">${fmt(c.rate)}${NB}DA<span class="text-[11px] font-medium text-on-brand/80">/ 1k${NB}vues</span></span>
        ${c.top ? `<span class="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-badge bg-on-brand/90 px-1.5 py-0.5 text-[11px] font-semibold text-night">${icon("star", "size-3", true)}Top campagne</span>` : ""}
      </button>
      <button type="button" data-action="toggle-fav" data-id="${c.id}" aria-pressed="${fav}" aria-label="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}" class="absolute right-2.5 top-2.5 grid size-10 place-items-center rounded-full bg-on-brand/90 md:size-8 text-night/70 shadow-control backdrop-blur-sm transition-colors hover:text-danger-solid aria-pressed:text-danger-solid ${FOCUS}">${icon("heart", "size-4", fav)}</button>
    </div>
    <div class="flex flex-1 flex-col gap-3 px-2 pb-1 pt-3">
      <div class="min-w-0"><p class="truncate text-xs text-fg-subtle">${esc(c.brand)} · ${esc(c.category)}</p><h3 class="mt-0.5 font-sans text-[15px] font-semibold leading-snug text-fg">${esc(c.title)}</h3></div>
      <dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-small">
        <dt class="text-fg-subtle">Payé dès</dt><dd class="text-right font-medium tabular-nums text-fg">${plural(clThresholdViews(c), "vue", "vues")}</dd>
        <dt class="text-fg-subtle">Plafond par clip</dt><dd class="text-right font-medium tabular-nums text-fg">${da(c.maxPayout)}</dd>
        ${joined ? `<dt class="text-fg-subtle">Vos gains</dt><dd class="text-right font-medium">${money(clMyEarnings(c), { signed: true })}</dd>` : ""}
      </dl>
      ${progress(c.spent, c.budget)}
      <div class="mt-auto pt-1">${joined
        ? `<button type="button" data-action="submit-clip" data-id="${c.id}" class="${btn("secondary", "sm", "w-full")}">${icon("plus")}Soumettre un clip</button>`
        : `<button type="button" data-action="join" data-id="${c.id}" class="${btn("soft", "sm", "w-full")}">Rejoindre</button>`}</div>
    </div>
  </article>`;
}

// Vue liste des campagnes (§4.5) : une ligne de tableau (≥ md) et un élément de liste (< md).
function clCampaignAction(c, size = "sm") {
  return me().joinedCampaigns.has(c.id)
    ? `<button type="button" data-action="submit-clip" data-id="${c.id}" class="${btn("secondary", size)}">${icon("plus")}Soumettre</button>`
    : `<button type="button" data-action="join" data-id="${c.id}" class="${btn("soft", size)}">Rejoindre</button>`;
}
function clFavButton(c, size = "sm") {
  const fav = me().favorites.has(c.id);
  return `<button type="button" data-action="toggle-fav" data-id="${c.id}" aria-pressed="${fav}" aria-label="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}" class="${iconBtn(size, false, "aria-pressed:text-danger-solid")}">${icon("heart", "", fav)}</button>`;
}
function campaignRow(c) {
  return `<tr class="${TBL.tr}">
    <td class="${TBL.td}"><button type="button" data-action="open-campaign" data-id="${c.id}" class="flex min-w-0 items-center gap-3 rounded-tile text-left ${FOCUS}" aria-label="Voir la campagne ${esc(c.title)}">${coverThumb(c, "sm")}
      <span class="min-w-0"><span class="block max-w-72 truncate font-medium text-fg">${esc(c.title)}</span><span class="${TBL.tdSub} truncate">${esc(c.brand)} · ${esc(c.category)}</span></span></button></td>
    <td class="${TBL.td} ${TBL.tdNum}">${money(c.rate)}</td>
    <td class="${TBL.td} ${TBL.tdNum}">${money(c.maxPayout)}</td>
    <td class="${TBL.td} ${TBL.tdNum}">${fmt(c.clippers)}</td>
    <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-1.5">${clFavButton(c)}${clCampaignAction(c)}</div></td>
  </tr>`;
}
function clCampaignItem(c) {
  return `<li class="${TBL.item}">
    <div class="flex items-start gap-3"><button type="button" data-action="open-campaign" data-id="${c.id}" class="flex min-w-0 flex-1 items-start gap-3 rounded-tile text-left ${FOCUS}" aria-label="Voir la campagne ${esc(c.title)}">${coverThumb(c, "sm")}
      <span class="min-w-0"><span class="block truncate text-sm font-medium text-fg">${esc(c.title)}</span><span class="block truncate text-xs text-fg-subtle">${esc(c.brand)} · ${esc(c.category)} · ${plural(c.clippers, "clipper", "clippers")}</span></span></button>${clFavButton(c, "md")}</div>
    <div class="flex items-center justify-between gap-3"><span class="text-small font-medium tabular-nums text-fg">${rateShort(c.rate)}</span>${clCampaignAction(c, "md")}</div>
  </li>`;
}

// Tableau des clips (§4.5), partagé avec l'agence (amountLabel « Coût ») et l'admin (actions : colonne Décision, §6.4).
function publicationsTable(list, { showUser = false, actions = false, amountLabel = actions ? "Gain estimé" : "Gains" } = {}) {
  if (!list.length) return emptyState("film", "Aucun clip pour le moment", "Les clips soumis apparaîtront ici.");
  const dash = `<span class="font-normal text-fg-subtle">—</span>`;
  const rows = list.map((p) => {
    const c = campaignById(p.campaign), owner = userById(p.userId), pending = p.status === "En attente", under = pending && belowMin(p);
    const share = under ? clThresholdPct(p) : 0;
    const thresholdBar = (w) => `<span class="block ${w}">${progress(p.views, clThresholdViews(c), { label: false, aria: "Progression vers le seuil" })}</span>`;
    // La cellule Clip prend la place restante (w-full max-w-0) : seul le texte trop long est tronqué.
    const title = p.url
      ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="block truncate font-medium text-fg underline-offset-2 hover:underline ${FOCUS}">${esc(p.title)}</a>`
      : `<span class="block truncate font-medium text-fg">${esc(p.title)}</span>`;
    const reason = p.status === "Refusée" && p.reason ? `<span class="mt-0.5 block truncate text-xs text-danger-fg">Motif${NB}: ${esc(p.reason)}</span>` : "";
    const capped = p.status === "Validée" && isCapped(p) ? `<span class="mt-0.5 flex items-center justify-end gap-1 text-xs font-medium text-warning-fg">${icon("info", "size-3.5 shrink-0")}Plafond atteint</span>` : "";
    // Montant : réel si validé ; estimé pour la modération ; « — » sinon (jamais « 0 DA » pour un gain non calculé).
    const amount = p.status === "Validée" ? `${money(earningsOf(p))}${capped}`
      : actions && pending && !under ? `${money(payoutOf(p))}<span class="${TBL.tdSub} font-normal">estimé</span>`
      : under && !actions ? `${dash}<span class="mt-0.5 block text-xs font-normal text-fg-subtle">${pct(share)} du seuil</span><span class="mt-1 flex justify-end">${thresholdBar("w-20")}</span>`
      : dash;
    const amountMobile = p.status === "Validée" ? money(earningsOf(p)) : actions && pending && !under ? `<span class="text-fg-subtle">estimé</span> ${money(payoutOf(p))}` : under ? `<span class="text-xs text-fg-subtle">${pct(share)} du seuil</span>` : dash;
    const eye = (size) => `<button type="button" data-action="adm-views" data-id="${p.id}" class="${iconBtn(size, true)}" aria-label="Relever les vues de « ${esc(p.title)} »" title="Relever les vues">${icon("eye")}</button>`;
    const threshold = (cls) => `<span class="${cls}"><span class="text-xs font-medium text-warning-fg">Seuil${NB}: ${pct(share)}</span>${thresholdBar("w-full")}</span>`;
    // Clip déjà traité : l'emplacement du bouton « Relever les vues » est toujours réservé (badges alignés à droite).
    const decision = !actions ? "" : pending
      ? `<div class="flex items-center justify-end gap-2">${eye("sm")}<button type="button" data-action="adm-reject" data-id="${p.id}" class="${btn("dangerSoft", "sm")}">Refuser</button>${under ? threshold("inline-grid w-[4.125rem] gap-1 whitespace-nowrap text-left") : `<button type="button" data-action="adm-validate" data-id="${p.id}" class="${btn("primary", "sm")}">Valider</button>`}</div>`
      : `<div class="flex items-center justify-end gap-2">${statusBadge(p.status)}${p.status === "Validée" ? eye("sm") : `<span class="size-10 shrink-0 md:size-8" aria-hidden="true"></span>`}</div>`;
    // Liste (sous 1 440 px chez l'admin) : boutons md en grille sur téléphone, alignés à droite dès sm (comme Campagnes et Paiements).
    const decisionMobile = !actions ? "" : pending
      ? `<div class="grid grid-cols-[auto_1fr_1fr] gap-2 sm:flex sm:justify-end">${eye("lg")}<button type="button" data-action="adm-reject" data-id="${p.id}" class="${btn("dangerSoft", "md")}">Refuser</button>${under ? threshold("grid content-center gap-1 rounded-control border border-line px-3 sm:w-40") : `<button type="button" data-action="adm-validate" data-id="${p.id}" class="${btn("primary", "md")}">Valider</button>`}</div>`
      : p.status === "Validée" ? `<div class="flex justify-end"><button type="button" data-action="adm-views" data-id="${p.id}" class="${btn("secondary", "md")}">${icon("eye")}Relever les vues</button></div>` : "";
    const sub = `${esc(c.title)} · ${date(p.date)}`;
    // Sous-ligne du tableau : seule la campagne se tronque ; la plateforme (colonne masquée sous xl) devient un pictogramme.
    const subCell = `<span class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-subtle"><span class="truncate">${esc(c.title)}</span><span class="shrink-0 whitespace-nowrap">· ${date(p.date)}</span><span class="inline-flex shrink-0 items-center gap-1 xl:hidden" title="${esc(p.platform)}">·${icon(PLATFORM_ICON[p.platform] || "film", "size-3.5")}<span class="sr-only">${esc(p.platform)}</span></span></span>`;
    return {
      tr: `<tr data-row="${p.id}" class="${TBL.tr}">
        <td class="${TBL.td} w-full max-w-0"><div class="flex min-w-0 items-center gap-3">${coverThumb(c, "sm")}<div class="min-w-0 flex-1">${title}${subCell}${reason}</div></div></td>
        ${showUser ? `<td class="${TBL.td}">${owner ? `<div class="flex items-center gap-2">${avatar(owner, "xs")}<span class="max-w-40 truncate text-small text-fg">${esc(owner.name)}</span></div>` : dash}</td>` : ""}
        <td class="${TBL.td} hidden xl:table-cell">${platformTag(p.platform)}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${fmt(p.views)}${actions ? `<span class="${TBL.tdSub} font-normal">seuil ${fmt(clThresholdViews(c))}</span>` : ""}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${amount}</td>
        ${actions ? `<td class="${TBL.td} ${TBL.tdActions}">${decision}</td>` : `<td class="${TBL.td}">${statusBadge(p.status)}</td>`}
      </tr>`,
      li: `<li data-row="${p.id}" class="${TBL.item}">
        <div class="flex items-start gap-3">${coverThumb(c, "sm")}<div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="underline-offset-2 hover:underline">${esc(p.title)}</a>` : esc(p.title)}</p>
          <p class="truncate text-xs text-fg-subtle">${showUser && owner ? `${esc(owner.name)} · ` : ""}${sub}</p>${reason}</div>${actions && pending ? "" : statusBadge(p.status)}</div>
        <div class="flex items-center justify-between gap-3 text-small"><span class="min-w-0 truncate text-fg-subtle">${plural(p.views, "vue", "vues")} · ${esc(p.platform)}</span><span class="shrink-0 font-medium">${amountMobile}</span></div>
        ${under && !actions ? thresholdBar("w-full") : ""}${decisionMobile}
      </li>`,
    };
  });
  return `<div class="${TBL.wrap}">
    <table class="${TBL.table}">
      <thead><tr class="${TBL.headRow}"><th scope="col" class="${TBL.th}">Clip</th>${showUser ? `<th scope="col" class="${TBL.th}">Clippeur</th>` : ""}<th scope="col" class="${TBL.th} hidden xl:table-cell">Plateforme</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Vues</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${esc(amountLabel)}</th>${actions ? `<th scope="col" class="${TBL.th} ${TBL.thNum}">Décision</th>` : `<th scope="col" class="${TBL.th}">Statut</th>`}</tr></thead>
      <tbody>${rows.map((r) => r.tr).join("")}</tbody>
    </table>
    <ul class="${TBL.list}">${rows.map((r) => r.li).join("")}</ul>
  </div>`;
}

// ---------- Vues ----------

function cAccueil() {
  const u = me(), pubs = myPubs(), series = dailySeries();
  const count = (s) => pubs.filter((p) => p.status === s).length, validated = count("Validée");
  const totalViews = clSum(pubs.map((p) => p.views)), periodGain = clSum(series), activeDays = series.filter((v) => v > 0).length;
  // Variation contre la période précédente (seulement sur 7 jours : la série du serveur couvre 30 jours).
  const prev = state.period === 7 && db.series.daily.length >= 14 ? clSum(db.series.daily.slice(-14, -7)) : 0;
  const change = prev ? ((periodGain - prev) / prev) * 100 : null;
  const recommended = activeCampaigns().filter((c) => !u.joinedCampaigns.has(c.id)).slice(0, 3);

  // Motivation : le clip en attente le plus proche du seuil (un seul, des faits, aucun emoji).
  const near = pubs.filter((p) => p.status === "En attente" && belowMin(p))
    .map((p) => ({ p, c: campaignById(p.campaign), left: clThresholdViews(campaignById(p.campaign)) - p.views }))
    .sort((a, b) => a.left - b.left)[0];

  const onboarding = !u.joinedCampaigns.size
    ? `<section class="mt-6 rounded-card border border-brand-line bg-brand-soft p-5 sm:p-6">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0"><h2 class="text-section text-fg">Prêt pour votre premier clip${NB}?</h2>
            <ol class="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-6">${["Rejoignez une campagne", "Publiez votre clip", "Soumettez le lien pour validation"].map((s, i) =>
              `<li class="flex items-center gap-2.5 text-small text-fg-muted"><span class="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-on-brand">${i + 1}</span>${s}</li>`).join("")}</ol></div>
          <a href="#/clipper/campagnes" class="${btn("primary")}">Voir les campagnes</a></div></section>`
    : "";

  const ops = myTx().slice(0, 4);
  const opsCard = card(`${cardHeader("Dernières opérations", "", ops.length ? clLink("#/clipper/portefeuille", "Tout voir") : "")}
    ${ops.length ? `<ul class="mt-1 divide-y divide-line">${ops.map(txRow).join("")}</ul>`
      : emptyState("wallet", "Aucune opération", "Vos gains validés et vos retraits apparaîtront ici.", "", { inCard: true })}`, "p-5");

  const kpis = [
    kpi({ label: "Gains de la période", value: bigMoney(periodGain), delta: change === null ? "" : `${change >= 0 ? "+" : MINUS}${pct(Math.abs(change))}`, deltaTone: change === null ? "flat" : change > 0 ? "up" : change < 0 ? "down" : "flat", sub: change === null ? `${state.period} derniers jours` : "vs 7 jours précédents" }),
    kpi({ label: "Vues totales", value: kpiValue(compact(totalViews)), sub: "Tous clips confondus" }),
    kpi({ label: "Clips publiés", value: kpiValue(fmt(pubs.length)), sub: `${plural(validated, "validé", "validés")} · ${fmt(count("En attente"))} en attente` }),
    kpi({ label: "Taux de validation", value: kpiValue(pubs.length ? pct((validated / pubs.length) * 100) : "—"), sub: `Objectif 80${NB}%` }),
  ];

  const chart = card(`<header class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0"><h2 class="text-section text-fg">Gains par jour</h2><p class="mt-0.5 text-small text-fg-subtle">Sur ${state.period} jours · ${plural(activeDays, "jour actif", "jours actifs")}</p></div>
      ${clPeriodSeg()}</header>
    ${periodGain ? `<div class="mt-5">${barChart(series, { tone: "income", caption: `Gains par jour sur ${state.period} jours` })}</div>`
      : emptyState("chart", "Pas encore de gains sur cette période", "Vos gains apparaîtront ici après votre premier clip validé.", "", { inCard: true })}`, "p-5");

  return `${pageHeader(`Bonjour ${clFirst(u)}`, `Voici votre activité au ${date(clToday())}`, `<span class="lg:hidden"><button type="button" data-action="submit-clip" class="${btn("primary")}">${icon("plus")}Soumettre un clip</button></span>`)}
    ${onboarding}
    <div class="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:gap-5">${clWalletCard({ curve: true })}${opsCard}</div>
    ${near ? `<div class="mt-4">${alertBox("info", `Plus que <strong class="font-semibold">${plural(near.left, "vue", "vues")}</strong> sur «${NB}${esc(near.c.title)}${NB}» pour être payé.`)}</div>` : ""}
    <div class="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-5 xl:grid-cols-4">${kpis.join("")}</div>
    <div class="mt-4 lg:mt-5">${chart}</div>
    ${recommended.length ? `${sectionHeader("Campagnes recommandées", "#/clipper/campagnes")}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${recommended.map(campaignCard).join("")}</div>` : ""}
    ${sectionHeader("Dernières publications", pubs.length ? "#/clipper/publications" : "")}
    ${pubs.length ? publicationsTable(pubs.slice(0, 4))
      : emptyState("film", "Aucun clip soumis", "Rejoignez une campagne, publiez votre clip puis soumettez son lien.", `<a href="#/clipper/campagnes" class="${btn("secondary")}">Voir les campagnes</a>`)}`;
}

function cCampagnes() {
  const f = state.camp, q = f.q.trim().toLowerCase(), u = me();
  let list = activeCampaigns().filter((c) =>
    (f.category === "Toutes" || c.category === f.category) &&
    (!f.favOnly || u.favorites.has(c.id)) &&
    (!q || `${c.title} ${c.brand}`.toLowerCase().includes(q)));
  const sorters = { recent: (a, b) => b.createdAt.localeCompare(a.createdAt), rate: (a, b) => b.rate - a.rate, popular: (a, b) => b.clippers - a.clippers };
  list = list.slice().sort(sorters[f.sort]);
  const favCount = `<span class="tabular-nums opacity-80">${fmt(u.favorites.size)}</span>`;
  const layoutBtn = (v, ic, label) => `<button type="button" data-action="layout" data-value="${v}" aria-label="${label}" aria-pressed="${f.layout === v}" class="grid size-8 place-items-center rounded-lg text-fg-muted transition-colors duration-150 hover:text-fg aria-pressed:bg-surface-raised aria-pressed:text-fg aria-pressed:shadow-control [&_svg]:size-4 ${FOCUS}">${icon(ic)}</button>`;

  // Desktop : une ligne. Mobile : recherche + tri, puis une rangée de puces défilante (favoris, catégories).
  const toolbar = `<div class="mt-6 flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
      ${searchInput("camp-q", f.q, "Rechercher", "Rechercher une campagne ou une marque", "min-w-0 flex-1 md:max-w-sm")}
      <span class="hidden md:ml-auto md:block">${select("camp-category", f.category, [["Toutes", "Toutes les catégories"], ...CATEGORIES.map((c) => [c, c])], { label: "Catégorie" })}</span>
      ${select("camp-sort", f.sort, [["recent", "Plus récentes"], ["rate", "Mieux payées"], ["popular", "Plus populaires"]], { label: "Trier les campagnes", cls: "w-40 shrink-0 md:w-auto" })}
      <span class="hidden md:block"><button type="button" data-action="fav-only" aria-pressed="${f.favOnly}" class="${btn("secondary", "md", "aria-pressed:border-brand-line aria-pressed:bg-brand-soft aria-pressed:text-brand-fg")}">${icon("heart", "", f.favOnly)}Favoris${favCount}</button></span>
      <span class="hidden md:block"><span class="inline-flex items-center gap-0.5 rounded-control border border-line bg-subtle p-0.5" role="group" aria-label="Affichage">${layoutBtn("grid", "grid", "Affichage en grille")}${layoutBtn("list", "list", "Affichage en liste")}</span></span>
      <div class="-mx-4 flex basis-full gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden" role="group" aria-label="Filtrer les campagnes">
        <button type="button" data-action="fav-only" aria-pressed="${f.favOnly}" class="${CL_CHIP}">${icon("heart", "", f.favOnly)}Favoris${favCount}</button>
        <span class="my-1.5 w-px shrink-0 bg-line" aria-hidden="true"></span>
        ${[["Toutes", "Toutes"], ...CATEGORIES.map((c) => [c, c])].map(([v, l]) => `<button type="button" data-action="camp-cat" data-value="${v}" aria-pressed="${f.category === v}" class="${CL_CHIP}">${l}</button>`).join("")}
      </div>
    </div>`;

  const results = list.length === 0
    ? emptyState("search", "Aucune campagne ne correspond", "Essayez une autre catégorie ou effacez la recherche.", `<button type="button" data-action="reset-filters" class="${btn("secondary")}">Effacer les filtres</button>`)
    : f.layout === "list"
      // 5 colonnes (environ 760 px) : le tableau à partir de xl, la liste en dessous (jamais de colonne rognée).
      ? `<div class="${TBL.wrap}"><table class="${TBL.table.replace("md:table", "xl:table")}">
          <thead><tr class="${TBL.headRow}"><th scope="col" class="${TBL.th}">Campagne</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Tarif / 1${NB}000 vues</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Plafond par clip</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Clippers</th><th scope="col" class="${TBL.th} ${TBL.thNum}"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>${list.map(campaignRow).join("")}</tbody></table>
          <ul class="${TBL.list.replace("md:hidden", "xl:hidden")}">${list.map(clCampaignItem).join("")}</ul></div>`
      : `<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">${list.map(campaignCard).join("")}</div>`;

  return `${pageHeader("Campagnes", `${plural(activeCampaigns().length, "campagne active", "campagnes actives")} · tarif pour 1${NB}000 vues validées`)}
    ${toolbar}
    <p class="mb-3 mt-4 text-small text-fg-subtle" aria-live="polite">${plural(list.length, "résultat", "résultats")}</p>
    ${results}`;
}

function cPublications() {
  const pubs = myPubs(), list = pubs.filter((p) => state.pub.status === "Toutes" || p.status === state.pub.status);
  const count = (s) => pubs.filter((p) => p.status === s).length;
  const empty = { Validée: "Aucun clip validé", "En attente": "Aucun clip en attente", Refusée: "Aucun clip refusé" }[state.pub.status];
  return `${pageHeader("Mes publications", "Suivez la validation et les gains de chacun de vos clips.", `<span class="lg:hidden"><button type="button" data-action="submit-clip" class="${btn("primary")}">${icon("plus")}Soumettre un clip</button></span>`)}
    ${pubs.length ? `<div class="mt-6">${segmented("pub-status", state.pub.status, [["Toutes", "Toutes", pubs.length], ["Validée", "Validées", count("Validée")], ["En attente", "En attente", count("En attente")], ["Refusée", "Refusées", count("Refusée")]], "Statut", { scroll: true })}</div>
    <div class="mt-4">${list.length ? publicationsTable(list)
      : emptyState("film", empty, "Les clips de ce statut apparaîtront ici.", `<button type="button" data-action="pub-status" data-value="Toutes" class="${btn("secondary")}">Voir tous les clips</button>`)}</div>`
    : `<div class="mt-6">${emptyState("film", "Aucun clip soumis", "Rejoignez une campagne, publiez votre clip puis soumettez son lien pour validation.", `<a href="#/clipper/campagnes" class="${btn("primary")}">Voir les campagnes</a>`)}</div>`}`;
}

function cPortefeuille() {
  const u = me(), all = myTx();
  const list = all.filter((t) => state.tx.type === "tous" || t.type === state.tx.type);
  // Historique regroupé par mois (la liste arrive triée du plus récent au plus ancien).
  const groups = [];
  for (const t of list) {
    const key = t.date.slice(0, 7), last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(t); else groups.push({ key, items: [t] });
  }
  const typeSeg = segmented("tx-type", { tous: "Tous", gain: "Gains", retrait: "Retraits" }[state.tx.type], ["Tous", "Gains", "Retraits"], "Type d'opération");
  const method = u.payoutMethod;
  const payoutCard = card(`${cardHeader("Moyen de retrait")}
    <div class="mt-4 flex items-center gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-tile bg-subtle text-fg-muted">${icon(method ? CL_PAYOUT_ICON[method] || "bank" : "wallet", "size-5")}</span>
      <div class="min-w-0 flex-1">${method
        ? `<p class="truncate text-sm font-medium text-fg">${esc(method)}</p><p class="truncate font-mono text-small text-fg-subtle">${maskAccount(u.payoutAccount)}</p>`
        : `<p class="text-sm font-medium text-fg">Aucun moyen de retrait</p><p class="text-small text-fg-subtle">Ajoutez un compte pour être payé.</p>`}</div>
      <a href="#/clipper/parametres" class="${btn("link", "", "shrink-0 text-small")}">${method ? "Modifier" : "Ajouter"}</a>
    </div>`, "p-5");
  const history = card(`${cardHeader("Historique", "", typeSeg)}
    ${list.length ? `<div class="mt-4 grid gap-5">${groups.map((g) => {
      const [y, m] = g.key.split("-");
      return `<section aria-label="${CL_MONTHS_LONG[+m - 1]} ${y}"><h3 class="font-sans text-micro font-medium uppercase tracking-[0.08em] text-fg-subtle">${CL_MONTHS_LONG[+m - 1]} ${y}</h3>
        <ul class="mt-1 divide-y divide-line">${g.items.map(txRow).join("")}</ul></section>`;
    }).join("")}</div>`
      : emptyState("wallet", all.length ? "Aucune opération de ce type" : "Aucune opération pour le moment", "Vos gains validés et vos retraits apparaîtront ici.", "", { inCard: true })}`, "p-5");
  return `${pageHeader("Portefeuille", "Vos gains, versements et retraits.")}
    <div class="mt-6 grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-5">
      <div class="grid content-start gap-4 lg:gap-5">${clWalletCard()}${payoutCard}</div>
      ${history}
    </div>`;
}

function cStatistiques() {
  const pubs = myPubs();
  if (!pubs.length) {
    return `${pageHeader("Statistiques", "Comprenez ce qui fait performer vos clips.")}
      <div class="mt-6">${emptyState("chart", "Pas encore de données", "Soumettez votre premier clip pour voir vos statistiques.", `<a href="#/clipper/campagnes" class="${btn("primary")}">Voir les campagnes</a>`)}</div>`;
  }
  const series = dailySeries(), periodGain = clSum(series), activeDays = series.filter((v) => v > 0).length;
  const valid = pubs.filter((p) => p.status === "Validée"), validViews = clSum(valid.map((p) => p.views));
  const rpm = validViews ? Math.round((clSum(valid.map(earningsOf)) / validViews) * 1000) : 0;
  const mode = state.clChart === "cumul" ? "cumul" : "jour";
  const byPlatform = ["TikTok", "Instagram", "YouTube"].map((pl) => {
    const v = clSum(pubs.filter((p) => p.platform === pl).map((p) => p.views));
    return { label: platformTag(pl), value: v, display: fmt(v) };
  });
  const byCampaign = db.campaigns.map((c) => ({ c, earn: clSum(pubs.filter((p) => p.campaign === c.id).map(earningsOf)) })).filter((x) => x.earn > 0)
    .map((x) => ({ label: `${coverThumb(x.c, "xs")}<span class="truncate">${esc(x.c.title)}</span>`, value: x.earn, display: money(x.earn) }));
  const top = pubs.slice().sort((a, b) => b.views - a.views).slice(0, 3);
  const dates = seriesDates(series.length);

  const cumul = `<div class="pt-7">${cumulativeChart(series, { h: "h-44", label: `Gains cumulés sur ${state.period} jours` })}</div>
    <div class="mt-2 flex justify-between text-micro tabular-nums text-fg-subtle" aria-hidden="true"><span>${dayLabel(dates[0])}</span><span>${dayLabel(dates[Math.floor((dates.length - 1) / 2)])}</span><span>Auj.</span></div>`;
  const chart = card(`<header class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0"><h2 class="text-section text-fg">${mode === "cumul" ? "Gains cumulés" : "Gains par jour"}</h2><p class="mt-0.5 text-small text-fg-subtle">Sur ${state.period} jours · ${plural(activeDays, "jour actif", "jours actifs")}</p></div>
      ${segmented("cl-chart", mode, [["jour", "Par jour"], ["cumul", "Cumulé"]], "Forme du graphique")}</header>
    ${periodGain ? `<div class="mt-5">${mode === "cumul" ? cumul : barChart(series, { tone: "income", h: "h-44", caption: `Gains par jour sur ${state.period} jours` })}</div>`
      : emptyState("chart", "Aucun gain sur cette période", "Choisissez une période plus longue ou attendez la validation de vos clips.", "", { inCard: true })}`, "p-5");

  const topTable = `<div class="${TBL.wrap}">
    <table class="${TBL.table}">
      <thead><tr class="${TBL.headRow}"><th scope="col" class="${TBL.th} w-12">Rang</th><th scope="col" class="${TBL.th}">Clip</th><th scope="col" class="${TBL.th} hidden xl:table-cell">Plateforme</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Vues</th><th scope="col" class="${TBL.th} ${TBL.thNum}">Gains</th></tr></thead>
      <tbody>${top.map((p, i) => { const c = campaignById(p.campaign); return `<tr class="${TBL.tr}">
        <td class="${TBL.td}"><span class="text-small font-medium tabular-nums text-fg-subtle">${i + 1}</span></td>
        <td class="${TBL.td}"><div class="flex min-w-0 items-center gap-3">${coverThumb(c, "sm")}<div class="min-w-0"><span class="block max-w-72 truncate font-medium text-fg">${esc(p.title)}</span><span class="${TBL.tdSub} truncate">${esc(c.title)}<span class="xl:hidden"> · ${esc(p.platform)}</span></span></div></div></td>
        <td class="${TBL.td} hidden xl:table-cell">${platformTag(p.platform)}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${fmt(p.views)}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${p.status === "Validée" ? money(earningsOf(p)) : `<span class="font-normal text-fg-subtle">—</span>`}</td></tr>`; }).join("")}</tbody>
    </table>
    <ul class="${TBL.list}">${top.map((p, i) => { const c = campaignById(p.campaign); return `<li class="${TBL.item}">
      <div class="flex items-center gap-3"><span class="w-4 shrink-0 text-small font-medium tabular-nums text-fg-subtle">${i + 1}</span>${coverThumb(c, "sm")}<div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(p.title)}</p><p class="truncate text-xs text-fg-subtle">${plural(p.views, "vue", "vues")} · ${esc(p.platform)}</p></div>
        <span class="shrink-0 text-small font-medium">${p.status === "Validée" ? money(earningsOf(p)) : `<span class="text-fg-subtle">—</span>`}</span></div></li>`; }).join("")}</ul>
  </div>`;

  return `${pageHeader("Statistiques", "Comprenez ce qui fait performer vos clips.", clPeriodSeg())}
    <div class="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5">
      ${kpi({ label: "Gains de la période", value: bigMoney(periodGain), sub: `${state.period} derniers jours` })}
      ${kpi({ label: "Vues totales", value: kpiValue(compact(clSum(pubs.map((p) => p.views)))), sub: `sur ${plural(pubs.length, "clip", "clips")}` })}
      <div class="col-span-2 grid lg:col-span-1">${kpi({ label: `Revenu pour 1${NB}000 vues`, value: rpm ? bigMoney(rpm) : kpiValue("—"), sub: rpm ? "sur vos clips validés" : "Aucun clip validé" })}</div>
    </div>
    <div class="mt-4 lg:mt-5">${chart}</div>
    <div class="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">
      ${card(`${cardHeader("Vues par plateforme", "Tous clips confondus")}<div class="mt-5">${barList(byPlatform, { tone: "brand", aria: "Vues par plateforme" })}</div>`, "p-5")}
      ${card(`${cardHeader("Gains par campagne", "Gains validés")}${byCampaign.length ? `<div class="mt-5">${barList(byCampaign, { tone: "income", aria: "Gains par campagne" })}</div>`
        : emptyState("wallet", "Aucun gain validé pour l'instant", "", "", { inCard: true })}`, "p-5")}
    </div>
    ${sectionHeader("Vos meilleurs clips")}
    ${topTable}`;
}

function cProfil() {
  const u = me(), h = u.handles || {};
  const at = (v) => esc(String(v || "").replace(/^@+/, ""));
  const handleInput = (name, label, placeholder) => field(label, `<span class="relative block"><span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-fg-subtle" aria-hidden="true">@</span><input name="${name}" maxlength="60" value="${at(h[name])}" placeholder="${placeholder}" autocomplete="off" class="${inputCls} pl-8"/></span>`);
  const form = card(`<form data-form="profile" class="@container">
      <h2 class="text-section text-fg">Informations publiques</h2><p class="mt-0.5 text-small text-fg-muted">Visibles par les marques qui consultent vos clips.</p>
      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        ${field("Nom complet", `<input name="name" required maxlength="80" value="${esc(u.name)}" autocomplete="name" class="${inputCls}"/>`)}
        ${field("Pays", countrySelect("country", u.country))}
        <div class="sm:col-span-2">${field(`Bio ${OPTIONAL}`, `<textarea name="bio" rows="3" maxlength="300" placeholder="Présentez votre style de clips aux marques…" class="${textareaCls}">${esc(u.bio || "")}</textarea>`, "300 caractères maximum.")}</div>
      </div>
      <div class="mt-5 border-t border-line pt-5">
        <h2 class="text-section text-fg">Vos comptes</h2><p class="mt-0.5 text-small text-fg-muted">Les comptes depuis lesquels vous publiez vos clips.</p>
        <div class="mt-5 grid gap-4 @xl:grid-cols-3">${handleInput("tiktok", "TikTok", "votrecompte")}${handleInput("instagram", "Instagram", "votrecompte")}${handleInput("youtube", "YouTube", "votrechaine")}</div>
      </div>
      <div class="mt-6 flex justify-end"><button class="${btn("primary")}">Enregistrer</button></div>
    </form>`);
  const identity = card(`<div class="flex flex-col items-center text-center">${avatar(u, "xl")}
      <p class="mt-4 font-display text-section text-fg">${esc(u.name)}</p>
      <p class="mt-0.5 flex items-center gap-1.5 text-small text-fg-muted">${u.handle ? `${esc(u.handle)} · ` : ""}${esc(u.country)}${u.country === "Algérie" ? flagDz() : ""}</p>
      ${u.level ? `<div class="mt-3">${badge(esc(u.level), "brand", { ic: "medal" })}</div>` : ""}
      ${u.bio ? `<p class="mt-4 text-sm text-fg-muted">${esc(u.bio)}</p>` : ""}
      <p class="mt-4 text-xs text-fg-subtle">Membre depuis le ${date(u.joined)}</p></div>`);
  return `${pageHeader("Profil", "Vos informations publiques et votre compte.")}
    <div class="mt-6 grid items-start gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      ${form}
      <div class="grid gap-4 lg:grid-cols-2 lg:gap-5 xl:grid-cols-1">${identity}${accountCard(u)}</div>
    </div>`;
}

function cParametres() {
  const u = me(), s = db.settings, current = u.payoutMethod || PAYOUT_METHODS[0];
  const rules = [
    ["Seuil de paiement", "Un clip doit atteindre le seuil minimum de sa campagne pour être examiné.", "Selon la campagne"],
    ["Fenêtre de gains", "Un clip validé continue de rapporter pendant cette durée, jusqu'au plafond par clip.", plural(s.earningDays, "jour", "jours")],
    ["Rétention", "Contrôle anti-fraude : chaque gain devient retirable ensuite.", plural(s.holdDays, "jour", "jours")],
    ["Retrait minimum", "", money(s.minWithdraw)],
    ["Retrait standard", "", "Gratuit"],
    ["Retrait instantané", "Traité en priorité.", `${pct(s.instantFeePercent)}, min. ${money(s.instantMinFee)}`],
  ];
  return `${pageHeader("Paramètres", "Votre moyen de retrait et les règles de paiement.")}
    <div class="mt-6 grid items-start gap-4 lg:gap-5 xl:grid-cols-2">
      ${card(`${cardHeader("Moyen de retrait", "Vos gains sont versés sur ce compte, après validation de chaque demande par l'équipe ClipBoost.")}
        <form data-form="payout" class="mt-5 grid gap-5">
          <fieldset><legend class="mb-1.5 text-small font-medium text-fg">Type de compte</legend>
            <div class="grid grid-cols-3 gap-2">${PAYOUT_METHODS.map((m) => `<label class="block min-w-0"><input type="radio" name="payoutMethod" value="${m}" ${current === m ? "checked" : ""} class="peer sr-only"/><span class="${SEG_CHOICE}"><span class="hidden sm:contents">${icon(CL_PAYOUT_ICON[m] || "bank")}</span><span class="truncate">${m === "RIB bancaire" ? `RIB<span class="hidden sm:inline">${NB}bancaire</span>` : m}</span></span></label>`).join("")}</div></fieldset>
          ${field("Numéro de compte", `<input name="payoutAccount" required maxlength="60" value="${esc(u.payoutAccount || "")}" placeholder="RIP, numéro CCP ou RIB" autocomplete="off" spellcheck="false" class="${inputCls} font-mono"/>`, `Vérifiez ce numéro${NB}: les virements sont envoyés tels quels.`)}
          <div class="flex justify-end"><button class="${btn("primary")}">Enregistrer</button></div>
        </form>`)}
      ${card(`${cardHeader("Comment vous êtes payé", "Les règles appliquées à chaque clip et à chaque retrait.")}
        <dl class="mt-3 divide-y divide-line">${rules.map(([t, d, v]) => `<div class="flex items-start justify-between gap-4 py-3.5 last:pb-0">
          <dt class="min-w-0"><span class="block text-sm text-fg-muted">${t}</span>${d ? `<span class="mt-0.5 block text-xs text-fg-subtle">${d}</span>` : ""}</dt>
          <dd class="shrink-0 text-right text-sm font-medium tabular-nums text-fg">${v}</dd></div>`).join("")}</dl>`)}
    </div>`;
}

const CLIPPER_VIEWS = { accueil: cAccueil, campagnes: cCampagnes, publications: cPublications, portefeuille: cPortefeuille, statistiques: cStatistiques, profil: cProfil, parametres: cParametres };

// ---------- Récapitulatifs en direct (main.js appelle LIVE[nom] à chaque saisie) ----------
LIVE.withdraw = (d) => {
  const a = Math.max(0, Math.round(+String(d.amount || "").replace(/\D/g, "")) || 0), s = db.settings;
  const fee = d.speed === "instant" ? Math.max(s.instantMinFee, Math.round((a * s.instantFeePercent) / 100)) : 0;
  return {
    "": summary([["Montant demandé", money(a)], ["Frais", fee ? money(fee) : "Aucun"], ["Vous recevrez", money(Math.max(0, a - fee)), true]]),
    btn: a ? `Confirmer le retrait de ${da(a)}` : "Confirmer le retrait",
  };
};
// Soumission d'un clip : plateformes acceptées par la campagne choisie.
LIVE.clip = (d) => {
  const c = campaignById(d.campaign);
  if (!c) return { platforms: "" };
  const list = c.platforms.join(", ").replace(/, ([^,]*)$/, " et $1");
  return {
    platforms: c.platforms.includes(d.platform)
      ? `<span class="text-xs text-fg-subtle">Cette campagne accepte ${esc(list)}.</span>`
      : `<span class="flex items-center gap-1 text-xs font-medium text-warning-fg">${icon("alert", "size-3.5 shrink-0")}Cette campagne n'accepte pas ${esc(d.platform)}${NB}: choisissez ${esc(c.platforms.join(" ou "))}.</span>`,
  };
};

// ---------- Modales ----------

function clipperModal() {
  const m = state.modal;
  if (!m) return "";
  const u = me();
  if (m.type === "campaign") {
    const c = campaignById(m.id);
    if (!c) return "";
    // Une campagne en pause ou terminée reste consultable (lien d'une notification) : statut affiché, sans action.
    const joined = u.joinedCampaigns.has(c.id), remaining = Math.max(0, c.budget - c.spent), open = c.status === "Active";
    const tile = (label, value, extra = "", cls = "") => `<div class="${TILE} ${cls}"><p class="text-xs text-fg-subtle">${label}</p><p class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${value}</p>${extra}</div>`;
    return modalShell({
      title: esc(c.title), description: `${esc(c.brand)} · ${esc(c.category)} · créée le ${date(c.createdAt)}`, size: "lg",
      body: `<div class="cover relative grid aspect-[16/9] place-items-center overflow-hidden rounded-tile sm:aspect-[5/2]" ${coverAttr(c)}>
          <span class="text-6xl drop-shadow-[0_6px_14px_rgb(0_0_0/0.22)]" aria-hidden="true">${c.emoji}</span>
          ${c.top ? `<span class="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-badge bg-on-brand/90 px-1.5 py-0.5 text-[11px] font-semibold text-night">${icon("star", "size-3", true)}Top campagne</span>` : ""}</div>
        <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          ${tile("Tarif", rate(c.rate))}
          ${tile("Clippers", fmt(c.clippers))}
          ${open
            ? tile("Budget restant", da(remaining), `<div class="mt-2">${progress(c.spent, c.budget, { label: false })}</div>`, "col-span-2 sm:col-span-1")
            : `<div class="${TILE} col-span-2 sm:col-span-1"><p class="text-xs text-fg-subtle">Statut</p><p class="mt-1">${statusBadge(c.status)}</p></div>`}
        </div>
        <div class="mt-4">${open ? alertBox("info", `Vous êtes payé à partir de <strong class="font-semibold">${plural(clThresholdViews(c), "vue", "vues")}</strong> (${da(c.minPayout)}) et jusqu'à <strong class="font-semibold">${plural(viewsFor(c, c.maxPayout), "vue", "vues")}</strong> (${da(c.maxPayout)}) par clip.`)
          : alertBox("warning", c.status === "En pause"
            ? `Cette campagne est <strong class="font-semibold">en pause</strong> : elle n'accepte ni nouveaux clippers ni nouveaux clips pour le moment.`
            : `Cette campagne est <strong class="font-semibold">terminée</strong> : elle n'accepte plus de clippers ni de clips.`)}</div>
        <h3 class="mt-6 text-section text-fg">Règles de la campagne</h3>
        <ul class="mt-2 grid gap-2">${c.rules.map((r) => `<li class="flex gap-2.5 text-sm text-fg-muted">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span>${esc(r)}</span></li>`).join("")}</ul>
        <h3 class="mt-6 text-section text-fg">Plateformes</h3>
        <div class="mt-2 flex flex-wrap gap-2">${c.platforms.map(platformTag).join("")}</div>`,
      footer: `<button type="button" data-action="close-modal" class="${btn(open ? "ghost" : "secondary")}">Fermer</button>${!open ? "" : joined
        ? `<button type="button" data-action="submit-clip" data-id="${c.id}" class="${btn("primary")}">${icon("plus")}Soumettre un clip</button>`
        : `<button type="button" data-action="join" data-id="${c.id}" class="${btn("primary")}">Rejoindre la campagne</button>`}`,
    });
  }
  if (m.type === "submit") {
    const joined = activeCampaigns().filter((c) => u.joinedCampaigns.has(c.id));
    if (!joined.length) {
      return modalShell({
        title: "Soumettre un clip",
        body: emptyState("target", "Aucune campagne rejointe", "Rejoignez d'abord une campagne pour pouvoir soumettre un clip.", "", { inCard: true }),
        footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">Annuler</button><a href="#/clipper/campagnes" data-action="close-modal" class="${btn("primary")}">Voir les campagnes</a>`,
      });
    }
    const v = m.values || {}, e = m.errors || {};
    const campaignId = v.campaign || (joined.some((c) => c.id === m.id) ? m.id : joined[0].id);
    const platform = v.platform || "TikTok";
    const inv = (k) => (e[k] ? ' aria-invalid="true"' : "");
    return modalShell({
      title: "Soumettre un clip", description: "Le clip sera vérifié par l'équipe ClipBoost avant validation.", form: "submit", live: "clip",
      body: `<div class="grid gap-4">
        ${field("Campagne", `<span class="relative block"><select name="campaign" class="${selectCls}">${joined.map((c) => `<option value="${c.id}" ${c.id === campaignId ? "selected" : ""}>${esc(c.title)} · ${rateShort(c.rate)}</option>`).join("")}</select>${CHEVRON}</span>`)}
        ${field("Titre du clip", `<input name="title" maxlength="80" value="${esc(v.title || "")}" placeholder="Ex. Le but de l'année" autocomplete="off" autofocus class="${inputCls}"${inv("title")}/>`, "", e.title)}
        ${field("Lien de la vidéo", `<span class="relative block">${icon("link", "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle")}<input name="url" type="url" inputmode="url" value="${esc(v.url || "")}" placeholder="https://www.tiktok.com/@…" autocomplete="off" class="${inputCls} pl-9"${inv("url")}/></span>`, "", e.url)}
        <fieldset><legend class="mb-1.5 text-small font-medium text-fg">Plateforme</legend>
          <div class="grid grid-cols-3 gap-2">${["TikTok", "Instagram", "YouTube"].map((p) => `<label class="block min-w-0"><input type="radio" name="platform" value="${p}" ${p === platform ? "checked" : ""} class="peer sr-only"/><span class="${SEG_CHOICE}"><span class="hidden sm:contents">${icon(PLATFORM_ICON[p])}</span><span class="truncate">${p}</span></span></label>`).join("")}</div>
          <p class="mt-1.5" data-live-out="platforms" role="status">${LIVE.clip({ campaign: campaignId, platform }).platforms}</p></fieldset>
      </div>`,
      footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">Annuler</button><button class="${btn("primary")}">Envoyer pour validation</button>`,
    });
  }
  if (m.type === "withdraw") {
    const set = db.settings, min = set.minWithdraw, bal = Math.floor(balance());
    const blocked = !u.payoutMethod
      ? alertBox("info", `Ajoutez d'abord le compte sur lequel vous voulez être payé (BaridiMob, CCP ou RIB). <a href="#/clipper/parametres" class="${btn("link")}">Ajouter un moyen de retrait</a>`)
      : bal < min
        ? alertBox("info", `Votre solde disponible (${da(bal)}) est inférieur au minimum de retrait, fixé à <strong class="font-semibold">${da(min)}</strong>.${pendingAmount() ? ` ${da(pendingAmount())} deviendront retirables à la fin de leur période de rétention.` : ""}`)
        : "";
    if (blocked) {
      return modalShell({
        title: "Demander un retrait", description: `Solde disponible${NB}: ${da(bal)}`,
        body: blocked,
        footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">Fermer</button><button type="button" class="${btn("primary")}" disabled>Confirmer le retrait</button>`,
      });
    }
    const amount = m.amount !== undefined ? String(m.amount) : fmt(bal), speed = m.speed === "instant" ? "instant" : "standard";
    const init = LIVE.withdraw({ amount, speed });
    const choice = (value, title, text, right) => `<label class="${CHOICE}"><input type="radio" name="speed" value="${value}" class="${RADIO}" ${speed === value ? "checked" : ""}/><span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${title}</span><span class="block text-xs text-fg-subtle">${text}</span></span><span class="shrink-0 text-right text-small font-medium tabular-nums text-fg">${right}</span></label>`;
    return modalShell({
      title: "Demander un retrait", description: `Solde disponible${NB}: ${da(bal)}`, form: "withdraw", live: "withdraw",
      body: `${field("Montant", `<div class="flex gap-2"><div class="min-w-0 flex-1">${unitInput(`name="amount" value="${esc(amount)}" autocomplete="off" autofocus aria-describedby="wd-hint"${m.error ? ' aria-invalid="true"' : ""}`, "DA", { lg: true })}</div><button type="button" data-action="wd-max" class="${btn("secondary", "lg")}">Tout retirer</button></div>`, `<span id="wd-hint">Minimum ${da(min)} · maximum ${da(bal)}</span>`, m.error ? esc(m.error) : "")}
        <fieldset class="mt-5 grid gap-2"><legend class="mb-1.5 text-small font-medium text-fg">Délai</legend>
          ${choice("standard", "Standard", `Traité sous 48${NB}h ouvrées`, "Gratuit")}
          ${choice("instant", "Instantané", "Traité en priorité", `${pct(set.instantFeePercent)}<span class="block text-xs font-normal text-fg-subtle">min. ${da(set.instantMinFee)}</span>`)}
        </fieldset>
        <div data-live-out>${init[""]}</div>
        <p class="mt-4 flex items-center gap-2 text-small text-fg-muted">${icon(CL_PAYOUT_ICON[u.payoutMethod] || "bank", "size-4 shrink-0 text-fg-subtle")}<span class="min-w-0 truncate">Vers ${esc(u.payoutMethod)} <span class="font-mono">${maskAccount(u.payoutAccount)}</span></span></p>`,
      footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">Annuler</button><button class="${btn("primary")}" data-live-out="btn">${init.btn}</button>`,
    });
  }
  return "";
}

function handleClipperAction(action, t) {
  const u = me(), { id, value } = t.dataset;
  switch (action) {
    case "toggle-fav": {
      const fav = !u.favorites.has(id);
      return act("POST", `/api/campaigns/${id}/membership`, { favorite: fav }, fav ? "Ajoutée aux favoris" : "Retirée des favoris");
    }
    case "join": {
      const c = campaignById(id);
      return act("POST", `/api/campaigns/${id}/membership`, { joined: true }, `Vous avez rejoint «${NB}${c.title}${NB}»`);
    }
    case "open-campaign": state.modal = { type: "campaign", id }; return render();
    case "submit-clip": state.modal = { type: "submit", id }; state.notifOpen = false; state.drawer = false; return render();
    case "withdraw": state.modal = { type: "withdraw" }; return render();
    case "wd-max": {
      const i = root.querySelector('[name="amount"]');
      if (i) { i.value = fmt(Math.floor(balance())); i.dispatchEvent(new Event("input", { bubbles: true })); i.focus(); }
      return;
    }
    case "fav-only": state.camp.favOnly = !state.camp.favOnly; return render();
    case "camp-cat": state.camp.category = value; return render();
    case "layout": state.camp.layout = value; return render();
    case "reset-filters": state.camp = { ...state.camp, q: "", category: "Toutes", favOnly: false }; return render();
    case "pub-status": state.pub.status = value; return render();
    case "tx-type": state.tx.type = { Tous: "tous", Gains: "gain", Retraits: "retrait" }[value]; return render();
    case "period": state.period = parseInt(value, 10); return render();
    case "cl-chart": state.clChart = value; return render();
  }
  return false;
}

// Erreurs de saisie dans une modale : on garde les valeurs, on marque le champ et on y place le focus.
function clModalErrors(patch) {
  state.modal = { ...state.modal, ...patch };
  render();
  const el = root.querySelector('[aria-modal="true"] [aria-invalid="true"]');
  if (el) el.focus();
}

function handleClipperSubmit(form, data) {
  if (form === "submit") {
    const title = String(data.title || "").trim(), url = String(data.url || "").trim(), errors = {};
    if (!title) errors.title = "Donnez un titre à votre clip.";
    if (!url) errors.url = "Collez le lien de la vidéo publiée.";
    else {
      let ok = false;
      try { const x = new URL(url); ok = x.protocol === "https:" && CL_HOSTS[data.platform].test(x.hostname); } catch (e) {}
      if (!ok) errors.url = `Le lien doit être un lien ${esc(data.platform)} (https://…).`;
    }
    if (Object.keys(errors).length) return clModalErrors({ values: data, errors });
    return act("POST", "/api/clips", { campaignId: data.campaign, title: data.title, platform: data.platform, url: data.url }, "Clip envoyé pour validation", () => {
      state.modal = null; state.pub.status = "Toutes";
      navigate("#/clipper/publications");
    });
  }
  if (form === "withdraw") {
    const amount = Math.floor(Number(String(data.amount || "").replace(/\D/g, ""))) || 0, min = db.settings.minWithdraw, bal = Math.floor(balance());
    const error = amount < min ? `Le retrait minimum est de ${da(min)}.` : amount > bal ? `Montant supérieur à votre solde disponible (${da(bal)}).` : "";
    if (error) return clModalErrors({ amount: data.amount, speed: data.speed, error });
    return act("POST", "/api/withdrawals", { amount, instant: data.speed === "instant" }, `Demande de retrait de ${da(amount)} envoyée`, () => { state.modal = null; });
  }
  if (form === "profile") {
    const at = (v) => { const s = String(v || "").trim().replace(/^@+/, ""); return s ? `@${s}` : ""; };
    return act("PATCH", "/api/me", { name: data.name, country: data.country, bio: data.bio, handles: { tiktok: at(data.tiktok), instagram: at(data.instagram), youtube: at(data.youtube) } }, "Profil mis à jour");
  }
  if (form === "payout") {
    return act("PATCH", "/api/me", { payoutMethod: data.payoutMethod, payoutAccount: data.payoutAccount }, "Moyen de retrait enregistré");
  }
}
