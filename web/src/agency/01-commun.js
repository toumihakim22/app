// Espace Agence : les créateurs de campagnes lancent et suivent leurs campagnes.
// Une nouvelle campagne part « En attente » et n'est visible des clippers qu'après approbation par l'administrateur.
// Tant qu'elle n'est pas approuvée, l'agence peut la modifier ou l'annuler ; refusée (motif de l'équipe : c.reviewNote),
// elle peut la modifier et la relancer (elle repasse « En attente ») ou la supprimer. Rien n'est prélevé avant l'approbation.
// Recettes : docs/design-system.md §4.4 à §4.8, §5 et §6.3. Les helpers propres à ce fichier sont préfixés « ag ».
// Textes : t(« source française ») au moment du rendu (web/src/i18n.js) ; traductions dans web/src/i18n/{en,ar}/agency.js.
// Les valeurs envoyées à l'API ou comparées (statuts, catégories, moyens de paiement) restent en français : seul
// l'affichage est traduit (t(c.category), statusBadge…). Îlots de gauche à droite (dir="ltr") : références, numéro de carte.
// Découpé en un fichier par partie dans web/src/agency/ (ordre des numéros) ; ce fichier-ci : fichier d'entrée de l'espace et helpers locaux.

// Libellés en getters : relus à chaque rendu, ils suivent la langue choisie sans recharger la page.
const AGENCY_NAV = [
  { id: "apercu", get label() { return t("Accueil"); }, get short() { return t("Accueil"); }, icon: "home" },
  { id: "campagnes", get label() { return t("Mes campagnes"); }, get short() { return t("Campagnes"); }, icon: "target" },
  { id: "clips", get label() { return t("Clips reçus"); }, get short() { return t("Clips"); }, icon: "film" },
  { id: "messages", get label() { return t("Messages"); }, icon: "message" },
  { id: "budget", get label() { return t("Budget"); }, icon: "wallet" },
  { id: "profil", get label() { return t("Profil de l'agence"); }, get short() { return t("Profil"); }, icon: "user" },
  { id: "parametres", get label() { return t("Paramètres"); }, icon: "gear" },
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
    "En attente": t("En cours de vérification par l'équipe {brand}. Encore modifiable."),
    "Active": t("Visible par les clippers."),
    "En pause": t("Masquée aux clippers, aucun nouveau clip."),
    "Terminée": t("Campagne archivée."),
    "Refusée": t("Refusée par l'équipe {brand}. Modifiez-la pour la relancer."),
  }[c.status] || "";
}

