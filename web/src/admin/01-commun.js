// Tableau de bord administrateur : pilotage des utilisateurs, campagnes, clips, paiements et réglages du site.
// Chaque action passe par l'API : les effets sont visibles immédiatement par les clippers et les agences.
// Rendu selon docs/design-system.md §6.4 (recettes et helpers de ui.js). Les helpers locaux sont préfixés « adm ».
// Pages hors navigation : fiche d'un utilisateur (#/admin/utilisateur/<id>, ITEM_PAGES dans main.js : « Utilisateurs »
// reste l'entrée courante) et « Mon compte » (#/admin/compte, ouverte par le menu du compte).
// Fiches d'examen (modales) : campagne (adm-camp) et clip (adm-clip), ouvertes sur place depuis chaque liste, ou par les
// adresses #/admin/campagnes/<id> et #/admin/moderation/<id> (liens des notifications, applyRouteItem dans main.js).
// Tout nom d'agence ou de clipper affiché ici mène à sa fiche (admUserLink).
// Langues : chaque texte affiché passe par t() (dictionnaires web/src/i18n/<langue>/admin.js), au moment du rendu. Les
// valeurs envoyées au serveur ou comparées (statuts, rôles, moyens de paiement, catégories, motifs de refus d'un clip)
// restent en français et ne sont traduites qu'à l'affichage ; les textes venus du serveur (journal d'activité, libellés
// des opérations, motifs) passent par tServer(). Mise en page en propriétés logiques (ms/me, start/end) pour l'arabe.
// Découpé en un fichier par partie dans web/src/admin/ (ordre des numéros) ; ce fichier-ci : fichier d'entrée de l'espace, liste de navigation, helpers locaux et liens vers les fiches.

// Libellés en français : main.js les traduit à l'affichage (t(n.label), t(n.short)).
const ADMIN_NAV = [
  { id: "apercu", label: "Vue d'ensemble", short: "Aperçu", icon: "home" },
  { id: "utilisateurs", label: "Utilisateurs", icon: "users" },
  { id: "campagnes", label: "Campagnes", icon: "target" },
  { id: "moderation", label: "Modération des clips", short: "Clips", icon: "shield" },
  { id: "retraits", label: "Paiements", icon: "wallet" },
  { id: "classement", label: "Classement", icon: "trophy" },
  { id: "messages", label: "Messages", icon: "message" },
  { id: "academie", label: "Académie", icon: "academy" },
  { id: "parametres", label: "Réglages du site", short: "Réglages", icon: "gear" },
];

const clippers = () => db.users.filter((u) => u.role === "clipper");
const pendingPubs = () => db.publications.filter((p) => p.status === "En attente");
const pendingWithdrawals = () => db.transactions.filter((tx) => tx.type === "retrait" && tx.status === "En cours");
// Recharges à confirmer : celles annoncées (virement, Visa / Mastercard). Un paiement en ligne en cours (Chargily) se confirme seul.
const admOnlinePay = (tx) => tx.provider === "chargily";
const pendingRecharges = () => db.transactions.filter((tx) => tx.type === "recharge" && tx.status === "En cours" && !admOnlinePay(tx));
// Agences qui attendent une décision sur leur demande de badge de vérification.
const admPendingBadges = () => db.users.filter((u) => u.role === "agence" && u.verification === "pending");
// Recours des clippers (contestation d'un refus), du plus récent au plus ancien ; en attente : à examiner.
const admAppeals = () => db.appeals || [];
const admPendingAppeals = () => admAppeals().filter((a) => a.status === "En attente");
const admAppealOf = (p) => admAppeals().find((a) => a.publicationId === p.id) || null;
const adminBadge = (id) => ({
  moderation: pendingPubs().length + admPendingAppeals().length, retraits: pendingWithdrawals().length + pendingRecharges().length,
  campagnes: db.campaigns.filter((c) => c.status === "En attente").length, utilisateurs: admPendingBadges().length,
}[id] || 0);

