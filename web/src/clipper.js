// Espace Clipper : accueil (activité et statistiques), découvrir (toutes les campagnes), agences et page d'une agence,
// publications, classement de la semaine, parrainage, portefeuille, profil (et comptes sociaux), paramètres. Modales : fiche d'une
// campagne, soumission d'un clip, retrait, retrait d'un compte social vérifié. Messages : questions posées aux
// organisateurs des campagnes.
// Recettes et helpers : docs/design-system.md §4 et §6.2 (web/src/ui.js). Helpers locaux préfixés « cl ».
// Textes : t("source française") au moment du rendu (web/src/i18n.js) ; traductions dans web/src/i18n/{en,ar}/clipper.js.
// Les valeurs échangées avec le serveur ou comparées (statuts, catégories, moyens de retrait, data-value) restent en
// français : seul leur affichage est traduit. Aucune variable locale ne s'appelle « t » (elle masquerait t()).

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
  ? t("Agence membre de ClipBoost depuis le {date}.", { date: date(o.since) })
  : t("Campagnes de la marque {name}, publiées et vérifiées par l'équipe ClipBoost.", { name: esc(o.name) }));
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

// ---------- Vues ----------

// Accueil : l'activité (portefeuille, opérations, seuil le plus proche, rappel des comptes sociaux à vérifier), les
// statistiques sur 7 ou 30 jours (chiffres clés, gains par jour ou cumulés, vues par plateforme, gains par campagne),
// les clips et une sélection à découvrir.
function cAccueil() {
  const u = me(), pubs = myPubs(), series = dailySeries();
  const count = (s) => pubs.filter((p) => p.status === s).length, validated = count("Validée"), waiting = count("En attente");
  const totalViews = clSum(pubs.map((p) => p.views)), periodGain = clSum(series), activeDays = series.filter((v) => v > 0).length;
  // Variation contre la période précédente (seulement sur 7 jours : la série du serveur couvre 30 jours).
  const prev = state.period === 7 && db.series.daily.length >= 14 ? clSum(db.series.daily.slice(-14, -7)) : 0;
  const change = prev ? ((periodGain - prev) / prev) * 100 : null;
  // Revenu pour 1 000 vues : gains validés ÷ vues validées × 1 000.
  const valid = pubs.filter((p) => p.status === "Validée"), validViews = clSum(valid.map((p) => p.views));
  const rpm = validViews ? Math.round((clSum(valid.map(earningsOf)) / validViews) * 1000) : 0;
  // À découvrir : campagnes actives pas encore rejointes, les « Top campagne » d'abord (puis les plus récentes).
  const discover = activeCampaigns().filter((c) => !u.joinedCampaigns.has(c.id)).sort((a, b) => Number(b.top) - Number(a.top)).slice(0, 3);
  const submitBtn = `<button type="button" data-action="submit-clip" class="${btn("primary")}">${icon("plus")}${t("Soumettre un clip")}</button>`;

  // Motivation : le clip en attente le plus proche du seuil (un seul, des faits, aucun emoji).
  const near = pubs.filter((p) => p.status === "En attente" && belowMin(p))
    .map((p) => ({ p, c: campaignById(p.campaign), left: clThresholdViews(campaignById(p.campaign)) - p.views }))
    .sort((a, b) => a.left - b.left)[0];

  const onboarding = !u.joinedCampaigns.size
    ? `<section class="mt-6 rounded-card border border-brand-line bg-brand-soft p-5 sm:p-6">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0"><h2 class="text-section text-fg">${t("Prêt pour votre premier clip ?")}</h2>
            <ol class="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-6">${[t("Rejoignez une campagne"), t("Publiez votre clip"), t("Soumettez le lien pour validation")].map((s, i) =>
              `<li class="flex items-center gap-2.5 text-small text-fg-muted"><span class="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-on-brand">${i + 1}</span>${s}</li>`).join("")}</ol></div>
          <a href="#/clipper/decouvrir" class="${btn("primary")}">${icon("compass")}${t("Découvrir les campagnes")}</a></div></section>`
    : "";

  // Aucun compte social vérifié : une alerte discrète, les clips n'étant acceptés que depuis un compte vérifié.
  const socialAlert = clVerifiedMap().size ? ""
    : `<div class="mt-6">${alertBox("info", `${t("Vérifiez au moins un compte social : seuls les clips publiés depuis un compte vérifié sont acceptés.")} ${clSocialLink(t("Vérifier mes comptes"))}`)}</div>`;

  const ops = myTx().slice(0, 4);
  const opsCard = card(`${cardHeader(t("Dernières opérations"), "", ops.length ? clLink("#/clipper/portefeuille", t("Tout voir")) : "")}
    ${ops.length ? `<ul class="mt-1 divide-y divide-line">${ops.map(txRow).join("")}</ul>`
      : emptyState("wallet", t("Aucune opération"), t("Vos gains validés et vos retraits apparaîtront ici."), "", { inCard: true })}`, "p-5");

  // Statistiques (après le premier clip) : la période choisie règle les chiffres clés et le graphique.
  let stats = "";
  if (pubs.length) {
    const periodDays = plural(state.period, "jour", "jours");
    const kpis = [
      // Variation signée (+12 %) : de gauche à droite, même en arabe.
      kpi({ label: t("Gains de la période"), value: bigMoney(periodGain), delta: change === null ? "" : `<span dir="ltr">${change >= 0 ? "+" : MINUS}${pct(Math.abs(change))}</span>`, deltaTone: change === null ? "flat" : change > 0 ? "up" : change < 0 ? "down" : "flat",
        sub: change === null ? t("Sur les {days}", { days: plural(state.period, "dernier jour", "derniers jours") }) : t("vs 7 jours précédents") }),
      kpi({ label: t("Vues totales"), value: kpiValue(compact(totalViews)), sub: t("sur {clips}", { clips: plural(pubs.length, "clip", "clips") }) }),
      kpi({ label: t("Taux de validation"), value: kpiValue(pct((validated / pubs.length) * 100)), sub: t("{validated} · {waiting} en attente", { validated: plural(validated, "validé", "validés"), waiting: fmt(waiting) }) }),
      kpi({ label: t("Revenu pour 1 000 vues"), value: rpm ? bigMoney(rpm) : kpiValue("—"), sub: rpm ? t("sur vos clips validés") : t("Aucun clip validé") }),
    ];
    const mode = state.clChart === "cumul" ? "cumul" : "jour";
    const dates = seriesDates(series.length);
    // Libellé de la courbe : cumulativeChart (ui.js) y ajoute le total et le nombre de jours.
    const cumul = `<div class="pt-7" dir="ltr">${cumulativeChart(series, { h: "h-44", label: t("Gains cumulés") })}</div>
      <div class="mt-2 flex justify-between text-micro tabular-nums text-fg-subtle" dir="ltr" aria-hidden="true"><span>${dayLabel(dates[0])}</span><span>${dayLabel(dates[Math.floor((dates.length - 1) / 2)])}</span><span>${t("Auj.")}</span></div>`;
    const chart = card(`<header class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0"><h3 class="text-section text-fg">${mode === "cumul" ? t("Gains cumulés") : t("Gains par jour")}</h3><p class="mt-0.5 text-small text-fg-subtle">${t("Sur {days} · {active}", { days: periodDays, active: plural(activeDays, "jour actif", "jours actifs") })}</p></div>
        ${segmented("cl-chart", mode, [["jour", t("Par jour")], ["cumul", t("Cumulé")]], t("Forme du graphique"))}</header>
      ${periodGain ? `<div class="mt-5">${mode === "cumul" ? cumul : `<div dir="ltr">${barChart(series, { tone: "income", h: "h-44", caption: t("Gains par jour sur {days}", { days: periodDays }) })}</div>`}</div>`
        : emptyState("chart", t("Aucun gain sur cette période"), t("Choisissez une période plus longue ou attendez la validation de vos clips."), "", { inCard: true })}`, "p-5");
    const byPlatform = PLATFORMS.map((pl) => {
      const v = clSum(pubs.filter((p) => p.platform === pl).map((p) => p.views));
      return { label: platformTag(pl), value: v, display: fmt(v) };
    });
    const byCampaign = db.campaigns.map((c) => ({ c, earn: clSum(pubs.filter((p) => p.campaign === c.id).map(earningsOf)) })).filter((x) => x.earn > 0)
      .map((x) => ({ label: `${coverThumb(x.c, "xs")}<span class="truncate">${esc(x.c.title)}</span>`, value: x.earn, display: money(x.earn) }));
    stats = `${clSection(t("Statistiques"), clPeriodSeg())}
      <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">${kpis.join("")}</div>
      <div class="mt-4 lg:mt-5">${chart}</div>
      <div class="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">
        ${card(`${cardHeader(t("Vues par plateforme"), t("Tous clips confondus"))}<div class="mt-5">${barList(byPlatform, { tone: "brand", aria: t("Vues par plateforme") })}</div>`, "p-5")}
        ${card(`${cardHeader(t("Gains par campagne"), t("Gains validés"))}${byCampaign.length ? `<div class="mt-5">${barList(byCampaign, { tone: "income", aria: t("Gains par campagne") })}</div>`
          : emptyState("wallet", t("Aucun gain validé pour l'instant"), "", "", { inCard: true })}`, "p-5")}
      </div>`;
  }

  // Vos clips : les plus récents ou les plus vus (un seul tableau, les deux classements).
  const clipsMode = state.clClips === "top" ? "top" : "recent";
  const shown = clipsMode === "top" ? pubs.slice().sort((a, b) => b.views - a.views).slice(0, 4) : pubs.slice(0, 4);
  const clips = pubs.length
    ? `${clSection(t("Vos clips"), `${pubs.length > 1 ? segmented("cl-clips", clipsMode, [["recent", t("Récents")], ["top", t("Les plus vus")]], t("Classer vos clips")) : ""}${clLink("#/clipper/publications", t("Tout voir"))}`)}
      ${publicationsTable(shown)}`
    : u.joinedCampaigns.size
      ? `${clSection(t("Vos clips"))}${emptyState("film", t("Aucun clip soumis"), t("Publiez votre clip sur l'une des plateformes de la campagne, puis soumettez son lien pour validation."), `<button type="button" data-action="submit-clip" class="${btn("secondary")}">${icon("plus")}${t("Soumettre un clip")}</button>`)}`
      : "";

  return `${pageHeader(t("Bonjour {name}", { name: clFirst(u) }), t("Voici votre activité au {date}", { date: date(clToday()) }), submitBtn)}
    ${onboarding}
    ${socialAlert}
    <div class="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:gap-5">${clWalletCard({ curve: true })}${opsCard}</div>
    ${near ? `<div class="mt-4">${alertBox("info", t("Plus que {views} sur « {title} » pour être payé.", { views: `<strong class="font-semibold">${plural(near.left, "vue", "vues")}</strong>`, title: esc(near.c.title) }))}</div>` : ""}
    ${stats}
    ${clips}
    ${discover.length ? `${sectionHeader(t("À découvrir"), "#/clipper/decouvrir", t("Tout voir"))}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${discover.map((c) => campaignCard(c)).join("")}</div>` : ""}`;
}