// ---------- Helpers locaux ----------
// Montant saisi (« 50 000 », « 50000 ») → entier positif, 0 si vide ou invalide.
const agNum = (v) => { const n = Math.floor(+String(v ?? "").replace(/\s/g, "")); return Number.isFinite(n) && n > 0 ? n : 0; };
const agToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const agClosed = (c) => c.status === "Terminée" || c.status === "Refusée";
// Motif cité dans une phrase : un seul point final, même si le motif se termine déjà par un point.
const agSentence = (s) => (/[.!?…]$/.test(s) ? s : `${s}.`);
// Mention « (facultatif) » d'un libellé de champ.
const agOptional = () => `<span class="font-normal text-fg-subtle">${t("(facultatif)")}</span>`;
// Énumération dans la langue choisie : « TikTok, Instagram et YouTube ».
const agList = (arr) => { try { return new Intl.ListFormat(LOCALES[LANG].intl, { type: "conjunction" }).format(arr); } catch (e) { return arr.join(", "); } };
// Référence de paiement : toujours de gauche à droite, même en arabe.
const agRef = (ref) => `<span dir="ltr">${code(ref)}</span>`;
// Recharges annoncées, pas encore confirmées par l'équipe (un paiement en ligne en cours n'est pas encore un paiement).
const agPendingCredit = () => myTx().filter((x) => x.type === "recharge" && x.status === "En cours" && !agOnline(x)).reduce((s, x) => s + x.amount, 0);
// Recharge payée en ligne (carte Edahabia ou CIB, Chargily Pay) : validée par la passerelle, jamais par l'équipe.
const agOnline = (x) => x.provider === "chargily";
const agPendingOnline = () => myTx().filter((x) => x.type === "recharge" && x.status === "En cours" && agOnline(x));
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
const agNewBtn = () => `<button type="button" data-action="ag-new" class="${btn("primary")}">${icon("plus")}${t("Nouvelle campagne")}</button>`;
// Rangée « Nouvelle campagne » qui complète la liste de l'accueil quand elle compte moins de 4 campagnes.
const agNewRow = () => `<li><button type="button" data-action="ag-new" class="flex w-full items-center gap-3 rounded-tile p-2 text-start text-sm font-medium text-fg-muted transition-colors duration-150 hover:bg-subtle hover:text-fg ${FOCUS}"><span class="grid size-10 shrink-0 place-items-center rounded-tile border border-dashed border-line-strong text-fg-subtle" aria-hidden="true">${icon("plus", "size-4")}</span>${t("Nouvelle campagne")}</button></li>`;
const agMoreLink = (href, label = t("Tout voir")) =>
  `<a href="${href}" class="${HIT} inline-flex items-center gap-1 rounded-sm text-small font-medium text-brand-fg underline-offset-4 hover:underline ${FOCUS}">${label}${icon("chevronRight", "size-3.5 rtl:-scale-x-100")}</a>`;
// Pause ou reprise : seules actions de statut ouvertes à l'agence sur une campagne en ligne.
const agToggle = (c, size = "sm", extra = "") =>
  c.status === "Active" ? `<button type="button" data-action="ag-pause" data-id="${c.id}" class="${btn("secondary", size, extra)}">${icon("pause")}${t("Mettre en pause")}</button>`
  : c.status === "En pause" ? `<button type="button" data-action="ag-resume" data-id="${c.id}" class="${btn("secondary", size, extra)}">${icon("play")}${t("Reprendre")}</button>` : "";
// Campagne pas encore en ligne : « Modifier » (en attente) ou « Modifier et relancer » (refusée).
const agEditBtn = (c, size = "sm", extra = "", variant = "secondary") =>
  `<button type="button" data-action="ag-edit" data-id="${c.id}" class="${btn(variant, size, extra)}">${c.status === "Refusée" ? `${icon("refresh")}${t("Modifier et relancer")}` : `${icon("pencil")}${t("Modifier")}`}</button>`;
// Retrait d'une campagne pas encore en ligne : [action, icône, libellé, nom accessible avec le titre].
const agRemoveAction = (c) => (c.status === "Refusée"
  ? ["ag-delete", "trash", t("Supprimer la campagne"), t("Supprimer la campagne « {title} »", { title: esc(c.title) })]
  : ["ag-cancel", "xCircle", t("Annuler la campagne"), t("Annuler la campagne « {title} »", { title: esc(c.title) })]);
// Bouton-icône de retrait (cartes) : même hauteur que btn(…, "sm"), teinte danger comme dangerSoft.
const AG_ICON_DANGER = `inline-grid size-10 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface text-danger-fg shadow-control transition-colors duration-150 hover:border-danger-border hover:bg-danger-bg md:size-8 [&_svg]:size-4 ${FOCUS}`;
// Puce de tarif posée sur une couverture.
const agRateChip = (r) =>
  `<span class="absolute start-2.5 top-2.5 inline-flex items-baseline gap-1 whitespace-nowrap rounded-badge bg-night/80 px-2 py-1 text-small font-semibold tabular-nums text-on-brand backdrop-blur-sm">${fmt(r)}${NB}${t("DA")}<span class="text-[11px] font-medium text-on-brand/80">${t("/ 1k vues")}</span></span>`;