// ---------- Helpers locaux ----------
// Attention : t est la fonction de traduction ; une opération (transaction) s'appelle tx dans ce fichier.
const admSum = (list, f) => list.reduce((s, x) => s + (f(x) || 0), 0);
// Net à virer d'un retrait : montant demandé moins les frais (le serveur stocke le retrait en négatif).
const admNet = (tx) => -tx.amount - (tx.fee || 0);
// Montant prélevé sur le crédit de l'agence pour un budget : budget + commission (même règle que fundingCost du serveur).
const admFunding = (budget, rate) => budget + Math.round((budget * (rate || 0)) / 100);
const admDash = `<span class="font-normal text-fg-subtle">—</span>`;
// Montant secondaire (frais) : même rendu que money(), en text-fg-muted.
const admMuted = (n) => money(n).replace("text-fg ", "text-fg-muted ");
// Gain de la plateforme en KPI : grand montant (comme bigMoney), signe « + » et vert, car l'argent entre chez ClipBoost.
// uiSigned garde le signe devant les chiffres en arabe (isolat LTR).
const admIncome = (n) => `<span class="whitespace-nowrap text-income ${BIG.kpi[0]}">${uiSigned(n > 0 ? "+" : "", fmt(n))}<span class="font-medium tracking-normal text-fg-subtle ${BIG.kpi[1]}">${NB}${t("DA")}</span></span>`;
// label (aria-label, title) et msg (toast) : textes déjà traduits, échappés ici.
const admCopyBtn = (value, label, msg) =>
  `<button type="button" data-action="adm-copy" data-value="${esc(value)}" data-msg="${esc(msg)}" class="${iconBtn("sm")}" aria-label="${esc(label)}" title="${esc(label)}">${icon("copy")}</button>`;
// Numéro de compte : groupé par 4 s'il n'a que des chiffres (RIB, BaridiMob), sinon tel quel (CCP « 0021234567 clé 89 »).
const admAccountValue = (raw) => { const a = String(raw || "").trim(); return /^[\d\s]+$/.test(a) ? a.replace(/\s+/g, "") : a.replace(/\s+/g, " "); };
const admAccount = (raw) => { const a = admAccountValue(raw); return /^\d+$/.test(a) ? groupAccount(a) : esc(a); };
// Majuscule initiale d'un texte (moyen de paiement traduit : « virement bancaire » → « Virement bancaire »), échappé.
const admCap = (s) => esc(String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1));
// Moyen de paiement (valeur française du serveur) dans la langue choisie.
const admMethod = (m) => (m ? admCap(t(m)) : "");
const admUser = (id) => userById(id) || { id: String(id), name: t("Compte supprimé"), email: "", role: "clipper", status: "Suspendu" };
// Ligne de filtres : recherche, puis une seule rangée défilante sous lg (jamais plus de 2 rangées avant le contenu).
const admToolbar = (search, filters) => `<div class="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">${search}${filters}</div>`;
const admCountLine = (n, total, one, many) =>
  `<p class="mt-4 text-small tabular-nums text-fg-subtle">${n === total ? plural(n, one, many) : t("{count} sur {total}", { count: plural(n, one, many), total: fmt(total) })}</p>`;