// Découvrir : toutes les campagnes. Recherche (titre, marque, agence, catégorie dans les deux langues ; accents ignorés),
// catégorie (les catégories précisées par une agence sont rangées sous « Autre »), Toutes / Rejointes / Favoris, tri,
// grille ou liste. Rejointes et Favoris montrent aussi les campagnes en pause ou terminées (après les actives).
function cDecouvrir() {
  const f = state.camp, u = me(), q = clNorm(f.q || "");
  const scope = CL_SCOPES.includes(f.scope) ? f.scope : "Toutes", category = f.category || "Toutes", layout = f.layout === "list" ? "list" : "grid";
  const pools = {
    Toutes: activeCampaigns(),
    Rejointes: db.campaigns.filter((c) => u.joinedCampaigns.has(c.id)),
    Favoris: db.campaigns.filter((c) => u.favorites.has(c.id)),
  };
  const pool = pools[scope];
  const sorters = { recent: (a, b) => b.createdAt.localeCompare(a.createdAt), rate: (a, b) => b.rate - a.rate, popular: (a, b) => b.clippers - a.clippers };
  const sorter = sorters[f.sort] || sorters.recent;
  const list = pool.filter((c) =>
    (category === "Toutes" || clCat(c) === category) &&
    (!q || clNorm(`${c.title} ${c.brand} ${clOrgName(c)} ${c.category} ${t(c.category)}`).includes(q)))
    .sort((a, b) => (b.status === "Active") - (a.status === "Active") || sorter(a, b));
  const categoryOptions = [["Toutes", t("Toutes")], ...CATEGORIES.map((c) => [c, t(c)])];
  const layoutBtn = (v, ic, label) => `<button type="button" data-action="layout" data-value="${v}" aria-label="${label}" aria-pressed="${layout === v}" class="grid size-8 place-items-center rounded-lg text-fg-muted transition-colors duration-150 hover:text-fg aria-pressed:bg-surface-raised aria-pressed:text-fg aria-pressed:shadow-control [&_svg]:size-4 ${FOCUS}">${icon(ic)}</button>`;
  // Puces Rejointes / Favoris (mobile) : un second appui revient à « Toutes ».
  const scopeChip = (v, ic) => `<button type="button" data-action="camp-scope" data-value="${v}" data-toggle aria-pressed="${scope === v}" class="${CL_CHIP}">${icon(ic, "", ic === "heart" && scope === v)}${t(v)}<span class="tabular-nums opacity-80">${fmt(pools[v].length)}</span></button>`;

  // Desktop : recherche, catégorie, tri, affichage ; dessous, Toutes / Rejointes / Favoris et le nombre de résultats.
  // Mobile : recherche + tri, puis une rangée de puces défilante (Rejointes, Favoris, catégories).
  const toolbar = `<div class="mt-6 flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
      ${searchInput("camp-q", f.q || "", t("Rechercher"), t("Rechercher une campagne, une agence ou une marque"), "min-w-0 flex-1 md:max-w-sm")}
      <span class="hidden md:ms-auto md:block">${select("camp-category", category, [["Toutes", t("Toutes les catégories")], ...CATEGORIES.map((c) => [c, t(c)])], { label: t("Catégorie") })}</span>
      ${select("camp-sort", sorters[f.sort] ? f.sort : "recent", [["recent", t("Plus récentes")], ["rate", t("Mieux payées")], ["popular", t("Plus populaires")]], { label: t("Trier les campagnes"), cls: "w-40 shrink-0 md:w-auto" })}
      <span class="hidden md:block"><span class="inline-flex items-center gap-0.5 rounded-control border border-line bg-subtle p-0.5" role="group" aria-label="${t("Affichage")}">${layoutBtn("grid", "grid", t("Affichage en grille"))}${layoutBtn("list", "list", t("Affichage en liste"))}</span></span>
      <div class="-mx-4 flex basis-full gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden" role="group" aria-label="${t("Filtrer les campagnes")}">
        ${scopeChip("Rejointes", "check")}${scopeChip("Favoris", "heart")}
        <span class="my-1.5 w-px shrink-0 bg-line" aria-hidden="true"></span>
        ${categoryOptions.map(([v, l]) => `<button type="button" data-action="camp-cat" data-value="${esc(v)}" aria-pressed="${category === v}" class="${CL_CHIP}">${esc(l)}</button>`).join("")}
      </div>
    </div>
    <div class="mb-3 mt-4 flex flex-wrap items-center justify-between gap-3">
      <span class="hidden md:block">${segmented("camp-scope", scope, CL_SCOPES.map((v) => [v, t(v), pools[v].length]), t("Afficher les campagnes"))}</span>
      <p class="text-small text-fg-subtle" aria-live="polite">${plural(list.length, "résultat", "résultats")}</p>
    </div>`;

  const showAll = `<button type="button" data-action="camp-scope" data-value="Toutes" class="${btn("secondary")}">${t("Voir toutes les campagnes")}</button>`;
  const results = !pool.length
    ? scope === "Rejointes"
      ? emptyState("target", t("Aucune campagne rejointe"), t("Rejoignez une campagne pour soumettre vos clips et suivre vos gains."), showAll)
      : scope === "Favoris"
        ? emptyState("heart", t("Aucun favori"), t("Touchez le cœur d'une campagne pour la retrouver ici."), showAll)
        : emptyState("compass", t("Aucune campagne active pour le moment"), t("Les nouvelles campagnes apparaissent ici dès leur validation par l'équipe ClipBoost."))
    : !list.length
      ? emptyState("search", t("Aucune campagne ne correspond"), t("Essayez une autre catégorie ou effacez la recherche."), `<button type="button" data-action="reset-filters" class="${btn("secondary")}">${t("Effacer les filtres")}</button>`)
      : layout === "list"
        // 6 colonnes (environ 870 px) : le tableau à partir de xl, la liste en dessous (jamais de colonne rognée).
        ? `<div class="${TBL.wrap}"><table class="${TBL.table.replace("md:table", "xl:table")}">
            <thead><tr class="${TBL.headRow}"><th scope="col" class="${TBL.th}">${t("Campagne")}</th><th scope="col" class="${TBL.th}">${t("Plateformes")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Tarif / 1 000 vues")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Plafond par clip")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Clippers")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}"><span class="sr-only">${t("Actions")}</span></th></tr></thead>
            <tbody>${list.map(campaignRow).join("")}</tbody></table>
            <ul class="${TBL.list.replace("md:hidden", "xl:hidden")}">${list.map(clCampaignItem).join("")}</ul></div>`
        : `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">${list.map((c) => campaignCard(c)).join("")}</div>`;

  return `${pageHeader(t("Découvrir"), t("{campaigns} · tarif pour 1 000 vues validées", { campaigns: plural(activeCampaigns().length, "campagne active", "campagnes actives") }))}
    ${toolbar}
    ${results}`;
}

// Carte d'un organisateur (page Agences) : couverture 3:1, pastille, nom et badge bleu ; toute la carte mène à sa page.
function clAgencyCard(o) {
  const n = o.active.length, dash = `<span class="font-normal text-fg-subtle">—</span>`;
  const thumbs = o.active.slice(0, 3).map(clMiniCover).join("");
  return `<a href="${clOrgHref(o.key)}" data-org="${esc(o.key)}" class="group flex min-w-0 flex-col overflow-hidden ${CARD} ${CARD_HOVER}">
    ${clOrgCover(o, "aspect-[3/1] w-full")}
    <div class="flex flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5">
      ${clOrgMark(o, "relative -mt-6 size-12 text-sm ring-4 ring-surface")}
      <h3 class="mt-2.5 flex min-w-0 items-center gap-1 font-sans text-[15px] font-semibold leading-snug text-fg"><span class="truncate">${esc(o.name)}</span>${o.verified ? verifiedBadge("size-4", t("Agence vérifiée")) : ""}</h3>
      <p class="mt-0.5 truncate text-xs text-fg-subtle">${clOrgType(o)}</p>
      <p class="mt-3 line-clamp-2 min-h-[2lh] text-small ${o.bio ? "text-fg-muted" : "text-fg-subtle"}">${clOrgAbout(o)}</p>
      <dl class="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t border-line pt-3.5 text-small">
        <dt class="text-fg-subtle">${t("Campagnes actives")}</dt><dd class="flex items-center justify-end gap-2 font-medium tabular-nums text-fg">${thumbs ? `<span class="flex -space-x-1" aria-hidden="true">${thumbs}</span>` : ""}${n ? fmt(n) : `<span class="font-normal text-fg-subtle">${t("Aucune")}</span>`}</dd>
        <dt class="text-fg-subtle">${t("Meilleur tarif")}</dt><dd class="text-end font-medium tabular-nums text-fg">${n ? rateShort(o.best) : dash}</dd>
        <dt class="text-fg-subtle">${t("Budget restant")}</dt><dd class="text-end font-medium">${n ? money(o.remaining) : dash}</dd>
      </dl>
      <div class="mt-auto flex items-center justify-between gap-3 pt-4">
        <ul class="flex min-w-0 flex-wrap gap-1.5" aria-label="${t("Catégories")}">${o.categories.map((cat) => `<li class="inline-flex h-6 items-center rounded-badge bg-muted px-2 text-xs font-medium text-fg-muted">${esc(t(cat))}</li>`).join("")}</ul>
        <span class="inline-flex shrink-0 items-center gap-0.5 text-small font-medium text-brand-fg">${t("Voir les projets")}${icon("chevronRight", "size-4 transition-transform duration-150 ease-standard group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5")}</span>
      </div>
    </div>
  </a>`;
}

// Agences : qui propose des projets de clipping. Recherche par nom (accents ignorés) ; les agences avec une campagne active d'abord.
function cAgences() {
  const all = clOrganisers(), q = clNorm(state.camp.aq || "");
  const list = q ? all.filter((o) => clNorm(o.name).includes(q)) : all;
  const active = activeCampaigns().length, withActive = all.filter((o) => o.active.length).length;
  const results = !all.length
    ? emptyState("building", t("Aucune agence pour le moment"), t("Les agences apparaîtront ici dès leur première campagne en ligne."))
    : !list.length
      ? emptyState("search", t("Aucune agence ne correspond"), t("Vérifiez l'orthographe ou effacez la recherche."), `<button type="button" data-action="reset-agencies" class="${btn("secondary")}">${t("Effacer la recherche")}</button>`)
      : `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">${list.map(clAgencyCard).join("")}</div>`;
  return `${pageHeader(t("Agences"), t("{agencies} des clippers sur {campaigns}. Ouvrez une agence pour voir ses projets.", { agencies: plural(withActive, "agence recrute", "agences recrutent"), campaigns: plural(active, "campagne active", "campagnes actives") }))}
    <div class="mt-6 flex items-center gap-2 md:gap-3">${searchInput("camp-aq", state.camp.aq || "", t("Rechercher une agence"), t("Rechercher une agence par son nom"), "min-w-0 flex-1 md:max-w-sm")}</div>
    <p class="mb-3 mt-4 text-small text-fg-subtle" aria-live="polite">${plural(list.length, "agence", "agences")}</p>
    ${results}`;
}