// Pictogrammes des plateformes d'une campagne, dans l'ordre de PLATFORMS (nom accessible : la liste complète).
const agPlatformIcons = (list) => {
  const l = PLATFORMS.filter((p) => (list || []).includes(p));
  return `<span class="inline-flex items-center gap-1.5 text-fg-muted" role="img" aria-label="${esc(t("Plateformes : {list}", { list: agList(l) }))}" title="${esc(l.join(" · "))}">${l.map((p) => icon(PLATFORM_ICON[p] || "film", "size-4 shrink-0")).join("")}</span>`;
};
// Motif du refus d'une campagne (carte) : encadré danger, tronqué à 3 lignes (la fiche le montre en entier).
const agReasonBox = (c) => (c.reviewNote
  ? `<div class="rounded-tile border border-danger-border bg-danger-bg px-3 py-2 text-xs text-danger-fg"><p class="font-medium">${t("Motif du refus")}</p><p class="mt-0.5 line-clamp-3 break-words">${esc(c.reviewNote)}</p></div>`
  : "");
// Montant d'une recharge : vert une fois le crédit reçu, neutre en attente, barré si refusée.
const agRechargeAmount = (x) =>
  x.status === "Validé" ? money(x.amount, { signed: true }) : x.status === "Refusé" ? `<span class="line-through">${money(x.amount)}</span>` : money(x.amount);
// Paiement en ligne en cours : « Paiement en ligne en attente » ; compact (liste mobile) : « En attente » avec l'horloge.
const agRechargeStatus = (x, compact = false) => (x.status === "En cours" && agOnline(x) ? badge(compact ? t("En attente") : t("Paiement en ligne en attente"), "warning", { ic: "clock" })
  : statusBadge(x.status === "En cours" ? "En attente" : x.status));
// Moyen d'une recharge : « Virement bancaire », « Carte CIB »… ; carte internationale : « Carte Visa •••• 4242 »
// (marque et 4 derniers chiffres ajoutés au libellé par l'API). La valeur (français) sert de clé, le libellé est traduit.
const agMethod = (x) => {
  const card = x.method === AG_CARD && /· (Visa|Mastercard) •••• (\d{4})$/.exec(x.label || "");
  if (card) return t("Carte {brand} {number}", { brand: card[1], number: `<span class="whitespace-nowrap" dir="ltr">••••${NB}${card[2]}</span>` });
  const m = x.method || x.label || "", known = AG_METHODS.find(([v]) => v === m);
  return esc(known ? t(known[1]) : t(m.charAt(0).toUpperCase() + m.slice(1)));
};
const agCopyBtn = (ref) =>
  `<button type="button" data-action="ag-copy" data-value="${esc(ref)}" class="${iconBtn("sm")}" aria-label="${t("Copier la référence {ref}", { ref: esc(ref) })}" title="${t("Copier")}">${icon("copy")}</button>`;
// Montants proposés sous un champ (raccourcis) : [[valeur, libellé]] ; celui qui correspond à la saisie est marqué.
const agPresets = (items, current) => items.map(([v, l]) =>
  `<button type="button" data-action="ag-amount" data-value="${v}" aria-pressed="${v === current}" ${l === da(v) ? "" : `title="${da(v)}"`} class="${btn("secondary", "sm", "tabular-nums aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-brand-fg")}">${l}</button>`).join("");
const agPresetRow = (html) => `<div class="flex flex-wrap gap-2" role="group" aria-label="${t("Montants rapides")}" data-live-out="presets">${html}</div>`;
// Raccourcis de l'ajout de budget ; « Tout le crédit » = le plus grand ajout (commission comprise) que le crédit couvre.
function agTopupPresets(c, u) {
  const max = c.status === "En attente" ? 0 : Math.floor(u.credit / (1 + c.commissionRate / 100) / 1000) * 1000;
  return [...[50000, 100000, 200000].map((v) => [v, da(v)]), ...(max >= 1000 ? [[max, t("Tout le crédit")]] : [])];
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
