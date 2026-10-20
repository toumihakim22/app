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

// Libellés en français : main.js les traduit à l'affichage (t(n.label), t(n.short)).
const ADMIN_NAV = [
  { id: "apercu", label: "Vue d'ensemble", short: "Aperçu", icon: "home" },
  { id: "utilisateurs", label: "Utilisateurs", icon: "users" },
  { id: "campagnes", label: "Campagnes", icon: "target" },
  { id: "moderation", label: "Modération des clips", short: "Clips", icon: "shield" },
  { id: "retraits", label: "Paiements", icon: "wallet" },
  { id: "classement", label: "Classement", icon: "trophy" },
  { id: "messages", label: "Messages", icon: "message" },
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

// ---------- Vue d'ensemble ----------

function aApercu() {
  const s = db.settings, users = clippers(), pubs = pendingPubs(), wd = pendingWithdrawals(), rc = pendingRecharges();
  const campPending = db.campaigns.filter((c) => c.status === "En attente").length, badges = admPendingBadges().length;
  const appeals = admPendingAppeals().length;
  const under = pubs.filter(belowMin).length, toPay = admSum(wd, admNet), queue = pubs.length + appeals + campPending + wd.length + rc.length + badges;

  // 1. À traiter : cartes interactives neutres (jamais de rose pour une file normale). Les demandes de badge n'ont leur
  // carte que lorsqu'il y en a. Sous sm : une liste compacte (une ligne par file, compteur en bout de ligne).
  const paySub = [
    wd.length ? t("{amount} à virer", { amount: money(toPay) }) : "",
    rc.length ? t("{count} à confirmer", { count: plural(rc.length, "recharge", "recharges") }) : "",
  ].filter(Boolean).join(" · ");
  const queues = [
    ["moderation", t("Clips à modérer"), pubs.length + appeals, [
      pubs.length ? (under ? t("dont {n} sous le seuil", { n: fmt(under) }) : t("En attente de décision")) : "",
      appeals ? plural(appeals, "recours à examiner", "recours à examiner") : "",
    ].filter(Boolean).join(" · ") || t("Tout est à jour")],
    ["campagnes", t("Campagnes à approuver"), campPending, campPending ? t("Soumises par les agences") : t("Aucune en attente")],
    ["retraits", t("Paiements à traiter"), wd.length + rc.length, paySub || t("Tout est à jour")],
    ...(badges ? [["utilisateurs", t("Badges à vérifier"), badges, t("Demandes des agences")]] : []),
  ];
  // Chevron de kpi() (ui.js) retourné en arabe : il pointe vers la suite de la lecture.
  const chevron = icon("chevronRight", "size-4"), chevronRtl = icon("chevronRight", "size-4 rtl:-scale-x-100");
  const todoCards = queues.map(([id, label, n, sub]) =>
    kpi({ href: `#/admin/${id}`, label, value: kpiValue(fmt(n)), sub, ic: "chevronRight" }).replace("<a ", `<a data-action="adm-focus" data-value="${id}" `).replace(chevron, chevronRtl));
  const todoList = queues.map(([id, label, n, sub]) => `<li><a href="#/admin/${id}" data-action="adm-focus" data-value="${id}" class="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
      <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${label}</span><span class="mt-0.5 block truncate text-xs text-fg-subtle">${sub}</span></span>
      ${n ? countBadge(n, "queue") : `<span class="text-small tabular-nums text-fg-subtle">0</span>`}${icon("chevronRight", "size-4 shrink-0 text-fg-subtle rtl:-scale-x-100")}</a></li>`).join("");

  // 2. KPI plateforme : chaque chiffre une seule fois sur l'écran.
  const active = db.campaigns.filter((c) => c.status === "Active").length, suspended = users.filter((u) => u.status === "Suspendu").length;
  const spent = admSum(db.campaigns, (c) => c.spent), commission = admSum(db.campaigns, (c) => Math.round((c.spent * c.commissionRate) / 100));
  const validated = db.publications.filter((p) => p.status === "Validée"), views = admSum(validated, (p) => p.views);
  const kpis = [
    kpi({ label: t("Clippers inscrits"), value: kpiValue(fmt(users.length)), sub: plural(suspended, "suspendu", "suspendus") }),
    kpi({ label: t("Campagnes actives"), value: kpiValue(fmt(active)), sub: t("sur {count}", { count: plural(db.campaigns.length, "campagne", "campagnes") }) }),
    kpi({ label: t("Budget consommé"), value: bigMoney(spent), sub: `${plural(validated.length, "clip validé", "clips validés")} · ${t("{n} vues", { n: compact(views) })}` }),
    kpi({ label: t("Commissions ClipBoost"), value: admIncome(commission), sub: t("sur le budget consommé") }),
  ];

  // 3. Inscriptions (un comptage : barres entières ; barChart se lit de gauche à droite, y compris en arabe, alors que
  // l'état vide suit le sens de la langue) et activité récente (textes du serveur, traduits à l'affichage).
  const period = state.period === 7 ? 7 : 30, series = (db.series.daily || []).slice(-period);
  const total = admSum(series, (v) => v), activeDays = series.filter((v) => v > 0).length;
  const chart = `<header class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0"><h2 class="text-section text-fg">${t("Nouvelles inscriptions")}</h2>
        <p class="mt-2">${kpiValue(fmt(total))}</p>
        <p class="mt-0.5 text-small text-fg-subtle">${t("sur {days}", { days: plural(period, "jour", "jours") })} · ${plural(activeDays, "jour actif", "jours actifs")}</p></div>
      ${segmented("adm-period", period, [[7, t("7 j")], [30, t("30 j")]], t("Période du graphique"))}
    </header>
    <div class="mt-5">${total
      ? barChart(series, { tone: "brand", unit: "inscription", unitPlural: "inscriptions", integer: true, caption: period === 7 ? t("Nouvelles inscriptions par jour, 7 derniers jours") : t("Nouvelles inscriptions par jour, 30 derniers jours") })
      : emptyState("users", t("Aucune inscription sur la période"), t("Les nouveaux comptes clippers et agences apparaîtront ici."), "", { inCard: true })}</div>`;
  const acts = (db.activity || []).slice(0, 6);
  const activity = `${cardHeader(t("Activité récente"))}
    ${acts.length
      ? `<ul class="mt-3 divide-y divide-line">${acts.map((a) => `<li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">${eventIcon(a.icon)}
          <div class="min-w-0 flex-1"><p class="break-words text-small text-fg">${esc(tServer(a.text))}</p><p class="mt-0.5 text-xs text-fg-subtle">${ago(a.at)}</p></div></li>`).join("")}</ul>`
      : `<div class="grid flex-1 place-items-center">${emptyState("clock", t("Aucune activité sur les 7 derniers jours"), t("Inscriptions, validations et paiements s'afficheront ici."), "", { inCard: true })}</div>`}`;

  return `${pageHeader(t("Vue d'ensemble"), t("Pilotez l'activité de ClipBoost en temps réel."))}
    ${s.maintenance ? `<div class="mt-6">${alertBox("warning", `<strong class="font-semibold">${t("Mode maintenance activé.")}</strong> ${t("Les clippers et les agences ne peuvent pas se connecter.")} <a href="#/admin/parametres" class="${btn("link")}">${t("Modifier dans les réglages")}</a>`)}</div>` : ""}
    <section class="mt-6" aria-label="${esc(t("À traiter"))}">
      ${admSectionTitle(t("À traiter"), queue ? countBadge(queue, "queue") : "")}
      <ul class="mt-3 divide-y divide-line overflow-hidden ${CARD} sm:hidden">${todoList}</ul>
      <div class="mt-3 hidden gap-4 sm:grid ${queues.length > 3 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"} lg:gap-5">${todoCards.join("")}</div>
    </section>
    <section class="mt-8" aria-label="${esc(t("Plateforme"))}">
      ${admSectionTitle(t("Plateforme"))}
      <div class="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-4">${kpis.join("")}</div>
    </section>
    <div class="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-5">
      ${card(chart, acts.length ? "" : "lg:col-span-2")}
      ${acts.length ? card(activity, "flex flex-col p-5") : ""}
    </div>
    ${sectionHeader(t("Clips en attente"), pubs.length ? "#/admin/moderation" : "")}
    ${pubs.length ? admPubTable(publicationsTable(pubs.slice(0, 3), { showUser: true, actions: true, tag: admRiskTag }))
      : emptyState("check", t("Aucun clip en attente"), t("Les nouveaux clips soumis par les clippers apparaîtront ici."))}`;
}

// ---------- Utilisateurs ----------

const roleTag = (u) => roleBadge(u.role);
// Filtre de rôle : clé (valeur du filtre, en français) → rôle ; libellés traduits à l'affichage.
const ADM_ROLES = { "Tous les rôles": null, Clippers: "clipper", Agences: "agence", Admins: "admin" };
// Solde : gains disponibles d'un clipper, crédit d'une agence.
const admBalance = (u) => (u.role === "agence" ? u.credit || 0 : balance(u));
const admBalanceLabel = (u) => (u.role === "agence" ? t("crédit") : t("gains"));
// Étiquette « Badge demandé » (même gabarit que roleBadge) : l'agence attend une décision sur le badge bleu.
const admBadgeAsked = () => `<span class="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] bg-info-bg px-1.5 text-micro font-semibold text-info-fg ring-1 ring-inset ring-info-border">${icon("shield", "size-3")}${t("Badge demandé")}</span>`;

// Colonne d'actions : « Profil » partout ; un compte admin ne se suspend pas, un espace vide garde l'alignement du tableau.
function admUserActions(u, size, table = false) {
  const profile = `<a href="${admUserHref(u)}" class="${btn("ghost", size)}">${t("Profil")}</a>`;
  if (u.role === "admin") return table ? `${profile}<span class="w-[6.5rem] shrink-0" aria-hidden="true"></span>` : profile;
  return `${profile}
    <button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="${btn("secondary", size, "sm:min-w-[6.5rem]")}">${u.status === "Actif" ? t("Suspendre") : t("Réactiver")}</button>`;
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
          <p class="mt-0.5 truncate text-xs text-fg-subtle"><span dir="ltr">${esc(u.email)}</span> · ${plural(n, "campagne", "campagnes")} · ${t("inscrite le {date}", { date: date(u.joined) })}</p>
          ${u.verificationNote
            ? `<p class="mt-2 break-words border-s-2 border-line-strong ps-3 text-small text-fg-muted">${esc(u.verificationNote)}</p>`
            : `<p class="mt-2 text-small text-fg-subtle">${t("Aucun message joint à la demande.")}</p>`}
        </div></div>
      <div class="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" data-action="adm-verify" data-id="${u.id}" data-value="reject" class="${btn("dangerSoft", "md")}">${t("Refuser")}</button>
        <button type="button" data-action="adm-verify-approve" data-id="${u.id}" class="${btn("primary", "md")}">${icon("shield")}${t("Accorder le badge")}</button>
      </div></li>`;
  }).join("");
  return `<section class="mt-6" aria-labelledby="adm-badges-title">
      <div class="flex items-center gap-2"><h2 id="adm-badges-title" class="text-heading text-fg">${t("Badges à vérifier")}</h2>${countBadge(list.length, "queue")}</div>
      <p class="mt-1 max-w-2xl text-small text-fg-muted">${t("Ces agences demandent le badge bleu. Vérifiez leur identité avant de l'accorder : il s'affiche à côté de leur nom, partout sur ClipBoost.")}</p>
      <ul class="mt-3 divide-y divide-line overflow-hidden ${CARD}">${items}</ul>
    </section>`;
}

function aUtilisateurs() {
  const f = state.adm, q = f.userQ.trim().toLowerCase();
  const byRole = (r) => db.users.filter((u) => !ADM_ROLES[r] || u.role === ADM_ROLES[r]);
  // La recherche trouve aussi le pays dans la langue affichée (« Algeria », « الجزائر »).
  const list = byRole(f.userRole).filter((u) => (f.userStatus === "Tous" || u.status === f.userStatus) && (!q || `${u.name} ${u.email} ${u.country} ${u.country ? t(u.country) : ""}`.toLowerCase().includes(q)));
  const roles = Object.keys(ADM_ROLES).map((r) => [r, t(r === "Tous les rôles" ? "Tous" : r), byRole(r).length]);
  const statuses = [["Tous", t("Tous les statuts")], ["Actif", t("Actifs")], ["Suspendu", t("Suspendus")]];
  const requests = admPendingBadges();
  const nameLine = (u, cls) => `<div class="flex min-w-0 items-center gap-1.5">${admUserLink(u, cls)}${roleTag(u)}${u.verification === "pending" ? admBadgeAsked() : ""}</div>`;

  const rows = list.map((u) => {
    const money_ = u.role === "admin" ? admDash : `${money(admBalance(u))}<span class="${TBL.tdSub} font-normal">${admBalanceLabel(u)}</span>`;
    return {
      tr: `<tr data-row="${u.id}" class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}"><div class="flex min-w-0 items-center gap-3">${avatar(u, "sm")}<div class="min-w-0">${nameLine(u, "font-medium text-fg")}<span class="${TBL.tdSub} truncate"><span dir="ltr">${esc(u.email)}</span></span></div></div></td>
        <td class="${TBL.td} hidden xl:table-cell"><span class="whitespace-nowrap text-fg-muted">${esc(t(u.country || ""))}</span></td>
        <td class="${TBL.td} hidden xl:table-cell"><span class="whitespace-nowrap tabular-nums text-fg-muted">${date(u.joined)}</span></td>
        <td class="${TBL.td} ${TBL.tdNum}">${money_}</td>
        <td class="${TBL.td}">${statusBadge(u.status)}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admUserActions(u, "sm", true)}</div></td>
      </tr>`,
      li: `<li data-row="${u.id}" class="${TBL.item}">
        <div class="flex items-start gap-3">${avatar(u, "md")}<div class="min-w-0 flex-1">${nameLine(u, "text-sm font-medium text-fg")}<p class="truncate text-xs text-fg-subtle"><span dir="ltr">${esc(u.email)}</span></p></div>${statusBadge(u.status)}</div>
        <div class="flex items-center justify-between gap-3 text-small"><span class="min-w-0 truncate text-fg-subtle">${esc(t(u.country || ""))} · ${t("inscrit le {date}", { date: date(u.joined) })}</span>${u.role === "admin" ? "" : `<span class="shrink-0 font-medium">${money(admBalance(u))}<span class="font-normal text-fg-subtle"> ${admBalanceLabel(u)}</span></span>`}</div>
        <div class="grid grid-cols-2 gap-2">${admUserActions(u, "md")}</div>
      </li>`,
    };
  });

  // Pays et date d'inscription : visibles à partir de xl (et toujours sur la fiche et dans la liste mobile).
  const table = admTable("md", `<th scope="col" class="${TBL.th}">${t("Utilisateur")}</th><th scope="col" class="${TBL.th} hidden xl:table-cell">${t("Pays")}</th><th scope="col" class="${TBL.th} hidden xl:table-cell">${t("Date d'inscription")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Solde")}</th><th scope="col" class="${TBL.th}">${t("Statut")}</th>${admThActions()}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));

  return `${pageHeader(t("Utilisateurs"), t("Clippers, agences et administrateurs. Les nouvelles inscriptions apparaissent ici automatiquement."))}
    ${admBadgeRequests(requests)}
    ${requests.length ? `<h2 class="mt-8 text-heading text-fg">${t("Tous les comptes")}</h2>` : ""}
    ${admToolbar(`<div class="flex min-w-0 gap-2 xl:contents">${searchInput("adm-user-q", f.userQ, t("Nom, email, pays"), t("Rechercher un utilisateur"), "min-w-0 flex-1 xl:max-w-xs")}${select("adm-user-status", f.userStatus, [["Tous", t("Tous statuts")], ...statuses.slice(1)], { label: t("Statut"), cls: "w-36 shrink-0 sm:hidden" })}</div>`,
      `<div class="flex min-w-0 items-center gap-2">${segmented("adm-user-role", f.userRole, roles, t("Rôle"), { scroll: true })}<span class="hidden sm:contents">${segmented("adm-user-status", f.userStatus, statuses, t("Statut"))}</span></div>`)}
    ${admCountLine(list.length, db.users.length, "compte", "comptes")}
    <div class="mt-3">${list.length ? table
      : emptyState("search", t("Aucun utilisateur ne correspond"), t("Essayez un autre nom, un autre rôle ou effacez les filtres."), `<button type="button" data-action="adm-user-clear" class="${btn("secondary")}">${t("Effacer les filtres")}</button>`)}</div>`;
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
  pending: () => badge(t("Demande en attente"), "info", { ic: "clock" }),
  verified: () => badge(`${verifiedBadge("size-3.5")}${t("Agence vérifiée")}`, "info"),
  rejected: () => badge(t("Demande refusée"), "danger", { dot: true }),
  none: () => badge(t("Non vérifiée"), "idle", { dot: true }),
};
function admVerifCard(u) {
  const v = ADM_VERIF_TAG[u.verification] ? u.verification : "none";
  const note = u.verificationNote ? esc(u.verificationNote) : "";
  const act_ = (action, variant, label, ic = "", value = "") => `<button type="button" data-action="${action}" data-id="${u.id}"${value ? ` data-value="${value}"` : ""} class="${btn(variant, "md")}">${ic ? icon(ic) : ""}${label}</button>`;
  const body = {
    pending: () => `<div class="mt-4 rounded-tile bg-subtle p-3.5">
        <p class="text-xs font-medium text-fg-subtle">${t("Message de l'agence")}</p>
        <p class="mt-1 break-words text-sm ${note ? "text-fg" : "text-fg-subtle"}">${note || t("Aucun message joint à la demande.")}</p></div>
      <p class="mt-3 text-small text-fg-muted">${t("Vérifiez l'identité de l'agence (registre du commerce, site officiel, comptes de la marque) avant d'accorder le badge.")}</p>
      <div class="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">${act_("adm-verify", "dangerSoft", t("Refuser"), "", "reject")}${act_("adm-verify-approve", "primary", t("Accorder le badge"), "shield")}</div>`,
    verified: () => `<p class="mt-4 flex items-start gap-2.5 text-sm text-fg">${verifiedBadge("mt-0.5 size-5")}<span>${t("Le badge bleu s'affiche à côté du nom de l'agence, sur ses campagnes et sur sa page.")}</span></p>
      <div class="mt-4 flex sm:justify-end">${act_("adm-verify", "dangerSoft", t("Retirer le badge"), "", "revoke")}</div>`,
    rejected: () => `${note ? `<div class="mt-4">${alertBox("danger", `<p class="font-medium">${t("Motif du refus")}</p><p class="mt-0.5 break-words">${note}</p>`)}</div>` : ""}
      <p class="mt-3 text-small text-fg-muted">${t("L'agence peut envoyer une nouvelle demande depuis son profil. Vous pouvez aussi lui accorder le badge directement.")}</p>
      <div class="mt-4 flex sm:justify-end">${act_("adm-verify-approve", "secondary", t("Accorder le badge"), "shield")}</div>`,
    none: () => `${note ? `<p class="mt-4 text-small text-fg-muted">${t("Badge retiré : {note}", { note })}</p>` : `<p class="mt-4 text-small text-fg-muted">${t("Aucune demande en cours. L'agence peut demander le badge depuis son profil, ou vous pouvez le lui accorder directement.")}</p>`}
      <div class="mt-4 flex sm:justify-end">${act_("adm-verify-approve", "secondary", t("Accorder le badge"), "shield")}</div>`,
  }[v]();
  return card(`${cardHeader(t("Badge de vérification"), t("Le badge bleu certifie l'identité de l'agence."), ADM_VERIF_TAG[v]())}${body}`);
}