// Page d'un organisateur (#/clipper/agence/<clé>) : couverture, photo, nom et badge, présentation, chiffres clés, projets.
function cAgence() {
  const key = state.route.item || "", o = clOrganisers().find((x) => x.key === key);
  const crumb = (name) => `<nav aria-label="${t("Fil d'Ariane")}"><ol class="flex min-w-0 items-center gap-1.5 text-small">
      <li class="shrink-0"><a href="#/clipper/agences" class="${HIT} inline-flex items-center gap-1 rounded-sm font-medium text-fg-muted transition-colors duration-150 hover:text-fg ${FOCUS}">${icon("arrowLeft", "size-4 sm:hidden rtl:-scale-x-100")}${t("Agences")}</a></li>
      <li class="hidden shrink-0 text-fg-subtle sm:block" aria-hidden="true">${icon("chevronRight", "size-3.5 rtl:-scale-x-100")}</li>
      <li class="hidden min-w-0 truncate text-fg-subtle sm:block" aria-current="page">${esc(name)}</li></ol></nav>`;
  if (!o) {
    return `${crumb(t("Agence introuvable"))}
      <h1 class="sr-only">${t("Agence introuvable")}</h1>
      <div class="mt-6">${emptyState("building", t("Agence introuvable"), t("Cette agence n'existe pas ou n'a plus de campagne visible."), `<a href="#/clipper/agences" class="${btn("secondary")}">${t("Voir les agences")}</a>`)}</div>`;
  }
  const n = o.active.length;
  const country = o.country || "Algérie";
  const grid = (list) => `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">${list.map((c) => campaignCard(c, { org: false })).join("")}</div>`;
  return `${crumb(o.name)}
    <section class="mt-4 overflow-hidden ${CARD}">
      ${clOrgCover(o, "aspect-[3/1] w-full")}
      <div class="px-4 pb-5 sm:px-6 sm:pb-6">
        ${clOrgMark(o, "relative -mt-10 size-20 text-xl ring-4 ring-surface sm:-mt-12 sm:size-24 sm:text-2xl")}
        <h1 class="mt-3 break-words text-title-sm text-fg sm:text-title">${esc(o.name)}${o.verified ? `${NB}${verifiedBadge("size-5 sm:size-6", t("Agence vérifiée"))}` : ""}</h1>
        <p class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-fg-muted">${o.agency
          ? `${badge(t("Agence"), "info")}<span class="inline-flex items-center gap-1.5">${esc(t(country))}${country === "Algérie" ? flagDz() : ""}</span>`
          : `${badge(t("Marque partenaire"), "brand")}<span>${t("Campagne gérée par ClipBoost")}</span>`}</p>
        <p class="mt-1 text-xs text-fg-subtle">${o.agency ? t("Membre depuis le {date}", { date: date(o.since) }) : t("Sur ClipBoost depuis le {date}", { date: date(o.since) })}</p>
        ${o.bio || !o.agency ? `<p class="mt-4 max-w-2xl text-sm leading-6 text-fg-muted">${clOrgAbout(o)}</p>` : ""}
      </div>
    </section>
    <div class="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-5 xl:grid-cols-4">
      ${kpi({ label: t("Campagnes actives"), value: kpiValue(fmt(n)), sub: o.closed.length ? `+ ${plural(o.closed.length, "en pause ou terminée", "en pause ou terminées")}` : t("Ouvertes aux clippers") })}
      ${kpi({ label: t("Meilleur tarif"), value: n ? bigMoney(o.best) : kpiValue("—"), sub: t("pour 1 000 vues validées") })}
      ${kpi({ label: t("Budget restant"), value: bigMoney(o.remaining), sub: t("sur les campagnes actives") })}
      ${kpi({ label: t("Participations"), value: kpiValue(fmt(o.entries)), sub: t("tous projets confondus") })}
    </div>
    ${sectionHeader(t("Projets de clipping en cours"))}
    ${n ? grid(o.active) : emptyState("target", t("Aucun projet en cours"), t("{name} n'a pas de campagne ouverte pour le moment.", { name: esc(o.name) }), `<a href="#/clipper/decouvrir" class="${btn("secondary")}">${t("Découvrir toutes les campagnes")}</a>`)}
    ${o.closed.length ? `${sectionHeader(t("Projets terminés ou en pause"))}${grid(o.closed)}` : ""}`;
}

function cPublications() {
  const pubs = myPubs(), list = pubs.filter((p) => state.pub.status === "Toutes" || p.status === state.pub.status);
  const count = (s) => pubs.filter((p) => p.status === s).length;
  const empty = { Validée: t("Aucun clip validé"), "En attente": t("Aucun clip en attente"), Refusée: t("Aucun clip refusé") }[state.pub.status];
  return `${pageHeader(t("Mes publications"), t("Suivez la validation et les gains de chacun de vos clips."), `<button type="button" data-action="submit-clip" class="${btn("primary")}">${icon("plus")}${t("Soumettre un clip")}</button>`)}
    ${pubs.length ? `<div class="mt-6">${segmented("pub-status", state.pub.status, [["Toutes", t("Toutes"), pubs.length], ["Validée", t("Validées"), count("Validée")], ["En attente", t("En attente"), count("En attente")], ["Refusée", t("Refusées"), count("Refusée")]], t("Statut"), { scroll: true })}</div>
    <div class="mt-4">${list.length ? publicationsTable(list)
      : emptyState("film", empty, t("Les clips de ce statut apparaîtront ici."), `<button type="button" data-action="pub-status" data-value="Toutes" class="${btn("secondary")}">${t("Voir tous les clips")}</button>`)}</div>`
    : `<div class="mt-6">${emptyState("film", t("Aucun clip soumis"), t("Rejoignez une campagne, publiez votre clip puis soumettez son lien pour validation."), `<a href="#/clipper/decouvrir" class="${btn("primary")}">${icon("compass")}${t("Découvrir les campagnes")}</a>`)}</div>`}`;
}

// ---------- Messages : une conversation par campagne (#/clipper/messages/<campagne>) ----------
// Le clipper pose sa question depuis la fiche d'une campagne (« Poser une question ») ; l'agence, ou l'équipe ClipBoost
// pour une campagne de ClipBoost, répond. Une campagne active ou en pause accepte de nouveaux messages.
const clThreadOf = (campaignId) => msgThreads().find((x) => x.campaignId === campaignId) || null;
const clAskable = (c) => c.status === "Active" || c.status === "En pause";
const clAnswerer = (c) => (c.ownerId ? clOrgName(c) : t("l'équipe ClipBoost"));

function cMessages() {
  const id = state.route.item || "", threads = msgThreads().filter((x) => campaignById(x.campaignId));
  const list = threads.length
    ? threads.map((x) => { const c = campaignById(x.campaignId); return msgThreadItem({ href: `#/clipper/messages/${encodeURIComponent(c.id)}`, current: c.id === id, thumb: coverThumb(c), title: esc(c.title), sub: esc(clOrgName(c)), thread: msgMine(x, true) }); }).join("")
    : emptyState("message", t("Aucune conversation"), t("Une question sur une campagne ? Ouvrez sa fiche et choisissez « Poser une question »."), `<a href="#/clipper/decouvrir" class="${btn("secondary")}">${t("Découvrir les campagnes")}</a>`, { inCard: true });
  let conversation = "";
  if (id) {
    const c = campaignById(id), x = c && clThreadOf(c.id);
    if (!c) conversation = `<div class="grid flex-1 place-items-center">${emptyState("message", t("Conversation introuvable"), t("Cette campagne n'est plus visible."), `<a href="#/clipper/messages" class="${btn("secondary")}">${t("Voir mes conversations")}</a>`, { inCard: true })}</div>`;
    else {
      msgAutoRead(x, { campaignId: c.id });
      const o = clOrgOf(c), who = clAnswerer(c);
      conversation = msgConversation({
        back: "#/clipper/messages",
        head: `${coverThumb(c)}<div class="min-w-0"><p class="truncate text-sm font-semibold text-fg">${esc(c.title)}</p><p class="truncate text-xs text-fg-subtle">${c.ownerId ? `${esc(o.name)}${o.verified ? `${NB}${verifiedBadge("size-3.5")}` : ""}` : t("Réponses de l'équipe ClipBoost")}</p></div>`,
        actions: `<button type="button" data-action="open-campaign" data-id="${c.id}" class="${btn("secondary", "sm", "shrink-0")}">${icon("info", "size-4")}<span class="max-sm:hidden">${t("Voir la campagne")}</span></button>`,
        messages: x ? msgMine(x, true).messages : [],
        empty: `<div class="grid h-full place-items-center">${emptyState("message", t("Posez votre question"), t("{name} vous répondra ici. Vous serez prévenu par une notification.", { name: esc(who) }), "", { inCard: true })}</div>`,
        composer: msgComposer("cl-msg", t("Écrivez votre question…"), clAskable(c) ? "" : t("Cette campagne est terminée : vous ne pouvez plus envoyer de message.")),
      });
    }
  }
  return msgLayout({ title: t("Messages"), text: t("Vos questions aux agences sur leurs campagnes, et leurs réponses."), list, conversation });
}

// ---------- Classement ----------
// Semaine en cours (du lundi 00:00 au dimanche 24:00, heure d'Alger) : podium et top 10 en direct avec la prime de chaque
// rang (places libres comprises), sa propre position, fin de la semaine, gagnants de la semaine écoulée et règles
// (db.leaderboard, helpers lb… de ui.js). Seules les vues des clips validés comptent.

// Jour à Alger (UTC+1) d'un instant ISO, au format ISO lu par date() ; back : ms retranchées (fin exclue de la semaine).
const clAlgiersDay = (iso, back = 0) => new Date(new Date(iso).getTime() + 3_600_000 - back).toISOString();

// Marche du podium : 1er au centre et plus haut (ordre 2-1-3, en miroir en arabe), photo, nom, vues, prime.
function clPodiumStep(r, meId) {
  const first = r.rank === 1;
  return `<li class="flex min-w-0 flex-col items-center rounded-tile px-2 text-center ${first ? "bg-warning-bg pb-4 pt-5 ring-1 ring-inset ring-warning-border" : "bg-subtle pb-3 pt-3"}">
    <span class="relative">${avatar(lbPerson(r), first ? "lg" : "size-12 text-base")}<span class="absolute -bottom-1 -end-1">${lbRankChip(r.rank, "size-6")}</span></span>
    <p class="mt-2.5 w-full truncate text-sm font-semibold text-fg">${esc(r.name)}</p>
    <p class="w-full truncate text-xs tabular-nums text-fg-subtle">${plural(r.views, "vue", "vues")}</p>
    <p class="mt-1.5">${lbPrize(r.prize)}</p>
    ${r.userId === meId ? `<p class="mt-1.5">${badge(t("Vous"), "brand")}</p>` : ""}
  </li>`;
}

