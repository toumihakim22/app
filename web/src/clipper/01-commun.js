// Espace Clipper : accueil (activité et statistiques), découvrir (toutes les campagnes), agences et page d'une agence,
// publications, classement de la semaine, académie (tutoriels courts, #/clipper/academie/<leçon>), parrainage, portefeuille, profil (et comptes sociaux), paramètres. Modales : fiche d'une
// campagne, soumission d'un clip, retrait, retrait d'un compte social vérifié. Messages : questions posées aux
// organisateurs des campagnes.
// Recettes et helpers : docs/design-system.md §4 et §6.2 (web/src/ui.js). Helpers locaux préfixés « cl ».
// Textes : t("source française") au moment du rendu (web/src/i18n.js) ; traductions dans web/src/i18n/{en,ar}/clipper.js.
// Les valeurs échangées avec le serveur ou comparées (statuts, catégories, moyens de retrait, data-value) restent en
// français : seul leur affichage est traduit. Aucune variable locale ne s'appelle « t » (elle masquerait t()).
// Découpé en un fichier par partie dans web/src/clipper/ (ordre des numéros) ; ce fichier-ci : fichier d'entrée de l'espace, helpers locaux, comptes sociaux, organisateurs, historique d'argent.

const me = () => db.me;
const myPubs = () => db.publications.filter((p) => p.userId === state.session);
const myTx = () => db.transactions.filter((x) => x.userId === state.session);
const myNotifs = () => db.notifications;
const activeCampaigns = () => db.campaigns.filter((c) => c.status === "Active");

// Soldes calculés par le serveur : gains validés, gains encore en rétention, solde retirable.
const totalEarned = (u = me()) => u.earned || 0;
const pendingAmount = (u = me()) => u.pending || 0;
const balance = (u = me()) => u.available || 0;
const dailySeries = () => (state.period === 7 ? db.series.daily.slice(-7) : db.series.daily);
// Masquage sur les chiffres seuls : « •••• 7890 ».
const maskAccount = (a) => { const d = String(a || "").replace(/\D/g, ""); return d ? `••••${NB}${d.slice(-4)}` : ""; };

// « Accueil » réunit l'ancienne vue d'ensemble et les statistiques ; « Découvrir » et « Agences » remplacent les deux
// onglets de l'ancienne page Campagnes. Le bouton « Soumettre un clip » est dans l'en-tête de l'Accueil et des publications.
// Libellés en getters : relus à chaque rendu, ils suivent la langue choisie sans recharger la page.
const CLIPPER_NAV = [
  { id: "accueil", get label() { return t("Accueil"); }, icon: "home" },
  { id: "decouvrir", get label() { return t("Découvrir"); }, icon: "compass" },
  { id: "agences", get label() { return t("Agences"); }, icon: "building" },
  { id: "publications", get label() { return t("Mes publications"); }, get short() { return t("Clips"); }, icon: "film" },
  { id: "messages", get label() { return t("Messages"); }, icon: "message" },
  { id: "classement", get label() { return t("Classement"); }, icon: "trophy" },
  { id: "academie", get label() { return t("Académie"); }, icon: "academy" },
  { id: "parrainage", get label() { return t("Parrainage"); }, icon: "gift" },
  { id: "portefeuille", get label() { return t("Portefeuille"); }, icon: "wallet" },
  { id: "profil", get label() { return t("Profil"); }, icon: "user" },
  { id: "parametres", get label() { return t("Paramètres"); }, icon: "gear" },
];