// Saisie numérique « 50 000 » ou « 2,5 » : espaces ignorés, virgule décimale ; vide = NaN.
const admParse = (v) => { const s = String(v ?? "").replace(/[\s  ]/g, "").replace(",", "."); return s === "" ? NaN : Number(s); };
// Champ refusé avant l'envoi : bordure d'erreur (aria-invalid), message sous le champ et focus (pas de toast éphémère).
// Sans message (relevé de vues), l'avertissement déjà affiché dans la modale suffit. msg : texte déjà traduit.
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
// En-tête de la colonne d'actions (fonction : le texte suit la langue choisie à chaque rendu).
const admThActions = () => `<th scope="col" class="${TBL.th} ${TBL.thNum} relative"><span class="sr-only">${t("Actions")}</span></th>`;
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
// Les liens sont reconnus à leur adresse, jamais à leur texte (traduit) ni à l'ordre de leurs attributs : tous les
// attributs sont gardés sauf href ; le titre du clip se tronque dans un span intérieur.
const admDecode = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
const admPubTable = (html, bp = "pub") => html
  .replace(`class="${TBL.wrap}"`, `class="${ADM_WRAP}"`)
  .replace(`class="${TBL.table}"`, `class="${ADM_BP[bp][0]}"`)
  .replace(`class="${TBL.list}"`, `class="${ADM_BP[bp][1]}"`)
  .replace(/<a\s([^>]*?)\bhref="#\/admin\/(moderation|campagnes)\/([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (_, pre, kind, id, post, inner) => {
    const attrs = `${pre} ${post}`, cls = (/\bclass="([^"]*)"/.exec(attrs) || ["", ""])[1];
    const rest = attrs.replace(/\bclass="[^"]*"/, "").replace(/\s+/g, " ").trim(), clip = kind === "moderation";
    return `<button type="button" data-action="${clip ? "adm-clip" : "adm-camp"}" data-id="${esc(admDecode(id))}" class="${clip ? `max-w-full text-start ${cls.replace(/(^|\s)truncate(?=\s|$)/, " ")}` : cls}"${rest ? ` ${rest}` : ""}>${clip ? `<span class="block truncate">${inner}</span>` : inner}</button>`;
  });
const admSectionTitle = (title, extra = "") => `<div class="flex items-center gap-2"><h2 class="text-heading text-fg">${title}</h2>${extra}</div>`;
// Titre d'une ligne qui ouvre une fiche : bouton au rendu de lien (tronqué dans un span intérieur).
const ADM_ROW_LINK = `block min-w-0 max-w-full rounded-sm text-start font-medium text-fg underline-offset-2 hover:underline ${FOCUS}`;

// ---------- Liens vers les fiches (noms, campagnes, clips) ----------
const admUserHref = (u) => `#/admin/utilisateur/${encodeURIComponent(u.id)}`;
// Nom d'une agence ou d'un clipper : lien vers sa fiche, badge bleu compris (nameWithBadge : nom échappé + badge si
// u.verified). Le nom se tronque dans un span intérieur et le badge reste entier ; zone tactile HIT sous md.
// Compte supprimé : texte simple. inModal : dans une fiche, le lien la referme avant d'ouvrir le profil.
function admUserLink(u, cls = "", { inModal = false } = {}) {
  if (!u || !u.id || !userById(u.id)) return `<span class="min-w-0 truncate ${cls}">${esc(u && u.name ? u.name : t("Compte supprimé"))}</span>`;
  return `<a href="${admUserHref(u)}"${inModal ? ' data-action="close-modal"' : ""} title="${esc(t("Voir le profil de {name}", { name: u.name }))}" class="${HIT} inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm underline-offset-2 transition-colors duration-150 hover:underline ${FOCUS} ${cls}"><span class="min-w-0 truncate">${esc(u.name)}</span>${u.verified ? verifiedBadge("size-3.5") : ""}</a>`;
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
// Fiche dont l'élément n'existe plus (campagne annulée par son agence pendant l'examen…). title, text : déjà traduits.
const admGone = (title, text) => modalShell({
  title, body: emptyState("info", title, text, "", { inCard: true }),
  footer: `<button type="button" data-action="close-modal" class="${btn("secondary")}">${t("Fermer")}</button>`,
});
// Carte Visa / Mastercard d'une recharge : marque et 4 derniers chiffres, ajoutés au libellé par l'API (« … · Visa •••• 4242 »).
const admCardOf = (tx) => { const m = /(Visa|Mastercard)\s*•+\s*(\d{4})\s*$/.exec(String(tx.label || "")); return m ? { brand: m[1], last4: m[2] } : null; };
const admCardNumber = (card) => `<span class="whitespace-nowrap font-mono text-xs text-fg-muted" dir="ltr">••••${NB}${card.last4}</span>`;
// « Titre » entre guillemets (description des modales) : guillemets de la langue choisie.
const admQuoted = (title) => t("« {title} »", { title: esc(title) });