function cClassement() {
  const lb = lbData(), u = me();
  if (!lb) return `${pageHeader(t("Classement"), "")}<div class="mt-6">${emptyState("trophy", t("Classement indisponible"), t("Rechargez la page pour afficher le classement de la semaine."))}</div>`;
  const mine = lb.me || { rank: null, views: 0 }, hold = db.settings.holdDays, podium = lb.top.slice(0, 3);
  const range = t("Du {from} au {to}, heure d'Alger", { from: date(clAlgiersDay(lb.start)), to: date(clAlgiersDay(lb.end, 1)) });

  // Semaine en cours : podium, rangs 4 à 10, places primées encore libres.
  const board = lb.top.length
    ? `<ol class="mt-5 grid grid-cols-3 items-end gap-2 sm:gap-3" aria-label="${esc(t("Podium"))}">${[1, 0, 2].map((i) => (podium[i] ? clPodiumStep(podium[i], u.id) : "<li></li>")).join("")}</ol>
      ${lb.top.length > 3 || lbOpenRanks(lb).length ? `<div class="mt-3">${lbRows(lb.top.slice(3), { meId: u.id, open: lbOpenRanks(lb) })}</div>` : ""}`
    : `${emptyState("trophy", t("Aucune vue validée cette semaine pour l'instant"), t("Le classement se remplit à chaque relevé des vues des clips validés. Les 10 premiers de la semaine gagnent une prime."), "", { inCard: true })}
      <div class="mt-1">${lbRows([], { open: lbOpenRanks(lb) })}</div>`;
  const weekCard = card(`${cardHeader(t("Semaine {n}", { n: fmt(lb.number) }), range, badge(t("En direct"), "success", { dot: true }))}${board}`, "p-5");

  // Sa position : rang et vues de la semaine, prime en jeu ou vues qui manquent pour entrer dans le top 10.
  const tenth = lb.top[9];
  const gap = mine.rank && mine.rank > 10 && tenth ? Math.max(1, tenth.views - mine.views + 1) : 0;
  const prize = mine.rank && mine.rank <= 10 ? lb.prizes[mine.rank - 1] || 0 : 0;
  const position = card(`<p class="text-small font-medium text-fg-muted">${t("Votre position")}</p>
    ${mine.rank
      ? `<p class="mt-1 flex flex-wrap items-baseline gap-x-2"><span class="text-[1.875rem] font-semibold leading-9 tracking-tight text-fg">${lbOrdinal(mine.rank)}</span><span class="text-small text-fg-subtle">${t("sur {count}", { count: plural(lb.ranked, "clipper classé", "clippers classés") })}</span></p>
        <p class="mt-2 text-sm text-fg-muted">${t("Vous êtes {rank} avec {views} cette semaine.", { rank: lbOrdinal(mine.rank), views: `<strong class="font-semibold text-fg">${plural(mine.views, "vue validée", "vues validées")}</strong>` })}</p>
        <div class="mt-4">${prize ? alertBox("success", t("Prime en jeu : {amount} si vous gardez cette place jusqu'à dimanche minuit.", { amount: `<strong class="font-semibold">${da(prize)}</strong>` }))
          : gap ? alertBox("info", t("Encore {views} pour entrer dans le top 10.", { views: `<strong class="font-semibold">${plural(gap, "vue", "vues")}</strong>` })) : ""}</div>`
      : `<p class="mt-1 text-base font-semibold text-fg">${t("Vous n'êtes pas encore au classement")}</p>
        <p class="mt-1 text-sm text-fg-muted">${t("Les vues gagnées cette semaine par vos clips validés vous y font entrer.")}</p>
        <div class="mt-4 flex flex-wrap gap-2"><button type="button" data-action="submit-clip" class="${btn("primary", "sm")}">${icon("plus")}${t("Soumettre un clip")}</button><a href="#/clipper/decouvrir" class="${btn("secondary", "sm")}">${t("Découvrir les campagnes")}</a></div>`}`, "p-5");
  const ends = card(`<div class="flex items-start gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-tile bg-subtle text-fg-muted" aria-hidden="true">${icon("clock", "size-5")}</span>
    <div class="min-w-0"><p class="text-small font-medium text-fg-muted">${t("Fin de la semaine dans")}</p><p class="mt-0.5 text-base font-semibold tabular-nums text-fg">${lbTimeLeft(lb.end)}</p>
      <p class="mt-1 text-xs text-fg-subtle">${t("Dimanche à minuit, heure d'Alger. Les primes sont versées lundi.")}</p></div></div>`, "p-5");

  // Semaine écoulée : ses gagnants et la prime versée à chacun.
  const last = lb.last;
  const lastCard = last ? card(`${cardHeader(t("Gagnants de la semaine {n}", { n: fmt(last.number) }), last.closedAt ? t("Primes versées le {date}", { date: date(last.closedAt) }) : "")}
    ${last.winners.length ? `<div class="mt-2">${lbRows(last.winners, { meId: u.id, amountKey: "amount" })}</div>` : emptyState("trophy", t("Aucun gagnant cette semaine-là"), "", "", { inCard: true })}`, "p-5") : "";

  const rules = [
    t("Seules les vues validées comptent : les vues gagnées pendant la semaine par vos clips validés, du lundi 00:00 au dimanche 24:00 (heure d'Alger)."),
    t("Les 10 premiers de la semaine gagnent une prime, versée lundi dans votre portefeuille."),
    t("Comme vos autres gains, une prime reste en rétention {days} avant d'être retirable.", { days: plural(hold, "jour", "jours") }),
    t("À égalité de vues, le clipper inscrit le plus tôt passe devant."),
  ];
  const rulesCard = card(`${cardHeader(t("Règles du classement"))}<ul class="mt-3 grid gap-2.5">${rules.map((r) => `<li class="flex gap-2.5 text-small text-fg-muted">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span>${r}</span></li>`).join("")}</ul>`, "p-5");

  return `${pageHeader(t("Classement"), t("Les clippers qui gagnent le plus de vues validées cette semaine. Les 10 premiers remportent une prime."))}
    <div class="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
      <div class="grid content-start gap-4 lg:col-start-2 lg:row-start-1 lg:gap-5">${position}${ends}</div>
      <div class="grid min-w-0 content-start gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:gap-5">${weekCard}${lastCard}</div>
      <div class="lg:col-start-2 lg:row-start-2">${rulesCard}</div>
    </div>`;
}

// ---------- Parrainage ----------
// Lien de parrainage du clipper (champ, « Copier », partage WhatsApp), règle de la prime (réglage referralBonus), chiffres
// clés et liste des filleuls (db.referral). La prime est versée au premier retrait validé de chaque filleul.

// Lien d'inscription avec le code : l'adresse de l'app (/espace en ligne, le fichier HTML hors ligne), sans paramètres.
const clReferralLink = (refCode) => `${location.href.split(/[?#]/)[0]}?ref=${encodeURIComponent(refCode)}#/inscription`;

function cParrainage() {
  const r = db.referral, bonus = db.settings.referralBonus || 0, hold = db.settings.holdDays;
  if (!r || !r.code) return `${pageHeader(t("Parrainage"), "")}<div class="mt-6">${emptyState("gift", t("Parrainage indisponible"), t("Rechargez la page pour afficher votre lien de parrainage."))}</div>`;
  const url = clReferralLink(r.code);
  const share = `https://wa.me/?text=${encodeURIComponent(t("Rejoins-moi sur ClipBoost : publie des clips et sois payé à la vue. Inscris-toi avec mon lien : {link}", { link: url }))}`;
  const rule = bonus > 0 ? t("Recevez {montant} quand votre filleul fait son premier retrait", { montant: `<strong class="font-semibold">${da(bonus)}</strong>` }) : t("Aucune prime de parrainage pour le moment : invitez quand même vos amis, la prime pourra revenir.");

  const linkCard = card(`${cardHeader(t("Votre lien de parrainage"), t("Partagez-le avec d'autres clippers : ils s'inscrivent sur ClipBoost avec votre code."))}
    <div class="mt-4 flex flex-col gap-2 sm:flex-row">
      <label class="min-w-0 flex-1"><span class="sr-only">${t("Lien de parrainage")}</span><input readonly value="${esc(url)}" dir="ltr" class="${inputCls} truncate font-mono text-small"/></label>
      <div class="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
        <button type="button" data-action="cl-ref-copy" data-value="${esc(url)}" class="${btn("primary")}">${icon("copy")}${t("Copier")}</button>
        <a href="${esc(share)}" target="_blank" rel="noopener" class="${btn("secondary")}">${icon("send", "size-4 rtl:-scale-x-100")}${t("WhatsApp")}</a>
      </div>
    </div>
    <p class="mt-3 text-small text-fg-muted">${t("Votre code : {code}", { code: `<span class="font-semibold text-fg">${code(r.code)}</span>` })}</p>
    <div class="mt-4">${alertBox(bonus > 0 ? "success" : "info", rule)}</div>`, "p-5");

  const st = r.stats || { referees: 0, firstWithdrawals: 0, bonus: 0 };
  const kpis = [
    kpi({ label: t("Filleuls"), value: kpiValue(fmt(st.referees)), sub: t("inscrits avec votre lien"), ic: "users" }),
    kpi({ label: t("Premiers retraits"), value: kpiValue(fmt(st.firstWithdrawals)), sub: st.referees ? t("sur {count}", { count: plural(st.referees, "filleul", "filleuls") }) : t("aucun filleul pour l'instant"), ic: "wallet" }),
    kpi({ label: t("Primes reçues"), value: bigMoney(st.bonus), sub: t("versées dans votre portefeuille"), ic: "gift" }),
  ];

  const row = (x) => `<li class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      ${avatar({ id: x.name + x.joined, name: x.name }, "md")}
      <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(x.name)}</p>
        <p class="truncate text-xs tabular-nums text-fg-subtle">${t("Inscrit le {date}", { date: date(x.joined) })}${x.bonus ? ` · ${t("prime de {amount}", { amount: da(x.bonus) })}` : ""}</p></div>
      ${x.firstWithdrawal ? badge(t("Premier retrait effectué"), "success", { ic: "check" }) : badge(t("Inscrit"), "idle", { dot: true })}
    </li>`;
  const list = card(`${cardHeader(t("Vos filleuls"), r.referees.length ? t("Du plus récent au plus ancien.") : "")}
    ${r.referees.length ? `<ul class="mt-4 divide-y divide-line">${r.referees.map(row).join("")}</ul>`
      : emptyState("users", t("Aucun filleul pour l'instant"), t("Les clippers inscrits avec votre lien apparaîtront ici."), "", { inCard: true })}`, "p-5");

  const rules = [
    t("Votre filleul s'inscrit comme clipper avec votre lien, par email ou avec Google, Apple ou Discord."),
    t("Dès que son premier retrait est validé par l'équipe, vous recevez la prime : une seule fois par filleul."),
    t("Comme vos autres gains, la prime reste en rétention {days} avant d'être retirable.", { days: plural(hold, "jour", "jours") }),
    t("Pas de prime si votre filleul retire vers le même compte que vous, ou si votre compte est suspendu."),
  ];
  const rulesCard = card(`${cardHeader(t("Comment ça marche"))}<ul class="mt-3 grid gap-2.5">${rules.map((x) => `<li class="flex gap-2.5 text-small text-fg-muted">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span>${x}</span></li>`).join("")}</ul>`, "p-5");

  return `${pageHeader(t("Parrainage"), t("Invitez d'autres clippers sur ClipBoost et recevez une prime à leur premier retrait."))}
    <div class="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 lg:gap-5">${linkCard}
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">${kpis[0]}${kpis[1]}<div class="col-span-2 sm:col-span-1">${kpis[2]}</div></div>
        ${list}</div>
      <div class="grid content-start gap-4 lg:gap-5">${rulesCard}</div>
    </div>`;
}

function cPortefeuille() {
  const u = me(), all = myTx();
  const list = all.filter((x) => state.tx.type === "tous" || x.type === state.tx.type);
  // Historique regroupé par mois (la liste arrive triée du plus récent au plus ancien).
  const groups = [];
  for (const x of list) {
    const key = x.date.slice(0, 7), last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(x); else groups.push({ key, items: [x] });
  }
  // Valeurs des segments : « Tous », « Gains », « Retraits » (lues par l'action tx-type) ; libellés traduits.
  const typeSeg = segmented("tx-type", { tous: "Tous", gain: "Gains", retrait: "Retraits" }[state.tx.type], [["Tous", t("Tous")], ["Gains", t("Gains")], ["Retraits", t("Retraits")]], t("Type d'opération"));
  const method = u.payoutMethod;
  const payoutCard = card(`${cardHeader(t("Moyen de retrait"))}
    <div class="mt-4 flex items-center gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-tile bg-subtle text-fg-muted">${icon(method ? CL_PAYOUT_ICON[method] || "bank" : "wallet", "size-5")}</span>
      <div class="min-w-0 flex-1">${method
        ? `<p class="truncate text-sm font-medium text-fg">${esc(t(method))}</p><p class="truncate font-mono text-small text-fg-subtle" dir="ltr">${maskAccount(u.payoutAccount)}</p>`
        : `<p class="text-sm font-medium text-fg">${t("Aucun moyen de retrait")}</p><p class="text-small text-fg-subtle">${t("Ajoutez un compte pour être payé.")}</p>`}</div>
      <a href="#/clipper/parametres" class="${btn("link", "", "shrink-0 text-small")}">${method ? t("Modifier") : t("Ajouter")}</a>
    </div>`, "p-5");
  const history = card(`${cardHeader(t("Historique"), "", typeSeg)}
    ${list.length ? `<div class="mt-4 grid gap-5">${groups.map((g) => {
      const month = clMonthLabel(g.key);
      return `<section aria-label="${esc(month)}"><h3 class="font-sans text-micro font-medium uppercase tracking-[0.08em] text-fg-subtle rtl:tracking-normal">${esc(month)}</h3>
        <ul class="mt-1 divide-y divide-line">${g.items.map(txRow).join("")}</ul></section>`;
    }).join("")}</div>`
      : emptyState("wallet", all.length ? t("Aucune opération de ce type") : t("Aucune opération pour le moment"), t("Vos gains validés et vos retraits apparaîtront ici."), "", { inCard: true })}`, "p-5");
  return `${pageHeader(t("Portefeuille"), t("Vos gains, versements et retraits."))}
    <div class="mt-6 grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-5">
      <div class="grid content-start gap-4 lg:gap-5">${clWalletCard()}${payoutCard}</div>
      ${history}
    </div>`;
}