// Mouvements d'argent d'un compte (retraits d'un clipper, recharges d'une agence) : une demande en cours mène à
// Paiements, sur sa ligne (#/admin/retraits/<id>). Libellé de l'opération (texte du serveur) traduit par tServer.
function admTxList(list) {
  return `<ul class="divide-y divide-line overflow-hidden ${CARD}">${list.map((tx) => {
    const card_ = tx.type === "recharge" ? admCardOf(tx) : null, out = tx.type === "retrait";
    const how = !card_ && !out ? admMethod(tx.method) : "";
    // Sortie ↗ ou entrée ↙ : flèches retournées en arabe (sens de lecture) ; la carte bancaire reste telle quelle.
    return `<li data-row="${tx.id}" class="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-fg-muted" aria-hidden="true">${card_ ? icon("card", "size-4") : icon(out ? "arrowUpRight" : "arrowDownLeft", "size-4 rtl:-scale-x-100")}</span>
      <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(tServer(tx.label))}</p>
        <p class="truncate text-xs tabular-nums text-fg-subtle">${admWhen(tx)}${how ? ` · ${how}` : ""}${admOnlinePay(tx) ? " · Chargily" : ""} · ${code(tx.ref)}${tx.fee ? ` · ${t("frais {amount}", { amount: da(tx.fee) })}` : ""}</p></div>
      <div class="flex shrink-0 flex-col items-end gap-1"><span class="text-sm font-medium">${money(Math.abs(tx.amount))}</span>
        ${tx.status === "En cours" ? (admOnlinePay(tx) ? admOnlineWaiting() : `<a href="#/admin/retraits/${encodeURIComponent(tx.id)}" class="${btn("link", "", "text-xs")}">${t("À traiter")}</a>`) : statusBadge(tx.status)}</div>
      ${txDocBtn(tx, { compact: true })}
    </li>`;
  }).join("")}</ul>`;
}