// ---------- Helpers locaux ----------
const CL_PAYOUT_ICON = { BaridiMob: "wallet", CCP: "mail", "RIB bancaire": "bank" };
const CL_CHIP = `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-small font-medium text-fg-muted transition-colors hover:border-line-control hover:text-fg aria-pressed:border-brand-line aria-pressed:bg-brand-soft aria-pressed:text-brand-fg [&_svg]:size-3.5 ${FOCUS}`;
// Découvrir : toutes les campagnes actives, celles que le clipper a rejointes, ses favoris (valeurs ; libellés : t(v)).
const CL_SCOPES = ["Toutes", "Rejointes", "Favoris"];
// Grille des plateformes de la modale de soumission (classes écrites en entier pour Tailwind).
const CL_COLS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" };
const clSum = (a) => a.reduce((s, v) => s + v, 0);
const clFirst = (u) => esc(u.name.split(" ")[0]);
const clToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const clLink = (href, text) => `<a href="${href}" class="${HIT} inline-flex items-center gap-1 rounded-sm text-small font-medium text-brand-fg underline-offset-4 hover:underline ${FOCUS}">${text}${icon("chevronRight", "size-3.5 rtl:-scale-x-100")}</a>`;
const clThresholdViews = (c) => viewsFor(c, c.minPayout);
const clThresholdPct = (p) => Math.min(99, Math.floor((p.views / Math.max(1, clThresholdViews(campaignById(p.campaign)))) * 100));
const clMyEarnings = (c) => myPubs().filter((p) => p.campaign === c.id).reduce((s, p) => s + earningsOf(p), 0);
// Gain encore en rétention (contrôle anti-fraude) : pas encore retirable.
const clOnHold = (x) => x.type === "gain" && x.availableAt && new Date(x.availableAt).getTime() > Date.now();
const clTxBadge = (x) => (clOnHold(x) ? badge(t("En rétention"), "idle", { ic: "clock" }) : statusBadge(x.status));
// Libellé d'une opération : un gain porte le titre de sa campagne (texte de l'agence, jamais traduit), suivi le cas
// échéant de « · vues supplémentaires » ; les autres libellés viennent du serveur (« Retrait vers CCP », prime du
// classement « Prime classement · semaine 43 (1er) », prime de parrainage « Parrainage · premier retrait de … ») : tServer.
const clTxLabel = (x) => {
  const s = String(x.label || ""), extra = s.match(/^(.*) · vues supplémentaires$/);
  if (x.type !== "gain" || /^Prime classement · semaine \d+ \(\d+(?:er|e)\)$/.test(s) || /^Parrainage · premier retrait de /.test(s)) return tServer(s);
  return extra ? t("{title} · vues supplémentaires", { title: extra[1] }) : s;
};
// Mois de l'historique (« Janvier 2026 ») dans la langue de l'interface, chiffres latins. key : « 2026-01 ».
const clMonthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  let s = `${m}/${y}`;
  try { s = new Intl.DateTimeFormat(LOCALES[LANG].intl, { month: "long", year: "numeric", numberingSystem: "latn" }).format(new Date(y, m - 1, 1)); } catch (e) {}
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const clPeriodSeg = () => segmented("period", `${state.period} jours`, [["7 jours", t("7 j")], ["30 jours", t("30 j")]], t("Période"));
// Catégorie de filtre : une catégorie précisée par l'agence (« Autre » au moment de la création) se range sous « Autre ».
const clCat = (c) => (CATEGORIES.includes(c.category) ? c.category : "Autre");
// Catégorie affichée : traduite si c'est l'une des 18 de la liste, sinon telle que l'agence l'a écrite.
const clCatLabel = (c) => esc(t(c.category));
// Mention « (facultatif) » d'un libellé de champ.
const clOptional = () => `<span class="font-normal text-fg-subtle">${t("(facultatif)")}</span>`;
// Énumération dans la langue de l'interface : « TikTok, Instagram et YouTube ».
const clList = (arr) => {
  try { return new Intl.ListFormat(LOCALES[LANG].intl, { type: "conjunction" }).format(arr); } catch (e) { return arr.join(", "); }
};
// Lien de clip : https et domaine de la plateforme déclarée (mêmes règles que le serveur, PLATFORM_HOSTS dans data.js).
const clUrlOk = (p, v) => { try { const x = new URL(String(v || "").trim()); return x.protocol === "https:" && !!PLATFORM_HOSTS[p] && PLATFORM_HOSTS[p].test(x.hostname); } catch (e) { return false; } };
// Forme normalisée d'un lien (le serveur enregistre url.toString()) : sert à repérer un lien déjà soumis.
const clUrlKey = (v) => { try { return new URL(String(v || "").trim()).toString(); } catch (e) { return String(v || "").trim(); } };
// Pictogrammes des plateformes d'une campagne (nom accessible : la liste complète).
const clPlatformIcons = (list, cls = "") =>
  `<span class="inline-flex items-center gap-1 ${cls}" role="img" aria-label="${t("Plateformes : {list}", { list: esc(clList(list)) })}" title="${esc(list.join(" · "))}">${list.map((p) => icon(PLATFORM_ICON[p] || "film", "size-3.5 shrink-0")).join("")}</span>`;
// En-tête de section avec des commandes en bout de ligne (filtre, lien « Tout voir »).
const clSection = (title, right = "") =>
  `<div class="mb-3 mt-8 flex flex-wrap items-end justify-between gap-x-3 gap-y-2"><h2 class="text-heading text-fg">${title}</h2>${right ? `<div class="flex flex-wrap items-center gap-3">${right}</div>` : ""}</div>`;
// Campagnes ouvertes aux clips du clipper (rejointes et actives) : choix de la modale de soumission.
const clJoinedOpen = () => activeCampaigns().filter((c) => me().joinedCampaigns.has(c.id));
// Erreur sous un champ : effacée dès la saisie suivante (clearInvalid, main.js) grâce à data-field-error.
const clErr = (msg) => `<span data-field-error class="flex items-center gap-1 text-xs font-medium text-danger-fg" role="alert">${icon("alert", "size-3.5 shrink-0")}${msg}</span>`;

// ---------- Comptes sociaux (Profil → Comptes sociaux) ----------
// Un compte par plateforme : identifiant normalisé (sans « @ », en minuscules), code « CB-XXXX » à coller dans sa bio,
// statut « pending » puis « verified » (lib/server/services/social.ts). Seuls les clips d'un compte vérifié sont acceptés.
const clSocial = () => me().socialAccounts || [];
// Plateforme → identifiant du compte vérifié.
const clVerifiedMap = () => new Map(clSocial().filter((a) => a.status === "verified").map((a) => [a.platform, a.handle]));
// Recours (contestation d'un refus) du clipper sur un clip : un seul par clip.
const clAppealOf = (p) => (db.appeals || []).find((a) => a.publicationId === p.id) || null;
// Carte des comptes dans le Profil : #/clipper/profil/comptes y fait défiler la page et la met en évidence (flashRow).
const CL_SOCIAL_HREF = "#/clipper/profil/comptes";
// Lien vers cette carte ; inModal : la modale se ferme aussi.
const clSocialLink = (text, inModal = false) => `<a href="${CL_SOCIAL_HREF}"${inModal ? ' data-action="close-modal"' : ""} class="${btn("link")}">${text}</a>`;
// Compte nommé par un lien TikTok ou YouTube (« /@compte/… »), sans « @ », en minuscules ; null sinon
// (même règle que handleInUrl, lib/server/rules.ts).
const clUrlHandle = (p, v) => {
  if (p !== "TikTok" && p !== "YouTube") return null;
  try { const first = decodeURIComponent(new URL(String(v || "").trim()).pathname.split("/")[1] || ""); return first.startsWith("@") ? first.replace(/^@+/, "").toLowerCase() : null; } catch (e) { return null; }
};
// Le lien nomme un autre compte que le compte vérifié `handle` de la plateforme.
const clUrlForeign = (p, v, handle) => { const h = clUrlHandle(p, v); return !!h && h !== handle; };