// Comptes sociaux du Profil : un compte par plateforme, prouvé par le code « CB-XXXX » collé dans sa bio. En attente :
// le code (copié d'un clic), le mode d'emploi et « Vérifier » ; vérifié : sa date. Retirer un compte vérifié demande
// confirmation (modale cl-social-remove). Ajout : une plateforme encore libre et l'identifiant (ou le lien du profil).
function clSocialCard() {
  const list = clSocial(), free = PLATFORMS.filter((p) => !list.some((a) => a.platform === p));
  const low = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const row = (a) => {
    const ok = a.status === "verified";
    const meta = ok ? t("Vérifié le {date}", { date: date(a.verifiedAt) }) : a.checkedAt ? t("Dernier essai : {when}", { when: low(ago(a.checkedAt)) }) : t("En attente de vérification");
    const remove = t("Retirer le compte {platform}", { platform: a.platform });
    return `<li class="rounded-tile border border-line p-3">
      <div class="flex items-center gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-tile bg-muted text-fg">${icon(PLATFORM_ICON[a.platform] || "film", "size-[18px]")}</span>
        <div class="min-w-0 flex-1">
          <p class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span class="min-w-0 truncate text-sm font-medium text-fg" dir="ltr">@${esc(a.handle)}</span>${ok ? badge(t("Vérifié"), "success", { ic: "check" }) : badge(t("En attente"), "warning", { dot: true })}</p>
          <p class="mt-0.5 text-xs text-fg-subtle">${esc(a.platform)} · ${meta}</p>
        </div>
        <button type="button" data-action="cl-social-remove" data-id="${a.id}" class="${iconBtn("sm")}" aria-label="${esc(remove)}" title="${esc(remove)}">${icon("trash")}</button>
      </div>
      ${ok ? "" : `<div class="mt-3 flex flex-col gap-3 rounded-tile bg-subtle p-3 sm:flex-row sm:items-center">
        <button type="button" data-action="cl-social-copy" data-value="${esc(a.code)}" class="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-full border border-line-strong bg-surface px-3.5 font-mono text-sm font-semibold tracking-wider text-fg shadow-control transition-colors duration-150 hover:border-line-control sm:self-auto ${FOCUS}" aria-label="${esc(t("Copier le code {code}", { code: a.code }))}" title="${esc(t("Copier le code"))}"><span dir="ltr">${esc(a.code)}</span>${icon("copy", "size-4 text-fg-subtle")}</button>
        <p class="min-w-0 flex-1 text-xs leading-5 text-fg-muted">${t("Collez ce code dans la bio de votre compte, puis cliquez sur Vérifier. Vous pourrez le retirer ensuite.")}</p>
        <button type="button" data-action="cl-social-verify" data-id="${a.id}" class="${btn("primary", "sm", "self-start sm:self-auto")}">${icon("shield")}${t("Vérifier")}</button>
      </div>`}
    </li>`;
  };
  const add = free.length
    ? `<form data-form="social" novalidate class="mt-5 border-t border-line pt-5">
        <h3 class="text-sm font-semibold text-fg">${t("Ajouter un compte")}</h3>
        <div class="mt-3 grid items-start gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]">
          ${field(t("Plateforme"), `<span class="relative block"><select name="platform" class="${selectCls}">${free.map((p) => `<option value="${p}">${p}</option>`).join("")}</select>${CHEVRON}</span>`)}
          ${field(t("Identifiant"), `<span class="relative block" dir="ltr"><span class="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm text-fg-subtle" aria-hidden="true">@</span><input name="handle" maxlength="200" placeholder="${esc(t("votrecompte"))}" autocomplete="off" autocapitalize="off" spellcheck="false" class="${inputCls} ps-8"/></span>`, t("Votre nom d'utilisateur, ou le lien de votre profil."))}
          <button class="${btn("secondary", "md", "sm:mt-[26px]")}">${icon("plus")}${t("Ajouter")}</button>
        </div>
      </form>`
    : `<p class="mt-5 border-t border-line pt-5 text-small text-fg-subtle">${t("Un compte par plateforme : retirez-en un pour le remplacer.")}</p>`;
  return `<div data-row="comptes" class="rounded-card">${card(`${cardHeader(t("Comptes sociaux"), t("Seuls les clips publiés depuis un compte vérifié sont acceptés."))}
    ${list.length ? `<ul class="mt-4 grid gap-3">${list.map(row).join("")}</ul>`
      : emptyState("shield", t("Aucun compte ajouté"), t("Ajoutez le compte depuis lequel vous publiez vos clips, puis vérifiez-le avec son code."), "", { inCard: true })}
    ${add}`)}</div>`;
}

// Profil : photo de profil, informations publiques et comptes sociaux (vérifiés par un code dans leur bio). Le compte
// (email, mot de passe), la langue et le thème sont dans Paramètres.
function cProfil() {
  const u = me();
  // Sans photo : les initiales sur la teinte de l'avatar, à la taille du cadre de l'aperçu.
  const initialsFallback = avatar({ ...u, avatar: null }, "size-full text-2xl");
  const form = card(`<form data-form="profile">
      <h2 class="text-section text-fg">${t("Informations publiques")}</h2><p class="mt-0.5 text-small text-fg-muted">${t("Visibles par les marques qui consultent vos clips.")}</p>
      <div class="mt-5">${imageField({ name: "avatar", value: u.avatar || "", shape: "avatar", label: t("Photo de profil"), hint: t("JPEG, PNG ou WebP. Elle est recadrée en carré et s'affiche en rond."), fallback: initialsFallback })}</div>
      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        ${field(t("Nom complet"), `<input name="name" required maxlength="80" value="${esc(u.name)}" autocomplete="name" class="${inputCls}"/>`)}
        ${field(t("Pays"), countrySelect("country", u.country))}
        <div class="sm:col-span-2">${field(`${t("Bio")} ${clOptional()}`, `<textarea name="bio" rows="3" maxlength="300" placeholder="${t("Présentez votre style de clips aux marques…")}" class="${textareaCls}">${esc(u.bio || "")}</textarea>`, t("300 caractères maximum."))}</div>
      </div>
      <div class="mt-6 flex justify-end"><button class="${btn("primary")}">${t("Enregistrer")}</button></div>
    </form>`);
  const identity = card(`<div class="flex flex-col items-center text-center">${avatar(u, "xl")}
      <p class="mt-4 break-words font-display text-section text-fg">${esc(u.name)}</p>
      <p class="mt-0.5 flex flex-wrap items-center justify-center gap-1.5 text-small text-fg-muted">${u.handle ? `<span dir="ltr">${esc(u.handle)}</span> · ` : ""}${esc(t(u.country))}${u.country === "Algérie" ? flagDz() : ""}</p>
      ${u.level ? `<div class="mt-3">${badge(esc(t(u.level)), "brand", { ic: "medal" })}</div>` : ""}
      ${u.bio ? `<p class="mt-4 text-sm text-fg-muted">${esc(u.bio)}</p>` : ""}
      <p class="mt-4 text-xs text-fg-subtle">${t("Membre depuis le {date}", { date: date(u.joined) })}</p>
      <div class="mt-4 border-t border-line pt-4 self-stretch">${clLink("#/clipper/parametres", t("Compte, langue et thème"))}</div></div>`);
  return `${pageHeader(t("Profil"), t("Vos informations publiques, votre photo et vos comptes sociaux."))}
    <div class="mt-6 grid items-start gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div class="grid min-w-0 content-start gap-4 lg:gap-5">${form}${clSocialCard()}</div>
      ${identity}
    </div>`;
}

// Paramètres : préférences (langue, thème), moyen de retrait, règles de paiement, compte et connexion.
function cParametres() {
  const u = me(), s = db.settings, current = u.payoutMethod || PAYOUT_METHODS[0];
  const rules = [
    [t("Seuil de paiement"), t("Un clip doit atteindre le seuil minimum de sa campagne pour être examiné."), t("Selon la campagne")],
    [t("Fenêtre de gains"), t("Un clip validé continue de rapporter pendant cette durée, jusqu'au plafond par clip."), plural(s.earningDays, "jour", "jours")],
    [t("Rétention"), t("Contrôle anti-fraude : chaque gain devient retirable ensuite."), plural(s.holdDays, "jour", "jours")],
    [t("Retrait minimum"), "", money(s.minWithdraw)],
    [t("Retrait standard"), "", t("Gratuit")],
    [t("Retrait instantané"), t("Traité en priorité."), t("{pct}, min. {amount}", { pct: pct(s.instantFeePercent), amount: money(s.instantMinFee) })],
  ];
  const pref = (title, text, control) => `<div class="grid gap-3 py-4 first:pt-0 last:pb-0">
      <div class="min-w-0"><p class="text-sm font-medium text-fg">${title}</p><p class="mt-0.5 text-xs text-fg-subtle">${text}</p></div>${control}</div>`;
  const prefs = card(`${cardHeader(t("Préférences"), t("La langue et l'apparence de votre espace."))}
      <div class="mt-4 divide-y divide-line">
        ${pref(t("Langue"), t("Enregistrée sur votre compte : elle vous suit sur tous vos appareils."), langSwitch({ full: true, cls: "w-full sm:w-auto" }))}
        ${pref(t("Thème"), t("Clair, sombre, ou selon le réglage de votre appareil."), themeModeSwitch({ labels: true, cls: "w-full sm:w-auto" }))}
      </div>`);
  // Type de compte : valeur envoyée en français (PAYOUT_METHODS) ; « RIB » seul sur téléphone, « RIB bancaire » ensuite.
  const methodLabel = (m) => (m === "RIB bancaire"
    ? `<span class="sm:hidden">${t("RIB")}</span><span class="hidden sm:inline">${t("RIB bancaire")}</span>`
    : esc(t(m)));
  const payout = card(`${cardHeader(t("Moyen de retrait"), t("Vos gains sont versés sur ce compte, après validation de chaque demande par l'équipe ClipBoost."))}
        <form data-form="payout" class="mt-5 grid gap-5">
          <fieldset><legend class="mb-1.5 text-small font-medium text-fg">${t("Type de compte")}</legend>
            <div class="grid grid-cols-3 gap-2">${PAYOUT_METHODS.map((m) => `<label class="block min-w-0"><input type="radio" name="payoutMethod" value="${m}" ${current === m ? "checked" : ""} class="peer sr-only"/><span class="${SEG_CHOICE}"><span class="hidden sm:contents">${icon(CL_PAYOUT_ICON[m] || "bank")}</span><span class="truncate">${methodLabel(m)}</span></span></label>`).join("")}</div></fieldset>
          ${field(t("Numéro de compte"), `<input name="payoutAccount" required maxlength="60" value="${esc(u.payoutAccount || "")}" placeholder="${t("RIP, numéro CCP ou RIB")}" autocomplete="off" spellcheck="false" dir="ltr" class="${inputCls} font-mono"/>`, t("Vérifiez ce numéro : les virements sont envoyés tels quels."))}
          <div class="flex justify-end"><button class="${btn("primary")}">${t("Enregistrer")}</button></div>
        </form>`);
  const howPaid = card(`${cardHeader(t("Comment vous êtes payé"), t("Les règles appliquées à chaque clip et à chaque retrait."))}
        <dl class="mt-3 divide-y divide-line">${rules.map(([label, d, v]) => `<div class="flex items-start justify-between gap-4 py-3.5 last:pb-0">
          <dt class="min-w-0"><span class="block text-sm text-fg-muted">${label}</span>${d ? `<span class="mt-0.5 block text-xs text-fg-subtle">${d}</span>` : ""}</dt>
          <dd class="shrink-0 text-end text-sm font-medium tabular-nums text-fg">${v}</dd></div>`).join("")}</dl>`);
  return `${pageHeader(t("Paramètres"), t("Langue, thème, moyen de retrait et sécurité de votre compte."))}
    <div class="mt-6 grid items-start gap-4 lg:gap-5 xl:grid-cols-2">
      <div class="grid content-start gap-4 lg:gap-5">${prefs}${payout}</div>
      <div class="grid content-start gap-4 lg:gap-5">${accountCard(u)}${howPaid}</div>
    </div>`;
}