function aUtilisateur() {
  const u = userById(state.route.item || "");
  const crumb = (name) => `<nav aria-label="${esc(t("Fil d'Ariane"))}"><ol class="flex min-w-0 items-center gap-1.5 text-small">
      <li class="shrink-0"><a href="#/admin/utilisateurs" class="${HIT} inline-flex items-center gap-1 rounded-sm font-medium text-fg-muted transition-colors duration-150 hover:text-fg ${FOCUS}">${icon("arrowLeft", "size-4 sm:hidden rtl:-scale-x-100")}${t("Utilisateurs")}</a></li>
      <li class="hidden shrink-0 text-fg-subtle sm:block" aria-hidden="true">${icon("chevronRight", "size-3.5 rtl:-scale-x-100")}</li>
      <li class="hidden min-w-0 truncate text-fg-subtle sm:block" aria-current="page">${esc(name)}</li></ol></nav>`;
  if (!u) {
    return `${crumb(t("Compte introuvable"))}
      <h1 class="sr-only">${t("Compte introuvable")}</h1>
      <div class="mt-6">${emptyState("users", t("Compte introuvable"), t("Ce compte n'existe pas ou a été supprimé."), `<a href="#/admin/utilisateurs" class="${btn("secondary")}">${t("Voir les utilisateurs")}</a>`)}</div>`;
  }
  const agency = u.role === "agence", clipper = u.role === "clipper", admin = u.role === "admin", self = u.id === state.session;
  const camps = agency ? db.campaigns.filter((c) => c.ownerId === u.id) : [];
  const pubs = clipper ? db.publications.filter((p) => p.userId === u.id) : [];
  const txs = db.transactions.filter((tx) => tx.userId === u.id && tx.type === (agency ? "recharge" : "retrait"));

  // En-tête : couverture (agence), photo, nom et badge, rôle et statut, coordonnées.
  const tags = [
    admin ? badge(t("Administrateur"), "brand", { ic: "shield" }) : agency ? badge(t("Agence"), "info", { ic: "building" }) : badge(esc(t(u.level || "Clipper")), "brand", { ic: "medal" }),
    statusBadge(u.status),
    agency && u.verification === "pending" ? badge(t("Badge demandé"), "info", { ic: "clock" }) : "",
  ].filter(Boolean).join("");
  const toggle = admin ? (self ? `<a href="#/admin/compte" class="${btn("secondary")}">${icon("pencil")}${t("Modifier mon compte")}</a>` : "")
    : u.status === "Actif"
      ? `<button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="${btn("dangerSoft")}">${icon("ban")}${t("Suspendre le compte")}</button>`
      : `<button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="${btn("secondary")}">${icon("play")}${t("Réactiver le compte")}</button>`;
  const fact = (label, value) => `<div class="min-w-0"><dt class="text-xs text-fg-subtle">${label}</dt><dd class="mt-0.5 flex min-w-0 items-center gap-1 text-sm text-fg">${value}</dd></div>`;
  const country = u.country || "Algérie";
  // Contact libre (nom, téléphone…) : dir="auto", un numéro reste lisible de gauche à droite en arabe.
  const facts = [
    fact(t("Email"), `<span class="min-w-0 break-all" dir="ltr">${esc(u.email || "")}</span>${u.email ? admCopyBtn(u.email, t("Copier l'adresse email"), t("Adresse copiée")) : ""}`),
    agency ? fact(t("Contact"), u.contact ? `<span class="min-w-0 break-words" dir="auto">${esc(u.contact)}</span>` : `<span class="text-fg-subtle">${t("Non renseigné")}</span>`) : "",
    clipper && u.handle ? fact(t("Compte principal"), `<span class="min-w-0 truncate" dir="ltr">${esc(u.handle)}</span>`) : "",
    fact(t("Pays"), `<span class="inline-flex items-center gap-1.5">${esc(t(country))}${country === "Algérie" ? flagDz() : ""}</span>`),
    fact(agency ? t("Inscrite le") : t("Inscrit le"), `<span class="tabular-nums">${date(u.joined)}</span>`),
    u.locale && LOCALES[u.locale] ? fact(t("Langue"), `<span lang="${u.locale}" dir="${LOCALES[u.locale].dir}">${esc(LOCALES[u.locale].label)}</span>`) : "",
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
        ${u.bio ? `<p class="mt-4 max-w-2xl break-words text-sm leading-6 text-fg-muted" dir="auto">${esc(u.bio)}</p>` : ""}
        <dl class="mt-5 grid gap-x-8 gap-y-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3">${facts}</dl>
      </div>
    </section>`;

  if (admin) {
    return `${crumb(u.name)}${header}
      <div class="mt-4 lg:mt-5">${alertBox("info", t("Compte administrateur : accès complet à l'espace d'administration. Il ne peut pas être suspendu depuis l'administration."))}</div>`;
  }

  if (agency) {
    const running = camps.filter((c) => c.status === "Active" || c.status === "En pause"), clips = db.publications.filter((p) => camps.some((c) => c.id === p.campaign));
    const waiting = camps.filter((c) => c.status === "En attente").length, toModerate = clips.filter((p) => p.status === "En attente").length;
    const toConfirm = admSum(txs.filter((tx) => tx.status === "En cours" && !admOnlinePay(tx)), (tx) => tx.amount);
    const kpis = [
      kpi({ label: t("Crédit disponible"), value: bigMoney(u.credit || 0), sub: toConfirm ? t("{amount} de recharge à confirmer", { amount: da(toConfirm) }) : t("pour financer ses campagnes") }),
      kpi({ label: t("Campagnes en cours"), value: kpiValue(fmt(running.length)), sub: waiting ? t("{n} en attente de vérification", { n: fmt(waiting) }) : t("sur {count}", { count: plural(camps.length, "campagne", "campagnes") }) }),
      kpi({ label: t("Budget consommé"), value: bigMoney(admSum(camps, (c) => c.spent)), sub: t("sur {amount} engagés", { amount: da(admSum(running, (c) => c.budget)) }) }),
      kpi({ label: t("Clips reçus"), value: kpiValue(fmt(clips.length)), sub: toModerate ? t("{n} à modérer", { n: fmt(toModerate) }) : t("Tout est modéré") }),
    ];
    return `${crumb(u.name)}${header}
      <div class="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-5 lg:gap-5 xl:grid-cols-4">${kpis.join("")}</div>
      <div class="mt-4 max-w-3xl lg:mt-5">${admVerifCard(u)}</div>
      ${sectionHeader(t("Campagnes de l'agence"))}
      ${camps.length ? admCampTable(camps, { owner: false }) : emptyState("target", t("Aucune campagne"), t("Les campagnes créées par cette agence apparaîtront ici."))}
      ${sectionHeader(t("Recharges de crédit"))}
      ${txs.length ? admTxList(txs) : emptyState("bank", t("Aucune recharge"), t("Les recharges de crédit annoncées par l'agence apparaîtront ici."))}`;
  }

  // Clipper : gains, moyen de retrait, comptes sociaux, clips (décision possible depuis sa fiche) et retraits.
  const count = (s) => pubs.filter((p) => p.status === s).length;
  const views = admSum(pubs.filter((p) => p.status === "Validée"), (p) => p.views), acc = admAccountValue(u.payoutAccount);
  const kpis = [
    kpi({ label: t("Gains totaux"), value: bigMoney(totalEarned(u)), sub: t("depuis l'inscription") }),
    kpi({ label: t("Solde retirable"), value: bigMoney(balance(u)), sub: pendingAmount(u) ? t("{amount} en rétention", { amount: da(pendingAmount(u)) }) : t("aucun gain en rétention") }),
    kpi({ label: t("Clips soumis"), value: kpiValue(fmt(pubs.length)), sub: t("{validated} · {pending} en attente", { validated: plural(count("Validée"), "validé", "validés"), pending: fmt(count("En attente")) }) }),
    kpi({ label: t("Vues validées"), value: kpiValue(compact(views)), sub: count("Refusée") ? plural(count("Refusée"), "clip refusé", "clips refusés") : t("aucun clip refusé") }),
  ];
  const payout = card(`${cardHeader(t("Moyen de retrait"), t("Compte sur lequel ses retraits sont virés."))}
      <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">${u.payoutMethod
        ? `${badge(esc(t(u.payoutMethod)), "idle")}${acc ? `<span class="flex min-w-0 items-center gap-0.5"><span class="min-w-0 break-all font-mono text-small font-medium text-fg" dir="ltr">${admAccount(acc)}</span>${admCopyBtn(acc, t("Copier le numéro"), t("Numéro copié"))}</span>` : `<span class="text-small text-fg-subtle">${t("Numéro non renseigné")}</span>`}`
        : `<span class="text-small text-fg-subtle">${t("Aucun moyen de retrait enregistré.")}</span>`}</div>`);
  // Comptes sociaux : vérifiés (code dans la bio) ou en attente (avec le code remis au clipper). Un « @compte » du profil
  // sans compte vérifié derrière (saisi avant la vérification des comptes) est montré « Non vérifié ».
  const social = u.socialAccounts || [];
  const legacy = PLATFORMS.filter((p) => u.handles && u.handles[p.toLowerCase()] && !social.some((a) => a.platform === p && a.status === "verified"))
    .map((p) => ({ id: `legacy-${p}`, platform: p, handle: String(u.handles[p.toLowerCase()]).replace(/^@+/, ""), status: "legacy" }));
  const accRow = (a) => {
    const tag = a.status === "verified" ? badge(t("Vérifié"), "success", { ic: "check" }) : a.status === "pending" ? badge(t("En attente"), "warning", { dot: true }) : badge(t("Non vérifié"), "idle");
    const meta = a.status === "verified" ? t("Vérifié le {date}", { date: date(a.verifiedAt) })
      : a.status === "pending" ? `${t("Code {code}", { code: code(a.code) })}${a.checkedAt ? ` · ${t("Dernier essai : {when}", { when: ago(a.checkedAt).replace(/^./, (ch) => ch.toLowerCase()) })}` : ""}`
      : t("Indiqué dans le profil, jamais vérifié");
    return `<li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span class="grid size-9 shrink-0 place-items-center rounded-tile bg-muted text-fg">${icon(PLATFORM_ICON[a.platform] || "film", "size-4")}</span>
      <div class="min-w-0 flex-1"><p class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span class="min-w-0 truncate text-sm font-medium text-fg" dir="ltr">@${esc(a.handle)}</span>${tag}</p>
        <p class="mt-0.5 text-xs text-fg-subtle">${esc(a.platform)} · ${meta}</p></div></li>`;
  };
  const rows = [...social, ...legacy];
  const accounts = card(`${cardHeader(t("Comptes sociaux"), t("Vérifiés par un code dans leur bio : seuls leurs clips sont acceptés."))}
      ${rows.length ? `<ul class="mt-4 divide-y divide-line">${rows.map(accRow).join("")}</ul>`
        : `<p class="mt-4 text-small text-fg-subtle">${t("Aucun compte social ajouté.")}</p>`}`);
  // amountLabel : texte source français, traduit par publicationsTable.
  return `${crumb(u.name)}${header}
    <div class="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-5 lg:gap-5 xl:grid-cols-4">${kpis.join("")}</div>
    <div class="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">${payout}${accounts}</div>
    ${sectionHeader(t("Clips"))}
    ${pubs.length ? admPubTable(publicationsTable(pubs, { actions: true, amountLabel: "Gain", tag: admRiskTag }), "xl") : emptyState("film", t("Aucun clip pour le moment"), t("Les clips soumis par ce clipper apparaîtront ici."))}
    ${sectionHeader(t("Retraits"))}
    ${txs.length ? admTxList(txs) : emptyState("wallet", t("Aucun retrait"), t("Les demandes de retrait de ce clipper apparaîtront ici."))}`;
}

// ---------- Campagnes ----------

// Filtre de statut : [valeur (statut du serveur, en français), libellé source traduit à l'affichage].
const ADM_CAMP_STATUS = [["Toutes", "Toutes"], ["Active", "Actives"], ["En attente", "En attente"], ["En pause", "En pause"], ["Terminée", "Terminées"], ["Refusée", "Refusées"]];
const admTopTag = () => `<span class="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] bg-warning-bg px-1.5 text-micro font-semibold text-warning-fg ring-1 ring-inset ring-warning-border" title="${esc(t("Top campagne"))}">${icon("star", "size-3", true)}${t("Top")}</span>`;

// Sous-ligne d'une campagne : agence (lien vers sa fiche) ou ClipBoost, marque si elle diffère, catégorie (traduite ;
// une catégorie précisée par l'agence, hors liste, s'affiche telle quelle).
function admCampSub(c, withOwner = true) {
  const o = c.ownerId ? userById(c.ownerId) : null;
  const sep = `<span class="shrink-0" aria-hidden="true">·</span>`;
  const who = !withOwner ? ""
    : o ? `${admUserLink(o, "font-medium text-fg-muted hover:text-fg")}${sep}`
    : `<span class="shrink-0">${c.ownerId ? t("Agence supprimée") : "ClipBoost"}</span>${sep}`;
  const brand = !o || c.brand !== o.name ? `${esc(c.brand)} · ` : "";
  return `${who}<span class="min-w-0 truncate">${brand}${esc(t(c.category))}</span>`;
}

// Actions par statut, sur une ligne ; l'action principale est en bout de ligne (comme la colonne Décision de la modération).
// Une campagne en attente s'examine dans sa fiche (approbation) ; un refus passe toujours par son motif ; « Terminer »
// demande une confirmation (définitif, le budget non consommé est rendu à l'agence).
function admCampActions(c, size) {
  // Action secondaire à largeur fixe dès sm : « Terminer » garde la même position d'une ligne à l'autre.
  const b = (action, variant, label, ic = "") => `<button type="button" data-action="${action}" data-id="${c.id}" class="${btn(variant, size, variant === "ghost" || variant === "dangerSoft" ? "" : "sm:min-w-[7.5rem]")}">${ic ? icon(ic) : ""}${label}</button>`;
  if (c.status === "En attente") return b("adm-camp-refuse", "dangerSoft", t("Refuser")) + b("adm-camp", "primary", t("Examiner"));
  if (c.status === "Active") return b("adm-camp-end", "ghost", t("Terminer")) + b("adm-camp-pause", "secondary", t("Pause"), "pause");
  if (c.status === "En pause") return b("adm-camp-end", "ghost", t("Terminer")) + b("adm-camp-resume", "secondary", t("Reprendre"), "play");
  return b("adm-camp", "ghost", t("Détails"));
}

// Tableau des campagnes (page Campagnes, fiche d'une agence) : la vignette et le titre ouvrent la fiche d'examen.
function admCampTable(list, { owner = true } = {}) {
  const thumb = (c) => `<button type="button" data-action="adm-camp" data-id="${c.id}" tabindex="-1" aria-hidden="true" class="shrink-0 rounded-tile">${coverThumb(c, "sm")}</button>`;
  const title = (c, cls = "") => `<p class="flex min-w-0 items-center gap-1.5"><button type="button" data-action="adm-camp" data-id="${c.id}" class="${ADM_ROW_LINK} ${cls}" title="${esc(t("Examiner la campagne"))}"><span class="block truncate">${esc(c.title)}</span></button>${c.top ? admTopTag() : ""}</p>`;
  const trs = list.map((c) => `<tr data-row="${c.id}" class="${TBL.tr}">
      <td class="${ADM_TD_MAIN}"><div class="flex min-w-0 items-center gap-3">${thumb(c)}<div class="min-w-0">${title(c)}<p class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${admCampSub(c, owner)}</p></div></div></td>
      <td class="${TBL.td}">${statusBadge(c.status)}</td>
      <td class="${TBL.td} ${TBL.tdNum}">${money(c.rate)}<span class="${TBL.tdSub} font-normal">${t("/ 1 000 vues")}</span></td>
      <td class="${TBL.td}"><div class="min-w-44">${progress(c.spent, c.budget)}</div></td>
      <td class="${TBL.td} ${TBL.tdNum}">${fmt(c.clippers)}</td>
      <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admCampActions(c, "sm")}</div></td>
    </tr>`).join("");
  // Sous xl : une ligne par campagne (identité | budget), actions en boutons md dessous, alignées en bout de ligne dès sm.
  const lis = list.map((c) => `<li data-row="${c.id}" class="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:items-center sm:gap-x-8 sm:px-5">
      <div class="flex min-w-0 items-start gap-3">${thumb(c)}<div class="min-w-0 flex-1">${title(c, "text-sm")}<p class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${admCampSub(c, owner)}</p>
        <p class="mt-1 text-xs tabular-nums text-fg-subtle">${rateShort(c.rate)} · ${plural(c.clippers, "clipper", "clippers")}</p></div>${statusBadge(c.status)}</div>
      <div class="min-w-0">${progress(c.spent, c.budget)}</div>
      <div class="grid grid-cols-2 gap-2 sm:col-span-2 sm:flex sm:justify-end [&>:only-child]:col-span-2">${admCampActions(c, "md")}</div>
    </li>`).join("");
  return admTable("xl", `<th scope="col" class="${TBL.th}">${t("Campagne")}</th><th scope="col" class="${TBL.th}">${t("Statut")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Tarif")}</th><th scope="col" class="${TBL.th}">${t("Budget")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Clippers")}</th>${admThActions()}`, trs, lis);
}

function aCampagnes() {
  const f = state.adm, q = f.campQ.trim().toLowerCase();
  const owner = (c) => (c.ownerId ? userById(c.ownerId) : null);
  // La recherche trouve aussi la catégorie dans la langue affichée.
  const searched = db.campaigns.filter((c) => { const o = owner(c); return !q || `${c.title} ${c.brand} ${c.category} ${t(c.category)} ${o ? o.name : ""}`.toLowerCase().includes(q); });
  const list = searched.filter((c) => f.campStatus === "Toutes" || c.status === f.campStatus);
  const options = ADM_CAMP_STATUS.map(([v, l]) => [v, t(l), v === "Toutes" ? searched.length : searched.filter((c) => c.status === v).length]);
  return `${pageHeader(t("Campagnes"), t("Examinez, approuvez, mettez en pause ou créez des campagnes. Seules les campagnes actives sont visibles par les clippers."),
      `<button type="button" data-action="adm-new-campaign" class="${btn("primary")}">${icon("plus")}${t("Nouvelle campagne")}</button>`)}
    ${admToolbar(searchInput("adm-camp-q", f.campQ, t("Titre, marque, catégorie ou agence"), t("Rechercher une campagne"), "w-full xl:max-w-xs"),
      chips("adm-camp-status", f.campStatus, options, t("Statut")))}
    ${admCountLine(list.length, db.campaigns.length, "campagne", "campagnes")}
    <div class="mt-3">${list.length ? admCampTable(list)
      : emptyState("search", t("Aucune campagne ne correspond"), t("Essayez un autre statut ou effacez la recherche."), `<button type="button" data-action="adm-camp-clear" class="${btn("secondary")}">${t("Effacer les filtres")}</button>`)}</div>`;
}

// ---------- Risque de fraude et relevé automatique des vues ----------

// Score de 0 à 100 recalculé par le serveur à chaque relevé (fraudRisk, lib/server/rules.ts), envoyé à l'admin seulement
// (absent ailleurs) : moins de 30 faible, 30 à 59 moyen, 60 et plus élevé (riskLevel). Renvoie [ton, libellé traduit].
const admRiskLevel = (score) => (score >= 60 ? ["danger", t("Risque élevé")] : score >= 30 ? ["warning", t("Risque moyen")] : ["success", t("Risque faible")]);
const ADM_RISK_TAG = { success: "bg-success-bg text-success-fg ring-success-border", warning: "bg-warning-bg text-warning-fg ring-warning-border", danger: "bg-danger-bg text-danger-fg ring-danger-border" };
// Signaux du score (libellés français du serveur) : [libellé, ce qu'il mesure], traduits (mêmes seuils que fraudRisk).
const ADM_RISK_FLAGS = {
  "Pic de vues soudain": () => [t("Pic de vues soudain"), t("Un jour récent a gagné plus de 5 fois la moyenne des jours précédents (et plus de 5 000 vues), ou le clip a fait un bond énorme dès son premier jour.")],
  "Beaucoup de vues, peu de likes": () => [t("Beaucoup de vues, peu de likes"), t("Au moins 5 000 vues pour moins de 0,5 % de likes : des vues achetées ou des robots sont possibles.")],
  "Compte récent": () => [t("Compte récent"), t("Le compte du clipper, ou son compte vérifié sur cette plateforme, avait moins de 7 jours à l'envoi du clip.")],
};
const admRiskFlag = (f) => (ADM_RISK_FLAGS[f] ? ADM_RISK_FLAGS[f]() : [esc(f), ""]);
// Pastille de risque d'un clip dans les listes de l'admin : niveau et score, signaux en infobulle. Vide sans score.
function admRiskTag(p) {
  if (typeof p.riskScore !== "number") return "";
  const [tone, label] = admRiskLevel(p.riskScore);
  const tip = [t("Score de risque : {score} sur 100", { score: fmt(p.riskScore) }), ...(p.riskFlags || []).map((f) => admRiskFlag(f)[0])].join(" · ");
  return `<span class="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-[4px] px-1.5 text-micro font-semibold tabular-nums ring-1 ring-inset ${ADM_RISK_TAG[tone]}" title="${esc(tip)}">${icon(tone === "success" ? "shield" : "alert", "size-3")}${label}<span aria-hidden="true">·</span>${fmt(p.riskScore)}</span>`;
}
// Risque de fraude d'un clip (fiche d'examen ; réutilisable ailleurs chez l'admin) : niveau, score, likes et dernier
// relevé, signaux expliqués, puis l'historique jour par jour des 14 derniers jours (vues gagnées par jour en graphique,
// le détail vues, likes, gain du jour en tableau replié). Vide sans score (données réservées à l'admin).
function admRiskPanel(p) {
  if (typeof p.riskScore !== "number") return "";
  const [tone, label] = admRiskLevel(p.riskScore), flags = p.riskFlags || [], hist = p.history || [];
  const knownLikes = typeof p.likes === "number";
  // Part des likes : précise sous 1 % (« 0,07 % »), là où se joue le signal « peu de likes » (0,5 %).
  const share = knownLikes && p.views > 0 ? (p.likes / p.views) * 100 : null;
  const ratio = share === null ? "" : t("{pct} des vues", { pct: share >= 1 || share === 0 ? pct(share) : t("{n}\u00a0%", { n: String(Number(share.toPrecision(2))).replace(".", uiDecimal()) }) });
  const tiles = `<dl class="mt-2 grid grid-cols-3 gap-2">
      ${admTile(t("Score"), `<span dir="ltr">${fmt(p.riskScore)}<span class="font-normal text-fg-subtle">${NB}/${NB}100</span></span>`)}
      ${admTile(t("Likes"), knownLikes ? fmt(p.likes) : admDash, ratio)}
      ${admTile(t("Dernier relevé"), p.checkedAt ? ago(p.checkedAt) : admDash)}
    </dl>`;
  const signals = flags.length
    ? `<ul class="mt-3 grid gap-2">${flags.map((f) => {
        const [name, help] = admRiskFlag(f);
        return `<li class="flex items-start gap-2.5 rounded-tile border border-line p-3"><span class="grid size-7 shrink-0 place-items-center rounded-full ${tone === "danger" ? "bg-danger-bg text-danger-fg" : "bg-warning-bg text-warning-fg"}" aria-hidden="true">${icon("alert", "size-4")}</span>
          <span class="min-w-0"><span class="block text-sm font-medium text-fg">${name}</span>${help ? `<span class="mt-0.5 block text-xs text-fg-muted">${help}</span>` : ""}</span></li>`;
      }).join("")}</ul>`
    : `<p class="mt-3 flex items-center gap-2 text-small text-fg-muted">${icon("shield", "size-4 shrink-0 text-success-fg")}${t("Aucun signal suspect sur les derniers relevés.")}</p>`;
  // Jours UTC (comme les relevés) des 14 derniers jours, aujourd'hui en dernier ; un jour sans relevé ne gagne rien.
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10));
  const byDay = new Map(hist.map((h) => [h.day, h]));
  const gains = days.map((d) => Math.max(0, (byDay.get(d) || {}).gain || 0));
  const dayOf = (iso) => { const [y, m, d] = iso.split("-"); return dayLabel(new Date(+y, +m - 1, +d)); };
  const TH = "h-8 whitespace-nowrap px-3 text-xs font-medium text-fg-subtle", TD = "h-9 whitespace-nowrap px-3 tabular-nums";
  const history = hist.length
    ? `<div class="mt-3">${barChart(gains, { tone: "brand", unit: "vue", unitPlural: "vues", integer: true, h: "h-28", caption: t("Vues gagnées par jour") })}</div>
      <details class="group mt-3">
        <summary class="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm text-small font-medium text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden ${FOCUS}">${t("Détail jour par jour")}${icon("chevronDown", "size-4 shrink-0 transition-transform duration-150 group-open:rotate-180")}</summary>
        <div class="mt-2 overflow-x-auto rounded-tile border border-line"><table class="w-full border-collapse text-small">
          <thead><tr class="bg-subtle"><th scope="col" class="${TH} text-start">${t("Jour")}</th><th scope="col" class="${TH} text-end">${t("Vues")}</th><th scope="col" class="${TH} text-end">${t("Likes")}</th><th scope="col" class="${TH} text-end">${t("Gain du jour")}</th></tr></thead>
          <tbody>${[...hist].reverse().map((h) => `<tr class="border-t border-line"><td class="${TD} text-fg-muted">${dayOf(h.day)}</td><td class="${TD} text-end text-fg">${fmt(h.views)}</td><td class="${TD} text-end text-fg-muted">${typeof h.likes === "number" ? fmt(h.likes) : "—"}</td><td class="${TD} text-end font-medium text-fg">${typeof h.gain === "number" ? uiSigned("+", fmt(h.gain)) : "—"}</td></tr>`).join("")}</tbody>
        </table></div>
      </details>`
    : `<p class="mt-3 text-small text-fg-muted">${t("Aucun relevé sur les 14 derniers jours.")}</p>`;
  return `${admH3(t("Risque de fraude"), badge(label, tone, { dot: true }))}${tiles}${signals}
    <h4 class="mt-5 text-small font-medium text-fg">${t("Historique des vues (14 jours)")}</h4>${history}`;
}
// Relevé automatique des vues : intervalle, dernier passage et son bilan, plateformes simulées faute de clés d'API ;
// le bouton lance un relevé tout de suite (POST /api/admin/track-views). Vide sans ces données (réservées à l'admin).
function admTrackingCard() {
  const tr = db.tracking;
  if (!tr) return "";
  const s = tr.summary || {};
  const by = { cron: t("Tâche planifiée"), script: t("Crontab du serveur"), admin: t("Lancé par l'équipe"), auto: t("Automatique") }[s.by] || "";
  const button = `<button type="button" data-action="adm-track-views" class="${btn("secondary", "md", "w-full sm:w-auto")}">${icon("refresh")}${t("Relever les vues maintenant")}</button>`;
  const simulated = tr.simulated && tr.simulated.length
    ? `<p class="mt-3 flex items-start gap-2 text-xs text-fg-subtle">${icon("info", "mt-px size-3.5 shrink-0")}<span>${t("Mode simulé pour {platforms} : sans clés d'API, les vues sont estimées par une croissance réaliste.", { platforms: esc(listAnd(tr.simulated)) })}</span></p>` : "";
  return card(`<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex min-w-0 items-start gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-fg" aria-hidden="true">${icon("trend", "size-5")}</span>
        <div class="min-w-0"><h2 class="text-section text-fg">${t("Relevé automatique des vues")}</h2>
          <p class="mt-0.5 text-small text-fg-muted">${t("Toutes les {hours} h, par les API officielles des plateformes : historique du jour, score de risque et vues supplémentaires payées.", { hours: fmt(tr.everyHours || 6) })}</p></div></div>
      <div class="shrink-0">${button}</div>
    </div>
    <dl class="mt-4 grid grid-cols-3 gap-2">
      ${admTile(t("Dernier relevé"), tr.lastRunAt ? ago(tr.lastRunAt) : admDash, tr.lastRunAt ? by : "")}
      ${admTile(t("Clips relevés"), tr.lastRunAt ? `<span dir="ltr">${fmt(s.updated || 0)}${NB}/${NB}${fmt(s.total || 0)}</span>` : admDash)}
      ${admTile(t("Erreurs"), tr.lastRunAt ? fmt(s.failed || 0) : admDash, s.failed ? t("Réessayé au prochain relevé") : "")}
    </dl>${simulated}`, "p-4 sm:p-5");
}

// ---------- Modération ----------

// Liste des recours (onglet « Recours » de la modération) : clip contesté (ouvre la fiche du recours), clippeur, envoi,
// statut ; « Examiner » pour un recours en attente, « Voir » ensuite. Tableau dès xl, liste en dessous.
function admAppealTable(list) {
  const pubOf = (a) => db.publications.find((x) => x.id === a.publicationId);
  const rows = list.map((a) => {
    const p = pubOf(a), c = p && campaignById(p.campaign), u = admUser(a.userId), pending = a.status === "En attente";
    const title = p ? p.title : t("Clip supprimé");
    const open = (cls = "") => `<button type="button" data-action="adm-appeal" data-id="${a.id}" class="${ADM_ROW_LINK} ${cls}" title="${esc(t("Examiner le recours"))}"><span class="block truncate">${esc(title)}</span></button>`;
    const sub = `<p class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${c ? `<span class="min-w-0 truncate">${esc(c.title)}</span><span class="shrink-0" aria-hidden="true">·</span>` : ""}<span class="shrink-0 whitespace-nowrap">${t("Envoyé le {date}", { date: date(a.createdAt) })}</span></p>`;
    const msg = `<p class="mt-0.5 truncate text-xs text-fg-muted" dir="auto">${esc(a.message)}</p>`;
    const action = (size) => `<button type="button" data-action="adm-appeal" data-id="${a.id}" class="${btn(pending ? "primary" : "ghost", size)}">${pending ? t("Examiner") : t("Voir")}</button>`;
    const thumb = c ? `<span class="shrink-0">${coverThumb(c, "sm")}</span>` : "";
    return {
      tr: `<tr data-row="${a.id}" class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}"><div class="flex min-w-0 items-center gap-3">${thumb}<div class="min-w-0 flex-1">${open()}${sub}${msg}</div></div></td>
        <td class="${TBL.td}"><div class="flex min-w-0 max-w-48 items-center gap-2 text-small">${avatar(u, "xs")}${admUserLink(u, "text-fg")}</div></td>
        <td class="${TBL.td} ${TBL.tdNum}">${p ? fmt(p.views) : admDash}${p && p.platform ? `<span class="${TBL.tdSub} font-normal">${esc(p.platform)}</span>` : ""}</td>
        <td class="${TBL.td}">${appealBadge(a.status)}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${action("sm")}</div></td>
      </tr>`,
      li: `<li data-row="${a.id}" class="${TBL.item}">
        <div class="flex items-start gap-3">${thumb}<div class="min-w-0 flex-1">${open("text-sm")}${sub}${msg}</div>${appealBadge(a.status)}</div>
        <div class="flex items-center justify-between gap-3 text-small"><span class="flex min-w-0 items-center gap-2">${avatar(u, "xs")}${admUserLink(u, "text-fg-muted")}</span>
          <span class="shrink-0 text-fg-subtle">${p ? `${esc(p.platform)} · ${plural(p.views, "vue", "vues")}` : ""}</span></div>
        <div class="grid sm:flex sm:justify-end">${action("md")}</div>
      </li>`,
    };
  });
  return admTable("xl", `<th scope="col" class="${TBL.th}">${t("Clip contesté")}</th><th scope="col" class="${TBL.th}">${t("Clippeur")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Vues")}</th><th scope="col" class="${TBL.th}">${t("Statut")}</th>${admThActions()}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));
}