// ---------- Organisateurs : agences et marques partenaires ----------
// L'organisateur d'une campagne est l'agence qui la finance (profil public dans db.agencies : photo, couverture, badge) ;
// sans agence (campagne créée par l'équipe ClipBoost), c'est l'agence visible qui porte le nom de sa marque, sinon la
// marque elle-même, sous la clé « brand:<nom normalisé> » (toutes écritures : arabe, tifinagh…). Page : #/clipper/agence/<clé>.
// Normalisation : sans accents ni signes diacritiques, en minuscules, espaces réduits (« Café  Noir » = « cafe noir »).
const clNorm = (s) => String(s || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const clAgencyOf = (c) => {
  const list = db.agencies || [];
  return (c.ownerId ? list.find((a) => a.id === c.ownerId) : list.find((a) => clNorm(a.name) === clNorm(c.brand))) || null;
};
const clOrgKey = (c) => { const a = clAgencyOf(c); return c.ownerId || (a ? a.id : `brand:${clNorm(c.brand) || c.id}`); };
const clOrgHref = (key) => `#/clipper/agence/${encodeURIComponent(key)}`;
const clOrgName = (c) => { const a = clAgencyOf(c); return a ? a.name : c.brand; };
// Organisateur réduit d'une campagne (lien, pastille, badge) : clé, nom, photo, badge de vérification.
const clOrgOf = (c) => { const a = clAgencyOf(c); return { key: clOrgKey(c), name: a ? a.name : c.brand, avatar: a ? a.avatar || null : null, verified: !!(a && a.verified) }; };
// Ligne de type des cartes (la page de l'organisateur précise « Campagne gérée par ClipBoost »).
const clOrgType = (o) => (o.agency ? `${t("Agence")} · ${esc(t(o.country || "Algérie"))}` : t("Marque partenaire"));
// Présentation : la bio de l'agence, sinon une phrase factuelle (marque gérée par ClipBoost, ancienneté de l'agence).
const clOrgAbout = (o) => (o.bio ? esc(o.bio) : o.agency
  ? t("Agence membre de {brand} depuis le {date}.", { date: date(o.since) })
  : t("Campagnes de la marque {name}, publiées et vérifiées par l'équipe {brand}.", { name: esc(o.name) }));
// Pastille de l'organisateur (carré arrondi : une structure, pas une personne) : sa photo, sinon ses initiales sur la
// même teinte que l'avatar de l'agence. size : taille et extras (anneau, marge négative sur une couverture) ;
// radius : arrondi (plus serré pour la petite pastille des cartes).
const clOrgMark = (o, size, radius = "rounded-tile") => o.avatar
  ? `<img src="${esc(o.avatar)}" alt="" loading="lazy" decoding="async" class="block ${size} shrink-0 select-none ${radius} bg-muted object-cover" aria-hidden="true"/>`
  : `<span class="grid ${size} shrink-0 select-none place-items-center ${radius} font-semibold text-on-brand ${AVATARS[[...String(o.key)].reduce((h, ch) => h + ch.charCodeAt(0), 0) % AVATARS.length]}" aria-hidden="true">${esc(initials(o.name))}</span>`;
// Couverture de l'organisateur (bandeau 3:1) : sa photo de couverture, sinon le dégradé de sa catégorie principale.
const clOrgCover = (o, cls) => o.cover
  ? `<div class="relative overflow-hidden bg-muted ${cls}" aria-hidden="true"><img src="${esc(o.cover)}" alt="" loading="lazy" decoding="async" class="absolute inset-0 size-full object-cover"/></div>`
  : `<div class="cover ${cls}" data-cat="${clCat(o.campaigns[0] || {})}" aria-hidden="true"></div>`;
// Lien vers l'organisateur dans une carte ou une ligne : cible tactile HIT (§3.5) sans décaler la ligne ; le nom se
// tronque dans un span intérieur (un overflow sur le lien rognerait sa zone de clic), le badge bleu reste entier.
// mark : taille de la pastille affichée avant le nom (sinon aucune).
const clOrgLink = (c, mark = "") => {
  const o = clOrgOf(c);
  return `<a href="${clOrgHref(o.key)}" class="${HIT} flex min-w-0 items-center gap-1 rounded-sm font-medium text-fg-muted underline-offset-2 transition-colors duration-150 hover:text-brand-fg hover:underline ${FOCUS}">${mark ? clOrgMark(o, mark, "rounded-[5px]") : ""}<span class="truncate">${esc(o.name)}</span>${o.verified ? verifiedBadge("size-3.5", t("Agence vérifiée")) : ""}</a>`;
};
// Mini-couverture (vignette 20 px) d'une campagne active sur la carte d'une agence.
const clMiniCover = (c) => `<span class="cover relative grid size-5 shrink-0 place-items-center overflow-hidden rounded-[4px] text-[11px] ring-2 ring-surface" ${coverAttr(c)}>${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy" decoding="async" class="absolute inset-0 size-full object-cover"/>` : c.emoji}</span>`;

/** Organisateurs des campagnes visibles : ceux qui ont une campagne active d'abord, puis par budget restant. */
function clOrganisers() {
  const map = new Map();
  for (const c of db.campaigns) {
    const key = clOrgKey(c);
    if (!map.has(key)) {
      const a = clAgencyOf(c);
      map.set(key, { key, agency: !!(c.ownerId || a), name: a ? a.name : c.brand, avatar: a ? a.avatar || null : null, cover: a ? a.cover || null : null,
        verified: !!(a && a.verified), country: a ? a.country : "", bio: a ? a.bio : "", joined: a ? a.joined : "", campaigns: [] });
    }
    map.get(key).campaigns.push(c);
  }
  return [...map.values()].map((o) => {
    const active = o.campaigns.filter((c) => c.status === "Active"), rated = active.length ? active : o.campaigns;
    const categories = [...new Set([...active, ...o.campaigns].map((c) => c.category))];
    const since = o.joined || o.campaigns.map((c) => c.createdAt).sort()[0];
    return { ...o, active, closed: o.campaigns.filter((c) => c.status !== "Active"), categories, since,
      best: Math.max(0, ...rated.map((c) => c.rate)), remaining: clSum(active.map((c) => Math.max(0, c.budget - c.spent))), entries: clSum(o.campaigns.map((c) => c.clippers)) };
  }).sort((a, b) => (b.active.length > 0) - (a.active.length > 0) || b.remaining - a.remaining || a.name.localeCompare(b.name, "fr"));
}

// Carte portefeuille : seule source du solde sur l'Accueil et le Portefeuille. Sur l'Accueil (curve), la courbe des
// gains cumulés couvre toujours les 30 derniers jours : le sélecteur de période ne règle que la section Statistiques.
function clWalletCard({ curve = false } = {}) {
  const bal = balance(), hold = db.settings.holdDays, min = db.settings.minWithdraw;
  // Sous le minimum, « Retirer » n'est pas l'action principale de l'écran : bouton secondaire et seuil affiché.
  const canWithdraw = bal >= min, wdVariant = canWithdraw ? "primary" : "secondary";
  const actions = curve
    ? `<div class="flex flex-col items-start gap-1.5 sm:items-end"><div class="flex items-center gap-2"><button type="button" data-action="withdraw" class="${btn(wdVariant)}">${t("Retirer")}</button><a href="#/clipper/portefeuille" class="${btn("ghost")}">${t("Portefeuille")}</a></div>${canWithdraw ? "" : `<p class="text-xs text-fg-subtle">${t("Disponible dès {amount}", { amount: da(min) })}</p>`}</div>`
    : "";
  const facts = `<dl class="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
      <div class="min-w-0"><dt class="flex items-center gap-1.5 text-small text-fg-muted">${icon("clock", "size-3.5 shrink-0 text-fg-subtle")}${t("En rétention")}</dt>
        <dd class="mt-1 text-base font-semibold">${money(pendingAmount())}</dd><dd class="mt-0.5 text-xs text-fg-subtle">${t("libéré après {days} de contrôle", { days: plural(hold, "jour", "jours") })}</dd></div>
      <div class="min-w-0"><dt class="text-small text-fg-muted">${t("Total gagné")}</dt>
        <dd class="mt-1 text-base font-semibold">${money(totalEarned())}</dd><dd class="mt-0.5 text-xs text-fg-subtle">${t("depuis l'inscription")}</dd></div></dl>`;
  if (!curve) {
    return card(`<p class="text-small font-medium text-fg-muted">${t("Solde disponible")}</p>
      <p class="mt-1">${bigMoney(bal, "money")}</p>
      <button type="button" data-action="withdraw" class="${btn(wdVariant, "md", "mt-5 w-full")}">${t("Demander un retrait")}</button>
      <p class="mt-2 text-center text-xs text-fg-subtle">${canWithdraw ? t("Retrait minimum {amount}", { amount: da(min) }) : t("Disponible dès {amount} de solde", { amount: da(min) })}</p>
      ${facts}`, "p-5");
  }
  const series = db.series.daily;
  return card(`<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div class="min-w-0"><p class="text-small font-medium text-fg-muted">${t("Solde disponible")}</p><p class="mt-1">${bigMoney(bal, "money")}</p></div>
      ${actions}</div>
    ${facts}
    ${clSum(series) ? `<p class="mt-5 text-micro font-medium text-fg-subtle">${t("Gains cumulés · {days}", { days: plural(series.length, "dernier jour", "derniers jours") })}</p>
    <div class="-mx-5 -mb-5 mt-1 pe-4" dir="ltr">${cumulativeChart(series, { h: "h-20", end: false, label: t("Gains cumulés") })}</div>` : ""}`, "p-5 overflow-hidden");
}

// Ligne d'historique d'argent (§4.6), du point de vue du clipper. Flèches entrée / sortie miroir en arabe ;
// la référence (code) reste de gauche à droite. Retrait versé : son reçu PDF (« Reçu PDF », icône seule sur mobile).
function txRow(x) {
  const credit = x.amount > 0, final = x.status === "Validé" && !clOnHold(x);
  const receipt = x.type === "retrait" && x.document
    ? `<div class="shrink-0"><span class="hidden sm:block">${txDocBtn(x, { variant: "secondary" })}</span><span class="sm:hidden">${txDocBtn(x, { compact: true })}</span></div>` : "";
  return `<li data-row="${x.id}" class="flex items-center gap-3 py-3">
    <span class="grid size-8 shrink-0 place-items-center rounded-full ${credit ? "bg-income-soft text-income" : "bg-muted text-fg-muted"}" aria-hidden="true">${icon(credit ? "arrowDownLeft" : "arrowUpRight", "size-4 rtl:-scale-x-100")}</span>
    <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(clTxLabel(x))}</p>
      <p class="truncate text-xs text-fg-subtle">${date(x.date)} · <span dir="ltr">${code(x.ref)}</span>${x.fee ? ` · ${t("frais {amount}", { amount: da(x.fee) })}` : ""}</p>
      ${final ? "" : `<div class="mt-1.5 sm:hidden">${clTxBadge(x)}</div>`}</div>
    <div class="shrink-0 text-end"><p class="text-sm font-medium">${money(x.amount, { signed: true, pending: !final })}</p><div class="mt-1 hidden justify-end sm:flex">${clTxBadge(x)}</div></div>
    ${receipt}
  </li>`;
}

// Carte campagne (§4.4) : photo de la campagne (sinon le dégradé de sa catégorie), tarif, plateformes, organisateur
// (pastille, nom et badge bleu). o.org === false : sans le lien vers l'organisateur (sur sa propre page).
// Campagne en pause ou terminée (page d'une agence, favoris, campagnes rejointes) : statut et détail, sans participation ;
// le cœur reste affiché tant qu'elle est en favori (pour pouvoir l'en retirer).
function campaignCard(c, o) {
  const u = me(), fav = u.favorites.has(c.id), joined = u.joinedCampaigns.has(c.id), open = c.status === "Active", org = !(o && o.org === false);
  const plats = PLATFORMS.filter((p) => c.platforms.includes(p));
  return `<article class="group flex min-w-0 flex-col ${CARD} ${CARD_HOVER} p-2">
    <div class="relative">
      <button type="button" data-action="open-campaign" data-id="${c.id}" class="cover relative block aspect-[16/9] w-full overflow-hidden rounded-tile ${FOCUS}" ${coverAttr(c)} aria-label="${t("Voir la campagne {title}", { title: esc(c.title) })}">
        ${coverArt(c, "text-5xl")}
        <span class="absolute start-2.5 top-2.5 inline-flex items-baseline gap-1 whitespace-nowrap rounded-badge bg-night/80 px-2 py-1 text-small font-semibold tabular-nums text-on-brand backdrop-blur-sm">${fmt(c.rate)}${NB}${t("DA")}<span class="text-[11px] font-medium text-on-brand/80">${t("/ 1k vues")}</span></span>
        ${c.top ? `<span class="absolute bottom-2.5 start-2.5 inline-flex items-center gap-1 rounded-badge bg-on-brand/90 px-1.5 py-0.5 text-[11px] font-semibold text-night">${icon("star", "size-3", true)}${t("Top campagne")}</span>` : ""}
      </button>
      ${plats.length ? clPlatformIcons(plats, "pointer-events-none absolute bottom-2.5 end-2.5 h-6 rounded-badge bg-night/80 px-1.5 text-on-brand backdrop-blur-sm") : ""}
      ${open || fav ? `<button type="button" data-action="toggle-fav" data-id="${c.id}" aria-pressed="${fav}" aria-label="${fav ? t("Retirer des favoris") : t("Ajouter aux favoris")}" class="absolute end-2.5 top-2.5 grid size-10 place-items-center rounded-full bg-on-brand/90 text-night/70 shadow-control backdrop-blur-sm transition-colors hover:text-danger-solid aria-pressed:text-danger-solid md:size-8 ${FOCUS}">${icon("heart", "size-4", fav)}</button>` : ""}
    </div>
    <div class="flex flex-1 flex-col gap-3 px-2 pb-1 pt-3">
      <div class="min-w-0"><p class="flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${org ? `${clOrgLink(c, "size-5 text-[9px]")}<span class="max-w-[60%] shrink-0 truncate">· ${clCatLabel(c)}</span>` : `<span class="truncate">${clCatLabel(c)}</span>`}</p><h3 class="mt-1 font-sans text-[15px] font-semibold leading-snug text-fg">${esc(c.title)}</h3></div>
      <dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-small">
        <dt class="text-fg-subtle">${t("Payé dès")}</dt><dd class="text-end font-medium tabular-nums text-fg">${plural(clThresholdViews(c), "vue", "vues")}</dd>
        <dt class="text-fg-subtle">${t("Plafond par clip")}</dt><dd class="text-end font-medium tabular-nums text-fg">${da(c.maxPayout)}</dd>
        ${joined ? `<dt class="text-fg-subtle">${t("Vos gains")}</dt><dd class="text-end font-medium">${money(clMyEarnings(c), { signed: true })}</dd>` : ""}
      </dl>
      ${progress(c.spent, c.budget, { aria: t("Budget utilisé") })}
      <div class="mt-auto pt-1">${!open
        ? `<div class="flex items-center justify-between gap-2">${statusBadge(c.status)}<button type="button" data-action="open-campaign" data-id="${c.id}" class="${btn("soft", "sm")}">${t("Détails")}</button></div>`
        : joined
        ? `<button type="button" data-action="submit-clip" data-id="${c.id}" class="${btn("secondary", "sm", "w-full")}">${icon("plus")}${t("Soumettre un clip")}</button>`
        : `<button type="button" data-action="join" data-id="${c.id}" class="${btn("soft", "sm", "w-full")}">${t("Rejoindre")}</button>`}</div>
    </div>
  </article>`;
}

// Vue liste des campagnes (§4.5) : une ligne de tableau (≥ xl) et un élément de liste (< xl).
// Campagne en pause ou terminée (rejointe ou en favori) : son statut à la place de l'action.
function clCampaignAction(c, size = "sm") {
  if (c.status !== "Active") return statusBadge(c.status);
  return me().joinedCampaigns.has(c.id)
    ? `<button type="button" data-action="submit-clip" data-id="${c.id}" class="${btn("secondary", size)}">${icon("plus")}${t("Soumettre")}</button>`
    : `<button type="button" data-action="join" data-id="${c.id}" class="${btn("soft", size)}">${t("Rejoindre")}</button>`;
}
function clFavButton(c, size = "sm") {
  const fav = me().favorites.has(c.id);
  if (!fav && c.status !== "Active") return `<span class="${iconBtn(size, false, "pointer-events-none invisible")}" aria-hidden="true"></span>`;
  return `<button type="button" data-action="toggle-fav" data-id="${c.id}" aria-pressed="${fav}" aria-label="${fav ? t("Retirer des favoris") : t("Ajouter aux favoris")}" class="${iconBtn(size, false, "aria-pressed:text-danger-solid")}">${icon("heart", "", fav)}</button>`;
}
function campaignRow(c) {
  const plats = PLATFORMS.filter((p) => c.platforms.includes(p));
  return `<tr class="${TBL.tr}">
    <td class="${TBL.td}"><div class="flex min-w-0 items-center gap-3"><button type="button" data-action="open-campaign" data-id="${c.id}" tabindex="-1" aria-hidden="true" class="shrink-0 rounded-tile">${coverThumb(c, "sm")}</button>
      <div class="min-w-0"><button type="button" data-action="open-campaign" data-id="${c.id}" class="block max-w-72 truncate rounded-sm text-start font-medium text-fg underline-offset-2 hover:underline ${FOCUS}" aria-label="${t("Voir la campagne {title}", { title: esc(c.title) })}">${esc(c.title)}</button>
        <p class="mt-0.5 flex min-w-0 max-w-72 items-center gap-1 text-xs text-fg-subtle">${clOrgLink(c)}<span class="max-w-[60%] shrink-0 truncate">· ${clCatLabel(c)}</span></p></div></div></td>
    <td class="${TBL.td}">${clPlatformIcons(plats, "text-fg-muted")}</td>
    <td class="${TBL.td} ${TBL.tdNum}">${money(c.rate)}</td>
    <td class="${TBL.td} ${TBL.tdNum}">${money(c.maxPayout)}</td>
    <td class="${TBL.td} ${TBL.tdNum}">${fmt(c.clippers)}</td>
    <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-1.5">${clFavButton(c)}${clCampaignAction(c)}</div></td>
  </tr>`;
}
function clCampaignItem(c) {
  const plats = PLATFORMS.filter((p) => c.platforms.includes(p));
  return `<li class="${TBL.item}">
    <div class="flex items-start gap-3"><button type="button" data-action="open-campaign" data-id="${c.id}" tabindex="-1" aria-hidden="true" class="shrink-0 rounded-tile">${coverThumb(c, "sm")}</button>
      <div class="min-w-0 flex-1"><button type="button" data-action="open-campaign" data-id="${c.id}" class="block max-w-full truncate rounded-sm text-start text-sm font-medium text-fg ${FOCUS}" aria-label="${t("Voir la campagne {title}", { title: esc(c.title) })}">${esc(c.title)}</button>
        <p class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${clOrgLink(c)}<span class="max-w-[70%] shrink-0 truncate">· ${clCatLabel(c)} · ${plural(c.clippers, "clipper", "clippers")}</span></p></div>${clFavButton(c, "md")}</div>
    <div class="flex items-center justify-between gap-3"><span class="flex min-w-0 items-center gap-2 text-small font-medium tabular-nums text-fg">${rateShort(c.rate)}${clPlatformIcons(plats, "text-fg-subtle")}</span>${clCampaignAction(c, "md")}</div>
  </li>`;
}

// Recours sous un clip refusé (espace clipper) : « Contester le refus » tant qu'aucun recours n'a été envoyé, puis le
// badge du recours (ouvre son détail) et, une fois décidé, le motif de l'équipe.
function clAppealLine(p) {
  const a = clAppealOf(p);
  if (!a) {
    return p.status === "Refusée"
      ? `<button type="button" data-action="cl-appeal" data-id="${p.id}" class="${HIT} mt-1 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-brand-fg underline-offset-4 hover:underline ${FOCUS}">${icon("flag", "size-3.5 shrink-0")}${t("Contester le refus")}</button>`
      : "";
  }
  const note = a.status !== "En attente" && a.decisionNote ? `<span class="mt-0.5 block truncate text-xs text-fg-subtle">${t("Réponse : {note}", { note: esc(a.decisionNote) })}</span>` : "";
  return `<button type="button" data-action="cl-appeal" data-id="${p.id}" class="mt-1 inline-flex rounded-badge ${FOCUS}" aria-label="${t("Voir mon recours sur « {title} »", { title: esc(p.title) })}">${appealBadge(a.status)}</button>${note}`;
}

// Tableau des clips (§4.5), partagé avec l'agence (amountLabel « Coût ») et l'admin (actions : colonne Décision, §6.4).
// amountLabel : texte source français (traduit ici, à l'affichage). Liens selon l'espace : clipper, la campagne ouvre sa
// fiche ; admin, le clip ouvre sa fiche d'examen (#/admin/moderation/<id>), la campagne la sienne (#/admin/campagnes/<id>)
// et le clippeur son profil (#/admin/utilisateur/<id>). Un clip publié sur plusieurs plateformes (même lot) le signale :
// « Aussi publié sur … ».
// tag(p) : pastille facultative après le titre de chaque clip (HTML ; l'admin y montre le risque de fraude, admRiskTag).
function publicationsTable(list, { showUser = false, actions = false, amountLabel = actions ? "Gain estimé" : "Gains", tag = null } = {}) {
  if (!list.length) return emptyState("film", t("Aucun clip pour le moment"), t("Les clips soumis apparaîtront ici."));
  const dash = `<span class="font-normal text-fg-subtle">—</span>`;
  const area = state.route.area, clipperArea = area === "clipper", adminArea = area === "admin";
  // Lots : publications soumises ensemble (un même clip, une publication par plateforme).
  const batches = new Map();
  for (const x of db.publications) if (x.batch) { if (!batches.has(x.batch)) batches.set(x.batch, []); batches.get(x.batch).push(x.platform); }
  const alsoOn = (p) => {
    const others = p.batch ? (batches.get(p.batch) || []).filter((pl) => pl !== p.platform) : [];
    const names = PLATFORMS.filter((pl) => others.includes(pl)).concat(others.filter((pl) => !PLATFORMS.includes(pl)));
    return names.length ? `<span class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${icon("layers", "size-3.5 shrink-0")}<span class="truncate">${t("Aussi publié sur {list}", { list: esc(clList([...new Set(names)])) })}</span></span>` : "";
  };
  const userHref = (u) => `#/admin/utilisateur/${encodeURIComponent(u.id)}`;
  const rows = list.map((p) => {
    const c = campaignById(p.campaign), owner = userById(p.userId), pending = p.status === "En attente", under = pending && belowMin(p);
    const share = under ? clThresholdPct(p) : 0;
    const thresholdBar = (w) => `<span class="block ${w}">${progress(p.views, clThresholdViews(c), { label: false, aria: t("Progression vers le seuil") })}</span>`;
    // Lien externe vers la vidéo publiée (l'admin l'ouvre d'un pictogramme : le titre mène à la fiche d'examen).
    const external = p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="inline-grid size-6 shrink-0 place-items-center rounded-sm text-fg-subtle transition-colors hover:text-fg ${FOCUS}" aria-label="${t("Ouvrir « {title} » sur {platform}", { title: esc(p.title), platform: esc(p.platform) })}" title="${t("Ouvrir sur {platform}", { platform: esc(p.platform) })}">${icon("external", "size-3.5")}</a>` : "";
    // Lien transformé en bouton par admPubTable (admin.js) : garder la forme <a href="#/admin/moderation/…" class="…" …>titre</a>.
    const reviewLink = (cls) => `<a href="#/admin/moderation/${encodeURIComponent(p.id)}" class="${cls} underline-offset-2 hover:underline ${FOCUS}" title="${t("Examiner le clip")}">${esc(p.title)}</a>`;
    // La cellule Clip prend la place restante (w-full max-w-0) : seul le texte trop long est tronqué.
    // Pastille : après le titre dans le tableau, sur sa propre ligne dans la liste (le titre garde toute la largeur).
    const extra = tag ? tag(p) : "", extraLine = extra ? `<span class="mt-1.5 flex">${extra}</span>` : "";
    const withTag = (html) => (extra ? `<span class="flex min-w-0 items-center gap-1.5">${html}${extra}</span>` : html);
    const title = adminArea
      ? `<span class="flex min-w-0 items-center gap-1">${reviewLink("block min-w-0 truncate rounded-sm font-medium text-fg")}${external}${extra ? `<span class="ms-0.5 flex shrink-0">${extra}</span>` : ""}</span>`
      : withTag(p.url
        ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="block min-w-0 truncate font-medium text-fg underline-offset-2 hover:underline ${FOCUS}">${esc(p.title)}</a>`
        : `<span class="block min-w-0 truncate font-medium text-fg">${esc(p.title)}</span>`);
    const titleMobile = adminArea
      ? `<span class="flex min-w-0 items-center gap-1">${reviewLink("min-w-0 truncate rounded-sm text-sm font-medium text-fg")}${external}</span>`
      : `<p class="truncate text-sm font-medium text-fg">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="underline-offset-2 hover:underline">${esc(p.title)}</a>` : esc(p.title)}</p>`;
    const reason = p.status === "Refusée" && p.reason ? `<span class="mt-0.5 block truncate text-xs text-danger-fg">${t("Motif : {reason}", { reason: esc(p.reason) })}</span>` : "";
    const appeal = clipperArea ? clAppealLine(p) : "";
    const also = alsoOn(p);
    const capped = p.status === "Validée" && isCapped(p) ? `<span class="mt-0.5 flex items-center justify-end gap-1 text-xs font-medium text-warning-fg">${icon("info", "size-3.5 shrink-0")}${t("Plafond atteint")}</span>` : "";
    // Montant : réel si validé ; estimé pour la modération ; « — » sinon (jamais « 0 DA » pour un gain non calculé).
    const amount = p.status === "Validée" ? `${money(earningsOf(p))}${capped}`
      : actions && pending && !under ? `${money(payoutOf(p))}<span class="${TBL.tdSub} font-normal">${t("estimé")}</span>`
      : under && !actions ? `${dash}<span class="mt-0.5 block text-xs font-normal text-fg-subtle">${t("{pct} du seuil", { pct: pct(share) })}</span><span class="mt-1 flex justify-end">${thresholdBar("w-20")}</span>`
      : dash;
    const amountMobile = p.status === "Validée" ? money(earningsOf(p)) : actions && pending && !under ? `<span class="text-fg-subtle">${t("estimé")}</span> ${money(payoutOf(p))}` : under ? `<span class="text-xs text-fg-subtle">${t("{pct} du seuil", { pct: pct(share) })}</span>` : dash;
    const eye = (size) => `<button type="button" data-action="adm-views" data-id="${p.id}" class="${iconBtn(size, true)}" aria-label="${t("Relever les vues de « {title} »", { title: esc(p.title) })}" title="${t("Relever les vues")}">${icon("eye")}</button>`;
    const threshold = (cls) => `<span class="${cls}"><span class="text-xs font-medium text-warning-fg">${t("Seuil : {pct}", { pct: pct(share) })}</span>${thresholdBar("w-full")}</span>`;
    // Clip déjà traité : l'emplacement du bouton « Relever les vues » est toujours réservé (badges alignés en bout de ligne).
    const decision = !actions ? "" : pending
      ? `<div class="flex items-center justify-end gap-2">${eye("sm")}<button type="button" data-action="adm-reject" data-id="${p.id}" class="${btn("dangerSoft", "sm")}">${t("Refuser")}</button>${under ? threshold("inline-grid w-[4.125rem] gap-1 whitespace-nowrap text-start") : `<button type="button" data-action="adm-validate" data-id="${p.id}" class="${btn("primary", "sm")}">${t("Valider")}</button>`}</div>`
      : `<div class="flex items-center justify-end gap-2">${statusBadge(p.status)}${p.status === "Validée" ? eye("sm") : `<span class="size-10 shrink-0 md:size-8" aria-hidden="true"></span>`}</div>`;
    // Liste (sous 1 440 px chez l'admin) : boutons md en grille sur téléphone, en bout de ligne dès sm (comme Campagnes et Paiements).
    const decisionMobile = !actions ? "" : pending
      ? `<div class="grid grid-cols-[auto_1fr_1fr] gap-2 sm:flex sm:justify-end">${eye("lg")}<button type="button" data-action="adm-reject" data-id="${p.id}" class="${btn("dangerSoft", "md")}">${t("Refuser")}</button>${under ? threshold("grid content-center gap-1 rounded-control border border-line px-3 sm:w-40") : `<button type="button" data-action="adm-validate" data-id="${p.id}" class="${btn("primary", "md")}">${t("Valider")}</button>`}</div>`
      : p.status === "Validée" ? `<div class="flex justify-end"><button type="button" data-action="adm-views" data-id="${p.id}" class="${btn("secondary", "md")}">${icon("eye")}${t("Relever les vues")}</button></div>` : "";
    // Campagne du clip : sa fiche (clipper) ou sa fiche d'examen (admin). Cible tactile HIT : le titre se tronque dans
    // un span intérieur et la ligne n'a pas d'overflow (la zone de clic n'est pas rognée).
    const campLabel = `<span class="truncate">${esc(c.title)}</span>`;
    const LINKISH = `${HIT} inline-flex min-w-0 max-w-full rounded-sm text-start underline-offset-2 transition-colors hover:text-fg hover:underline ${FOCUS}`;
    const campName = clipperArea
      ? `<button type="button" data-action="open-campaign" data-id="${c.id}" class="${LINKISH}" aria-label="${t("Voir la campagne {title}", { title: esc(c.title) })}">${campLabel}</button>`
      : adminArea
        ? `<a href="#/admin/campagnes/${encodeURIComponent(c.id)}" class="${LINKISH}" aria-label="${t("Examiner la campagne {title}", { title: esc(c.title) })}">${campLabel}</a>`
        : `<span class="min-w-0 truncate">${esc(c.title)}</span>`;
    // Clippeur (agence et admin, sous-ligne de la liste) : chez l'admin, un lien vers son profil.
    const ownerSub = !showUser || !owner ? ""
      : adminArea
        ? `<a href="${userHref(owner)}" class="${HIT} min-w-0 truncate rounded-sm font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline ${FOCUS}">${esc(owner.name)}</a><span class="shrink-0" aria-hidden="true">·</span>`
        : `<span class="min-w-0 truncate">${esc(owner.name)}</span><span class="shrink-0" aria-hidden="true">·</span>`;
    const subLine = `<p class="flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${ownerSub}${campName}<span class="shrink-0 whitespace-nowrap">· ${date(p.date)}</span></p>`;
    // Sous-ligne du tableau : seule la campagne se tronque ; la plateforme (colonne masquée sous xl) devient un pictogramme.
    const subCell = `<span class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${campName}<span class="shrink-0 whitespace-nowrap">· ${date(p.date)}</span><span class="inline-flex shrink-0 items-center gap-1 xl:hidden" title="${esc(p.platform)}">·${icon(PLATFORM_ICON[p.platform] || "film", "size-3.5")}<span class="sr-only">${esc(p.platform)}</span></span></span>`;
    const ownerCell = !owner ? dash
      : adminArea
        ? `<a href="${userHref(owner)}" class="flex min-w-0 items-center gap-2 rounded-sm text-small text-fg underline-offset-2 hover:underline ${FOCUS}">${avatar(owner, "xs")}<span class="max-w-40 truncate">${esc(owner.name)}</span>${owner.verified ? verifiedBadge("size-3.5", t("Agence vérifiée")) : ""}</a>`
        : `<div class="flex items-center gap-2">${avatar(owner, "xs")}<span class="max-w-40 truncate text-small text-fg">${esc(owner.name)}</span></div>`;
    return {
      tr: `<tr data-row="${p.id}" class="${TBL.tr}">
        <td class="${TBL.td} w-full max-w-0"><div class="flex min-w-0 items-center gap-3">${coverThumb(c, "sm")}<div class="min-w-0 flex-1">${title}${subCell}${also}${reason}${appeal}</div></div></td>
        ${showUser ? `<td class="${TBL.td}">${ownerCell}</td>` : ""}
        <td class="${TBL.td} hidden xl:table-cell">${platformTag(p.platform)}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${fmt(p.views)}${actions ? `<span class="${TBL.tdSub} font-normal">${t("seuil {views}", { views: fmt(clThresholdViews(c)) })}</span>` : ""}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${amount}</td>
        ${actions ? `<td class="${TBL.td} ${TBL.tdActions}">${decision}</td>` : `<td class="${TBL.td}">${statusBadge(p.status)}</td>`}
      </tr>`,
      li: `<li data-row="${p.id}" class="${TBL.item}">
        <div class="flex items-start gap-3">${coverThumb(c, "sm")}<div class="min-w-0 flex-1">${titleMobile}
          ${subLine}${also}${reason}${appeal}${extraLine}</div>${actions && pending ? "" : statusBadge(p.status)}</div>
        <div class="flex items-center justify-between gap-3 text-small"><span class="flex min-w-0 items-center gap-1.5 truncate text-fg-subtle">${icon(PLATFORM_ICON[p.platform] || "film", "size-3.5 shrink-0")}<span class="truncate">${esc(p.platform)} · ${plural(p.views, "vue", "vues")}</span></span><span class="shrink-0 font-medium">${amountMobile}</span></div>
        ${under && !actions ? thresholdBar("w-full") : ""}${decisionMobile}
      </li>`,
    };
  });
  return `<div class="${TBL.wrap}">
    <table class="${TBL.table}">
      <thead><tr class="${TBL.headRow}"><th scope="col" class="${TBL.th}">${t("Clip")}</th>${showUser ? `<th scope="col" class="${TBL.th}">${t("Clippeur")}</th>` : ""}<th scope="col" class="${TBL.th} hidden xl:table-cell">${t("Plateforme")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Vues")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${esc(t(amountLabel))}</th>${actions ? `<th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Décision")}</th>` : `<th scope="col" class="${TBL.th}">${t("Statut")}</th>`}</tr></thead>
      <tbody>${rows.map((r) => r.tr).join("")}</tbody>
    </table>
    <ul class="${TBL.list}">${rows.map((r) => r.li).join("")}</ul>
  </div>`;
}