// agence : page hors navigation (ITEM_PAGES dans main.js), « Agences » y reste l'entrée courante.
const CLIPPER_VIEWS = { accueil: cAccueil, decouvrir: cDecouvrir, agences: cAgences, agence: cAgence, publications: cPublications, messages: cMessages, classement: cClassement, parrainage: cParrainage, portefeuille: cPortefeuille, profil: cProfil, parametres: cParametres };

// ---------- Récapitulatifs en direct (main.js appelle LIVE[nom] à chaque saisie) ----------
LIVE.withdraw = (d) => {
  const a = Math.max(0, Math.round(+String(d.amount || "").replace(/\D/g, "")) || 0), s = db.settings;
  const fee = d.speed === "instant" ? Math.max(s.instantMinFee, Math.round((a * s.instantFeePercent) / 100)) : 0;
  return {
    "": summary([[t("Montant demandé"), money(a)], [t("Frais"), fee ? money(fee) : t("Aucun")], [t("Vous recevrez"), money(Math.max(0, a - fee)), true]]),
    btn: a ? t("Confirmer le retrait de {amount}", { amount: da(a) }) : t("Confirmer le retrait"),
  };
};
// Soumission d'un clip : coche verte dans chaque champ de lien dès que le lien pointe vers sa plateforme (https).
// Un lien qui nomme un autre compte que le compte vérifié de la plateforme n'a pas de coche.
LIVE.clip = (d) => { const v = clVerifiedMap(); return Object.fromEntries(PLATFORMS.map((p) => [`ok-${p}`, clUrlGood(p, d[`url-${p}`], v.get(p)) ? icon("checkCircle", "size-4") : ""])); };
// Contestation d'un refus : compteur de caractères du message.
LIVE.clAppeal = (d) => ({ count: `${fmt(String(d.message || "").trim().length)}${NB}/${NB}${fmt(1000)}` });

// ---------- Modales ----------

// Fiche d'une campagne : photo (ou couverture en dégradé), organisateur (lien vers sa page, badge bleu), chiffres,
// règles et plateformes. Une campagne en pause ou terminée reste consultable (lien d'une notification) : statut, sans action.
function clCampaignSheet(c, u) {
  const joined = u.joinedCampaigns.has(c.id), remaining = Math.max(0, c.budget - c.spent), open = c.status === "Active", o = clOrgOf(c);
  const plats = PLATFORMS.filter((p) => c.platforms.includes(p));
  const strong = (html) => `<strong class="font-semibold">${html}</strong>`;
  const tile = (label, value, extra = "", cls = "") => `<div class="${TILE} ${cls}"><p class="text-xs text-fg-subtle">${label}</p><p class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${value}</p>${extra}</div>`;
  return modalShell({
    title: esc(c.title), description: t("{category} · créée le {date}", { category: clCatLabel(c), date: date(c.createdAt) }), size: "lg",
    body: `<div class="cover relative aspect-[16/9] overflow-hidden rounded-tile sm:aspect-[2/1]" ${coverAttr(c)}>
        ${coverArt(c, "text-6xl")}
        ${c.top ? `<span class="absolute bottom-3 start-3 inline-flex items-center gap-1 rounded-badge bg-on-brand/90 px-1.5 py-0.5 text-[11px] font-semibold text-night">${icon("star", "size-3", true)}${t("Top campagne")}</span>` : ""}</div>
      <a href="${clOrgHref(o.key)}" data-action="close-modal" class="group mt-4 flex items-center gap-3 rounded-tile border border-line p-3 transition-colors duration-150 hover:border-line-strong hover:bg-subtle ${FOCUS}">
        ${clOrgMark(o, "size-10 text-sm")}
        <span class="min-w-0 flex-1"><span class="block text-xs text-fg-subtle">${t("Organisée par")}</span>
          <span class="flex min-w-0 items-center gap-1 text-sm font-medium text-fg"><span class="truncate">${esc(o.name)}</span>${o.verified ? verifiedBadge("size-4", t("Agence vérifiée")) : ""}</span></span>
        <span class="inline-flex shrink-0 items-center gap-0.5 text-small font-medium text-brand-fg">${t("Voir la page")}${icon("chevronRight", "size-4 rtl:-scale-x-100")}</span></a>
      <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        ${tile(t("Tarif"), rate(c.rate))}
        ${tile(t("Clippers"), fmt(c.clippers))}
        ${open
          ? tile(t("Budget restant"), da(remaining), `<div class="mt-2">${progress(c.spent, c.budget, { label: false, aria: t("Budget utilisé") })}</div>`, "col-span-2 sm:col-span-1")
          : `<div class="${TILE} col-span-2 sm:col-span-1"><p class="text-xs text-fg-subtle">${t("Statut")}</p><p class="mt-1">${statusBadge(c.status)}</p></div>`}
      </div>
      <div class="mt-4">${open ? alertBox("info", t("Vous êtes payé à partir de {minViews} ({min}) et jusqu'à {maxViews} ({max}) par clip.", { minViews: strong(plural(clThresholdViews(c), "vue", "vues")), min: da(c.minPayout), maxViews: strong(plural(viewsFor(c, c.maxPayout), "vue", "vues")), max: da(c.maxPayout) }))
        : alertBox("warning", c.status === "En pause"
          ? t("Cette campagne est {status} : elle n'accepte ni nouveaux clippers ni nouveaux clips pour le moment.", { status: strong(t("en pause")) })
          : t("Cette campagne est {status} : elle n'accepte plus de clippers ni de clips.", { status: strong(t("terminée")) }))}</div>
      <h3 class="mt-6 text-section text-fg">${t("Règles de la campagne")}</h3>
      <ul class="mt-2 grid gap-2">${c.rules.map((r) => `<li class="flex gap-2.5 text-sm text-fg-muted">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span>${esc(r)}</span></li>`).join("")}</ul>
      <h3 class="mt-6 text-section text-fg">${plats.length > 1 ? t("Plateformes acceptées") : t("Plateforme acceptée")}</h3>
      <div class="mt-2 flex flex-wrap gap-2">${plats.map(platformTag).join("")}</div>
      ${open && plats.length > 1 ? `<p class="mt-2 text-xs text-fg-subtle">${t("Publiez votre clip sur une seule de ces plateformes ou sur toutes : vous indiquerez un lien par plateforme, chacun payé selon ses vues.")}</p>` : ""}`,
    // Question à l'organisateur : sur une campagne active ou en pause, ou conversation déjà ouverte.
    footer: `<button type="button" data-action="close-modal" class="${btn(open ? "ghost" : "secondary")}">${t("Fermer")}</button>${clAskable(c) || clThreadOf(c.id)
      ? `<a href="#/clipper/messages/${encodeURIComponent(c.id)}" data-action="close-modal" class="${btn("secondary")}">${icon("message", "size-4")}${clThreadOf(c.id) ? t("Voir la conversation") : t("Poser une question")}</a>` : ""}${!open ? "" : joined
      ? `<button type="button" data-action="submit-clip" data-id="${c.id}" class="${btn("primary")}">${icon("plus")}${t("Soumettre un clip")}</button>`
      : `<button type="button" data-action="join" data-id="${c.id}" class="${btn("primary")}">${t("Rejoindre la campagne")}</button>`}`,
  });
}

// Lien accepté pour la coche verte : bon domaine (https) et, s'il nomme un compte, le compte vérifié `handle`.
const clUrlGood = (p, v, handle) => clUrlOk(p, v) && !clUrlForeign(p, v, handle);
// Champ de lien d'une plateforme : pictogramme et nom, compte vérifié d'où vient le clip (« @compte »), lien en LTR,
// coche en direct (LIVE.clip), erreur sous le champ.
function clUrlField(p, value, error, handle) {
  const placeholder = p === "TikTok" && handle ? `https://www.tiktok.com/@${handle}/video/…` : PLATFORM_PLACEHOLDER[p] || "https://…";
  return `<div class="grid gap-1.5" data-field>
    <label class="contents"><span class="flex items-center gap-1.5 text-small font-medium text-fg">${icon(PLATFORM_ICON[p] || "film", "size-4 shrink-0 text-fg-muted")}${t("Lien {platform}", { platform: esc(p) })}${handle ? `<span class="ms-auto inline-flex min-w-0 items-center gap-1 text-xs font-normal text-fg-subtle">${icon("shield", "size-3.5 shrink-0 text-success-fg")}<span class="truncate" dir="ltr">@${esc(handle)}</span></span>` : ""}</span>
      <span class="relative block" dir="ltr">${icon("link", "pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle")}<input name="url-${p}" type="url" inputmode="url" required value="${esc(value || "")}" placeholder="${esc(placeholder)}" autocomplete="off" autocapitalize="off" spellcheck="false" class="${inputCls} ps-9 pe-10"${error ? ' aria-invalid="true"' : ""}/>
        <span data-live-out="ok-${p}" class="pointer-events-none absolute inset-y-0 end-3 flex items-center text-income" aria-hidden="true">${clUrlGood(p, value, handle) ? icon("checkCircle", "size-4") : ""}</span></span></label>
    ${error ? clErr(esc(error)) : ""}</div>`;
}