function aModeration() {
  const f = state.adm, s = db.settings, all = db.publications;
  const n = (st) => all.filter((p) => p.status === st).length;
  const appealTab = f.modStatus === "Recours", pendingAppeals = admPendingAppeals().length;
  const filtered = all.filter((p) => f.modStatus === "Toutes" || p.status === f.modStatus);
  // Tri par risque : score décroissant, l'ordre d'arrivée départage (tri stable).
  const list = f.modSort === "risk" ? [...filtered].sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0)) : filtered;
  // Règles longues repliées : un résumé d'une ligne, le détail au clic.
  const rules = alertBox("info", `<details class="group">
      <summary class="flex cursor-pointer list-none items-center gap-1.5 font-medium [&::-webkit-details-marker]:hidden">${t("Gains crédités : seuil, plafond et rétention")}${icon("chevronDown", "size-4 shrink-0 transition-transform duration-150 group-open:rotate-180")}</summary>
      <p class="mt-1.5">${t("Les gains d'un clip validé sont crédités au clipper, seuil et plafond appliqués, et restent {hold} en rétention. Pendant {window} après la validation, chaque nouveau relevé paie les vues supplémentaires.", { hold: plural(s.holdDays, "jour", "jours"), window: plural(s.earningDays, "jour", "jours") })}</p>
    </details>`);
  // Recours : en attente d'abord (le plus ancien en premier, comme une file), puis les décidés du plus récent au plus ancien ;
  // tri par risque : score du clip contesté décroissant, à l'intérieur de chaque groupe.
  const riskOf = (a) => (db.publications.find((p) => p.id === a.publicationId) || {}).riskScore || 0;
  const done = (a) => (a.status === "En attente" ? 0 : 1);
  const appealList = [...admAppeals()].sort((a, b) => done(a) - done(b)
    || (f.modSort === "risk" ? riskOf(b) - riskOf(a) : 0)
    || (done(a) ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
  const appealsBody = appealList.length ? admAppealTable(appealList)
    : emptyState("flag", t("Aucun recours"), t("Les contestations des clippers sur un clip refusé apparaîtront ici."));
  const empty = f.modStatus === "En attente"
    ? emptyState("check", t("Tout est à jour"), t("Aucun clip en attente de modération."))
    : emptyState("film", t("Aucun clip dans cette catégorie"), t("Changez de filtre pour voir les autres clips."));
  // amountLabel : texte source français, traduit par publicationsTable.
  return `${pageHeader(t("Modération des clips"), t("Ouvrez chaque clip pour vérifier sa vidéo et ses vues, puis validez ceux qui respectent les règles de la campagne."))}
    <div class="mt-6">${rules}</div>
    ${db.tracking ? `<div class="mt-4">${admTrackingCard()}</div>` : ""}
    ${admToolbar(`<div class="min-w-0">${segmented("adm-mod-status", f.modStatus, [["En attente", t("En attente"), n("En attente")], ["Validée", t("Validées"), n("Validée")], ["Refusée", t("Refusées"), n("Refusée")], ["Recours", t("Recours"), pendingAppeals], ["Toutes", t("Toutes"), all.length]], t("Statut"), { scroll: true })}</div>`,
      `<div class="shrink-0">${segmented("adm-mod-sort", f.modSort === "risk" ? "risk" : "recent", [["recent", t("Plus récents")], ["risk", t("Risque le plus élevé")]], t("Trier les clips"))}</div>`)}
    <div class="mt-4">${appealTab ? appealsBody : list.length ? admPubTable(publicationsTable(list, { showUser: true, actions: true, amountLabel: f.modStatus === "En attente" ? "Gain estimé" : "Gain", tag: admRiskTag })) : empty}</div>`;
}

// ---------- Paiements ----------

// Paiement en ligne (Chargily Pay) : pastille du moyen ; en cours, il attend la confirmation de Chargily (aucune action).
const admChargilyTag = () => badge("Chargily", "brand", { ic: "globe" });
const admOnlineWaiting = () => `<span title="${esc(t("Paiement en ligne : confirmé automatiquement par Chargily"))}">${badge(t("Paiement en ligne en attente"), "warning", { ic: "clock" })}</span>`;
// approveLabel : texte déjà traduit. Une recharge payée en ligne ne se valide ni ne se rejette à la main.
const admPayActions = (tx, size, approveLabel) => (tx.status === "En cours" && !admOnlinePay(tx)
  ? `<button type="button" data-action="adm-tx-reject" data-id="${tx.id}" class="${btn("dangerSoft", size)}">${t("Rejeter")}</button><button type="button" data-action="adm-tx-approve" data-id="${tx.id}" class="${btn("primary", size)}">${approveLabel}</button>`
  : "");
// Carte d'un paiement validé : son document PDF (reçu d'un retrait, facture d'une recharge) sur toute la largeur.
const admDocAction = (tx) => txDocBtn(tx, { size: "md", variant: "secondary", extra: "col-span-2 w-full" });
// Ligne mono + Copier (compte, référence) des cartes : valeur de gauche à droite, y compris en arabe.
const admMonoLine = (label, html, value, copyLabel, msg) =>
  `<div class="grid gap-0.5"><dt class="text-xs text-fg-subtle">${label}</dt><dd class="flex min-w-0 items-center justify-between gap-2"><span class="min-w-0 truncate font-mono text-sm text-fg" dir="ltr">${html}</span>${value ? admCopyBtn(value, copyLabel, msg) : ""}</dd></div>`;
const admMoneyRows = (rows) => `<dl class="grid gap-1.5 text-small">${rows.map(([l, v, strong]) => `<div class="flex items-baseline justify-between gap-4 ${strong ? "border-t border-line pt-2 font-semibold text-fg first:border-t-0 first:pt-0" : "text-fg-muted"}"><dt>${l}</dt><dd class="text-end">${v}</dd></div>`).join("")}</dl>`;
const admWhen = (tx) => `${date(tx.date)}${tx.time ? ` · <span dir="ltr">${esc(tx.time)}</span>` : ""}`;
// Carte d'une demande (sous la largeur du tableau) : identité et coordonnées en tête, argent et décision en bout dès sm.
const admPayItem = (u, sub, badgeHtml, details, moneyHtml, actions, id) => `<li data-row="${id}" class="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] sm:gap-x-8 sm:px-5">
    <div class="grid min-w-0 content-start gap-3">
      <div class="flex items-start gap-3">${avatar(u, "md")}<div class="min-w-0 flex-1"><p class="flex min-w-0 text-sm font-medium text-fg">${admUserLink(u)}</p><p class="truncate text-xs tabular-nums text-fg-subtle">${sub}</p></div>${badgeHtml}</div>
      <dl class="grid gap-2.5 rounded-tile bg-subtle p-3">${details}</dl>
    </div>
    <div class="grid content-start gap-3 sm:pt-1">${moneyHtml}${actions ? `<div class="grid grid-cols-2 gap-2 sm:flex sm:flex-col-reverse">${actions}</div>` : ""}</div>
  </li>`;
const admPayer = (u, tx) => `<div class="flex min-w-0 items-center gap-2.5">${avatar(u, "sm")}<div class="min-w-0"><p class="flex min-w-0 font-medium text-fg">${admUserLink(u)}</p><span class="${TBL.tdSub} tabular-nums">${admWhen(tx)}</span></div></div>`;
// Moyen d'une recharge : la carte (marque et 4 derniers chiffres) pour un paiement Visa / Mastercard, sinon le moyen.
const admRechargeMethod = (tx) => {
  const card_ = admCardOf(tx);
  if (card_) return `<span class="flex flex-wrap items-center gap-1.5">${badge(card_.brand, "idle", { ic: "card" })}${admCardNumber(card_)}</span>`;
  if (admOnlinePay(tx)) return `<span class="flex flex-wrap items-center gap-1.5">${tx.method ? badge(admMethod(tx.method), "idle") : ""}${admChargilyTag()}</span>`;
  return tx.method ? badge(admMethod(tx.method), "idle") : admDash;
};

// Retraits : tableau à partir de 1 400 px (7 colonnes), cartes en dessous. La date de la demande est sous le nom.
function admWithdrawals(list) {
  const rows = list.map((tx) => {
    const u = admUser(tx.userId), acc = admAccountValue(u.payoutAccount), method = tx.method || u.payoutMethod || "", pending = tx.status === "En cours";
    const fee = tx.fee ? admMuted(tx.fee) : admDash, noAccount = t("Aucun compte enregistré");
    return {
      tr: `<tr data-row="${tx.id}" class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}">${admPayer(u, tx)}</td>
        <td class="${TBL.td}"><div class="flex items-center gap-1.5"><div class="grid justify-items-start gap-1">${method ? badge(esc(t(method)), "idle") : ""}${acc ? `<span class="whitespace-nowrap font-mono text-small text-fg" dir="ltr">${admAccount(acc)}</span>` : `<span class="text-xs text-fg-subtle">${noAccount}</span>`}</div>${acc ? admCopyBtn(acc, t("Copier le numéro"), t("Numéro copié")) : ""}</div></td>
        <td class="${TBL.td}"><span class="whitespace-nowrap text-small text-fg">${code(tx.ref)}</span></td>
        <td class="${TBL.td} ${TBL.tdNum}">${money(-tx.amount)}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${fee}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${money(admNet(tx), { cls: "font-semibold" })}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admPayActions(tx, "sm", t("Virement effectué")) || `${statusBadge(tx.status)}${txDocBtn(tx, { compact: true })}`}</div></td>
      </tr>`,
      li: admPayItem(u, t("Demandé le {date}", { date: admWhen(tx) }), pending ? badge(t("À virer"), "info", { dot: true }) : statusBadge(tx.status),
        admMonoLine(method ? t("Compte {method}", { method: esc(t(method)) }) : t("Compte"), acc ? admAccount(acc) : `<span class="font-sans text-small text-fg-subtle" dir="auto">${noAccount}</span>`, acc, t("Copier le numéro"), t("Numéro copié"))
        + admMonoLine(t("Référence"), esc(tx.ref), tx.ref, t("Copier la référence"), t("Référence copiée")),
        admMoneyRows([[t("Montant demandé"), money(-tx.amount)], [t("Frais"), fee], [t("Net à virer"), money(admNet(tx)), true]]),
        admPayActions(tx, "md", t("Virement effectué")) || admDocAction(tx), tx.id),
    };
  });
  return admTable("wide", `<th scope="col" class="${TBL.th}">${t("Bénéficiaire")}</th><th scope="col" class="${TBL.th}">${t("Moyen et compte")}</th><th scope="col" class="${TBL.th}">${t("Référence")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Montant")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Frais")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Net à virer")}</th>${admThActions()}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));
}

// Recharges : tableau à partir de xl (5 colonnes), cartes en dessous. Carte Visa / Mastercard : marque et •••• 4242.
function admRecharges(list) {
  const rows = list.map((tx) => {
    const u = admUser(tx.userId), pending = tx.status === "En cours", card_ = admCardOf(tx), online = admOnlinePay(tx);
    const how = card_ ? `<span dir="ltr">${card_.brand} •••• ${card_.last4}</span>` : admMethod(tx.method);
    return {
      tr: `<tr data-row="${tx.id}" class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}">${admPayer(u, tx)}</td>
        <td class="${TBL.td}">${admRechargeMethod(tx)}</td>
        <td class="${TBL.td}"><span class="flex items-center gap-0.5"><span class="whitespace-nowrap text-small text-fg">${code(tx.ref)}</span>${admCopyBtn(tx.ref, t("Copier la référence"), t("Référence copiée"))}</span></td>
        <td class="${TBL.td} ${TBL.tdNum}">${money(tx.amount, { cls: "font-semibold" })}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admPayActions(tx, "sm", t("Paiement reçu")) || (pending && online ? admOnlineWaiting() : `${statusBadge(tx.status)}${txDocBtn(tx, { compact: true })}`)}</div></td>
      </tr>`,
      li: admPayItem(u, `${how || t("Recharge")} · ${admWhen(tx)}`, pending ? (online ? admOnlineWaiting() : badge(t("À confirmer"), "info", { dot: true })) : statusBadge(tx.status),
        (card_ ? `<div class="grid gap-0.5"><dt class="text-xs text-fg-subtle">${t("Carte")}</dt><dd class="flex items-center gap-1.5">${badge(card_.brand, "idle", { ic: "card" })}${admCardNumber(card_)}</dd></div>` : "")
        + (online ? `<div class="grid gap-0.5"><dt class="text-xs text-fg-subtle">${t("Paiement en ligne")}</dt><dd class="flex flex-wrap items-center gap-1.5">${admChargilyTag()}<span class="text-xs text-fg-muted">${t("Confirmé automatiquement par Chargily.")}</span></dd></div>` : "")
        + admMonoLine(t("Référence du paiement"), esc(tx.ref), tx.ref, t("Copier la référence"), t("Référence copiée"))
        + (online && tx.providerRef ? admMonoLine(t("Identifiant Chargily"), esc(tx.providerRef), tx.providerRef, t("Copier l'identifiant"), t("Identifiant copié")) : ""),
        admMoneyRows([[online ? t("Montant payé en ligne") : t("Montant annoncé"), money(tx.amount), true]]),
        admPayActions(tx, "md", t("Paiement reçu")) || admDocAction(tx), tx.id),
    };
  });
  return admTable("xl", `<th scope="col" class="${TBL.th}">${t("Agence")}</th><th scope="col" class="${TBL.th}">${t("Moyen")}</th><th scope="col" class="${TBL.th}">${t("Référence")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Montant")}</th>${admThActions()}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));
}

function aRetraits() {
  const tab = state.adm.payTab === "recharges" ? "recharges" : "retraits";
  // Les demandes à traiter d'abord, puis l'historique (ordre du serveur conservé).
  const byType = (type) => db.transactions.filter((tx) => tx.type === type).sort((a, b) => (b.status === "En cours") - (a.status === "En cours"));
  const pw = pendingWithdrawals(), pr = pendingRecharges();
  const tabs = [["retraits", t("Retraits"), t("Retraits des clippers"), pw.length], ["recharges", t("Recharges"), t("Recharges des agences"), pr.length]];
  const tablist = `<div class="${TABLIST}" role="tablist" aria-label="${esc(t("Type de paiement"))}">${tabs.map(([v, short, long, n]) =>
    `<button type="button" role="tab" id="adm-tab-${v}" aria-controls="adm-pay-panel" aria-selected="${tab === v}" data-action="adm-pay-tab" data-value="${v}" class="${TAB}"><span class="sm:hidden">${short}</span><span class="hidden sm:inline">${long}</span>${n ? countBadge(n, "queue") : ""}</button>`).join("")}</div>`;
  const list = byType(tab === "retraits" ? "retrait" : "recharge");
  const intro = tab === "retraits"
    ? [t("Approuvez après avoir effectué le virement vers le compte indiqué."), pw.length ? t("{count} · {amount} à virer", { count: plural(pw.length, "demande", "demandes"), amount: da(admSum(pw, admNet)) }) : ""]
    : [t("Confirmez à réception du paiement (virement, carte Visa ou Mastercard) : le montant est alors ajouté au crédit de l'agence. Les paiements en ligne par carte Edahabia ou CIB sont confirmés automatiquement par Chargily."), pr.length ? t("{count} · {amount} annoncés", { count: plural(pr.length, "recharge", "recharges"), amount: da(admSum(pr, (tx) => tx.amount)) }) : ""];
  const body = list.length
    ? (tab === "retraits" ? admWithdrawals(list) : admRecharges(list))
    : tab === "retraits"
      ? emptyState("wallet", t("Aucune demande de retrait"), t("Les demandes des clippers apparaîtront ici."))
      : emptyState("bank", t("Aucune recharge"), t("Les recharges annoncées par les agences apparaîtront ici."));
  const exportBtn = `<button type="button" data-action="adm-export" class="${btn("secondary")}">${icon("download")}${t("Exporter en CSV")}</button>`;
  return `${pageHeader(t("Paiements"), t("Retraits des clippers (minimum {amount}) et recharges de crédit des agences.", { amount: da(db.settings.minWithdraw) }), exportBtn)}
    <div class="mt-6">${tablist}</div>
    <div id="adm-pay-panel" role="tabpanel" aria-labelledby="adm-tab-${tab}">
      <div class="mt-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"><p class="text-small text-fg-muted">${intro[0]}</p>${intro[1] ? `<p class="shrink-0 text-small font-medium tabular-nums text-fg">${intro[1]}</p>` : ""}</div>
      <div class="mt-4">${body}</div>
    </div>`;
}

// Export CSV des transactions (Excel en français : « ; », UTF-8) : type (gains compris), statut et période facultatifs.
function admExportModal(m) {
  const sel = (name, value, options) => `<span class="relative block"><select name="${name}" class="${selectCls}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>${CHEVRON}</span>`;
  const day = (name) => `<input type="date" name="${name}" class="${inputCls} tabular-nums" dir="ltr" max="9999-12-31"/>`;
  return modalShell({
    title: t("Exporter les transactions"), description: t("Fichier CSV pour Excel ou un tableur : une ligne par transaction, avec son document."), form: "adm-export",
    body: `<div class="grid gap-4">
        <div class="grid gap-4 sm:grid-cols-2">
          ${field(t("Type"), sel("type", m.kind || "", [["", t("Toutes les transactions")], ["gain", t("Gains")], ["retrait", t("Retraits")], ["recharge", t("Recharges")]]))}
          ${field(t("Statut"), sel("status", "", [["", t("Tous les statuts")], ["Validé", t("Validé")], ["En cours", t("En cours")], ["Refusé", t("Refusé")]]))}
          ${field(`${t("Du")} ${OPTIONAL}`, day("from"))}
          ${field(`${t("Au")} ${OPTIONAL}`, day("to"))}
        </div>
        ${alertBox("info", t("Colonnes : référence, date et heure (UTC), type, utilisateur, email, rôle, libellé, montant, frais, statut, moyen et numéro de facture ou de reçu."))}
      </div>`,
    footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><button type="submit" class="${btn("primary")}">${icon("download")}${t("Exporter en CSV")}</button>`,
  });
}

// ---------- Réglages ----------

// Aperçu en direct du formulaire de réglages : compteur et bandeau d'annonce (texte libre de l'admin, non traduit).
LIVE.admSettings = (d) => {
  const text = String(d.announcement || "").trim();
  return {
    count: `${fmt(String(d.announcement || "").length)}${NB}/${NB}140`,
    preview: text
      ? `<div class="flex items-center gap-2 rounded-control border border-brand-line bg-brand-soft px-3 py-2 text-small font-medium text-brand-fg">${icon("megaphone", "size-4 shrink-0")}<span class="min-w-0 truncate" dir="auto">${esc(text)}</span></div>`
      : `<p class="text-xs text-fg-subtle">${t("Aucun bandeau affiché.")}</p>`,
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
// Champs numériques des réglages : bornes vérifiées avant l'envoi (mêmes règles que le serveur). Libellé : texte source
// français, traduit à l'affichage (message d'erreur) ; 4e valeur : nombre décimal accepté.
const ADM_LIMITS = {
  minWithdraw: ["Retrait minimum", 0, Infinity], minBudget: ["Budget minimum d'une campagne", 0, Infinity], commissionRate: ["Commission ClipBoost", 0, 50],
  instantFeePercent: ["Frais du retrait instantané", 0, 20, true], instantMinFee: ["Frais minimum du retrait instantané", 0, Infinity],
  holdDays: ["Rétention des gains", 0, 60], earningDays: ["Fenêtre de gains", 1, 60],
};
// Valeur affichée avec séparateur de milliers (« 50 000 ») ou virgule décimale (« 2,5 »). unit : "DA", "%" ou "jours"
// (accordé à la valeur enregistrée : « 1 jour », « 14 jours » ; « 14 يومًا » en arabe).
const admNumber = (s, key, unit) => {
  const decimal = ADM_LIMITS[key][3], v = Number(s[key]) || 0;
  const u = unit === "DA" ? t("DA") : unit === "jours" ? tPlural(v, "jour", "jours") : unit;
  return unitInput(`id="set-${key}" name="${key}" type="text" ${decimal ? 'inputmode="decimal" ' : ""}value="${decimal ? String(v).replace(".", ",") : fmt(v)}" autocomplete="off" aria-describedby="set-${key}-desc"`, u);
};

function aParametres() {
  const s = db.settings, live = LIVE.admSettings(s);
  const group = (title, desc, rows) => card(`${cardHeader(title, desc)}<div class="mt-4 divide-y divide-line">${rows}</div>`);
  return `${pageHeader(t("Réglages du site"), t("Ces réglages s'appliquent immédiatement à tout le site."))}
    <div class="mt-6 grid max-w-3xl gap-4 lg:gap-5">
      ${group(t("Accès"), t("Ces interrupteurs prennent effet dès le clic."),
        admSwitchRow(s, "signupsOpen", t("Inscriptions ouvertes"), t("Autoriser la création de nouveaux comptes Clipper et Agence."))
        + admSwitchRow(s, "maintenance", t("Mode maintenance"), t("Bloque la connexion des clippers et des agences et affiche un bandeau.")))}
      <form data-form="adm-settings" data-live="admSettings" novalidate class="grid gap-4 lg:gap-5">
        ${card(`${cardHeader(t("Annonce"), t("Bandeau affiché en haut du site et des espaces."))}
          <div class="mt-4 grid gap-1.5">
            <div class="flex items-baseline justify-between gap-3"><label for="set-announcement" class="text-small font-medium text-fg">${t("Texte de l'annonce")}</label><span data-live-out="count" dir="ltr" class="text-xs tabular-nums text-fg-subtle">${live.count}</span></div>
            <textarea id="set-announcement" name="announcement" rows="3" maxlength="140" dir="auto" placeholder="${esc(t("Ex. Nouvelle campagne Ramadan disponible"))}" aria-describedby="set-announcement-desc" class="${textareaCls}">${esc(s.announcement)}</textarea>
            <span id="set-announcement-desc" class="text-xs text-fg-subtle">${t("Laisser vide pour masquer le bandeau.")}</span>
          </div>
          <div class="mt-4 grid gap-1.5"><span class="text-small font-medium text-fg">${t("Aperçu")}</span><div data-live-out="preview">${live.preview}</div></div>`)}
        ${group(t("Argent"), t("Montants et commissions appliqués aux retraits et aux campagnes."),
          admSettingRow(t("Retrait minimum"), t("Montant minimum qu'un clipper peut retirer."), admNumber(s, "minWithdraw", "DA"), "set-minWithdraw")
          + admSettingRow(t("Budget minimum d'une campagne"), t("Budget exigé pour créer une campagne."), admNumber(s, "minBudget", "DA"), "set-minBudget")
          + admSettingRow(t("Commission ClipBoost"), t("Ajoutée au budget des nouvelles campagnes."), admNumber(s, "commissionRate", "%"), "set-commissionRate")
          + admSettingRow(t("Frais du retrait instantané"), t("Pourcentage prélevé sur un retrait instantané."), admNumber(s, "instantFeePercent", "%"), "set-instantFeePercent")
          + admSettingRow(t("Frais minimum du retrait instantané"), t("Montant prélevé au minimum sur un retrait instantané."), admNumber(s, "instantMinFee", "DA"), "set-instantMinFee"))}
        ${group(t("Délais"), t("Contrôle et rémunération des clips validés."),
          admSettingRow(t("Rétention des gains"), t("Délai de contrôle avant qu'un gain validé devienne retirable."), admNumber(s, "holdDays", "jours"), "set-holdDays")
          + admSettingRow(t("Fenêtre de gains"), t("Après la validation, chaque nouveau relevé paie les vues supplémentaires pendant ce délai."), admNumber(s, "earningDays", "jours"), "set-earningDays"))}
        ${card(`${cardHeader(t("Primes du classement hebdomadaire"), t("Versées chaque lundi aux 10 clippers qui ont le plus de vues validées la semaine écoulée. ClipBoost les paie : aucune campagne n'est débitée. 0 DA : pas de prime pour ce rang."))}
          <div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">${(s.weeklyPrizes || []).map((v, i) => `<div data-field class="grid min-w-0 gap-1.5"><label for="set-prize-${i}" class="text-small font-medium text-fg">${lbOrdinal(i + 1)}</label>
            ${unitInput(`id="set-prize-${i}" name="prize-${i}" type="text" value="${fmt(v)}" autocomplete="off"`, t("DA"))}</div>`).join("")}</div>`)}
        <div data-sticky-save class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-4 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-popover backdrop-blur-md sm:px-5 lg:bottom-4">
          <p class="hidden text-small text-fg-muted sm:block">${t("Annonce, montants, délais et primes s'appliquent à tout le site dès l'enregistrement.")}</p>
          <button type="submit" class="${btn("primary", "md", "w-full sm:w-auto")}">${t("Enregistrer")}</button>
        </div>
      </form>
      ${window.__CLIPBOOST_OFFLINE__ ? `<section class="mt-4 flex flex-col gap-3 rounded-card border border-dashed border-line-strong p-5 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0"><h2 class="text-section text-fg">${t("Version de démonstration")}</h2><p class="mt-0.5 text-small text-fg-muted">${t("Les données sont enregistrées dans ce navigateur.")}</p></div>
        <button type="button" data-action="adm-reset-demo" class="${btn("dangerSoft", "sm")}">${t("Réinitialiser la démo")}</button></section>` : ""}
    </div>`;
}

// ---------- Classement hebdomadaire ----------
// Semaine en cours en direct (top 10, places primées libres), chiffres clés et historique des primes versées par semaine
// clôturée (db.leaderboard.history). Chaque nom mène à la fiche du clipper. La clôture est automatique (relevé des vues).
const admLbName = (r) => admUserLink(userById(r.userId) || { id: r.userId, name: r.name }, "text-fg");

function aClassement() {
  const lb = lbData();
  if (!lb) return pageHeader(t("Classement hebdomadaire"), "");
  const history = lb.history || [], paid = admSum(history, (w) => admSum(w.winners, (x) => x.amount));
  const atStake = admSum(lb.top, (r) => r.prize);
  const kpis = [
    kpi({ label: t("Clippers classés"), value: kpiValue(fmt(lb.ranked)), sub: t("Semaine {n}", { n: fmt(lb.number) }), ic: "users" }),
    kpi({ label: t("Primes en jeu"), value: bigMoney(atStake), sub: t("sur {amount} au total", { amount: da(admSum(lb.prizes, (x) => x)) }), ic: "trophy" }),
    kpi({ label: t("Fin de la semaine dans"), value: `<span class="text-base font-semibold tracking-tight text-fg tabular-nums sm:text-xl">${lbTimeLeft(lb.end)}</span>`, sub: t("Dimanche à minuit, heure d'Alger"), ic: "clock" }),
    kpi({ label: t("Primes versées"), value: bigMoney(paid), sub: t("sur {weeks}", { weeks: plural(history.length, "semaine clôturée", "semaines clôturées") }), ic: "wallet" }),
  ];
  const current = card(`${cardHeader(t("Semaine {n}", { n: fmt(lb.number) }), t("Vues validées gagnées depuis lundi 00:00 (heure d'Alger), en direct."), badge(t("En direct"), "success", { dot: true }))}
    ${lb.top.length ? "" : `<p class="mt-4 text-small text-fg-subtle">${t("Aucune vue validée cette semaine pour l'instant.")}</p>`}
    <div class="mt-2">${lbRows(lb.top, { name: admLbName, open: lbOpenRanks(lb) })}</div>`, "p-5");
  const past = card(`${cardHeader(t("Primes versées"), t("Semaines clôturées, la plus récente d'abord."))}
    ${history.length ? `<div class="mt-4 grid gap-6">${history.map((w) => `<section aria-label="${esc(t("Semaine {n}", { n: fmt(w.number) }))}">
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h3 class="text-sm font-semibold text-fg">${t("Semaine {n}", { n: fmt(w.number) })}</h3>
          <p class="text-xs tabular-nums text-fg-subtle">${w.closedAt ? `${date(w.closedAt)} · ` : ""}${da(admSum(w.winners, (x) => x.amount))}</p></div>
        ${lbRows(w.winners, { name: admLbName, amountKey: "amount" })}</section>`).join("")}</div>`
      : emptyState("trophy", t("Aucune semaine clôturée"), t("La semaine écoulée est clôturée au premier relevé des vues du lundi."), "", { inCard: true })}`, "p-5");
  return `${pageHeader(t("Classement hebdomadaire"), t("Les clippers classés par vues validées, du lundi au dimanche (heure d'Alger). Les 10 premiers reçoivent une prime à la clôture de la semaine, faite par le relevé des vues."),
      `<a href="#/admin/parametres" class="${btn("secondary")}">${icon("gear")}${t("Modifier les primes")}</a>`)}
    <div class="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">${kpis.join("")}</div>
    <div class="mt-4 grid items-start gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">${current}${past}</div>`;
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
      ${cardHeader(t("Profil"), t("Votre photo et votre nom s'affichent dans la barre du haut et dans le journal d'activité."))}
      <div class="mt-5">${imageField({ name: "avatar", value: u.avatar || "", shape: "avatar", label: t("Photo de profil"), hint: t("JPEG, PNG ou WebP. Elle est recadrée en carré et s'affiche en rond."), fallback })}</div>
      <div class="mt-5">${field(t("Nom"), `<input name="name" required maxlength="80" value="${esc(u.name)}" autocomplete="name" dir="auto" class="${inputCls}"/>`)}</div>
      <div class="mt-6 flex justify-end"><button type="submit" class="${btn("primary", "md", "w-full sm:w-auto")}">${t("Enregistrer")}</button></div>
    </form>`);
  const prefs = card(`${cardHeader(t("Préférences"), t("La langue et l'apparence de votre espace."))}
      <div class="mt-4 divide-y divide-line">
        ${pref(t("Langue"), t("Enregistrée sur votre compte : elle vous suit sur tous vos appareils."), langSwitch({ full: true, cls: "w-full sm:w-auto" }))}
        ${pref(t("Thème"), t("Clair, sombre, ou selon le réglage de votre appareil."), themeModeSwitch({ labels: true, cls: "w-full sm:w-auto" }))}
      </div>`);
  return `${pageHeader(t("Mon compte"), t("Votre photo, votre nom, la langue et le thème de l'administration, et la sécurité du compte."),
      `<a href="#/admin/parametres" class="${btn("secondary")}">${icon("gear")}${t("Réglages du site")}</a>`)}
    <div class="mt-6 grid items-start gap-4 lg:gap-5 xl:grid-cols-2">
      <div class="grid content-start gap-4 lg:gap-5">${profile}${prefs}</div>
      <div class="grid content-start gap-4 lg:gap-5">${accountCard(u)}</div>
    </div>`;
}

// utilisateur : page hors navigation (ITEM_PAGES dans main.js) ; compte : « Mon compte », ouverte par le menu du compte.
// Messages : questions des clippers sur les campagnes de ClipBoost, auxquelles l'équipe répond (#/admin/messages/<campagne>~<clipper>).
const aMessages = () => msgTeamPage({
  area: "admin", form: "adm-msg", campaignAction: "adm-camp", filter: state.adm.msgFilter || "all", filterAction: "adm-msg-filter",
  title: t("Messages"), text: t("Les questions des clippers sur les campagnes de ClipBoost. Les agences répondent elles-mêmes sur leurs campagnes."),
  emptyText: t("Les clippers peuvent poser une question depuis la fiche de chaque campagne de ClipBoost active ou en pause."),
});

const ADMIN_VIEWS = { apercu: aApercu, messages: aMessages, utilisateurs: aUtilisateurs, utilisateur: aUtilisateur, campagnes: aCampagnes, moderation: aModeration, retraits: aRetraits, classement: aClassement, parametres: aParametres, compte: aCompte };

// ---------- Fiches d'examen ----------

const admTile = (label, value, sub = "", cls = "") => `<div class="${TILE} ${cls}"><dt class="text-xs text-fg-subtle">${label}</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${value}${sub ? `<span class="mt-0.5 block text-xs font-normal text-fg-subtle">${sub}</span>` : ""}</dd></div>`;
const admH3 = (title, extra = "") => `<div class="mt-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"><h3 class="text-section text-fg">${title}</h3>${extra}</div>`;
// Règles écrites par l'agence : texte libre, affiché tel quel (dir="auto" : une règle en arabe se lit de droite à gauche).
const admRules = (c) => (c.rules && c.rules.length
  ? `<ul class="mt-2 grid gap-2">${c.rules.map((r) => `<li class="flex gap-2.5 text-sm text-fg-muted">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span class="min-w-0 break-words" dir="auto">${esc(r)}</span></li>`).join("")}</ul>`
  : `<p class="mt-2 text-sm text-fg-subtle">${t("Aucune règle particulière.")}</p>`);
const admPlatforms = (c) => `<div class="mt-2 flex flex-wrap gap-1.5">${PLATFORMS.filter((p) => (c.platforms || []).includes(p)).concat((c.platforms || []).filter((p) => !PLATFORMS.includes(p))).map(platformTag).join("")}</div>`;

// Dernière modification de la campagne par son agence (journal d'activité), pour l'examen d'une campagne en attente.
// Comparaison avec les textes français du serveur (jamais traduits ici : ce sont des clés, pas un affichage).
function admCampEdit(c, o) {
  if (!o) return null;
  const edited = `${o.name} a modifié la campagne « ${c.title} ».`, relaunched = `${o.name} a modifié et relancé la campagne « ${c.title} ».`;
  const a = (db.activity || []).find((x) => x.text === edited || x.text === relaunched);
  if (a) return { at: a.at, relaunch: a.text === relaunched };
  return c.updatedAt && c.updatedAt.slice(0, 10) !== c.createdAt ? { at: c.updatedAt, relaunch: false } : null;
}

// Indication sous le statut d'une campagne, dans la fiche d'examen.
function admCampHint(c, o, edit) {
  if (c.status === "En attente") {
    if (!edit) return t("Soumise le {date}, en attente de votre vérification.", { date: date(c.createdAt) });
    return edit.relaunch ? t("Relancée par l'agence le {date} après un refus : vérifiez ses corrections.", { date: date(edit.at) }) : t("Modifiée par l'agence le {date}.", { date: date(edit.at) });
  }
  if (c.status === "Active") return t("En ligne : visible par les clippers, qui peuvent la rejoindre et soumettre des clips.");
  if (c.status === "En pause") return t("En pause : elle n'accepte ni nouveaux clippers ni nouveaux clips.");
  if (c.status === "Terminée") return o ? t("Terminée : le budget non consommé a été rendu au crédit de l'agence.") : t("Terminée : elle n'accepte plus de clips.");
  if (c.status === "Refusée") return t("Refusée le {date}. L'agence peut la modifier et la relancer, ou la supprimer.", { date: date(c.updatedAt || c.createdAt) });
  return "";
}

// Fiche d'examen d'une campagne : photo, agence (fiche, badge, crédit), chiffres, financement, clips, plateformes,
// règles, mise en avant ; décisions selon le statut (approuver, refuser avec motif, pause, reprise, fin).
function admCampSheet(m) {
  const c = campaignById(m.id);
  if (!c) return admGone(t("Campagne introuvable"), t("Cette campagne a été annulée ou supprimée par son agence."));
  const o = c.ownerId ? userById(c.ownerId) : null, pending = c.status === "En attente", refused = c.status === "Refusée";
  const funded = !pending && !refused, closed = c.status === "Terminée" || refused;
  const cost = admFunding(c.budget, c.commissionRate), fee = cost - c.budget, credit = o ? o.credit || 0 : 0;
  const short = pending && o ? Math.max(0, cost - credit) : 0;
  const clips = db.publications.filter((p) => p.campaign === c.id);
  const edit = pending ? admCampEdit(c, o) : null;
  const commissionLabel = t("Commission ClipBoost ({rate} %)", { rate: c.commissionRate });

  const cover = `<div class="cover relative aspect-[16/9] overflow-hidden rounded-tile sm:aspect-[5/2]" ${coverAttr(c)}>${coverArt(c, "text-6xl")}
      <span class="absolute start-3 top-3 rounded-badge bg-night/80 px-2 py-1 text-small font-semibold tabular-nums text-on-brand backdrop-blur-sm"><span class="inline-flex items-baseline gap-1">${da(c.rate)}<span class="text-[11px] font-medium text-on-brand/80">${t("/ 1k vues")}</span></span></span>
      ${c.top ? `<span class="absolute bottom-3 start-3 inline-flex items-center gap-1 rounded-badge bg-on-brand/90 px-1.5 py-0.5 text-[11px] font-semibold text-night">${icon("star", "size-3", true)}${t("Top campagne")}</span>` : ""}</div>`;

  const status = `<div class="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">${statusBadge(c.status)}<span class="min-w-0 text-small text-fg-muted">${admCampHint(c, o, edit)}</span></div>`;
  const reason = refused && c.reviewNote ? `<div class="mt-4">${alertBox("danger", `<p class="font-medium">${t("Motif du refus")}</p><p class="mt-0.5 break-words" dir="auto">${esc(c.reviewNote)}</p>`)}</div>` : "";

  // Organisateur : l'agence (lien vers sa fiche, badge, contact, crédit actuel), sinon ClipBoost.
  const org = o
    ? `<div class="mt-4 flex items-center gap-3 rounded-tile border border-line p-3">${avatar(o, "md")}
        <div class="min-w-0 flex-1"><p class="text-xs text-fg-subtle">${t("Agence")}</p>
          <p class="flex min-w-0 text-sm font-medium text-fg">${admUserLink(o, "", { inModal: true })}</p>
          <p class="truncate text-xs text-fg-subtle"><span dir="ltr">${esc(o.email || "")}</span>${o.contact ? ` · <span dir="auto">${esc(o.contact)}</span>` : ""}</p></div>
        <div class="shrink-0 text-end"><p class="text-xs text-fg-subtle">${t("Crédit")}</p><p class="text-sm font-semibold">${money(credit)}</p></div></div>`
    : `<div class="mt-4 flex items-center gap-3 rounded-tile border border-line p-3"><span class="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand">${icon("play", "size-4 translate-x-px", true)}</span>
        <div class="min-w-0"><p class="text-xs text-fg-subtle">${t("Organisateur")}</p><p class="text-sm font-medium text-fg">${c.ownerId ? t("Agence supprimée") : t("Campagne gérée par ClipBoost")}</p></div></div>`;

  // Catégorie hors liste : précisée par l'agence (« Autre »), affichée telle quelle.
  const custom = !CATEGORIES.includes(c.category);
  const facts = `<dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div class="min-w-0"><dt class="text-xs text-fg-subtle">${t("Marque")}</dt><dd class="mt-0.5 break-words font-medium text-fg">${esc(c.brand)}</dd></div>
      <div class="min-w-0"><dt class="text-xs text-fg-subtle">${t("Catégorie")}</dt><dd class="mt-0.5 break-words font-medium text-fg">${esc(t(c.category))}${custom ? `<span class="block text-xs font-normal text-fg-subtle">${t("« Autre », précisée par l'agence")}</span>` : ""}</dd></div>
      <div class="min-w-0"><dt class="text-xs text-fg-subtle">${t("Créée le")}</dt><dd class="mt-0.5 font-medium tabular-nums text-fg">${date(c.createdAt)}</dd></div>
      <div class="min-w-0"><dt class="text-xs text-fg-subtle">${t("Dernière mise à jour")}</dt><dd class="mt-0.5 font-medium tabular-nums text-fg">${date(c.updatedAt || c.createdAt)}</dd></div>
    </dl>`;

  const pay = `${admH3(t("Rémunération des clippers"))}
    <dl class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      ${admTile(t("Tarif"), da(c.rate), t("pour 1 000 vues · 100 000 vues = {amount}", { amount: da(c.rate * 100) }), "col-span-2 sm:col-span-1")}
      ${admTile(t("Seuil par clip"), da(c.minPayout), t("payé dès {views}", { views: plural(viewsFor(c, c.minPayout), "vue", "vues") }))}
      ${admTile(t("Plafond par clip"), da(c.maxPayout), t("atteint à {views}", { views: plural(viewsFor(c, c.maxPayout), "vue", "vues") }))}
    </dl>`;

  // Financement : ce qui sera débité à l'approbation (et le crédit de l'agence), ou ce qui a été consommé.
  const waiting = o ? admSum(pendingRecharges().filter((tx) => tx.userId === o.id), (tx) => tx.amount) : 0;
  const payLink = `<a href="#/admin/retraits" data-action="adm-focus" data-value="recharges" class="${btn("link")}">${t("Voir dans Paiements")}</a>`;
  let money_;
  if (pending || refused) {
    const shortAlert = () => alertBox("warning", `<p><strong class="font-semibold">${t("Crédit de l'agence insuffisant.")}</strong> ${t("{credit} disponibles : il manque {missing}. L'approbation sera possible dès que l'agence aura rechargé son crédit.", { credit: da(credit), missing: `<strong class="font-semibold tabular-nums">${da(short)}</strong>` })}</p>${waiting
      ? `<p class="mt-1">${waiting >= short ? t("Une recharge de {amount} attend votre confirmation, ce qui suffirait.", { amount: da(waiting) }) : t("Une recharge de {amount} attend votre confirmation.", { amount: da(waiting) })} ${payLink}</p>` : ""}`);
    money_ = o
      ? `${summary([[t("Budget de la campagne"), money(c.budget)], [commissionLabel, money(fee)], [refused ? t("Aurait été débité à l'approbation") : t("Débité à l'approbation"), money(cost), true]])}
        ${pending ? (short
          ? `<div class="mt-3" id="adm-credit-short">${shortAlert()}</div>`
          : `<p class="mt-3 text-xs tabular-nums text-fg-subtle">${t("Crédit actuel de l'agence : {credit}. Il restera {left} après l'approbation.", { credit: da(credit), left: da(credit - cost) })}</p>`)
          : `<p class="mt-3 text-xs text-fg-subtle">${t("Rien n'a été débité du crédit de l'agence.")}</p>`}`
      : summary([[t("Budget de la campagne"), money(c.budget)], [t("Commission ClipBoost"), t("Aucune")]]);
  } else {
    const remaining = Math.max(0, c.budget - c.spent);
    money_ = `<div class="mt-2">${progress(c.spent, c.budget, { aria: t("Budget consommé de {title}", { title: c.title }) })}</div>
      ${summary([[t("Budget"), money(c.budget)], [t("Consommé (gains des clippers)"), money(c.spent)],
        [c.status === "Terminée" ? (o ? t("Rendu à l'agence") : t("Non consommé")) : t("Restant"), money(remaining)],
        o ? [commissionLabel, money(Math.round((c.spent * c.commissionRate) / 100))] : [t("Commission ClipBoost"), t("Aucune")]])}`;
  }
  const budget = `${admH3(t("Budget et financement"))}${money_}`;

  // Clips reçus (campagne en ligne ou terminée) : chacun ouvre sa fiche par-dessus celle-ci.
  const toModerate = clips.filter((p) => p.status === "En attente").length;
  const clipList = !funded ? "" : `${admH3(t("Clips"))}
    <dl class="mt-2 grid grid-cols-3 gap-2">
      ${admTile(t("Clippers"), fmt(c.clippers), t("ont rejoint"))}
      ${admTile(t("Clips reçus"), fmt(clips.length), toModerate ? t("{n} à modérer", { n: fmt(toModerate) }) : t("tout est modéré"))}
      ${admTile(t("Vues validées"), compact(admSum(clips.filter((p) => p.status === "Validée"), (p) => p.views)), t("sur les clips validés"))}
    </dl>
    ${clips.length ? `<ul class="mt-3 divide-y divide-line overflow-hidden rounded-tile border border-line">${clips.slice(0, 5).map((p) => {
      const cu = userById(p.userId);
      return `<li><button type="button" data-action="adm-clip" data-id="${p.id}" class="flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors duration-150 hover:bg-subtle ${FOCUS_INSET}">
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-fg-muted" aria-hidden="true">${icon(PLATFORM_ICON[p.platform] || "film", "size-4")}</span>
        <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium text-fg">${esc(p.title)}</span><span class="block truncate text-xs tabular-nums text-fg-subtle">${esc(cu ? cu.name : t("Compte supprimé"))} · ${plural(p.views, "vue", "vues")} · ${date(p.date)}</span></span>
        ${statusBadge(p.status)}</button></li>`;
    }).join("")}</ul>${clips.length > 5 ? `<p class="mt-2 text-xs text-fg-subtle">${t("{count} dans la modération.", { count: plural(clips.length - 5, "autre clip", "autres clips") })}</p>` : ""}`
      : `<p class="mt-3 rounded-tile border border-dashed border-line-strong px-4 py-5 text-center text-small text-fg-muted">${t("Aucun clip reçu pour l'instant.")}</p>`}`;

  const top = closed ? "" : `<div class="mt-6 flex items-center justify-between gap-6 rounded-tile border border-line p-3.5">
      <div class="min-w-0"><p class="flex items-center gap-1.5 text-sm font-medium text-fg">${icon("star", "size-4 shrink-0 text-fg-subtle")}${t("Top campagne")}</p>
        <p class="mt-0.5 text-xs text-fg-subtle">${pending ? t("Mise en avant en tête de Découvrir et de l'accueil public, dès son approbation.") : t("Mise en avant en tête de Découvrir et de l'accueil public.")}</p></div>
      ${switchBtn(!!c.top, "adm-camp-top", c.id, t("Top campagne"))}</div>`;

  const b = (action, variant, label, extra = "") => `<button type="button" data-action="${action}" data-id="${c.id}" class="${btn(variant)}"${extra}>${label}</button>`;
  const close = `<button type="button" data-action="close-modal" class="${btn(closed ? "secondary" : "ghost")}">${t("Fermer")}</button>`;
  const footer = close + (
    pending ? b("adm-camp-refuse", "dangerSoft", t("Refuser")) + b("adm-camp-approve", "primary", `${icon("check")}${t("Approuver")}`, short ? ` disabled aria-describedby="adm-credit-short" title="${esc(t("Crédit de l'agence insuffisant"))}"` : "")
    : c.status === "Active" ? b("adm-camp-end", "dangerSoft", t("Terminer")) + b("adm-camp-pause", "secondary", `${icon("pause")}${t("Mettre en pause")}`)
    : c.status === "En pause" ? b("adm-camp-end", "dangerSoft", t("Terminer")) + b("adm-camp-resume", "primary", `${icon("play")}${t("Reprendre")}`)
    : "");

  return modalShell({
    title: esc(c.title), description: `${esc(c.brand)} · ${esc(t(c.category))}`, size: "xl", footer,
    body: `${cover}${status}${reason}${org}${facts}${pay}${budget}${clipList}
      ${admH3((c.platforms || []).length > 1 ? t("Plateformes acceptées") : t("Plateforme acceptée"))}${admPlatforms(c)}
      ${admH3(t("Règles de la campagne"))}${admRules(c)}
      ${top}`,
  });
}

// Lien de la vidéo d'un clip (copier, ouvrir sur sa plateforme) : fiche d'examen du clip et fiche d'un recours.
function admClipLinkBox(p) {
  const ic = PLATFORM_ICON[p.platform] || "film", platform = esc(p.platform);
  return `<div class="flex flex-col gap-3 rounded-tile border border-line p-3 sm:flex-row sm:items-center">
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-tile bg-muted text-fg" aria-hidden="true">${icon(ic, "size-5")}</span>
        <div class="min-w-0 flex-1"><p class="text-xs text-fg-subtle">${t("Lien {platform}", { platform })}</p>
          <p class="mt-0.5 flex min-w-0 items-center gap-0.5"><span class="min-w-0 break-all font-mono text-small text-fg" dir="ltr">${esc(p.url || "")}</span>${p.url ? admCopyBtn(p.url, t("Copier le lien"), t("Lien copié")) : ""}</p></div>
      </div>
      ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="${btn("secondary", "md", "shrink-0")}">${icon("external")}${t("Ouvrir sur {platform}", { platform })}</a>` : ""}
    </div>`;
}
// Clipper (lien vers son profil) et campagne (sa fiche, par-dessus) d'un clip : fiche du clip et fiche d'un recours.
function admClipPeople(p, c) {
  const u = userById(p.userId), o = c.ownerId ? userById(c.ownerId) : null;
  return `<div class="mt-4 grid gap-2 sm:grid-cols-2">
      <div class="flex min-w-0 items-center gap-3 rounded-tile border border-line p-3">${u ? avatar(u, "md") : avatar({ id: p.userId, name: "?", role: "clipper" }, "md")}
        <div class="min-w-0 flex-1"><p class="text-xs text-fg-subtle">${t("Clipper")}</p><p class="flex min-w-0 text-sm font-medium text-fg">${admUserLink(u, "", { inModal: true })}</p>
          <p class="truncate text-xs text-fg-subtle">${u ? `${esc(t(u.level || "Clipper"))}${u.handle ? ` · <span dir="ltr">${esc(u.handle)}</span>` : ""}` : ""}</p></div></div>
      <button type="button" data-action="adm-camp" data-id="${c.id}" class="flex min-w-0 items-center gap-3 rounded-tile border border-line p-3 text-start transition-colors duration-150 hover:border-line-strong hover:bg-subtle ${FOCUS}">${coverThumb(c, "sm")}
        <span class="min-w-0 flex-1"><span class="block text-xs text-fg-subtle">${t("Campagne")}</span><span class="block truncate text-sm font-medium text-fg">${esc(c.title)}</span>
          <span class="block truncate text-xs text-fg-subtle">${esc(o ? o.name : c.brand)} · ${rateShort(c.rate)}</span></span>${icon("chevronRight", "size-4 shrink-0 text-fg-subtle rtl:-scale-x-100")}</button>
    </div>`;
}

// Fiche d'examen d'un clip : lien de la vidéo (ouvrir, copier), clipper (fiche), campagne (sa fiche), vues, seuil et
// plafond, gain estimé ou crédité, risque de fraude et historique des vues, autres plateformes du même envoi, motif d'un
// refus ; décision (valider, refuser).
function admClipSheet(m) {
  const p = db.publications.find((x) => x.id === m.id), c = p && campaignById(p.campaign);
  if (!p || !c) return admGone(t("Clip introuvable"), t("Ce clip n'existe plus."));
  const pending = p.status === "En attente", validated = p.status === "Validée", appeal = admAppealOf(p);
  const seuil = viewsFor(c, c.minPayout), cap = viewsFor(c, c.maxPayout);
  // Même calcul que le serveur (lib/server/rules.ts) : gain brut arrondi, rien sous le seuil, plafond, budget restant.
  const raw = Math.floor((p.views * c.rate) / 1000), under = raw < c.minPayout, capped = raw >= c.maxPayout;
  const due = under ? 0 : Math.min(raw, c.maxPayout), remaining = Math.max(0, c.budget - c.spent), est = Math.min(due, remaining);
  const siblings = p.batch ? db.publications.filter((x) => x.batch === p.batch && x.id !== p.id) : [];
  const platform = esc(p.platform);
  const linkBox = admClipLinkBox(p), people = admClipPeople(p, c);

  const status = `<div class="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">${statusBadge(p.status)}<span class="text-small text-fg-muted">${pending && under ? t("Soumis le {date} · seuil de paiement pas encore atteint", { date: date(p.date) }) : t("Soumis le {date}", { date: date(p.date) })}</span></div>`;
  // Motif d'un refus : un des motifs proposés (français, traduit par tServer) ou un texte libre (affiché tel quel).
  const reason = p.status === "Refusée" && p.reason ? `<div class="mt-4">${alertBox("danger", `<p class="font-medium">${t("Motif du refus")}</p><p class="mt-0.5 break-words" dir="auto">${esc(tServer(p.reason))}</p>`)}</div>` : "";
  // Recours du clipper sur ce refus : statut et accès à sa fiche (décision, message, preuve).
  const appealBox = appeal ? `<div class="mt-4 flex flex-col gap-3 rounded-tile border border-line p-3 sm:flex-row sm:items-center">
      <div class="flex min-w-0 flex-1 items-center gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-tile bg-info-bg text-info-fg" aria-hidden="true">${icon("flag", "size-5")}</span>
        <div class="min-w-0 flex-1"><p class="text-sm font-medium text-fg">${t("Le clipper conteste ce refus")}</p><p class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">${appealBadge(appeal.status)}<span>${t("Envoyé le {date}", { date: date(appeal.createdAt) })}</span></p></div></div>
      <button type="button" data-action="adm-appeal" data-id="${appeal.id}" class="${btn(appeal.status === "En attente" ? "primary" : "secondary", "md", "shrink-0")}">${appeal.status === "En attente" ? t("Examiner le recours") : t("Voir le recours")}</button>
    </div>` : "";
  const ended = pending && c.status === "Terminée" ? `<div class="mt-4">${alertBox("warning", t("La campagne est terminée : son budget non consommé a été rendu à l'agence. Vérifiez avant de valider ce clip."))}</div>` : "";


  const viewsBtn = pending || validated ? `<button type="button" data-action="adm-views" data-id="${p.id}" class="${btn("secondary", "sm")}">${icon("eye")}${t("Relever les vues")}</button>` : "";
  const threshold = under && !validated ? `<div class="mt-3">${progress(p.views, seuil, { label: false, aria: t("Progression vers le seuil") })}
      <p class="mt-1.5 text-xs tabular-nums text-fg-subtle">${t("{pct} du seuil : il manque {views}.", { pct: pct(Math.min(99, Math.floor((p.views / Math.max(1, seuil)) * 100))), views: plural(seuil - p.views, "vue", "vues") })}</p></div>` : "";
  const capNote = (txt) => `<span class="ms-1.5 text-xs font-normal text-fg-subtle">${txt}</span>`;
  const rows = [[t("Tarif"), rate(c.rate)], [t("Gain brut des vues"), money(raw)]];
  if (pending) {
    rows.push([t("Gain estimé à la validation"), under ? `<span class="font-normal text-fg-subtle">${t("— sous le seuil")}</span>`
      : `${money(est)}${est < due ? capNote(t("budget restant")) : capped ? capNote(t("plafond")) : ""}`, true]);
  } else if (validated) rows.push([t("Crédité au clipper"), `${money(p.paid || 0)}${capped ? capNote(t("plafond")) : ""}`, true]);
  else rows.push([t("Gain"), `<span class="font-normal text-fg-subtle">${t("Aucun : clip refusé")}</span>`, true]);
  const payout = `${admH3(t("Vues et gain"), viewsBtn)}
    <dl class="mt-2 grid grid-cols-3 gap-2">
      ${admTile(t("Vues relevées"), fmt(p.views))}
      ${admTile(t("Seuil"), plural(seuil, "vue", "vues"), da(c.minPayout))}
      ${admTile(t("Plafond"), plural(cap, "vue", "vues"), da(c.maxPayout))}
    </dl>${threshold}${summary(rows)}
    ${validated ? `<p class="mt-2 text-xs text-fg-subtle">${t("Les vues relevées pendant {days} après la validation sont payées en plus, dans la limite du plafond et du budget restant.", { days: plural(db.settings.earningDays, "jour", "jours") })}</p>` : ""}`;

  // Autres plateformes du même envoi : leur fiche remplace celle-ci (même fiche de retour).
  const batch = siblings.length ? `${admH3(t("Publié aussi sur"))}
    <ul class="mt-2 grid gap-2">${siblings.map((s) => `<li><button type="button" data-action="adm-clip" data-id="${s.id}" class="flex w-full items-center gap-3 rounded-tile border border-line p-3 text-start transition-colors duration-150 hover:border-line-strong hover:bg-subtle ${FOCUS}">
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-fg-muted" aria-hidden="true">${icon(PLATFORM_ICON[s.platform] || "film", "size-4")}</span>
        <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${esc(s.platform)}</span><span class="block truncate text-xs tabular-nums text-fg-subtle">${plural(s.views, "vue", "vues")}</span></span>
        ${statusBadge(s.status)}${icon("chevronRight", "size-4 shrink-0 text-fg-subtle rtl:-scale-x-100")}</button></li>`).join("")}</ul>` : "";

  const rules = `<details class="group mt-6" ${pending ? "open" : ""}>
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-section text-fg [&::-webkit-details-marker]:hidden ${FOCUS}">${t("Règles de la campagne")}${icon("chevronDown", "size-4 shrink-0 text-fg-subtle transition-transform duration-150 group-open:rotate-180")}</summary>
      ${admRules(c)}
      <div class="mt-3 flex flex-wrap items-center gap-1.5"><span class="text-xs text-fg-subtle">${t("Plateformes acceptées :")}</span>${admPlatforms(c).replace('<div class="mt-2 flex flex-wrap gap-1.5">', "").replace(/<\/div>$/, "")}</div>
    </details>`;

  const footer = `<button type="button" data-action="close-modal" class="${btn(pending ? "ghost" : "secondary")}">${t("Fermer")}</button>${pending
    ? `<button type="button" data-action="adm-reject" data-id="${p.id}" class="${btn("dangerSoft")}">${t("Refuser")}</button>
      <button type="button" data-action="adm-validate" data-id="${p.id}" class="${btn("primary")}"${under ? ` disabled title="${esc(t("Seuil non atteint : {views} minimum", { views: plural(seuil, "vue", "vues") }))}"` : ""}>${icon("check")}${t("Valider")}</button>` : ""}`;

  return modalShell({
    title: esc(p.title), description: `${platform} · ${esc(c.title)}`, size: "xl", footer,
    body: `${linkBox}${status}${reason}${appealBox}${ended}${people}${payout}${admRiskPanel(p)}${batch}${rules}`,
  });
}

// Fiche d'un recours (contestation d'un clip refusé) : le clip (lien, plateforme, vues, campagne), le motif du refus
// d'origine, le message du clipper, sa preuve (agrandie au clic, proportions gardées) et le risque de fraude du clip ;
// en attente : « Refuser » ou « Accepter » (motif obligatoire, modale par-dessus). Accepter valide le clip comme une
// validation normale : impossible si la campagne ne paie plus ou si le seuil n'est pas atteint (bouton désactivé,
// le serveur le refuse aussi). Décidé : la décision, son auteur et son motif.
function admAppealCheck(p, c) {
  const raw = Math.floor((p.views * c.rate) / 1000), under = raw < c.minPayout, ended = !["Active", "En pause"].includes(c.status);
  const due = under ? 0 : Math.max(0, Math.min(raw, c.maxPayout) - (p.paid || 0)), est = Math.min(due, Math.max(0, c.budget - c.spent));
  const blocked = ended ? t("Cette campagne est terminée : ce clip ne peut plus être validé.")
    : under ? t("Seuil non atteint : {views} minimum", { views: plural(viewsFor(c, c.minPayout), "vue", "vues") }) : "";
  return { under, ended, est, blocked };
}
function admAppealSheet(m) {
  const a = admAppeals().find((x) => x.id === m.id), p = a && db.publications.find((x) => x.id === a.publicationId), c = p && campaignById(p.campaign);
  if (!a || !p || !c) return admGone(t("Recours introuvable"), t("Ce recours n'existe plus."));
  const u = admUser(a.userId), pending = a.status === "En attente", { under, est, blocked } = admAppealCheck(p, c);
  const decider = a.decidedBy ? admUser(a.decidedBy) : null;
  const status = `<div class="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">${appealBadge(a.status)}<span class="text-small text-fg-muted">${t("Envoyé le {date}", { date: date(a.createdAt) })}</span>
      <button type="button" data-action="adm-clip" data-id="${p.id}" class="${btn("link", "", "ms-auto text-small")}">${t("Fiche d'examen du clip")}</button></div>`;
  const decision = pending ? ""
    : `<div class="mt-4">${alertBox(a.status === "Acceptée" ? "success" : "danger", `<p class="font-medium">${a.status === "Acceptée"
        ? t("Recours accepté le {date} par {name} : le clip est validé.", { date: date(a.decidedAt), name: esc(decider ? decider.name : "ClipBoost") })
        : t("Recours refusé le {date} par {name} : le clip reste refusé.", { date: date(a.decidedAt), name: esc(decider ? decider.name : "ClipBoost") })}</p>${a.decisionNote ? `<p class="mt-0.5 break-words" dir="auto">${t("Motif : {reason}", { reason: esc(a.decisionNote) })}</p>` : ""}`)}</div>`;
  const tiles = `${admH3(t("Le clip"))}
    <dl class="mt-2 grid grid-cols-3 gap-2">
      ${admTile(t("Vues relevées"), fmt(p.views), t("seuil {views}", { views: fmt(viewsFor(c, c.minPayout)) }))}
      ${admTile(t("Statut du clip"), statusBadge(p.status))}
      ${admTile(pending ? t("Gain si accepté") : t("Gain"), p.status === "Validée" ? money(p.paid || 0) : under ? `<span class="font-normal text-fg-subtle">${t("— sous le seuil")}</span>` : money(est))}
    </dl>
    ${pending && blocked ? `<div class="mt-3">${alertBox("warning", `${esc(blocked)} ${t("Le recours ne peut pas être accepté pour le moment : refusez-le ou attendez un nouveau relevé des vues.")}`)}</div>` : ""}`;
  const refusal = p.reason ? `<div class="mt-4">${alertBox("danger", `<p class="font-medium">${t("Motif du refus d'origine")}</p><p class="mt-0.5 break-words" dir="auto">${esc(tServer(p.reason))}</p>`)}</div>` : "";
  const message = `${admH3(t("Message du clipper"))}
    <div class="mt-2 ${TILE}"><p class="whitespace-pre-line break-words text-sm text-fg" dir="auto">${esc(a.message)}</p></div>`;
  const proof = a.proof ? `${admH3(t("Preuve"))}
    <button type="button" data-action="adm-proof" data-id="${a.id}" class="group relative mt-2 block h-56 w-full overflow-hidden rounded-tile bg-muted ${FOCUS}" aria-label="${esc(t("Agrandir la preuve"))}">
      <img src="${esc(a.proof)}" alt="${esc(t("Capture d'écran jointe au recours"))}" class="absolute inset-0 size-full object-contain"/>
      <span class="absolute bottom-2 end-2 inline-flex items-center gap-1 rounded-badge bg-surface/90 px-2 py-1 text-xs font-medium text-fg shadow-control">${icon("search", "size-3.5")}${t("Agrandir")}</span></button>` : "";
  const footer = `<button type="button" data-action="close-modal" class="${btn(pending ? "ghost" : "secondary")}">${t("Fermer")}</button>${pending
    ? `<button type="button" data-action="adm-appeal-decide" data-id="${a.id}" data-value="refuse" class="${btn("dangerSoft")}">${t("Refuser le recours")}</button>
      <button type="button" data-action="adm-appeal-decide" data-id="${a.id}" data-value="approve" class="${btn("primary")}"${blocked ? ` disabled title="${esc(blocked)}"` : ""}>${icon("check")}${t("Accepter le recours")}</button>` : ""}`;
  return modalShell({
    title: t("Recours sur « {title} »", { title: `<bdi>${esc(p.title)}</bdi>` }), description: `${esc(u.name)} · ${esc(p.platform)} · ${esc(c.title)}`, size: "xl", footer,
    body: `${admClipLinkBox(p)}${status}${decision}${admClipPeople(p, c)}${tiles}${refusal}${message}${proof}${admRiskPanel(p)}`,
  });
}

// ---------- Modales ----------

// Relevé de vues : gain estimé en direct (même règle que le serveur : rien sous le seuil, plafonné au-delà).
LIVE.admViews = (d) => {
  const p = state.modal && db.publications.find((x) => x.id === state.modal.id);
  if (!p) return "";
  const c = campaignById(p.campaign), seuil = viewsFor(c, c.minPayout || 0);
  const typed = Math.floor(admParse(d.views));
  if (!Number.isFinite(typed) || typed < p.views) return `<div class="mt-5">${alertBox("warning", t("Indiquez au moins {views} : le dernier relevé ne peut pas diminuer.", { views: plural(p.views, "vue", "vues") }))}</div>`;
  const v = typed;
  const raw = Math.floor((v * c.rate) / 1000), capped = c.maxPayout && raw >= c.maxPayout;
  const est = raw < (c.minPayout || 0) ? 0 : Math.min(raw, c.maxPayout || Infinity);
  const rows = [[t("Seuil de paiement"), v >= seuil ? t("Atteint") : t("{pct} atteint", { pct: pct(Math.floor((v / Math.max(1, seuil)) * 100)) })]];
  if (p.status === "Validée") {
    rows.push([t("Déjà crédité"), money(p.paid || 0), true]);
    return `${summary(rows)}<p class="mt-2 text-xs text-fg-subtle">${t("Les vues supplémentaires sont payées pendant {days} après la validation, dans la limite du plafond et du budget restant.", { days: plural(db.settings.earningDays, "jour", "jours") })}</p>`;
  }
  rows.push([t("Gain estimé"), est ? `${money(est)}${capped ? `<span class="ms-1.5 text-xs font-normal text-fg-subtle">${t("plafond")}</span>` : ""}` : `<span class="font-normal text-fg-subtle">${t("— sous le seuil")}</span>`, true]);
  return summary(rows);
};

// Motif d'un refus (campagne et décision sur un recours : 300 caractères, badge : 200) : compteur en direct (« 12 / 300 », de gauche à droite).
LIVE.admReason = (d) => ({ count: `${fmt(String(d.reason || "").length)}${NB}/${NB}${state.modal && ["adm-refuse", "adm-appeal-decide"].includes(state.modal.type) ? 300 : 200}` });

// Motifs fréquents de refus d'une campagne : [puce, texte inséré dans le motif], sources françaises. Le texte est
// inséré dans la langue affichée : le motif est un message libre de l'admin, envoyé tel qu'il le lit.
const ADM_CAMP_REASONS = [
  ["Budget incohérent", "Le budget, le tarif et le plafond par clip ne sont pas cohérents entre eux."],
  ["Règles trop vagues", "Les règles de la campagne sont trop vagues : précisez ce que les clips doivent montrer."],
  ["Marque non autorisée", "Cette marque ou ce produit ne peut pas être promu sur ClipBoost."],
  ["Photo inappropriée", "La photo de la campagne n'est pas appropriée : remplacez-la."],
  ["Marque à préciser", "Les informations sur la marque sont insuffisantes : précisez qui finance la campagne."],
];
// Motifs de refus d'un clip : valeurs envoyées en français (le clipper les lit traduites, voir tServer) ; libellés traduits.
const ADM_CLIP_REASONS = ["Règles de la campagne non respectées", "Vues suspectes ou achetées", "Contenu inapproprié", "Lien invalide ou vidéo supprimée", "Doublon d'un clip existant"];
const ADM_REASON_CHIP = `inline-flex h-10 shrink-0 items-center rounded-full border border-line-strong bg-surface px-3.5 text-small font-medium text-fg-muted transition-colors duration-150 hover:border-line-control hover:text-fg md:h-8 ${FOCUS}`;
// Champ de motif avec compteur (refus d'une campagne, refus ou retrait d'un badge). Textes déjà traduits.
const admReasonField = (id, label, max, required, placeholder, hint) => `<div class="grid gap-1.5" data-field>
    <div class="flex items-baseline justify-between gap-3"><label for="${id}" class="text-small font-medium text-fg">${label}</label><span data-live-out="count" dir="ltr" class="text-xs tabular-nums text-fg-subtle">0${NB}/${NB}${max}</span></div>
    <textarea id="${id}" name="reason" rows="4" maxlength="${max}" ${required ? "required " : ""}autofocus dir="auto" placeholder="${esc(placeholder)}" aria-describedby="${id}-hint" class="${textareaCls}"></textarea>
    <span id="${id}-hint" class="text-xs text-fg-subtle">${hint}</span>
  </div>`;

function adminModal() {
  const m = state.modal;
  if (!m) return "";
  const cancel = (label = t("Annuler")) => `<button type="button" data-action="close-modal" class="${btn("ghost")}">${label}</button>`;

  if (m.type === "adm-camp") return admCampSheet(m);
  if (m.type === "adm-export") return admExportModal(m);
  if (m.type === "adm-clip") return admClipSheet(m);
  if (m.type === "adm-appeal") return admAppealSheet(m);
  // Preuve d'un recours en grand (image entière, proportions gardées).
  if (m.type === "adm-proof") {
    const a = admAppeals().find((x) => x.id === m.id), p = a && db.publications.find((x) => x.id === a.publicationId);
    if (!a || !a.proof) return admGone(t("Recours introuvable"), t("Ce recours n'existe plus."));
    return modalShell({
      title: t("Preuve du recours"), description: `${p ? `${admQuoted(p.title)} · ` : ""}${esc(admUser(a.userId).name)}`, size: "xl",
      body: `<div class="grid place-items-center rounded-tile bg-muted"><img src="${esc(a.proof)}" alt="${esc(t("Capture d'écran jointe au recours"))}" class="max-h-[70dvh] w-auto max-w-full object-contain"/></div>`,
      footer: `<button type="button" data-action="close-modal" class="${btn("secondary")}">${t("Fermer")}</button>`,
    });
  }
  // Décision sur un recours : motif obligatoire (3 à 300 caractères), lu par le clipper dans sa notification.
  if (m.type === "adm-appeal-decide") {
    const a = admAppeals().find((x) => x.id === m.id), p = a && db.publications.find((x) => x.id === a.publicationId), c = p && campaignById(p.campaign);
    if (!a || !p || !c) return admGone(t("Recours introuvable"), t("Ce recours n'existe plus."));
    const approve = m.decision === "approve", { est, blocked } = admAppealCheck(p, c);
    const note = approve
      ? blocked ? alertBox("warning", esc(blocked))
        : alertBox("info", est ? t("Le clip passe en « Validée » et {amount} sont crédités au clipper, comme pour une validation normale.", { amount: `<strong class="font-semibold">${da(est)}</strong>` })
          : t("Le clip passe en « Validée », comme pour une validation normale (aucun gain à créditer : plafond ou budget atteint)."))
      : alertBox("warning", t("Décision définitive : le clip reste refusé et le clipper ne pourra plus le contester."));
    return modalShell({
      title: approve ? t("Accepter le recours") : t("Refuser le recours"), description: `${admQuoted(p.title)} · ${esc(admUser(a.userId).name)}`, form: "adm-appeal-decide", live: "admReason",
      body: `${admReasonField("adm-appeal-reason", t("Motif de la décision"), 300, true,
          approve ? t("Ex. Licence de la musique vérifiée : le son est libre de droits.") : t("Ex. La capture ne montre pas la licence du son utilisé."),
          t("Entre 3 et 300 caractères. Le clipper le lit dans sa notification."))}
        <div class="mt-5">${note}</div>`,
      footer: `${cancel()}<button type="submit" class="${btn(approve ? "primary" : "danger")}"${approve && blocked ? " disabled" : ""}>${approve ? `${icon("check")}${t("Accepter et valider le clip")}` : t("Refuser le recours")}</button>`,
    });
  }
  if (m.type === "adm-refuse") {
    const c = campaignById(m.id);
    if (!c) return admGone(t("Campagne introuvable"), t("Cette campagne a été annulée ou supprimée par son agence."));
    const o = c.ownerId ? userById(c.ownerId) : null;
    return modalShell({
      title: t("Refuser la campagne"), description: `${admQuoted(c.title)}${o ? ` · ${esc(o.name)}` : ""}`, form: "adm-refuse", live: "admReason",
      body: `${admReasonField("adm-refuse-reason", t("Motif du refus"), 300, true, t("Ex. Le plafond par clip est trop élevé pour ce budget."), t("Entre 3 et 300 caractères. L'agence le lit dans sa notification et sur sa campagne."))}
        <div class="mt-4"><p class="text-xs text-fg-subtle">${t("Motifs fréquents")}</p>
          <div class="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="${esc(t("Motifs fréquents"))}">${ADM_CAMP_REASONS.map(([l], i) => `<button type="button" data-action="adm-reason" data-value="${i}" class="${ADM_REASON_CHIP}">${esc(t(l))}</button>`).join("")}</div></div>
        <div class="mt-5">${alertBox("info", t("L'agence est prévenue et peut modifier sa campagne puis la relancer, ou la supprimer. Rien n'est débité de son crédit."))}</div>`,
      footer: `${cancel()}<button type="submit" class="${btn("danger")}">${t("Refuser la campagne")}</button>`,
    });
  }
  if (m.type === "adm-end") {
    const c = campaignById(m.id);
    if (!c) return admGone(t("Campagne introuvable"), t("Cette campagne n'existe plus."));
    const o = c.ownerId ? userById(c.ownerId) : null, unspent = Math.max(0, c.budget - c.spent);
    const refund = o && c.reserved > 0 ? admFunding(unspent, c.commissionRate) : 0;
    return modalShell({
      title: t("Terminer la campagne ?"), description: `${admQuoted(c.title)}${o ? ` · ${esc(o.name)}` : ""}`,
      body: `<p class="text-sm text-fg-muted">${t("La campagne disparaît de Découvrir et n'accepte plus de nouveaux clips. Les gains déjà crédités aux clippers restent acquis. Cette action est définitive.")}</p>
        ${refund ? summary([[t("Budget non consommé"), money(unspent)], [t("Commission correspondante ({rate} %)", { rate: c.commissionRate }), money(refund - unspent)], [t("Rendu au crédit de l'agence"), money(refund), true]]) : ""}`,
      footer: `${cancel()}<button type="button" data-action="adm-camp-end-confirm" data-id="${c.id}" class="${btn("danger")}">${t("Terminer la campagne")}</button>`,
    });
  }
  if (m.type === "adm-verify") {
    const u = userById(m.id);
    if (!u) return admGone(t("Compte introuvable"), t("Ce compte n'existe plus."));
    const reject = m.decision !== "revoke";
    return modalShell({
      title: reject ? t("Refuser la demande de badge") : t("Retirer le badge de vérification"), description: esc(u.name), form: "adm-verify", live: "admReason",
      body: `${reject ? `<div class="mb-4 rounded-tile bg-muted p-3"><p class="text-xs font-medium text-fg-subtle">${t("Message de l'agence")}</p><p class="mt-1 break-words text-small ${u.verificationNote ? "text-fg" : "text-fg-subtle"}" dir="auto">${u.verificationNote ? esc(u.verificationNote) : t("Aucun message joint à la demande.")}</p></div>` : ""}
        ${reject
          ? admReasonField("adm-verify-reason", t("Motif du refus"), 200, true, t("Ex. Impossible de vérifier le registre du commerce de l'agence."), t("Entre 3 et 200 caractères. L'agence pourra faire une nouvelle demande."))
          : admReasonField("adm-verify-reason", `${t("Motif")} ${OPTIONAL}`, 200, false, t("Ex. Informations de l'agence devenues inexactes."), t("Transmis à l'agence s'il est indiqué. Elle pourra demander de nouveau le badge."))}`,
      footer: `${cancel()}<button type="submit" class="${btn("danger")}">${reject ? t("Refuser la demande") : t("Retirer le badge")}</button>`,
    });
  }
  if (m.type === "suspend") {
    const u = userById(m.id);
    if (!u) return "";
    return modalShell({
      title: t("Suspendre ce compte ?"), description: `${esc(u.name)} · <span dir="ltr">${esc(u.email)}</span>`,
      body: `<p class="text-sm text-fg-muted">${t("{name} sera déconnecté immédiatement et ne pourra plus se connecter. Vous pourrez réactiver le compte à tout moment depuis sa fiche ou la liste des utilisateurs.", { name: esc(u.name) })}</p>`,
      footer: `${cancel()}<button type="button" data-action="adm-user-toggle" data-id="${u.id}" data-confirm="true" class="${btn("danger")}">${t("Suspendre le compte")}</button>`,
    });
  }
  if (m.type === "reject") {
    const p = db.publications.find((x) => x.id === m.id);
    if (!p) return "";
    return modalShell({
      title: t("Refuser le clip"), description: t("« {title} » de {name}. Le clipper sera notifié du motif.", { title: esc(p.title), name: esc(admUser(p.userId).name) }), form: "adm-reject",
      body: `<fieldset class="grid gap-2"><legend class="mb-1.5 text-small font-medium text-fg">${t("Motif du refus")}</legend>
        ${ADM_CLIP_REASONS.map((r, i) => `<label class="${CHOICE_DANGER}"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? "checked autofocus" : ""} class="mt-0.5 size-4 shrink-0 cursor-pointer accent-danger-solid focus-visible:outline-none"/><span class="text-sm font-medium text-fg">${esc(t(r))}</span></label>`).join("")}</fieldset>`,
      footer: `${cancel()}<button type="submit" class="${btn("danger")}">${t("Confirmer le refus")}</button>`,
    });
  }
  if (m.type === "views") {
    const p = db.publications.find((x) => x.id === m.id);
    if (!p) return "";
    const c = campaignById(p.campaign);
    return modalShell({
      title: t("Relever les vues"), description: `${admQuoted(p.title)} · ${esc(admUser(p.userId).name)}`, form: "adm-views", live: "admViews",
      body: `${field(t("Nombre de vues affiché sur la plateforme"),
          unitInput(`name="views" type="text" value="${fmt(p.views)}" required autofocus autocomplete="off"`, tPlural(p.views, "vue", "vues"), { lg: true }),
          t("Seuil {min} · plafond {max}. Le nombre ne peut pas diminuer.", { min: plural(viewsFor(c, c.minPayout), "vue", "vues"), max: plural(viewsFor(c, c.maxPayout), "vue", "vues") }))}
        <div class="mt-4">${field(`${t("Likes")} ${OPTIONAL}`, `<input name="likes" type="text" inputmode="numeric" value="${typeof p.likes === "number" ? fmt(p.likes) : ""}" autocomplete="off" class="${inputCls} tabular-nums"/>`,
          t("Servent au score de risque : beaucoup de vues pour très peu de likes est suspect."))}</div>
        <div data-live-out>${LIVE.admViews({ views: p.views })}</div>
        ${p.url ? `<p class="mt-4"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="${btn("link", "", "text-small")}">${icon("external", "size-4")}${t("Ouvrir le clip sur {platform}", { platform: esc(p.platform) })}</a></p>` : ""}`,
      footer: `${cancel()}<button type="submit" class="${btn("primary")}">${t("Enregistrer")}</button>`,
    });
  }
  if (m.type === "reset-demo") {
    return modalShell({
      title: t("Réinitialiser la démo ?"),
      body: `<p class="text-sm text-fg-muted">${t("Les comptes créés, campagnes, clips et paiements enregistrés dans ce navigateur seront effacés, puis les données d'exemple recréées. Vous serez déconnecté.")}</p>`,
      footer: `${cancel()}<button type="button" data-action="adm-reset-demo-confirm" class="${btn("danger")}">${t("Effacer et recommencer")}</button>`,
    });
  }
  // Campagne créée par l'équipe : même formulaire que l'agence (agency.js : photo, catégories et « Autre », plateformes
  // dont Facebook), avec la marque en plus ; publiée aussitôt, sans crédit d'agence. campaignForm attend des textes traduits.
  if (m.type === "new-campaign") {
    return modalShell({
      title: t("Nouvelle campagne"), description: t("Créée par ClipBoost, elle est immédiatement visible par les clippers."), size: "xl", form: "adm-campaign", live: "campaign",
      body: campaignForm("adm-campaign", t("Publier la campagne"), t("Campagne gérée directement par ClipBoost : aucun crédit d'agence n'est prélevé.")),
      footer: `${cancel()}<button type="submit" class="${btn("primary")}">${t("Publier la campagne")}</button>`,
    });
  }
  return "";
}