// Soumission d'un clip : campagne, titre, « Où avez-vous publié ce clip ? » (toutes les plateformes de la campagne ou
// une seule, puis laquelle), et un champ de lien par plateforme retenue. Les choix (data-rerender) sont relus dans
// state.modal.draft (main.js garde les saisies à chaque rendu) ; une erreur ne s'affiche que tant que la valeur fautive
// n'a pas changé (m.errorValues : la saisie au moment de l'envoi). Seules les plateformes où le clipper a un compte
// vérifié se choisissent (les autres sont désactivées, avec un lien vers Profil → Comptes sociaux) ; sans aucune,
// la modale l'explique et l'envoi est désactivé.
function clSubmitModal(m) {
  const joined = clJoinedOpen();
  if (!joined.length) {
    return modalShell({
      title: t("Soumettre un clip"),
      body: emptyState("target", t("Aucune campagne rejointe"), t("Rejoignez d'abord une campagne pour pouvoir soumettre un clip."), "", { inCard: true }),
      footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><a href="#/clipper/decouvrir" data-action="close-modal" class="${btn("primary")}">${icon("compass")}${t("Découvrir les campagnes")}</a>`,
    });
  }
  const d = m.draft || {}, e = m.errors || {}, ev = m.errorValues || {};
  const same = (k) => String(d[k] ?? "") === String(ev[k] ?? "");
  const c = joined.find((x) => x.id === d.campaign) || joined.find((x) => x.id === m.id) || joined[0];
  const plats = PLATFORMS.filter((p) => c.platforms.includes(p)), single = plats.length === 1;
  const verified = clVerifiedMap(), usable = plats.filter((p) => verified.has(p)), missing = plats.filter((p) => !verified.has(p));
  const blocked = !usable.length;
  const mode = single ? "one" : (d.mode === "all" && !missing.length) || d.mode === "one" ? d.mode : "";
  const platform = single ? plats[0] : usable.includes(d.platform) ? d.platform : "";
  const targets = mode === "all" ? plats : platform ? [platform] : [];
  const errOf = (k) => (e[k] && same(k) ? e[k] : "");
  const modeErr = e.mode && !mode ? e.mode : "", platformErr = e.platform && mode === "one" && !platform ? e.platform : "";
  const titleErr = errOf("title"), campaignErr = errOf("campaign");
  const LEGEND = "mb-1.5 text-small font-medium text-fg";
  const choice = (value, title, text, off = false) => `<label class="${CHOICE} has-[[aria-invalid=true]]:border-danger-solid has-disabled:cursor-not-allowed has-disabled:opacity-50"><input type="radio" name="mode" value="${value}" data-rerender class="${RADIO}" ${mode === value ? "checked" : ""}${off ? " disabled" : ""}${modeErr ? ' aria-invalid="true"' : ""}/>
      <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${title}</span>${text}</span></label>`;
  // Plateformes de la campagne sans compte vérifié : lien vers la carte des comptes du Profil.
  const missingHint = missing.length && !blocked
    ? `<p class="text-xs text-fg-subtle">${t("Pas encore de compte vérifié sur {platforms}.", { platforms: esc(clList(missing)) })} ${clSocialLink(t("Vérifier mes comptes"), true)}</p>`
    : "";

  // Campagne à une seule plateforme : une phrase (la pastille de la plateforme s'insère à sa place dans chaque langue).
  const where = single ? `<div class="flex items-start gap-2 rounded-tile bg-subtle p-3 text-small leading-6 text-fg-muted in-[[aria-modal=true]]:bg-muted">${icon("info", "mt-1 size-4 shrink-0 text-fg-subtle")}<span class="min-w-0 [&>span]:align-middle">${t("Cette campagne se publie uniquement sur {platform}", { platform: platformTag(plats[0]) })}</span></div>`
    : `<fieldset class="grid gap-2" data-field><legend class="${LEGEND}">${t("Où avez-vous publié ce clip ?")}</legend>
        <div class="grid gap-2 sm:grid-cols-2">
          ${choice("all", t("Sur toutes les plateformes de la campagne"), `<span class="mt-2 flex flex-wrap gap-1.5">${plats.map(platformTag).join("")}</span>`, missing.length > 0)}
          ${choice("one", t("Sur une seule plateforme"), `<span class="mt-0.5 block text-xs text-fg-subtle">${t("Vous choisissez laquelle juste après.")}</span>`)}
        </div>
        ${modeErr ? clErr(esc(modeErr)) : mode === "one" ? "" : missingHint}</fieldset>`;

  const which = !single && mode === "one"
    ? `<fieldset class="grid gap-2" data-field><legend class="${LEGEND}">${t("Sur quelle plateforme ?")}</legend>
        <div class="grid grid-cols-2 gap-2 ${CL_COLS[plats.length] || ""}">${plats.map((p) => `<label class="block min-w-0"><input type="radio" name="platform" value="${p}" data-rerender class="peer sr-only" ${p === platform ? "checked" : ""}${verified.has(p) ? "" : " disabled"}${platformErr ? ' aria-invalid="true"' : ""}/><span class="${SEG_CHOICE} h-11 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-aria-[invalid=true]:border-danger-solid">${icon(PLATFORM_ICON[p] || "film")}<span class="truncate">${p}</span></span></label>`).join("")}</div>
        ${platformErr ? clErr(esc(platformErr)) : missingHint}</fieldset>`
    : "";

  const links = targets.length
    ? `<div class="grid gap-4">
        ${targets.length > 1 ? `<p class="text-xs text-fg-subtle">${t("Un lien par plateforme : chaque publication est vérifiée, puis payée selon ses propres vues.")}</p>` : ""}
        ${targets.map((p) => clUrlField(p, d[`url-${p}`], errOf(`url-${p}`), verified.get(p))).join("")}</div>`
    : `<div class="flex items-center gap-2.5 rounded-tile border border-dashed border-line-strong px-3.5 py-3 text-small text-fg-subtle">${icon("link", "size-4 shrink-0")}<span>${mode === "one" ? t("Choisissez la plateforme pour coller le lien de votre clip.") : t("Les champs de lien s'affichent selon votre choix.")}</span></div>`;

  return modalShell({
    title: t("Soumettre un clip"), description: t("Le clip sera vérifié par l'équipe ClipBoost avant validation."), form: "submit", live: "clip", size: "lg",
    body: `<div class="grid gap-5">
      ${field(t("Campagne"), `<span class="relative block"><select name="campaign" data-rerender class="${selectCls}"${campaignErr ? ' aria-invalid="true"' : ""}>${joined.map((x) => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${esc(x.title)} · ${rateShort(x.rate)}</option>`).join("")}</select>${CHEVRON}</span>`, "", campaignErr ? esc(campaignErr) : "")}
      <div class="grid gap-1.5" data-field><label class="contents"><span class="text-small font-medium text-fg">${t("Titre du clip")}</span><input name="title" required maxlength="100" value="${esc(d.title || "")}" placeholder="${t("Ex. Le but de l'année")}" autocomplete="off" autofocus class="${inputCls}"${titleErr ? ' aria-invalid="true"' : ""}/></label>${titleErr ? clErr(esc(titleErr)) : ""}</div>
      ${blocked ? alertBox("warning", `${single
        ? t("Vérifiez d'abord votre compte {platform} : seuls les clips publiés depuis un compte vérifié sont acceptés.", { platform: esc(plats[0]) })
        : t("Vérifiez d'abord l'un de vos comptes {platforms} : seuls les clips publiés depuis un compte vérifié sont acceptés.", { platforms: esc(clList(plats)) })} ${clSocialLink(t("Vérifier mes comptes"), true)}`)
        : `${where}
      ${which}
      ${links}`}
    </div>`,
    footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><button class="${btn("primary")}"${blocked ? " disabled" : ""}>${icon("send", "rtl:-scale-x-100")}${t("Envoyer pour validation")}</button>`,
  });
}

// Recours sur un clip refusé : formulaire de contestation (une seule par clip : message de 20 à 1 000 caractères et
// capture d'écran en preuve, envoyée entière), puis, une fois envoyé, son suivi (statut, motif de l'équipe, message
// et preuve envoyés).
function clAppealModal(m) {
  const p = db.publications.find((x) => x.id === m.id && x.userId === state.session);
  if (!p) return "";
  const c = campaignById(p.campaign), a = clAppealOf(p);
  const description = [t("« {title} »", { title: `<bdi>${esc(p.title)}</bdi>` }), esc(p.platform), c ? esc(c.title) : ""].filter(Boolean).join(" · ");
  const refusal = p.reason
    ? `<div class="${TILE}"><p class="text-xs text-fg-subtle">${t("Motif du refus")}</p><p class="mt-0.5 break-words text-sm text-fg" dir="auto">${esc(tServer(p.reason))}</p></div>`
    : "";
  if (a) {
    const decided = a.status !== "En attente", day = date(a.decidedAt || a.createdAt);
    const decision = !decided
      ? alertBox("info", t("L'équipe ClipBoost examine votre recours. Vous serez prévenu de sa décision par une notification."))
      : alertBox(a.status === "Acceptée" ? "success" : "danger", `${a.status === "Acceptée" ? t("Recours accepté le {date} : votre clip est validé.", { date: day }) : t("Recours refusé le {date} : le clip reste refusé.", { date: day })}${a.decisionNote ? `<span class="mt-1 block">${t("Motif de l'équipe : {note}", { note: esc(a.decisionNote) })}</span>` : ""}`);
    return modalShell({
      title: t("Votre recours"), description, size: "lg",
      body: `<div class="grid gap-4">
        <div class="flex flex-wrap items-center gap-2">${appealBadge(a.status)}<span class="text-small text-fg-subtle">${t("Envoyé le {date}", { date: date(a.createdAt) })}</span></div>
        ${decision}
        ${refusal}
        <div><p class="text-small font-medium text-fg">${t("Votre message")}</p><p class="mt-1 whitespace-pre-line break-words text-sm text-fg-muted" dir="auto">${esc(a.message)}</p></div>
        ${a.proof ? `<div><p class="text-small font-medium text-fg">${t("Votre preuve")}</p><div class="mt-1.5 grid place-items-center overflow-hidden rounded-tile bg-muted"><img src="${esc(a.proof)}" alt="${t("Capture d'écran jointe au recours")}" class="max-h-96 w-auto max-w-full object-contain"/></div></div>` : ""}
      </div>`,
      footer: `<button type="button" data-action="close-modal" class="${btn("secondary")}">${t("Fermer")}</button>`,
    });
  }
  if (p.status !== "Refusée") return "";
  return modalShell({
    title: t("Contester le refus"), description, form: "cl-appeal", live: "clAppeal", size: "lg",
    body: `<div class="grid gap-5">
      ${refusal}
      ${alertBox("info", `<strong class="font-semibold">${t("Une seule contestation possible par clip.")}</strong> ${t("Expliquez pourquoi ce refus vous semble injustifié et joignez une capture d'écran qui le prouve. L'équipe ClipBoost revoit le clip et vous répond par une notification.")}`)}
      <div class="grid gap-1.5" data-field><label class="contents"><span class="text-small font-medium text-fg">${t("Votre message")}</span>
        <textarea name="message" rows="5" maxlength="1000" required autofocus dir="auto" placeholder="${esc(t("Ex. La musique vient de la bibliothèque audio libre de droits de la plateforme : la licence est sur la capture."))}" aria-describedby="cl-appeal-hint" class="${textareaCls}"></textarea></label>
        <span id="cl-appeal-hint" class="flex justify-between gap-3 text-xs text-fg-subtle"><span>${t("Entre 20 et 1 000 caractères.")}</span><span data-live-out="count" dir="ltr" class="shrink-0 tabular-nums">${LIVE.clAppeal({}).count}</span></span></div>
      ${imageField({
        name: "proof", shape: "proof", label: t("Preuve (capture d'écran)"),
        hint: t("JPEG, PNG ou WebP, envoyée entière, sans recadrage : statistiques de la vidéo, licence de la musique, message de la plateforme…"),
        labels: { pick: t("Choisir une capture"), change: t("Changer la capture"), clear: t("Retirer la capture") },
        fallback: `<span class="flex flex-col items-center gap-1.5 text-small text-fg-subtle">${icon("image", "size-6")}${t("Aucune capture choisie")}</span>`,
      })}
    </div>`,
    footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><button class="${btn("primary")}">${icon("send", "rtl:-scale-x-100")}${t("Envoyer la contestation")}</button>`,
  });
}

function clipperModal() {
  const m = state.modal;
  if (!m) return "";
  const u = me();
  if (m.type === "campaign") {
    const c = campaignById(m.id);
    return c ? clCampaignSheet(c, u) : "";
  }
  if (m.type === "submit") return clSubmitModal(m);
  if (m.type === "cl-appeal") return clAppealModal(m);
  if (m.type === "cl-social-remove") {
    const a = clSocial().find((x) => x.id === m.id);
    if (!a) return "";
    const handle = `<span class="font-medium text-fg" dir="ltr">@${esc(a.handle)}</span>`;
    return modalShell({
      title: t("Retirer votre compte {platform} ?", { platform: esc(a.platform) }),
      body: `<p class="text-sm text-fg-muted">${t("Le compte {handle} ne sera plus vérifié : vos clips déjà envoyés ne changent pas, mais vous ne pourrez plus soumettre de clip {platform} avant d'avoir vérifié un compte, avec un nouveau code.", { handle, platform: esc(a.platform) })}</p>`,
      footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><button type="button" data-action="cl-social-remove-confirm" data-id="${a.id}" class="${btn("danger")}">${icon("trash")}${t("Retirer le compte")}</button>`,
    });
  }
  if (m.type === "withdraw") {
    const set = db.settings, min = set.minWithdraw, bal = Math.floor(balance());
    const blocked = !u.payoutMethod
      ? alertBox("info", t("Ajoutez d'abord le compte sur lequel vous voulez être payé (BaridiMob, CCP ou RIB). {link}", { link: `<a href="#/clipper/parametres" class="${btn("link")}">${t("Ajouter un moyen de retrait")}</a>` }))
      : bal < min
        ? alertBox("info", `${t("Votre solde disponible ({balance}) est inférieur au minimum de retrait, fixé à {min}.", { balance: da(bal), min: `<strong class="font-semibold">${da(min)}</strong>` })}${pendingAmount() ? ` ${t("{amount} deviendront retirables à la fin de leur période de rétention.", { amount: da(pendingAmount()) })}` : ""}`)
        : "";
    if (blocked) {
      return modalShell({
        title: t("Demander un retrait"), description: t("Solde disponible : {amount}", { amount: da(bal) }),
        body: blocked,
        footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Fermer")}</button><button type="button" class="${btn("primary")}" disabled>${t("Confirmer le retrait")}</button>`,
      });
    }
    const amount = m.amount !== undefined ? String(m.amount) : fmt(bal), speed = m.speed === "instant" ? "instant" : "standard";
    const init = LIVE.withdraw({ amount, speed });
    const choice = (value, title, text, right) => `<label class="${CHOICE}"><input type="radio" name="speed" value="${value}" class="${RADIO}" ${speed === value ? "checked" : ""}/><span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${title}</span><span class="block text-xs text-fg-subtle">${text}</span></span><span class="shrink-0 text-end text-small font-medium tabular-nums text-fg">${right}</span></label>`;
    return modalShell({
      title: t("Demander un retrait"), description: t("Solde disponible : {amount}", { amount: da(bal) }), form: "withdraw", live: "withdraw",
      body: `${field(t("Montant"), `<div class="flex gap-2"><div class="min-w-0 flex-1">${unitInput(`name="amount" value="${esc(amount)}" autocomplete="off" autofocus aria-describedby="wd-hint"${m.error ? ' aria-invalid="true"' : ""}`, t("DA"), { lg: true })}</div><button type="button" data-action="wd-max" class="${btn("secondary", "lg")}">${t("Tout retirer")}</button></div>`, `<span id="wd-hint">${t("Minimum {min} · maximum {max}", { min: da(min), max: da(bal) })}</span>`, m.error ? esc(m.error) : "")}
        <fieldset class="mt-5 grid gap-2"><legend class="mb-1.5 text-small font-medium text-fg">${t("Délai")}</legend>
          ${choice("standard", t("Standard"), t("Traité sous 48 h ouvrées"), t("Gratuit"))}
          ${choice("instant", t("Instantané"), t("Traité en priorité"), `${pct(set.instantFeePercent)}<span class="block text-xs font-normal text-fg-subtle">${t("min. {amount}", { amount: da(set.instantMinFee) })}</span>`)}
        </fieldset>
        <div data-live-out>${init[""]}</div>
        <p class="mt-4 flex items-center gap-2 text-small text-fg-muted">${icon(CL_PAYOUT_ICON[u.payoutMethod] || "bank", "size-4 shrink-0 text-fg-subtle")}<span class="min-w-0 truncate">${t("Vers {method} {account}", { method: esc(t(u.payoutMethod)), account: `<span class="font-mono" dir="ltr">${maskAccount(u.payoutAccount)}</span>` })}</span></p>`,
      footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><button class="${btn("primary")}" data-live-out="btn">${init.btn}</button>`,
    });
  }
  return "";
}

// el : l'élément cliqué (data-action). Les toasts reçoivent du texte brut : toast() l'échappe.
function handleClipperAction(action, el) {
  const u = me(), { id, value } = el.dataset;
  switch (action) {
    case "toggle-fav": {
      const fav = !u.favorites.has(id);
      return act("POST", `/api/campaigns/${id}/membership`, { favorite: fav }, fav ? t("Ajoutée aux favoris") : t("Retirée des favoris"));
    }
    case "join": {
      const c = campaignById(id);
      return act("POST", `/api/campaigns/${id}/membership`, { joined: true }, c ? t("Vous avez rejoint « {title} »", { title: c.title }) : t("Campagne rejointe"));
    }
    case "open-campaign": state.modal = { type: "campaign", id }; return render();
    case "submit-clip": state.modal = { type: "submit", id }; state.notifOpen = false; state.menuOpen = false; state.drawer = false; return render();
    case "withdraw": state.modal = { type: "withdraw" }; return render();
    case "cl-appeal": state.modal = { type: "cl-appeal", id }; return render();
    case "wd-max": {
      const i = root.querySelector('[name="amount"]');
      if (i) { i.value = fmt(Math.floor(balance())); i.dispatchEvent(new Event("input", { bubbles: true })); i.focus(); }
      return;
    }
    // Toutes / Rejointes / Favoris ; une puce (data-toggle) déjà active revient à « Toutes ».
    case "camp-scope": state.camp.scope = "toggle" in el.dataset && state.camp.scope === value ? "Toutes" : CL_SCOPES.includes(value) ? value : "Toutes"; return render();
    case "reset-agencies": state.camp.aq = ""; return render();
    case "camp-cat": state.camp.category = value; return render();
    case "layout": state.camp.layout = value; return render();
    case "reset-filters": state.camp = { ...state.camp, q: "", category: "Toutes" }; return render();
    case "pub-status": state.pub.status = value; return render();
    case "tx-type": state.tx.type = { Tous: "tous", Gains: "gain", Retraits: "retrait" }[value]; return render();
    case "period": state.period = parseInt(value, 10); return render();
    case "cl-chart": state.clChart = value; return render();
    case "cl-clips": state.clClips = value; return render();
    // Comptes sociaux (Profil) : code copié, vérification (« simulated » : plateforme sans identifiants sur le serveur,
    // bio non lue), retrait (direct pour un compte en attente, après confirmation pour un compte vérifié).
    case "cl-social-copy": return copy(value, t("Code {code} copié", { code: value }));
    case "cl-ref-copy": return copy(value, t("Lien de parrainage copié"));
    case "cl-social-verify": {
      const a = clSocial().find((x) => x.id === id);
      if (!a) return;
      return act("POST", `/api/social/${encodeURIComponent(id)}/verify`, null, (res) => (res && res.simulated
        ? t("Compte {platform} vérifié (mode simulé : la bio n'a pas été lue)", { platform: a.platform })
        : t("Compte {platform} vérifié", { platform: a.platform })));
    }
    case "cl-social-remove": {
      const a = clSocial().find((x) => x.id === id);
      if (!a) return;
      if (a.status === "verified") { state.modal = { type: "cl-social-remove", id }; return render(); }
      return act("DELETE", `/api/social/${encodeURIComponent(id)}`, null, t("Compte {platform} retiré", { platform: a.platform }));
    }
    case "cl-social-remove-confirm": {
      const a = clSocial().find((x) => x.id === id);
      if (!a) { state.modal = null; return render(); }
      return act("DELETE", `/api/social/${encodeURIComponent(id)}`, null, t("Compte {platform} retiré", { platform: a.platform }), () => { state.modal = null; });
    }
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

// Messages d'erreur et toasts : texte brut (clErr, field et toast les échappent), paramètres non échappés.
function handleClipperSubmit(form, data) {
  if (form === "submit") {
    // Mêmes contrôles que le serveur (lib/server/services/clips.ts), champ par champ, avant tout envoi.
    const c = clJoinedOpen().find((x) => x.id === data.campaign), errors = {};
    const title = String(data.title || "").trim();
    if (!c) errors.campaign = t("Cette campagne n'accepte plus de clips : choisissez-en une autre.");
    if (!title) errors.title = t("Donnez un titre à votre clip.");
    const plats = c ? PLATFORMS.filter((p) => c.platforms.includes(p)) : [], single = plats.length === 1;
    const mode = single ? "one" : data.mode, platform = single ? plats[0] : data.platform, verified = clVerifiedMap();
    if (c && !plats.some((p) => verified.has(p))) errors.campaign = t("Vérifiez d'abord l'un des comptes de cette campagne (Profil → Comptes sociaux).");
    else if (c && mode !== "all" && mode !== "one") errors.mode = t("Indiquez où vous avez publié ce clip.");
    else if (c && mode === "one" && !plats.includes(platform)) errors.platform = t("Choisissez la plateforme sur laquelle vous avez publié ce clip.");
    const targets = mode === "all" ? plats : plats.includes(platform) ? [platform] : [];
    const submitted = new Set(myPubs().map((p) => clUrlKey(p.url))), seen = new Set();
    const links = targets.map((p) => {
      const k = `url-${p}`, url = String(data[k] || "").trim(), key = clUrlKey(url);
      if (!url) errors[k] = t("Collez le lien {platform} de votre clip.", { platform: p });
      else if (!clUrlOk(p, url)) errors[k] = t("Le lien doit être un lien {platform} (https://…).", { platform: p });
      else if (!verified.has(p)) errors[k] = t("Vérifiez d'abord votre compte {platform} (Profil → Comptes sociaux).", { platform: p });
      else if (clUrlForeign(p, url, verified.get(p))) errors[k] = t("Ce lien ne vient pas de votre compte {platform} vérifié (@{handle}).", { platform: p, handle: verified.get(p) });
      else if (submitted.has(key)) errors[k] = t("Vous avez déjà soumis ce lien.");
      else if (seen.has(key)) errors[k] = t("Le même lien est indiqué deux fois.");
      seen.add(key);
      return { platform: p, url };
    });
    if (Object.keys(errors).length) return clModalErrors({ errors, errorValues: data, draft: { ...(state.modal && state.modal.draft), ...data } });
    const sent = links.length > 1 ? t("Clip envoyé pour validation sur {platforms}", { platforms: plural(links.length, "plateforme", "plateformes") }) : t("Clip envoyé pour validation");
    return act("POST", "/api/clips", { campaignId: c.id, title, links }, sent, (res) => {
      state.modal = null; state.pub.status = "Toutes";
      // Les publications s'ouvrent sur le nouveau clip (mis en évidence, voir applyRouteItem dans main.js).
      navigate(res && res.id ? `#/clipper/publications/${encodeURIComponent(res.id)}` : "#/clipper/publications");
    });
  }
  if (form === "cl-appeal") {
    // Mêmes contrôles que le serveur (appealSchema) : message de 20 caractères au moins, capture obligatoire.
    const formEl = root.querySelector('form[data-form="cl-appeal"]'), id = state.modal && state.modal.id;
    const message = String(data.message || "").trim(), proof = String(data.proof || "");
    if (message.length < 20) return markInvalid(formEl, "message", t("Expliquez votre contestation en 20 caractères au moins."));
    if (!proof) {
      markInvalid(formEl, "proof", t("Ajoutez une capture d'écran comme preuve."));
      const pick = formEl && formEl.querySelector('input[data-image-input="proof"]');
      if (pick) pick.focus();
      return;
    }
    return act("POST", `/api/clips/${encodeURIComponent(id)}/appeal`, { message, proof }, t("Contestation envoyée : l'équipe ClipBoost va revoir votre clip"), () => { state.modal = null; });
  }
  if (form === "cl-msg") {
    const c = campaignById(state.route.item || ""), body = String(data.body || "").trim();
    if (!c || !body) return;
    return act("POST", `/api/campaigns/${encodeURIComponent(c.id)}/messages`, { body });
  }
  if (form === "withdraw") {
    const amount = Math.floor(Number(String(data.amount || "").replace(/\D/g, ""))) || 0, min = db.settings.minWithdraw, bal = Math.floor(balance());
    const error = amount < min ? t("Le retrait minimum est de {amount}.", { amount: da(min) }) : amount > bal ? t("Montant supérieur à votre solde disponible ({amount}).", { amount: da(bal) }) : "";
    if (error) return clModalErrors({ amount: data.amount, speed: data.speed, error });
    return act("POST", "/api/withdrawals", { amount, instant: data.speed === "instant" }, t("Demande de retrait de {amount} envoyée", { amount: da(amount) }), () => { state.modal = null; });
  }
  if (form === "profile") {
    // avatar : data URL (nouvelle photo), adresse actuelle (inchangée) ou "" (retirée), voir imageField (ui.js).
    // Les « @compte » du profil suivent les comptes sociaux vérifiés (formulaire « social ») : ils ne sont plus envoyés ici.
    return act("PATCH", "/api/me", { name: data.name, country: data.country, bio: data.bio, avatar: data.avatar }, t("Profil mis à jour"));
  }
  if (form === "social") {
    const formEl = root.querySelector('form[data-form="social"]'), handle = String(data.handle || "").trim();
    if (!handle) return markInvalid(formEl, "handle", t("Indiquez l'identifiant du compte."));
    return act("POST", "/api/social", { platform: data.platform, handle }, t("Compte {platform} ajouté : collez maintenant son code dans sa bio", { platform: data.platform }));
  }
  if (form === "payout") {
    return act("PATCH", "/api/me", { payoutMethod: data.payoutMethod, payoutAccount: data.payoutAccount }, t("Moyen de retrait enregistré"));
  }
}