// ---------- Actions ----------
// Messages de confirmation (toasts) : texte brut traduit, échappé par toast() ; les paramètres ne sont donc pas échappés.

function handleAdminAction(action, el) {
  const id = el.dataset.id, v = el.dataset.value;
  switch (action) {
    case "adm-user-status": state.adm.userStatus = v; return render();
    case "adm-user-role": state.adm.userRole = v; return render();
    case "adm-user-clear": Object.assign(state.adm, { userQ: "", userRole: "Tous les rôles", userStatus: "Tous" }); return render();
    case "adm-camp-status": state.adm.campStatus = v; return render();
    case "adm-camp-clear": Object.assign(state.adm, { campQ: "", campStatus: "Toutes" }); return render();
    case "adm-mod-status": state.adm.modStatus = v; return render();
    case "adm-msg-filter": state.adm.msgFilter = v; return render();
    case "adm-mod-sort": state.adm.modSort = v === "risk" ? "risk" : "recent"; return render();
    // Relevé des vues de tous les clips suivis, sans attendre le prochain passage automatique.
    case "adm-track-views": return act("POST", "/api/admin/track-views", null, (r) => (r.failed
      ? t("Relevé terminé : {clips} sur {total} mis à jour, {failed} en erreur.", { clips: plural(r.updated, "clip", "clips"), total: fmt(r.total), failed: fmt(r.failed) })
      : t("Relevé terminé : {clips} sur {total} mis à jour.", { clips: plural(r.updated, "clip", "clips"), total: fmt(r.total) })));
    case "adm-pay-tab": state.adm.payTab = v; return render();
    // Export CSV : la modale propose le type de l'onglet ouvert, modifiable, avec statut et période.
    case "adm-export": state.modal = { type: "adm-export", kind: state.adm.payTab === "recharges" ? "recharge" : "retrait" }; return render();
    case "adm-period": state.period = Number(v) === 7 ? 7 : 30; return render();
    // Carte « À traiter », lien vers Paiements : le lien ouvre la page (changement d'adresse), on y présélectionne la file.
    case "adm-focus":
      // Que des recours à examiner : la carte ouvre l'onglet « Recours ».
      if (v === "moderation") state.adm.modStatus = !pendingPubs().length && admPendingAppeals().length ? "Recours" : "En attente";
      if (v === "campagnes" && db.campaigns.some((c) => c.status === "En attente")) Object.assign(state.adm, { campQ: "", campStatus: "En attente" });
      if (v === "retraits") state.adm.payTab = pendingWithdrawals().length || !pendingRecharges().length ? "retraits" : "recharges";
      if (v === "recharges") state.adm.payTab = "recharges";
      return;
    case "adm-copy": return copy(v, el.dataset.msg || t("Copié"));
    case "adm-user-toggle": {
      const u = userById(id);
      if (!u) return;
      // La suspension demande une confirmation ; la réactivation est immédiate.
      if (u.status === "Actif" && !el.dataset.confirm) return admOpen({ type: "suspend", id });
      const next = u.status === "Actif" ? "Suspendu" : "Actif";
      return act("PATCH", `/api/admin/users/${id}`, { status: next }, next === "Suspendu" ? t("{name} : compte suspendu", { name: u.name }) : t("{name} : compte réactivé", { name: u.name }), () => admPop(["suspend"], id));
    }
    // Fiches d'examen, ouvertes sur place.
    case "adm-camp": return admOpenSheet("adm-camp", id);
    case "adm-clip": return admOpenSheet("adm-clip", id);
    // Recours : sa fiche, la preuve en grand et la décision (par-dessus la fiche).
    case "adm-appeal": return admOpenSheet("adm-appeal", id);
    case "adm-proof": return admOpen({ type: "adm-proof", id });
    case "adm-appeal-decide": return admOpen({ type: "adm-appeal-decide", id, decision: v === "approve" ? "approve" : "refuse" });
    // Décisions sur une campagne. L'approbation débite le crédit de l'agence (budget + commission) : le serveur la refuse
    // si le crédit ne suffit pas (message traduit par data.js) ; la fiche est refermée après une décision réussie.
    case "adm-camp-approve": {
      const c = campaignById(id);
      if (!c) return;
      return act("PATCH", `/api/campaigns/${id}`, { status: "Active" }, t("« {title} » est approuvée et en ligne", { title: c.title }), () => admPop(["adm-camp"], id));
    }
    case "adm-camp-resume": case "adm-camp-pause": {
      const c = campaignById(id), pause = action === "adm-camp-pause";
      if (!c) return;
      return act("PATCH", `/api/campaigns/${id}`, { status: pause ? "En pause" : "Active" }, pause ? t("« {title} » est en pause", { title: c.title }) : t("« {title} » est de nouveau active", { title: c.title }));
    }
    case "adm-camp-end": return admOpen({ type: "adm-end", id });
    case "adm-camp-end-confirm": {
      const c = campaignById(id);
      if (!c) return;
      return act("PATCH", `/api/campaigns/${id}`, { status: "Terminée" }, t("« {title} » est terminée", { title: c.title }), () => admPop(["adm-end"], id));
    }
    case "adm-camp-refuse": return admOpen({ type: "adm-refuse", id });
    case "adm-camp-top": {
      const c = campaignById(el.dataset.key);
      if (!c) return;
      return act("PATCH", `/api/campaigns/${c.id}`, { top: !c.top }, c.top ? t("« {title} » n'est plus mise en avant", { title: c.title }) : t("« {title} » est mise en avant en Top campagne", { title: c.title }));
    }
    // Motif fréquent : ajouté au motif saisi (sans doublon), dans la limite de 300 caractères ; le brouillon et le compteur suivent.
    case "adm-reason": {
      const area = root.querySelector('[aria-modal="true"] textarea[name="reason"]'), r = ADM_CAMP_REASONS[Number(v)];
      if (!area || !r) return;
      const cur = area.value.trim(), text = t(r[1]);
      const next = !cur ? text : cur.includes(text) ? cur : `${cur}${/[.!?…؟]$/.test(cur) ? "" : "."} ${text}`;
      area.value = next.slice(0, 300);
      area.dispatchEvent(new Event("input", { bubbles: true }));
      area.focus();
      try { area.setSelectionRange(area.value.length, area.value.length); } catch (e) {}
      return;
    }
    case "adm-new-campaign": state.modal = { type: "new-campaign" }; return render();
    // Décisions sur un clip (tableaux et fiche) : la fiche est refermée après une décision réussie.
    case "adm-validate": return act("POST", `/api/clips/${id}/review`, { approve: true }, t("Clip validé, gains crédités au clipper"), () => admPop(["adm-clip"], id));
    case "adm-reject": return admOpen({ type: "reject", id });
    case "adm-views": return admOpen({ type: "views", id });
    // Badge de vérification des agences.
    case "adm-verify-approve": {
      const u = userById(id);
      if (!u) return;
      return act("POST", `/api/admin/users/${id}/verification`, { decision: "approve" }, t("Badge de vérification accordé à {name}", { name: u.name }));
    }
    case "adm-verify": return admOpen({ type: "adm-verify", id, decision: v === "revoke" ? "revoke" : "reject" });
    case "adm-tx-approve": case "adm-tx-reject": {
      const tx = db.transactions.find((x) => x.id === id), approve = action === "adm-tx-approve";
      const msg = !tx ? (approve ? t("Opération validée") : t("Opération rejetée"))
        : tx.type === "retrait" ? (approve ? t("Virement de {amount} confirmé", { amount: da(admNet(tx)) }) : t("Retrait de {amount} rejeté", { amount: da(-tx.amount) }))
        : approve ? t("Recharge de {amount} créditée à l'agence", { amount: da(tx.amount) }) : t("Recharge de {amount} rejetée", { amount: da(tx.amount) });
      return act("POST", `/api/transactions/${id}/review`, { approve }, msg);
    }
    case "adm-reset-demo": state.modal = { type: "reset-demo" }; return render();
    case "adm-reset-demo-confirm": return resetDemo();
    case "adm-setting": {
      const k = el.dataset.key, value = !db.settings[k];
      const labels = { maintenance: [t("Mode maintenance activé"), t("Mode maintenance désactivé")], signupsOpen: [t("Inscriptions ouvertes"), t("Inscriptions fermées")] };
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
  toast(t("Démo réinitialisée : données d'exemple recréées"));
}

// Message d'erreur d'un réglage numérique (phrase entière par cas : nombre entier ou décimal, borne basse ou intervalle).
function admLimitError(label, min, max, decimal) {
  const p = { label: t(label), min: fmt(min), max: fmt(max) };
  if (max !== Infinity) return decimal ? t("{label} : indiquez un nombre entre {min} et {max}.", p) : t("{label} : indiquez un nombre entier entre {min} et {max}.", p);
  if (min) return decimal ? t("{label} : indiquez un nombre d'au moins {min}.", p) : t("{label} : indiquez un nombre entier d'au moins {min}.", p);
  return decimal ? t("{label} : indiquez un nombre positif.", p) : t("{label} : indiquez un nombre entier positif.", p);
}

function handleAdminSubmit(form, data) {
  const m = state.modal;
  // Réponse de l'équipe dans la conversation ouverte (Messages).
  if (form === "adm-msg") {
    const x = msgThreads().find((y) => y.id === state.route.item), body = String(data.body || "").trim();
    if (!x || !body) return;
    return act("POST", `/api/campaigns/${encodeURIComponent(x.campaignId)}/messages`, { body, clipperId: x.clipperId });
  }
  // Export CSV : téléchargement (navigateur ou fichier HTML autonome), modale refermée une fois le fichier enregistré.
  if (form === "adm-export") {
    const from = String(data.from || ""), to = String(data.to || "");
    if (from && to && from > to) return admInvalid(form, "to", t("La date de fin doit suivre la date de début."));
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ type: data.type, status: data.status, from, to })) if (v) q.set(k, v);
    const query = q.toString();
    return downloadFile(`/api/admin/transactions/export${query ? `?${query}` : ""}`, "clipboost-transactions.csv").then((ok) => {
      if (!ok) return;
      state.modal = null;
      render();
      toast(t("Export CSV téléchargé"));
    });
  }
  if (form === "adm-reject") {
    return act("POST", `/api/clips/${m.id}/review`, { approve: false, reason: data.reason }, t("Clip refusé, le clipper est notifié"), () => admPop(["reject", "adm-clip"], m.id));
  }
  if (form === "adm-views") {
    const p = db.publications.find((x) => x.id === m.id), views = Math.floor(admParse(data.views));
    if (!Number.isFinite(views) || (p && views < p.views)) return admInvalid("adm-views", "views");
    // Likes : facultatifs (vide : les likes connus sont gardés), nombre entier positif.
    const likes = admParse(data.likes), noLikes = String(data.likes ?? "").trim() === "";
    if (!noLikes && (!Number.isInteger(likes) || likes < 0)) return admInvalid("adm-views", "likes", t("Indiquez un nombre entier de likes, ou laissez le champ vide."));
    return act("POST", `/api/clips/${m.id}/views`, noLikes ? { views } : { views, likes }, t("Vues enregistrées"), () => admPop(["views"], m.id));
  }
  // Décision sur un recours : motif obligatoire (3 à 300 caractères). Acceptation impossible (seuil, campagne
  // terminée) : l'erreur du serveur s'affiche et le recours reste en attente, modales ouvertes.
  if (form === "adm-appeal-decide") {
    const reason = String(data.reason || "").trim(), approve = m.decision === "approve";
    if (reason.length < 3) return admInvalid(form, "reason", t("Indiquez le motif de votre décision (3 caractères minimum)."));
    return act("POST", `/api/appeals/${encodeURIComponent(m.id)}/review`, { approve, reason },
      approve ? t("Recours accepté : clip validé, le clipper est prévenu") : t("Recours refusé, le clipper est prévenu"), () => admPop(["adm-appeal-decide", "adm-proof", "adm-appeal"], m.id));
  }
  // Refus d'une campagne : motif obligatoire (3 à 300 caractères), transmis à l'agence.
  if (form === "adm-refuse") {
    const reason = String(data.reason || "").trim(), c = campaignById(m.id);
    if (reason.length < 3) return admInvalid(form, "reason", t("Indiquez le motif du refus (3 caractères minimum)."));
    return act("PATCH", `/api/campaigns/${m.id}`, { status: "Refusée", reason }, c ? t("« {title} » est refusée : l'agence est prévenue", { title: c.title }) : t("La campagne est refusée : l'agence est prévenue"), () => admPop(["adm-refuse", "adm-camp"], m.id));
  }
  // Badge : refus (motif obligatoire) ou retrait (motif facultatif).
  if (form === "adm-verify") {
    const reason = String(data.reason || "").trim(), u = userById(m.id), reject = m.decision !== "revoke";
    if (reject && reason.length < 3) return admInvalid(form, "reason", t("Indiquez le motif du refus (3 caractères minimum)."));
    const msg = reject
      ? (u ? t("Demande de badge de {name} refusée", { name: u.name }) : t("Demande de badge refusée"))
      : (u ? t("Badge de vérification retiré à {name}", { name: u.name }) : t("Badge de vérification retiré"));
    return act("POST", `/api/admin/users/${m.id}/verification`, { decision: reject ? "reject" : "revoke", ...(reason ? { reason } : {}) }, msg, () => admPop(["adm-verify"], m.id));
  }
  if (form === "adm-campaign") {
    const err = !String(data.brand || "").trim() ? ["brand", t("Indiquez la marque.")] : agCampaignError(data);
    if (err) return admInvalid(form, ...err);
    return act("POST", "/api/campaigns", campaignPayload(data), t("Campagne publiée"), () => { state.modal = null; state.adm.campStatus = "Toutes"; });
  }
  // Mon compte : nom et photo (data URL nouvelle, adresse actuelle inchangée, "" retirée : voir imageField).
  if (form === "adm-account") {
    const name = String(data.name || "").trim();
    if (!name) return admInvalid(form, "name", t("Indiquez votre nom."));
    return act("PATCH", "/api/me", { name, avatar: data.avatar }, t("Compte mis à jour"));
  }
  if (form === "adm-settings") {
    const values = {};
    for (const [k, [label, min, max, decimal]] of Object.entries(ADM_LIMITS)) {
      const v = admParse(data[k]);
      if (!Number.isFinite(v) || v < min || v > max || (!decimal && !Number.isInteger(v))) return admInvalid("adm-settings", k, admLimitError(label, min, max, decimal));
      values[k] = v;
    }
    // Primes du classement : 10 nombres entiers de 0 à 1 000 000 DA (même règle que le serveur), du 1er au 10e.
    const weeklyPrizes = [];
    for (let i = 0; i < 10; i++) {
      const v = admParse(data[`prize-${i}`]);
      if (!Number.isInteger(v) || v < 0 || v > 1000000) return admInvalid("adm-settings", `prize-${i}`, t("Prime du {rank} : indiquez un nombre entier entre 0 et 1 000 000.", { rank: lbOrdinal(i + 1) }));
      weeklyPrizes.push(v);
    }
    return act("PATCH", "/api/admin/settings", { announcement: data.announcement.trim(), ...values, weeklyPrizes }, t("Réglages enregistrés"));
  }
}
