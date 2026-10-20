// Utilitaires et composants partagés par toutes les zones du site (formats, icônes, recettes du design system :
// docs/design-system.md §4). Les noms déclarés ici sont réservés : aucun autre fichier de web/src ne les redéclare.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Dates : en français « 05 janv. 2026 » (MONTHS, rendu historique) ; en anglais et en arabe, Intl dans la langue choisie
// (LOCALES[LANG].intl, chiffres latins) : « 5 Jan 2026 », « 5 جانفي 2026 ». Formateurs mis en cache par langue et options.
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const uiIntlCache = {};
function uiIntl(kind, opts) {
  const key = `${kind}|${LANG}|${JSON.stringify(opts)}`;
  if (!(key in uiIntlCache)) {
    try { uiIntlCache[key] = new Intl[kind](LOCALES[LANG].intl, { numberingSystem: "latn", ...opts }); } catch (e) { uiIntlCache[key] = null; }
  }
  return uiIntlCache[key];
}
// Jour ISO (« 2026-01-05… ») lu tel quel (UTC : aucun décalage de fuseau), espaces insécables.
const date = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  const f = LANG === "fr" ? null : uiIntl("DateTimeFormat", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return f ? f.format(Date.UTC(+y, +m - 1, +d)).replace(/\s/g, NB) : `${d}${NB}${MONTHS[+m - 1]}${NB}${y}`;
};
// Temps écoulé depuis une date ISO : « À l'instant », « Il y a 5 min », « Hier »… ; au-delà d'une semaine, la date.
// Anglais et arabe : Intl.RelativeTimeFormat (« 5 min ago », « قبل 5 دقائق », « أمس »), accord du pluriel compris.
function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return t("À l'instant");
  if (s >= 604800) return date(iso);
  const [n, unit] = s < 3600 ? [Math.floor(s / 60), "minute"] : s < 86400 ? [Math.floor(s / 3600), "hour"] : s < 172800 ? [1, "day"] : [Math.floor(s / 86400), "day"];
  const rtf = LANG === "fr" ? null : uiIntl("RelativeTimeFormat", { numeric: "auto", style: LANG === "en" ? "short" : "long" });
  if (rtf) { const out = rtf.format(-n, unit); return out.charAt(0).toUpperCase() + out.slice(1); }
  return unit === "minute" ? t("Il y a {n} min", { n }) : unit === "hour" ? t("Il y a {n} h", { n }) : s < 172800 ? t("Hier") : t("Il y a {n} j", { n });
}
// Initiales de l'avatar, toujours 2 lettres : premières lettres des deux premiers mots (« Yacine Benali » → YB), ou deux
// premières lettres d'un nom en un seul mot (« Yacine » → YA). Ponctuation ignorée (« L'Atelier » → LA, « @nova » → NO).
const initials = (name) => {
  const words = String(name || "").trim().split(/\s+/).map((w) => [...w.replace(/[^\p{L}\p{N}]/gu, "")]).filter((w) => w.length);
  if (!words.length) return "?";
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2).join("")).toUpperCase();
};
const campaignById = (id) => db.campaigns.find((c) => c.id === id);
const userById = (id) => db.users.find((u) => u.id === id);
const rawEarnings = (p) => (p.views / 1000) * campaignById(p.campaign).rate;
// Sous le seuil minimum, un clip ne rapporte rien ; au-delà du plafond, ses gains s'arrêtent.
const belowMin = (p) => rawEarnings(p) < (campaignById(p.campaign).minPayout || 0);
const isCapped = (p) => rawEarnings(p) >= (campaignById(p.campaign).maxPayout || Infinity);
const payoutOf = (p) => (belowMin(p) ? 0 : Math.min(rawEarnings(p), campaignById(p.campaign).maxPayout || Infinity));
// Montant réellement crédité par le serveur pour un clip validé.
const earningsOf = (p) => (p.status === "Validée" ? p.paid : 0);
const viewsFor = (c, amount) => Math.ceil((amount / c.rate) * 1000);
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
function copy(text, msg) {
  try { navigator.clipboard && navigator.clipboard.writeText(text).catch(() => {}); } catch (e) {}
  toast(msg);
}

// Formulaire « password » de accountCard : changement (mot de passe actuel exigé) ou, pour un compte créé avec Google,
// Apple ou Discord qui n'en a pas encore (me.hasPassword === false), premier mot de passe (current vide, ignoré par l'API).
async function handlePasswordSubmit(data) {
  const u = userById(state.session), had = !u || u.hasPassword !== false;
  try {
    await api("POST", "/api/auth/password", { current: had ? data.current || "" : "", next: data.next || "" });
    state.pwdError = "";
    if (!had) await refresh().catch(() => {});
    render();
    toast(had ? t("Mot de passe modifié") : t("Mot de passe défini : vous pouvez aussi vous connecter avec votre email"));
  } catch (e) {
    state.pwdError = e.message;
    render();
  }
}

const homeOf = (u) => ({ admin: "#/admin/apercu", agence: "#/agence/apercu", clipper: "#/clipper/accueil" }[u.role]);

// ===================== web/src/ui.js : référence du design system =====================
// Conserver tel quel (en tête de fichier) : esc, MONTHS, date, ago, initials, campaignById, userById, rawEarnings,
// belowMin, isCapped, payoutOf, earningsOf, viewsFor, isEmail, copy, handlePasswordSubmit, homeOf.

// ---------- Formats (argent, nombres) ----------
const NB = " ", MINUS = "−";
const fmt = (n) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
// Signe d'un montant ou d'un écart : en arabe (de droite à gauche), signe et chiffres sont isolés de gauche à droite
// (U+2066…U+2069), sinon le « − » s'afficherait à droite du nombre. L'unité (t("DA") : « DA », « دج ») reste hors de
// l'isolat et suit le sens de la phrase.
const uiSigned = (sign, digits) => (sign && isRtl() ? `\u2066${sign}${digits}\u2069` : `${sign}${digits}`);
// Séparateur décimal de la langue : « 48,2 » (français, arabe), « 48.2 » (anglais). Les milliers gardent l'espace insécable.
const uiDecimal = () => (LANG === "en" ? "." : ",");
const da = (n) => `${uiSigned(n < 0 ? MINUS : "", fmt(n))}${NB}${t("DA")}`;                     // texte brut : phrases, toasts, aria
const daSigned = (n) => `${uiSigned(n > 0 ? "+" : n < 0 ? MINUS : "", fmt(n))}${NB}${t("DA")}`; // mouvements : historiques, deltas
// Montant HTML en ligne ou en cellule : chiffres tabulaires, « DA » atténué. signed : vert + « + » si positif.
// pending : montant en attente (rétention, recharge non confirmée) : garde le « + » mais reste en text-fg (§3.3).
const money = (n, { signed = false, pending = false, cls = "" } = {}) =>
  `<span class="whitespace-nowrap tabular-nums ${signed && n > 0 && !pending ? "text-income" : "text-fg"} ${cls}">${uiSigned(signed ? (n > 0 ? "+" : n < 0 ? MINUS : "") : n < 0 ? MINUS : "", fmt(n))}<span class="font-normal text-fg-subtle">${NB}${t("DA")}</span></span>`;
// Grand montant (KPI, solde) : chiffres proportionnels, unité plus petite. size : "kpi" | "money".
const BIG = { kpi: ["text-xl font-semibold tracking-tight sm:text-kpi", "text-sm sm:text-base"], money: ["text-[1.875rem] leading-9 font-semibold tracking-[-0.03em] sm:text-money", "text-base sm:text-lg"] };
const bigMoney = (n, size = "kpi") =>
  `<span class="whitespace-nowrap text-fg ${BIG[size][0]}">${uiSigned(n < 0 ? MINUS : "", fmt(n))}<span class="font-medium tracking-normal text-fg-subtle ${BIG[size][1]}">${NB}${t("DA")}</span></span>`;
// Compact (axes, puces, cartes étroites) : 9 800 → « 9 800 » ; 48 200 → « 48,2 k » ; 1 250 000 → « 1,3 M »
// (anglais « 48.2K », arabe « 48,2 ألف »).
const compact = (n) => {
  const a = Math.abs(n), sign = n < 0 ? MINUS : "", f = (v, d) => v.toFixed(d).replace(".", uiDecimal()).replace(/[.,]0$/, "");
  if (a >= 1e6) return uiSigned(sign, t("{n}\u00a0M", { n: f(a / 1e6, a >= 1e7 ? 0 : 1) }));
  if (a >= 1e4) return uiSigned(sign, t("{n}\u00a0k", { n: f(a / 1e3, a >= 1e5 ? 0 : 1) }));
  return uiSigned(sign, fmt(a));
};
const pct = (x) => (x > 0 && x < 1 ? t("<\u00a01\u00a0%") : t("{n}\u00a0%", { n: String(x < 10 && x % 1 ? x.toFixed(1) : Math.round(x)).replace(".", uiDecimal()) }));
// « 3 vues » : le mot suit la langue et ses règles de pluriel (tPlural ; arabe : duel, 3 à 10, 11 à 99…). L'entrée du
// dictionnaire est cherchée sous la forme plurielle française (many), puis singulière (one).
const plural = (n, one, many) => `${fmt(n)}${NB}${tPlural(n, one, many)}`;
const rate = (r) => t("{amount} / 1\u00a0000\u00a0vues", { amount: da(r) });   // forme pleine
const rateShort = (r) => t("{amount} / 1k\u00a0vues", { amount: da(r) });       // puces et cartes uniquement
// Code, référence, identifiant : toujours de gauche à droite (îlot LTR, même en arabe).
const code = (s) => `<span class="font-mono text-[0.92em] tracking-wide" dir="ltr">${esc(s)}</span>`;
const groupAccount = (s) => esc(String(s || "").replace(/\s+/g, "")).replace(/(.{4})(?=.)/g, `$1${NB}`);

// ---------- Icônes : grille 24, trait 1,75, taille donnée par cls ou par le parent ([&_svg]:size-*) ----------
const icons = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 13.5h2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  list: '<path d="M4 6h16M4 12h10M4 18h13"/>',
  arrowUp: '<path d="M7 17L17 7M9 7h8v8"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  dots: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  // nouvelles
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  arrowDownLeft: '<path d="M17 7L7 17M15 17H7V9"/>',
  arrowUpRight: '<path d="M7 17L17 7M9 7h8v8"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M8.5 11L6 3h4l2 4 2-4h4l-2.5 8"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.2 4.4 5 4.6"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z"/>',
  facebook: '<path d="M14 21v-7.5h2.6l.4-3H14V8.6c0-.9.3-1.6 1.6-1.6H17V4.3a20 20 0 0 0-2.3-.1C12.4 4.2 11 5.6 11 8.2v2.3H8.5v3H11V21"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  message: '<path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4A8 8 0 1 1 20 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
  refresh: '<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H5a1 1 0 0 0-1 1 4 4 0 0 0 4 4M16 6h3a1 1 0 0 1 1 1 4 4 0 0 1-4 4M12 14v3M8.5 21h7M9.5 21l.5-4h4l.5 4"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
  fileText: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  academy: '<path d="M2 9.5L12 5l10 4.5-10 4.5z"/><path d="M6 11.3V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.7M22 9.5V15"/>',
};
const icon = (name, cls = "size-5", fill = false) =>
  `<svg viewBox="0 0 24 24" class="${cls}" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true" focusable="false">${icons[name] || ""}</svg>`;

// Événements (notifications, activité) : la base stocke un emoji, l'interface affiche une icône au trait.
const EVENT_ICON = { "✅": ["check", "bg-success-bg text-success-fg"], "🚫": ["ban", "bg-danger-bg text-danger-fg"], "⛔": ["ban", "bg-danger-bg text-danger-fg"], "⚠": ["alert", "bg-warning-bg text-warning-fg"],
  "⏳": ["clock", "bg-muted text-fg-muted"], "⚙": ["gear", "bg-muted text-fg-muted"], "🎬": ["film", "bg-muted text-fg-muted"], "🎯": ["target", "bg-muted text-fg-muted"],
  "🏁": ["flag", "bg-muted text-fg-muted"], "🏢": ["building", "bg-muted text-fg-muted"], "🏦": ["bank", "bg-muted text-fg-muted"], "💰": ["wallet", "bg-muted text-fg-muted"], "💸": ["wallet", "bg-muted text-fg-muted"],
  "🛡": ["shield", "bg-info-bg text-info-fg"], "✏": ["pencil", "bg-muted text-fg-muted"], "🗑": ["trash", "bg-muted text-fg-muted"],
  "📈": ["trend", "bg-brand-soft text-brand-fg"], "⚖": ["flag", "bg-info-bg text-info-fg"], "💬": ["message", "bg-brand-soft text-brand-fg"],
  "🏆": ["trophy", "bg-warning-bg text-warning-fg"], "🎓": ["academy", "bg-brand-soft text-brand-fg"] };
const eventIcon = (emoji) => {
  const [ic, tone] = EVENT_ICON[String(emoji || "").replace(/️/g, "")] || ["bell", "bg-muted text-fg-muted"];
  return `<span class="grid size-8 shrink-0 place-items-center rounded-full ${tone}" aria-hidden="true">${icon(ic, "size-4")}</span>`;
};

// Drapeau algérien (SVG, jamais d'emoji : Windows n'affiche pas les drapeaux emoji).
const flagDz = (cls = "h-3 w-[18px]") =>
  `<svg viewBox="0 0 30 20" class="${cls} shrink-0 rounded-[2px] ring-1 ring-fg/10" role="img" aria-label="${esc(t("Algérie"))}"><rect width="15" height="20" fill="#006233"/><rect x="15" width="15" height="20" fill="#ffffff"/><mask id="dz-crescent"><rect width="30" height="20" fill="#fff"/><circle cx="16.25" cy="10" r="4" fill="#000"/></mask><circle cx="15" cy="10" r="5" fill="#d21034" mask="url(#dz-crescent)"/><polygon fill="#d21034" points="15.50,10.00 16.91,9.50 16.95,8.00 17.86,9.19 19.30,8.77 18.45,10.00 19.30,11.23 17.86,10.81 16.95,12.00 16.91,10.50"/></svg>`;

// ---------- Logo ----------
// logo() sur surface ; logo({ tone: "text-on-brand" }) sur bg-night ; logo({ wordmark: false }) : symbole seul.
// Compatibilité : logo(true) = version claire sur fond sombre.
function logo(opts = {}) {
  const o = typeof opts === "boolean" ? { tone: opts ? "text-on-brand" : "text-fg" } : opts;
  const { wordmark = true, tone = "text-fg", size = "md", href = "/" } = o;
  const S = { md: ["size-9 rounded-tile", "text-[1.375rem]"], sm: ["size-8 rounded-[10px]", "text-[1.125rem]"] }[size];
  return `<a href="${href}" class="inline-flex items-center gap-2.5 rounded-control" aria-label="${esc(t("ClipBoost, retour au site"))}">
    <span class="grid ${S[0]} shrink-0 place-items-center bg-brand text-on-brand">${icon("play", "size-[18px] translate-x-px", true)}</span>
    ${wordmark ? `<span class="inline-block -skew-x-6 font-display ${S[1]} font-extrabold leading-none tracking-[-0.03em] ${tone}" aria-hidden="true">ClipBoost</span>` : ""}</a>`;
}

// ---------- Classes de base ----------
const cx = (...a) => a.filter(Boolean).join(" ");
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
// Anneau intérieur : pour un bouton posé dans un cadre défilant (segmented, chips, overflow-x-auto), qui rognerait
// un anneau extérieur, ou collé au bord d'un panneau (menus).
const FOCUS_INSET = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";
// Zone tactile élargie (≥ 40 px sous md) pour les liens texte, sans changer leur rendu.
const HIT = "relative max-md:after:absolute max-md:after:-inset-x-2 max-md:after:-inset-y-3";

// ---------- Boutons ----------
const BTN = {
  base: `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-colors duration-150 ease-standard disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ${FOCUS}`,
  sm: "h-10 rounded-lg px-3 text-small md:h-8 [&_svg]:size-4", // 40 px sous md (cible tactile, §3.5)
  md: "h-10 rounded-control px-4 text-sm [&_svg]:size-4",
  lg: "h-12 rounded-control px-5 text-[15px] [&_svg]:size-5",
  primary: "bg-brand text-on-brand shadow-control hover:bg-brand-hover active:bg-brand-active",
  secondary: "border border-line-strong bg-surface text-fg shadow-control hover:border-line-control hover:bg-subtle active:bg-muted",
  soft: "bg-brand-soft text-brand-fg hover:bg-brand-soft-hover",
  ghost: "text-fg-muted hover:bg-muted hover:text-fg active:bg-line",
  danger: "bg-danger-solid text-on-brand shadow-control hover:bg-danger-solid-hover",
  dangerSoft: "border border-line-strong bg-surface text-danger-fg shadow-control hover:border-danger-border hover:bg-danger-bg",
  onColor: "bg-on-brand text-brand-700 shadow-control hover:bg-brand-50",
  onColorGhost: "bg-on-brand/10 text-on-brand ring-1 ring-inset ring-on-brand/25 hover:bg-on-brand/15",
  link: `${HIT} rounded-sm font-medium text-brand-fg underline-offset-4 hover:underline`, // sans taille : hérite du texte parent
};
// extra ne doit jamais redéfinir une propriété déjà posée par la recette (voir « Règle des extras »).
const btn = (variant = "primary", size = "md", extra = "") => cx(BTN.base, variant === "link" ? "" : BTN[size], BTN[variant], extra);

const ICON_BTN = {
  base: `inline-grid shrink-0 place-items-center rounded-lg text-fg-muted transition-colors duration-150 hover:bg-muted hover:text-fg ${FOCUS}`,
  // 40 px sous md (cible tactile, §3.5), tailles compactes à partir de md.
  sm: "size-10 md:size-8 [&_svg]:size-4", md: "size-10 md:size-9 [&_svg]:size-[18px]", lg: "size-10 [&_svg]:size-5",
  outline: "border border-line-strong bg-surface shadow-control",
};
const iconBtn = (size = "md", outline = false, extra = "") => cx(ICON_BTN.base, ICON_BTN[size], outline && ICON_BTN.outline, extra);

// ---------- Champs ----------
const inputCls = "block h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-fg shadow-control transition-[border-color,box-shadow] duration-150 placeholder:text-fg-subtle hover:border-line-control focus:border-focus focus:outline-hidden focus:ring-3 focus:ring-focus/20 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-fg-disabled [&:read-only:not(select)]:bg-subtle aria-[invalid=true]:border-danger-solid aria-[invalid=true]:focus:ring-danger-solid/20 sm:text-sm";
const inputLg = "h-12"; // même hauteur que btn(…, "lg") posé à côté (« Tout retirer »)
const textareaCls = `${inputCls} h-auto min-h-24 resize-y py-2.5 leading-5`;
const selectCls = `${inputCls} cursor-pointer appearance-none pe-9`;
const CHEVRON = icon("chevronDown", "pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle");

// select(name, value, options[[v, l]], { label, cls }) ; 4e argument texte = classes du conteneur (compatibilité).
function select(name, value, options, opts = {}) {
  const o = typeof opts === "string" ? { cls: opts } : opts;
  return `<label class="relative block ${o.cls || ""}">${o.label ? `<span class="sr-only">${esc(o.label)}</span>` : ""}<select data-input="${name}" class="${selectCls}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>${CHEVRON}</label>`;
}
// Compatibilité : un 3e argument (ancien `cls`) ou { invalid } ; un champ en erreur porte aria-invalid="true".
const countrySelect = (name, value, opts = {}) =>
  `<span class="relative block"><select name="${name}" class="${selectCls}"${(typeof opts === "string" ? /rose|danger|invalid/.test(opts) : opts.invalid) ? ' aria-invalid="true"' : ""}>${COUNTRIES.map((c) => `<option value="${esc(c)}"${c === value ? " selected" : ""}>${esc(t(c))}</option>`).join("")}</select>${CHEVRON}</span>`;
// Champ numérique avec unité en suffixe (DA, %, jours, vues). attrs : attributs bruts de l'input.
const unitInput = (attrs, unit, { lg = false } = {}) =>
  `<span class="relative block"><input ${attrs} inputmode="numeric" class="${inputCls} ${lg ? inputLg : ""} ${unit.length > 3 ? "pe-16" : "pe-12"} tabular-nums"/><span class="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm font-medium text-fg-subtle">${unit}</span></span>`;
// Bouton « Effacer » maison (la croix native de WebKit est masquée dans web/styles.css) : visible dès que le champ n'est plus vide.
const searchInput = (name, value, placeholder, label, cls = "") =>
  `<label class="relative block ${cls}"><span class="sr-only">${esc(label)}</span>${icon("search", "pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle")}<input data-input="${name}" type="search" value="${esc(value)}" placeholder="${esc(placeholder)}" class="peer ${inputCls} ps-9 pe-10 md:pe-9"/><span class="absolute inset-y-0 end-0 flex items-center pe-0 peer-placeholder-shown:hidden md:pe-1"><button type="button" data-action="clear-search" data-value="${name}" class="${iconBtn("sm", false, "text-fg-subtle")}" aria-label="${esc(t("Effacer la recherche"))}">${icon("close")}</button></span></label>`;
// field(libellé, champ, aide, erreur) : l'erreur remplace l'aide ; poser aria-invalid="true" sur le champ en erreur.
// L'aide et l'erreur restent hors du <label> : elles ne s'ajoutent pas au nom accessible du champ.
const field = (label, input, hint = "", error = "") =>
  `<div class="grid gap-1.5" data-field><label class="contents"><span class="text-small font-medium text-fg">${label}</span>${input}</label>${error
    ? `<span class="flex items-center gap-1 text-xs font-medium text-danger-fg" role="alert">${icon("alert", "size-3.5 shrink-0")}${error}</span>`
    : hint ? `<span class="text-xs text-fg-subtle">${hint}</span>` : ""}</div>`;
// « (facultatif) » après un libellé : objet converti en texte à chaque usage (`${OPTIONAL}`), donc dans la langue courante.
const OPTIONAL = { toString: () => `<span class="font-normal text-fg-subtle">${t("(facultatif)")}</span>` };
// Erreur de saisie posée sans réafficher le formulaire (les valeurs saisies restent) : aria-invalid, message sous le
// champ (dans son conteneur [data-field]), focus et défilement. msg vide : le champ est seulement marqué.
function markInvalid(formEl, name, msg = "") {
  if (!formEl) return;
  formEl.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute("aria-invalid"));
  formEl.querySelectorAll("[data-field-error]").forEach((el) => el.remove());
  const el = formEl.querySelector(`[name="${name}"]`);
  if (!el) { if (msg) toast(msg, "danger"); return; }
  el.setAttribute("aria-invalid", "true");
  const host = el.closest("[data-field]");
  if (msg && host) {
    const id = `err-${name}`;
    host.insertAdjacentHTML("beforeend", `<span id="${id}" data-field-error class="flex items-center gap-1 text-xs font-medium text-danger-fg" role="alert">${icon("alert", "size-3.5 shrink-0")}${esc(msg)}</span>`);
    el.setAttribute("aria-describedby", [...new Set([...(el.getAttribute("aria-describedby") || "").split(" ").filter((x) => x && x !== id), id])].join(" "));
  } else if (msg) toast(msg, "danger");
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "center", behavior: "smooth" });
}
// Une nouvelle saisie efface l'erreur posée par markInvalid sur ce champ (appelé par main.js).
function clearInvalid(el) {
  if (!el || el.getAttribute("aria-invalid") !== "true") return;
  el.removeAttribute("aria-invalid");
  const host = el.closest("[data-field]");
  if (host) host.querySelectorAll("[data-field-error]").forEach((x) => x.remove());
}

// Cartes de choix (radio natif visible) et segments de choix (input peer sr-only).
const CHOICE = `group relative flex cursor-pointer items-start gap-3 rounded-control border border-line-strong bg-surface p-3.5 transition-colors duration-150 hover:border-line-control has-checked:border-brand has-checked:bg-brand-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus`;
const CHOICE_DANGER = `group relative flex cursor-pointer items-start gap-3 rounded-control border border-line-strong bg-surface p-3.5 transition-colors duration-150 hover:border-line-control has-checked:border-danger-solid has-checked:bg-danger-bg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus`;
const SEG_CHOICE = "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-fg-muted transition-colors hover:border-line-control peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus [&_svg]:size-4";
// Pas d'anneau propre : la carte de choix (has-focus-visible) porte le seul indicateur de focus.
const RADIO = "mt-0.5 size-4 shrink-0 cursor-pointer accent-brand focus-visible:outline-none";
const CHECKBOX = `size-4 shrink-0 cursor-pointer rounded-[4px] accent-brand ${FOCUS}`;

const switchBtn = (on, action, key, label) =>
  `<button type="button" role="switch" aria-checked="${on}" data-action="${action}" data-key="${key}" aria-label="${esc(label)}" class="group relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full bg-line-control transition-colors duration-150 ease-standard after:absolute after:-inset-2 aria-checked:bg-brand ${FOCUS}"><span class="pointer-events-none ms-0.5 size-5 rounded-full bg-on-brand shadow-control transition-[margin-inline-start] duration-150 ease-standard group-aria-checked:ms-[1.125rem]"></span></button>`;

// ---------- Cartes ----------
const CARD = "rounded-card border border-line bg-surface shadow-card";
const CARD_HOVER = `transition-[border-color,box-shadow] duration-150 ease-standard hover:border-line-strong hover:shadow-card-hover ${FOCUS}`;
// Dans une modale (surface surélevée), la tuile prend bg-muted pour rester visible en sombre.
const TILE = "rounded-tile bg-subtle p-3 in-[[aria-modal=true]]:bg-muted";
// Compatibilité : un ancien appel sans padding (card(html, "mt-6")) reçoit le padding par défaut p-5.
const card = (inner, cls = "p-5") => `<section class="${CARD} ${/(^|\s)p[xytblrse]?-/.test(cls) ? cls : `p-5 ${cls}`}">${inner}</section>`;
const cardHeader = (title, desc = "", actions = "") =>
  `<header class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><h2 class="text-section text-fg">${title}</h2>${desc ? `<p class="mt-0.5 text-small text-fg-muted">${desc}</p>` : ""}</div>${actions ? `<div class="flex shrink-0 items-center gap-2">${actions}</div>` : ""}</header>`;

// KPI : value = HTML (bigMoney(n) pour l'argent, sinon `<span class="text-xl font-semibold tracking-tight text-fg sm:text-kpi">${fmt(n)}</span>` via kpiValue).
const kpiValue = (txt) => `<span class="whitespace-nowrap text-xl font-semibold tracking-tight text-fg tabular-nums sm:text-kpi">${txt}</span>`;
const DELTA = { up: "bg-success-bg text-success-fg", down: "bg-danger-bg text-danger-fg", flat: "bg-muted text-fg-muted" };
function kpi({ label, value, sub = "", ic = "", delta = "", deltaTone = "up", href = "", extra = "" }) {
  const body = `<div class="flex items-center justify-between gap-2"><p class="text-small font-medium text-fg-muted">${label}</p>${ic ? `<span class="text-fg-subtle">${icon(ic, "size-4")}</span>` : ""}</div>
    <p class="mt-2">${value}</p>
    ${delta || sub ? `<div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">${delta ? `<span class="inline-flex h-5 items-center gap-0.5 rounded-badge px-1.5 font-medium tabular-nums ${DELTA[deltaTone]}">${delta}</span>` : ""}${sub ? `<span>${sub}</span>` : ""}</div>` : ""}${extra}`;
  return href ? `<a href="${href}" class="block ${CARD} ${CARD_HOVER} p-4 sm:p-5">${body}</a>` : `<div class="${CARD} p-4 sm:p-5">${body}</div>`;
}

// ---------- Badges ----------
const BADGE = "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-badge border px-2 text-xs font-medium";
const TONE = {
  success: "border-success-border bg-success-bg text-success-fg", warning: "border-warning-border bg-warning-bg text-warning-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg", info: "border-info-border bg-info-bg text-info-fg",
  idle: "border-idle-border bg-idle-bg text-idle-fg", brand: "border-brand-line bg-brand-soft text-brand-fg",
};
const DOT = { success: "bg-success-solid", warning: "bg-warning-solid", danger: "bg-danger-solid", info: "bg-info-solid", idle: "bg-idle-solid", brand: "bg-brand" };
const STATUS_TONE = {
  "Active": "success", "Actif": "success", "Validée": "success", "Validé": "success",
  "En attente": "warning", "En cours": "info", "En pause": "idle", "Terminée": "idle",
  "Refusée": "danger", "Refusé": "danger", "Rejeté": "danger", "Suspendu": "danger",
};
const badge = (text, tone = "idle", { dot = false, ic = "" } = {}) =>
  `<span class="${BADGE} ${TONE[tone]}">${ic ? icon(ic, "size-3") : dot ? `<span class="size-1.5 rounded-full ${DOT[tone]}" aria-hidden="true"></span>` : ""}${text}</span>`;
// Statut (valeur du serveur, en français) affiché dans la langue choisie.
const statusBadge = (s) => badge(esc(t(s)), STATUS_TONE[s] || "idle", s === "En pause" ? { ic: "pause" } : { dot: true });
// Recours d'un clipper sur un clip refusé (statut du serveur : « En attente », « Acceptée », « Refusée »), dans la langue choisie.
const APPEAL_BADGE = { "En attente": ["Recours en cours", "warning"], "Acceptée": ["Recours accepté", "success"], "Refusée": ["Recours refusé", "danger"] };
const appealBadge = (s) => { const [label, tone] = APPEAL_BADGE[s] || APPEAL_BADGE["En attente"]; return badge(esc(t(label)), tone, { ic: "flag" }); };
const PLATFORM_ICON = { TikTok: "tiktok", Instagram: "instagram", YouTube: "youtube", Facebook: "facebook" };
const platformTag = (p) => `<span class="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-badge bg-muted px-2 text-xs font-medium text-fg-muted">${icon(PLATFORM_ICON[p] || "film", "size-3.5")}${esc(p)}</span>`;
// Liseré : brand-soft et info-bg se confondent avec le fond canvas en clair (même correction que countBadge).
const roleBadge = (role) => ({ agence: `<span class="inline-flex h-5 items-center rounded-[4px] bg-info-bg px-1.5 text-micro font-semibold text-info-fg ring-1 ring-inset ring-info-border">${t("Agence")}</span>`, admin: `<span class="inline-flex h-5 items-center rounded-[4px] bg-brand-soft px-1.5 text-micro font-semibold text-brand-fg ring-1 ring-inset ring-brand-line/70">${t("Admin")}</span>` }[role] || "");
// queue : liseré brand-line, sinon la pastille brand-soft se confond avec le fond canvas en clair.
const COUNT = { queue: "bg-brand-soft text-brand-fg ring-1 ring-inset ring-brand-line/70", unread: "bg-brand text-on-brand", total: "bg-muted text-fg-muted" };
// Facture (recharge) ou reçu (retrait) PDF d'une transaction validée (x.document : son numéro), sinon rien. compact : icône
// seule (lignes étroites), le type de document en infobulle ; le nom accessible donne le numéro. Action : tx-document (main.js).
const txDocBtn = (x, { compact = false, size = "sm", variant = "ghost", extra = "" } = {}) => {
  if (!x || !x.document) return "";
  const invoice = x.type === "recharge", label = invoice ? t("Facture PDF") : t("Reçu PDF");
  const aria = esc(invoice ? t("Télécharger la facture {number}", { number: x.document }) : t("Télécharger le reçu {number}", { number: x.document }));
  return compact
    ? `<button type="button" data-action="tx-document" data-id="${esc(x.id)}" class="${iconBtn("sm", false, extra)}" aria-label="${aria}" title="${esc(label)}">${icon("download")}</button>`
    : `<button type="button" data-action="tx-document" data-id="${esc(x.id)}" class="${btn(variant, size, extra)}" aria-label="${aria}" title="${esc(x.document)}">${icon("download")}${label}</button>`;
};
const countBadge = (n, tone = "queue") => `<span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${COUNT[tone]}">${fmt(n)}</span>`;

// ---------- Filtres : segmented (2 à 5 choix), chips (au-delà, défilable) ----------
// options : "Libellé" | [valeur, libellé] | [valeur, libellé, compteur]
// Option texte seul : la valeur reste en français (statut, catégorie…), le libellé affiché est traduit.
const opt = (o) => (Array.isArray(o) ? o : [o, t(o)]);
// segmented(…, { scroll: true }) : filtre de statut ; sous sm il devient une rangée de puces défilante bord à bord
// (comme chips), pour qu'aucune option ne soit rognée dans le cadre ; à partir de sm, le contrôle segmenté.
const SEG_WRAP = "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-control border border-line bg-subtle p-0.5 [scrollbar-width:none]";
const SEG_WRAP_SCROLL = "max-sm:-mx-4 max-sm:flex max-sm:max-w-none max-sm:gap-2 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:px-4 max-sm:pb-1";
const SEG_BTN = `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-small font-medium text-fg-muted transition-colors duration-150 hover:text-fg aria-pressed:bg-surface-raised aria-pressed:text-fg aria-pressed:shadow-control md:h-8 ${FOCUS_INSET}`;
const SEG_BTN_SCROLL = "max-sm:rounded-full max-sm:border max-sm:border-line-strong max-sm:bg-surface max-sm:px-3.5 max-sm:aria-pressed:border-brand-line max-sm:aria-pressed:bg-brand-soft max-sm:aria-pressed:text-brand-fg max-sm:aria-pressed:shadow-none";
const segmented = (name, value, options, label = t("Filtrer"), { scroll = false } = {}) =>
  `<div class="${SEG_WRAP} ${scroll ? SEG_WRAP_SCROLL : ""}" role="group" aria-label="${esc(label)}">${options.map((o) => {
    const [v, l, n] = opt(o);
    return `<button type="button" data-action="${name}" data-value="${esc(v)}" aria-pressed="${String(v) === String(value)}" class="${SEG_BTN} ${scroll ? SEG_BTN_SCROLL : ""}">${esc(l)}${n !== undefined ? `<span class="tabular-nums ${scroll ? "text-fg-subtle max-sm:text-current" : "text-fg-subtle"}">${fmt(n)}</span>` : ""}</button>`;
  }).join("")}</div>`;
const pills = segmented; // compatibilité
const chips = (name, value, options, label = t("Filtrer")) =>
  `<div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" role="group" aria-label="${esc(label)}">${options.map((o) => {
    const [v, l, n] = opt(o);
    return `<button type="button" data-action="${name}" data-value="${esc(v)}" aria-pressed="${String(v) === String(value)}" class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-small font-medium text-fg-muted transition-colors hover:border-line-control hover:text-fg aria-pressed:border-brand-line aria-pressed:bg-brand-soft aria-pressed:text-brand-fg md:h-8 ${FOCUS_INSET}">${esc(l)}${n !== undefined ? `<span class="tabular-nums">${fmt(n)}</span>` : ""}</button>`;
  }).join("")}</div>`;
// Onglets soulignés (sections d'une même page).
const TABLIST = "flex gap-6 border-b border-line";
const TAB = `-mb-px inline-flex h-10 items-center gap-2 border-b-2 border-transparent text-sm font-medium text-fg-muted transition-colors hover:text-fg aria-selected:border-brand aria-selected:text-fg ${FOCUS}`;

// ---------- En-têtes, état vide, progression ----------
const pageHeader = (title, text, action = "") =>
  `<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0"><h1 class="text-title-sm text-fg sm:text-title">${title}</h1>${text ? `<p class="mt-1 max-w-2xl text-sm text-fg-muted">${text}</p>` : ""}</div>
    ${action ? `<div class="flex shrink-0 flex-wrap items-center gap-2">${action}</div>` : ""}</div>`;
const sectionHeader = (title, href = "", link = t("Tout voir"), attrs = "") =>
  `<div class="mb-3 mt-8 flex items-end justify-between gap-3"><h2 class="text-heading text-fg">${title}</h2>${href ? `<a href="${href}" ${attrs} class="inline-flex items-center gap-1 rounded-sm text-small font-medium text-brand-fg underline-offset-4 hover:underline ${FOCUS}">${link}${icon("chevronRight", "size-3.5 rtl:-scale-x-100")}</a>` : ""}</div>`;
// emptyState(icône, titre, texte, action HTML, { inCard }) : inCard = à l'intérieur d'une carte existante (pas de bordure).
const emptyState = (ic, title, text = "", action = "", { inCard = false } = {}) =>
  `<div class="flex flex-col items-center justify-center px-6 text-center ${inCard ? "py-10" : "rounded-card border border-dashed border-line-strong bg-surface py-12"}">
    <span class="grid size-10 place-items-center rounded-full bg-muted text-fg-subtle">${icon(ic, "size-5")}</span>
    <p class="mt-3 text-sm font-semibold text-fg">${title}</p>${text ? `<p class="mt-1 max-w-sm text-small text-fg-muted">${text}</p>` : ""}${action ? `<div class="mt-4">${action}</div>` : ""}</div>`;
// progress(dépensé, budget, { label, aria }) : violet ; ≥ 85 % ambre ; 100 % gris. Jamais rouge.
function progress(spent, budget, { label = true, aria = t("Budget utilisé") } = {}) {
  const p = budget ? (spent / budget) * 100 : 0;
  const fill = p >= 100 ? "bg-idle-solid" : p >= 85 ? "bg-warning-solid" : "bg-brand";
  return `<div>${label ? `<div class="mb-1.5 flex items-baseline justify-between gap-3 text-xs tabular-nums text-fg-subtle"><span><span class="font-medium text-fg">${fmt(spent)}</span> / ${da(budget)}</span><span>${pct(p)}</span></div>` : ""}
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(100, p))}" aria-label="${esc(aria)}">
      <div class="h-full rounded-full ${fill} transition-[width] duration-300 ease-standard" style="width:${p > 0 ? `max(3px, ${Math.min(100, p).toFixed(1)}%)` : "0"}"></div></div></div>`;
}

// ---------- Couvertures de campagne (catégorie → teinte, voir .cover dans app/theme.css) ----------
const coverAttr = (c) => `data-cat="${CATEGORIES.includes(c.category) ? c.category : "Autre"}"`;
const THUMB = { xs: "size-5 rounded-[4px] text-[11px]", sm: "size-10 rounded-tile text-lg", md: "size-12 rounded-tile text-2xl", lg: "size-14 rounded-tile text-2xl" };
// Vignette : la photo de la campagne si elle en a une, sinon l'emoji sur la teinte de sa catégorie.
const coverThumb = (c, size = "sm") => c.image
  ? `<span class="cover relative grid ${THUMB[size]} shrink-0 overflow-hidden" ${coverAttr(c)} aria-hidden="true"><img src="${esc(c.image)}" alt="" loading="lazy" decoding="async" class="absolute inset-0 size-full object-cover"/></span>`
  : `<span class="cover grid ${THUMB[size]} shrink-0 place-items-center" ${coverAttr(c)} aria-hidden="true">${c.emoji}</span>`;
// Contenu d'une grande couverture (.cover relative overflow-hidden) : photo plein cadre, sinon l'emoji centré.
// emojiCls : taille de l'emoji (« text-5xl »). Les puces posées par-dessus (tarif, Top campagne) se placent après.
const coverArt = (c, emojiCls = "text-5xl") => c.image
  ? `<img src="${esc(c.image)}" alt="" loading="lazy" decoding="async" class="absolute inset-0 size-full object-cover"/>`
  : `<span class="absolute inset-0 grid place-items-center ${emojiCls} drop-shadow-[0_6px_14px_rgb(0_0_0/0.22)]" aria-hidden="true">${c.emoji}</span>`;

// ---------- Avatar : 6 fonds AA (texte blanc ≥ 5:1), admin = violet ----------
const AVATARS = ["bg-avatar-1", "bg-avatar-2", "bg-avatar-3", "bg-avatar-4", "bg-avatar-5", "bg-avatar-6"];
const AVATAR_SIZE = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-9 text-small", lg: "size-16 text-xl", xl: "size-20 text-2xl" };
// Photo de profil (u.avatar) si elle existe, sinon les initiales (2 lettres) sur une teinte stable.
function avatar(u, size = "md") {
  const cls = AVATAR_SIZE[size] || size;
  if (u && u.avatar) return `<img src="${esc(u.avatar)}" alt="" loading="lazy" decoding="async" class="inline-block ${cls} shrink-0 select-none rounded-full bg-muted object-cover" aria-hidden="true"/>`;
  const tone = u.role === "admin" ? "bg-avatar-1" : AVATARS[[...String(u.id)].reduce((h, ch) => h + ch.charCodeAt(0), 0) % AVATARS.length];
  return `<span class="inline-grid ${cls} shrink-0 select-none place-items-center rounded-full font-semibold text-on-brand ${tone}" aria-hidden="true">${esc(initials(u.name))}</span>`;
}

// Badge de vérification (agence vérifiée par l'équipe ClipBoost) : sceau bleu et coche blanche, à côté du nom.
const verifiedBadge = (cls = "size-4", label = t("Agence vérifiée")) =>
  `<svg viewBox="0 0 24 24" class="${cls} inline-block shrink-0 align-[-0.125em] text-verified" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><path fill="currentColor" d="M10.80 1.91Q12.00 0.80 13.20 1.91Q14.41 3.02 16.00 2.66Q17.60 2.30 18.09 3.86Q18.58 5.42 20.14 5.91Q21.70 6.40 21.34 8.00Q20.98 9.59 22.09 10.80Q23.20 12.00 22.09 13.20Q20.98 14.41 21.34 16.00Q21.70 17.60 20.14 18.09Q18.58 18.58 18.09 20.14Q17.60 21.70 16.00 21.34Q14.41 20.98 13.20 22.09Q12.00 23.20 10.80 22.09Q9.59 20.98 8.00 21.34Q6.40 21.70 5.91 20.14Q5.42 18.58 3.86 18.09Q2.30 17.60 2.66 16.00Q3.02 14.41 1.91 13.20Q0.80 12.00 1.91 10.80Q3.02 9.59 2.66 8.00Q2.30 6.40 3.86 5.91Q5.42 5.42 5.91 3.86Q6.40 2.30 8.00 2.66Q9.59 3.02 10.80 1.91Z"/><path d="M8.2 12.3l2.6 2.6 5-5.3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// Nom + badge si l'utilisateur (ou l'agence publique) est vérifié : u.verified === true.
const nameWithBadge = (u, cls = "size-4") => `${esc(u.name)}${u && u.verified ? `${NB}${verifiedBadge(cls)}` : ""}`;

// ---------- Tableau (≥ md) et liste (< md) dans le même conteneur ----------
const TBL = {
  // relative : les .sr-only (position absolue) des en-têtes restent dans le cadre et ne créent pas de défilement de page.
  wrap: "relative overflow-hidden rounded-card border border-line bg-surface shadow-card",
  table: "hidden w-full border-collapse text-sm md:table",
  headRow: "bg-subtle",
  th: "h-9 whitespace-nowrap px-4 text-start align-middle text-xs font-medium text-fg-subtle first:ps-5 last:pe-5",
  // Toujours posé avec th (`${TBL.th} ${TBL.thNum}`) : text-end! l'emporte sur text-start, que Tailwind émet après lui.
  thNum: "text-end!",
  tr: "border-t border-line transition-colors duration-150 hover:bg-subtle/70",
  td: "h-14 px-4 py-2 align-middle text-fg first:ps-5 last:pe-5",
  tdNum: "text-end font-medium tabular-nums whitespace-nowrap",
  tdSub: "mt-0.5 block text-xs text-fg-subtle",
  tdActions: "w-px whitespace-nowrap text-end",
  list: "divide-y divide-line md:hidden",
  item: "flex flex-col gap-3 px-4 py-3.5",
};

// ---------- Toast ----------
// toast(message, "success" | "danger" | "info"). Messages sans emoji ni « ✓ » : l'icône s'en charge.
const TOAST = { success: ["check", "text-toast-success"], danger: ["alert", "text-toast-danger"], info: ["info", "text-toast-info"] };
// Emplacement de la pile : en haut quand une modale ou une feuille est ouverte (son pied porte l'action principale),
// au-dessus de la barre d'enregistrement collante des Réglages, sinon en bas (au-dessus de la navigation mobile).
const TOAST_AT = {
  bottom: "bottom-20 lg:bottom-6",
  top: "top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] lg:top-6",
  sticky: "bottom-[calc(9.5rem+env(safe-area-inset-bottom))] lg:bottom-24",
};
function toast(msg, tone = "success") {
  const box = document.getElementById("toasts");
  if (!box) return;
  const at = document.querySelector('#app [aria-modal="true"]') ? "top" : document.querySelector("[data-sticky-save]") ? "sticky" : "bottom";
  box.className = `pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 ${TOAST_AT[at]}`;
  const [ic, cls] = TOAST[tone] || TOAST.success;
  const el = document.createElement("div");
  el.setAttribute("role", tone === "danger" ? "alert" : "status");
  el.className = "pointer-events-auto flex max-w-md items-center gap-2.5 rounded-control bg-inverse px-4 py-3 text-sm font-medium text-fg-inverse shadow-popover animate-toast-in";
  el.innerHTML = `${icon(ic, `size-4 shrink-0 ${cls}`)}<span>${esc(msg)}</span>`;
  box.appendChild(el);
  setTimeout(() => el.remove(), Math.max(3200, msg.length * 70));
}

// ---------- Modale (feuille en bas sur mobile, boîte centrée ≥ sm) ----------
// modalShell({ title, description, body, footer, size: "md" | "lg" | "xl", form: "nom-du-data-form", live: "nom" })
// Avec form, la boîte entière est le <form data-form> : les boutons du pied sont dans le formulaire.
// Avec live, chaque saisie appelle LIVE[nom](données du formulaire) et remplace le contenu de [data-live-out] (main.js).
// Compatibilité : modalShell(bodyHtml, "max-w-lg") reste accepté pendant la migration.
const MODAL_W = { md: "sm:max-w-lg", lg: "sm:max-w-xl", xl: "sm:max-w-2xl", "max-w-lg": "sm:max-w-lg", "max-w-xl": "sm:max-w-xl", "max-w-2xl": "sm:max-w-2xl" };
function modalShell(arg, legacySize = "max-w-lg") {
  const o = typeof arg === "string" ? { body: arg, size: legacySize } : arg;
  const { title = "", description = "", body, footer = "", size = "md", form = "", live = "" } = o;
  const tag = form ? "form" : "div";
  return `<div class="fixed inset-0 z-50 flex items-end justify-center bg-overlay animate-fade-in sm:items-center sm:p-6" data-action="close-modal">
    <${tag} ${form ? `data-form="${form}" novalidate` : ""} ${live ? `data-live="${live}"` : ""} data-stop role="dialog" aria-modal="true" ${title ? 'aria-labelledby="modal-title"' : ""} tabindex="-1"
      class="relative flex focus:outline-none max-h-[92dvh] w-full ${MODAL_W[size] || MODAL_W.md} flex-col overflow-hidden rounded-t-panel border border-line bg-surface-raised shadow-modal animate-sheet-in sm:rounded-panel sm:animate-modal-in">
      <span class="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong sm:hidden" aria-hidden="true"></span>
      ${title ? `<header class="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div class="min-w-0"><h2 id="modal-title" class="text-heading text-fg">${title}</h2>${description ? `<p class="mt-0.5 text-small text-fg-muted">${description}</p>` : ""}</div>
        <button type="button" data-action="close-modal" class="${iconBtn("sm", false, "-me-1.5 -mt-0.5")}" aria-label="${esc(t("Fermer"))}">${icon("close")}</button>
      </header>` : `<button type="button" data-action="close-modal" class="${iconBtn("sm", false, "absolute end-3 top-3 z-10")}" aria-label="${esc(t("Fermer"))}">${icon("close")}</button>`}
      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">${body}</div>
      ${footer ? `<footer class="flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:pb-3.5">${footer}</footer>` : ""}
    </${tag}></div>`;
}
// Récapitulatifs en direct : chaque fichier de zone enregistre LIVE.nom = (data) => html au niveau supérieur.
const LIVE = {};
// Récapitulatif d'argent (au-dessus du pied des modales qui touchent à l'argent).
// rows : [[libellé, valeurHTML, fort?]] ; la ligne forte est séparée par un trait.
const summary = (rows) =>
  `<dl class="mt-5 grid gap-2 rounded-tile bg-subtle p-4 text-sm">${rows.map(([l, v, strong]) => `<div class="flex items-baseline justify-between gap-4 ${strong ? "mt-1 border-t border-line pt-3 font-semibold text-fg" : "text-fg-muted"}"><dt>${l}</dt><dd class="tabular-nums text-end ${strong ? "" : "text-fg"}">${v}</dd></div>`).join("")}</dl>`;
// Alerte en ligne : alert("info" | "warning" | "danger" | "success", texteHTML)
const ALERT_ICON = { info: "info", warning: "alert", danger: "alert", success: "check" };
const alertBox = (tone, html) =>
  `<div class="flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-sm ${TONE[tone]}" role="${tone === "danger" ? "alert" : "note"}">${icon(ALERT_ICON[tone], "mt-0.5 size-4 shrink-0")}<div class="min-w-0">${html}</div></div>`;

// ---------- Carte « Compte et connexion » (Profil et Paramètres du clipper et de l'agence, Mon compte de l'admin) ----------
// Email (badge « Vérifiée » si u.emailVerified), connexions Google / Apple / Discord liées au compte (u.providers),
// puis le mot de passe : changement (actuel + nouveau) si le compte en a un (u.hasPassword), sinon « Définir un mot
// de passe » (compte créé avec Google, Apple ou Discord : le nouveau seul, voir handlePasswordSubmit). Déconnexion en bas.
const PROVIDER_NAMES = { google: "Google", apple: "Apple", discord: "Discord" };
// ["Google", "Apple", "Discord"] → « Google, Apple et Discord » (« Google, Apple and Discord », « Google وApple وDiscord »).
const listAnd = (a) => {
  const f = uiIntl("ListFormat", { style: "long", type: "conjunction" });
  if (f) try { return f.format(a); } catch (e) {}
  return a.length > 1 ? t("{list} et {last}", { list: a.slice(0, -1).join(", "), last: a[a.length - 1] }) : a[0] || "";
};
function accountCard(u) {
  const pe = state.pwdError, hasPwd = u.hasPassword !== false;
  const names = listAnd((u.providers || []).map((p) => PROVIDER_NAMES[p] || p));
  const linked = names ? `<p class="mt-3 flex items-start gap-2 text-small text-fg-muted">${icon("checkCircle", "mt-0.5 size-4 shrink-0 text-success-fg")}<span>${t("Connexion avec {providers} activée", { providers: esc(names) })}</span></p>` : "";
  // Erreur du serveur posée sur le bon champ : « Mot de passe actuel incorrect » → actuel, sinon → nouveau.
  const badCurrent = hasPwd && /actuel/i.test(pe), inv = (on) => (pe && on ? ' aria-invalid="true"' : "");
  const next = (attrs = "") => field(t("Nouveau mot de passe"), `<input name="next" type="password" autocomplete="new-password" class="${inputCls}"${attrs}/>`, t("8 caractères minimum, avec au moins une lettre et un chiffre."));
  const pwd = hasPwd
    ? `<p class="text-sm font-semibold text-fg">${t("Mot de passe")}</p>
      ${pe ? alertBox("danger", esc(tServer(pe))) : ""}
      ${field(t("Mot de passe actuel"), `<input name="current" type="password" autocomplete="current-password" class="${inputCls}"${inv(badCurrent)}/>`)}
      ${next(inv(!badCurrent))}
      <button class="${btn("secondary", "md", "w-full")}">${t("Changer le mot de passe")}</button>`
    : `<div><p class="text-sm font-semibold text-fg">${t("Définir un mot de passe")}</p>
        <p class="mt-0.5 text-small text-fg-muted">${names ? `${t("Vous vous connectez avec {providers}.", { providers: esc(names) })} ` : ""}${t("Ajoutez un mot de passe pour pouvoir aussi vous connecter avec votre adresse email.")}</p></div>
      ${pe ? alertBox("danger", esc(tServer(pe))) : ""}
      ${next(inv(true))}
      <button class="${btn("secondary", "md", "w-full")}">${t("Définir le mot de passe")}</button>`;
  return card(`${cardHeader(t("Compte et connexion"))}
    <div class="mt-4 flex items-center gap-3 rounded-tile bg-subtle p-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-tile border border-line bg-surface text-fg-muted">${icon("mail", "size-[18px]")}</span>
      <p class="min-w-0 flex-1 break-all text-sm font-medium text-fg"><span dir="ltr">${esc(u.email)}</span></p>${u.emailVerified ? badge(t("Vérifiée"), "success", { ic: "check" }) : ""}</div>
    ${linked}
    <form data-form="password" class="mt-5 grid gap-4 border-t border-line pt-5" novalidate>
      <input type="text" name="username" autocomplete="username" value="${esc(u.email)}" hidden/>
      ${pwd}
    </form>
    <button type="button" data-action="logout" class="${btn("dangerSoft", "md", "mt-3 w-full")}">${icon("logout")}${t("Se déconnecter")}</button>`);
}

// ---------- Bandeau du site, bascule de thème ----------
function siteBanner() {
  const s = db.settings, parts = [];
  if (s.maintenance) parts.push(`<div class="flex items-center justify-center gap-2 border-b border-warning-border bg-warning-bg px-4 py-2 text-center text-small font-medium text-warning-fg">${icon("alert", "size-4 shrink-0")}${t("Le site est en maintenance : les connexions des clippers et des agences sont temporairement suspendues.")}</div>`);
  if (s.announcement) parts.push(`<div class="flex items-center justify-center gap-2 border-b border-brand-line bg-brand-soft px-4 py-2 text-center text-small font-medium text-brand-fg">${icon("megaphone", "size-4 shrink-0")}${esc(s.announcement)}</div>`);
  return parts.join("");
}
// Thème : clair, sombre ou système (web/theme.js gère les clics sur [data-theme-set] et l'état aria-pressed).
// Libellés en français dans la liste, traduits à l'affichage.
const THEME_MODES = [["light", "sun", "Clair"], ["dark", "moon", "Sombre"], ["system", "monitor", "Système"]];
function themeModeSwitch({ labels = false, cls = "" } = {}) {
  const m = window.clipboostTheme ? window.clipboostTheme.mode() : "system";
  return `<div class="${SEG_WRAP} ${cls}" role="group" aria-label="${esc(t("Thème"))}">${THEME_MODES.map(([v, ic, l]) => {
    const label = esc(t(l));
    return `<button type="button" data-theme-set="${v}" aria-pressed="${m === v}" title="${label}" class="${SEG_BTN} flex-1 justify-center [&_svg]:size-4">${icon(ic)}${labels ? `<span>${label}</span>` : `<span class="sr-only">${label}</span>`}</button>`;
  }).join("")}</div>`;
}
// Langue : boutons [data-lang-set] (web/src/i18n.js). full : libellés complets (« Français »), sinon FR / EN / ع.
function langSwitch({ full = false, cls = "" } = {}) {
  return `<div class="${SEG_WRAP} ${cls}" role="group" aria-label="${esc(t("Langue"))}">${Object.entries(LOCALES).map(([k, l]) =>
    `<button type="button" data-lang-set="${k}" aria-pressed="${LANG === k}" lang="${k}" title="${l.label}" class="${SEG_BTN} flex-1 justify-center">${full ? l.label : `<span aria-hidden="true">${l.short}</span><span class="sr-only">${l.label}</span>`}</button>`).join("")}</div>`;
}
const themeToggle = (cls = "") =>
  `<button type="button" data-theme-toggle class="${iconBtn("md", false, cls)}" aria-label="${esc(t("Changer de thème (clair ou sombre)"))}">
    <svg viewBox="0 0 24 24" class="dark:hidden" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    <svg viewBox="0 0 24 24" class="hidden dark:block" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
  </button>`;

// ---------- Photos : choix, recadrage et compression dans le navigateur ----------
// imageField({ name, value, shape, label, hint, fallback, labels }) : aperçu, bouton « Choisir une photo », « Retirer la
// photo », et un <input type="hidden" name> qui porte la valeur envoyée à l'API : data URL (nouvelle photo), adresse
// actuelle (inchangée) ou "" (retirée). Chaque changement déclenche un événement input sur ce champ caché (récapitulatifs, brouillons).
// shape : "avatar" (carré 320 px, rond), "cover" (bandeau 3:1, 1 500 px), "campaign" (16:9, 1 280 px), "proof" (capture
// d'écran : image entière, sans recadrage, réduite pour tenir dans 1 600 × 1 600 px ; aperçu sans rognage, object-contain).
// fallback : HTML affiché sans photo (initiales, couverture en dégradé) ; il remplit le cadre de l'aperçu.
// labels : { pick, change, clear } (textes déjà traduits) à la place de « Choisir / Changer / Retirer la photo ».
const IMAGE_SHAPES = {
  avatar: { w: 320, h: 320, box: "size-20 rounded-full", row: true },
  cover: { w: 1500, h: 500, box: "aspect-[3/1] w-full rounded-tile", row: false },
  campaign: { w: 1280, h: 720, box: "aspect-[16/9] w-full rounded-tile", row: false },
  proof: { w: 1600, h: 1600, box: "h-56 w-full rounded-tile", row: false, fit: true },
};
const IMAGE_MAX_CHARS = 2000000;
const imageFitCls = (shape) => ((IMAGE_SHAPES[shape] || {}).fit ? "object-contain" : "object-cover");
function imageField({ name, value = "", shape = "avatar", label = t("Photo"), hint = "", fallback = "", labels = null }) {
  const S = IMAGE_SHAPES[shape] || IMAGE_SHAPES.avatar, id = `img-${name}`;
  const L = { pick: t("Choisir une photo"), change: t("Changer la photo"), clear: t("Retirer la photo"), ...(labels || {}) };
  const preview = value ? `<img src="${esc(value)}" alt="" class="absolute inset-0 size-full ${imageFitCls(shape)}"/>` : fallback;
  const buttons = `<div class="flex flex-wrap items-center gap-2">
      <label class="${btn("secondary", "sm")} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus">${icon("camera")}<span data-image-pick-label>${value ? L.change : L.pick}</span>
        <input id="${id}" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" data-image-input="${name}" data-image-shape="${shape}"/></label>
      <button type="button" data-image-clear="${name}" class="${btn("ghost", "sm")}" ${value ? "" : "hidden"}>${icon("trash")}${L.clear}</button>
    </div>`;
  return `<div class="grid gap-2" data-field data-image-field="${name}" data-label-pick="${esc(L.pick)}" data-label-change="${esc(L.change)}">
    <span class="text-small font-medium text-fg">${label}</span>
    <div class="${S.row ? "flex items-center gap-4" : "grid gap-3"}">
      <div class="relative grid shrink-0 place-items-center overflow-hidden bg-muted ${S.box}" data-image-preview>${preview}</div>
      ${buttons}
    </div>
    <template data-image-fallback>${fallback}</template>
    <input type="hidden" name="${name}" value="${esc(value)}"/>
    ${hint ? `<span class="text-xs text-fg-subtle">${hint}</span>` : ""}
  </div>`;
}

// Recadrage au centre au format demandé, sans agrandir une petite image, puis JPEG (fond blanc pour la transparence).
// Forme « fit » (capture d'écran) : l'image entière, proportions gardées, réduite pour tenir dans S.w × S.h.
async function readImage(file, shape) {
  const S = IMAGE_SHAPES[shape] || IMAGE_SHAPES.avatar, ratio = S.w / S.h;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const iw = img.naturalWidth, ih = img.naturalHeight;
    let sw = iw, sh = iw / ratio, ow, oh;
    if (S.fit) {
      const k = Math.min(1, S.w / iw, S.h / ih);
      sh = ih; ow = Math.max(1, Math.round(iw * k)); oh = Math.max(1, Math.round(ih * k));
    } else {
      if (sh > ih) { sh = ih; sw = ih * ratio; }
      ow = Math.max(1, Math.round(Math.min(S.w, sw))); oh = Math.max(1, Math.round(ow / ratio));
    }
    const canvas = document.createElement("canvas");
    canvas.width = ow; canvas.height = oh;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ow, oh);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, ow, oh);
    for (const q of [0.85, 0.75, 0.6]) {
      const out = canvas.toDataURL("image/jpeg", q);
      if (out.length <= IMAGE_MAX_CHARS) return out;
    }
    throw new Error("too-big");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function setImageField(fieldEl, value) {
  const hidden = fieldEl.querySelector('input[type="hidden"]'), box = fieldEl.querySelector("[data-image-preview]");
  const clear = fieldEl.querySelector("[data-image-clear]"), label = fieldEl.querySelector("[data-image-pick-label]");
  const pick = fieldEl.querySelector("input[data-image-input]"), d = fieldEl.dataset;
  hidden.value = value;
  box.innerHTML = value ? `<img src="${esc(value)}" alt="" class="absolute inset-0 size-full ${imageFitCls(pick ? pick.dataset.imageShape : "")}"/>` : fieldEl.querySelector("template[data-image-fallback]").innerHTML;
  if (clear) clear.hidden = !value;
  if (label) label.textContent = value ? d.labelChange || t("Changer la photo") : d.labelPick || t("Choisir une photo");
  hidden.dispatchEvent(new Event("input", { bubbles: true }));
}

document.addEventListener("change", async (e) => {
  const input = e.target;
  if (!input || !input.matches || !input.matches("input[data-image-input]")) return;
  const file = input.files && input.files[0], name = input.dataset.imageInput;
  let fieldEl = input.closest("[data-image-field]");
  input.value = "";
  if (!file || !fieldEl) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast(t("Format non pris en charge : choisissez une image JPEG, PNG ou WebP."), "danger");
  if (file.size > 15 * 1024 * 1024) return toast(t("Image trop lourde : 15 Mo maximum."), "danger");
  try {
    const value = await readImage(file, input.dataset.imageShape);
    // Page réaffichée pendant la lecture (données rechargées…) : le champ du même nom dans le nouveau rendu.
    if (!fieldEl.isConnected) fieldEl = document.querySelector(`[data-image-field="${String(name).replace(/["\\]/g, "\\$&")}"]`);
    if (fieldEl) setImageField(fieldEl, value);
  } catch (err) {
    toast(t("Impossible de lire cette image. Essayez avec une autre photo."), "danger");
  }
});
document.addEventListener("click", (e) => {
  const b = e.target && e.target.closest ? e.target.closest("[data-image-clear]") : null;
  const fieldEl = b && b.closest("[data-image-field]");
  if (!fieldEl) return;
  setImageField(fieldEl, "");
  // « Retirer la photo » disparaît : le focus passe au choix d'une nouvelle photo (sinon il tomberait sur <body>).
  const pick = fieldEl.querySelector("input[data-image-input]");
  if (pick) pick.focus();
});

// ---------- Graphiques (voir §6) : toujours de gauche à droite (dir="ltr"), même en arabe ----------
const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
const seriesDates = (n, end = new Date()) => Array.from({ length: n }, (_, i) => new Date(end.getFullYear(), end.getMonth(), end.getDate() - (n - 1 - i)));
// Graduation : même unité sur tout l'axe (« 5 k » à côté de « 10 k », jamais « 5 000 »).
const axisTick = (v, max) => (v && max >= 1e4 && max < 1e6 ? t("{n}\u00a0k", { n: String(+(v / 1e3).toFixed(1)).replace(".", uiDecimal()) }) : compact(v));
// « 5 janv. » ; anglais « 5 Jan », arabe « 5 جانفي ».
const dayLabel = (d) => {
  const f = LANG === "fr" ? null : uiIntl("DateTimeFormat", { day: "numeric", month: "short" });
  return f ? f.format(d).replace(/\s/g, NB) : `${d.getDate()}${NB}${MONTHS[d.getMonth()]}`;
};

// barChart(valeursJournalières, { tone: "income" | "brand", unit: "DA" | libellé singulier, unitPlural, integer, h, caption })
function barChart(values, { tone = "income", unit = "DA", unitPlural = "", integer = false, h = "h-44", caption = "" } = {}) {
  const n = values.length, peak = Math.max(0, ...values);
  const max = integer ? Math.max(1, Math.ceil(niceMax(peak))) : niceMax(peak);
  const dates = seriesDates(n), bar = tone === "income" ? "bg-chart-income" : "bg-chart-brand";
  const fv = (v) => (unit === "DA" ? da(v) : plural(v, unit, unitPlural || `${unit}s`));
  const ticks = integer && max < 4 ? [max, 0] : [max, max / 2, 0];
  return `<figure class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2" dir="ltr">
    <div class="${h} flex flex-col justify-between text-end text-micro leading-none tabular-nums text-fg-subtle" aria-hidden="true">${ticks.map((v) => `<span>${axisTick(v, max)}</span>`).join("")}</div>
    <div class="relative ${h} border-b border-chart-axis bg-[linear-gradient(to_bottom,var(--color-chart-grid)_1px,transparent_1px)] bg-[size:100%_50%]" aria-hidden="true">
      <div class="absolute inset-0 flex items-end gap-[2px] px-0.5">${values.map((v, i) =>
        `<span class="flex h-full min-w-0 flex-1 items-end justify-center" title="${dayLabel(dates[i])} · ${fv(v)}">${v > 0 ? `<span class="w-full max-w-6 rounded-t-[3px] ${bar}" style="height:max(2px, ${((v / max) * 100).toFixed(2)}%)"></span>` : ""}</span>`).join("")}</div>
    </div>
    <span></span>
    <div class="mt-2 flex justify-between text-micro tabular-nums text-fg-subtle" aria-hidden="true"><span>${dayLabel(dates[0])}</span><span>${dayLabel(dates[Math.floor((n - 1) / 2)])}</span><span>${t("Auj.")}</span></div>
    <table class="sr-only"><caption>${esc(caption)}</caption>${values.map((v, i) => (v ? `<tr><th>${dayLabel(dates[i])}</th><td>${fv(v)}</td></tr>` : "")).join("")}</table>
  </figure>`;
}

// cumulativeChart(valeursJournalières, { h, label, end, onNight }) : courbe verte du cumul (monotone, sans dépassement).
// end : affiche la valeur finale au-dessus du point. onNight : variante sur bg-night (panneau auth, CTA final).
function cumulativeChart(daily, { h = "h-24", label = t("Gains cumulés"), end = true, onNight = false } = {}) {
  let s = 0; const cum = (daily.length > 1 ? daily : [0, ...daily, 0].slice(0, 2)).map((v) => (s += v));
  const max = niceMax(Math.max(...cum, 1)), W = 300, H = 100, step = W / Math.max(1, cum.length - 1);
  const pts = cum.map((v, i) => [i * step, H - (v / max) * (H - 6)]);
  let d = `M ${pts[0][0]} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], m = (x0 + x1) / 2; d += ` C ${m} ${y0.toFixed(2)}, ${m} ${y1.toFixed(2)}, ${x1} ${y1.toFixed(2)}`; }
  const [ex, ey] = pts.at(-1);
  const stroke = onNight ? "stroke-night-income" : "stroke-chart-income", fill = onNight ? "fill-night-income/15" : "fill-chart-income/12", dot = onNight ? "bg-night-income ring-night" : "bg-chart-income ring-surface";
  return `<div class="relative ${h}" dir="ltr" role="img" aria-label="${esc(t("{label} : {amount} sur {days}", { label, amount: da(s), days: plural(daily.length, "jour", "jours") }))}">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="absolute inset-0 size-full overflow-visible" aria-hidden="true">
      <path d="${d} L ${W} ${H} L 0 ${H} Z" class="${fill}"/>
      <path d="${d}" class="fill-none ${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
    <span class="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ${dot}" style="left:${((ex / W) * 100).toFixed(2)}%;top:${((ey / H) * 100).toFixed(2)}%"></span>
    ${end && !onNight ? `<span class="absolute end-0 -translate-y-[calc(100%+8px)] text-small font-semibold tabular-nums text-fg" style="top:${((ey / H) * 100).toFixed(2)}%">${da(s)}</span>` : ""}
  </div>`;
}

// barList([{ label: HTML, value: nombre, display: texte }], { tone: "brand" | "income", aria })
function barList(items, { tone = "brand", aria = "" } = {}) {
  const max = Math.max(1, ...items.map((i) => i.value)), fill = tone === "income" ? "bg-chart-income" : "bg-chart-brand";
  return `<ul class="grid gap-4" aria-label="${esc(aria)}">${[...items].sort((a, b) => b.value - a.value).map((i) =>
    `<li class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5"><span class="flex min-w-0 items-center gap-2 truncate text-sm text-fg">${i.label}</span><span class="text-sm font-medium tabular-nums ${i.value ? "text-fg" : "text-fg-subtle"}">${i.display}</span>
      <span class="col-span-2 block h-2 overflow-hidden rounded-full bg-muted">${i.value ? `<span class="block h-full rounded-full ${fill}" style="width:max(2px, ${((i.value / max) * 100).toFixed(1)}%)"></span>` : ""}</span></li>`).join("")}</ul>`;
}
// Ancien nom, ne plus appeler (le garde-fou l'interdit hors de ui.js).
// Les anciens appels placent la courbe dans un conteneur à hauteur fixe (h-20, h-56…) : elle le remplit.
const areaChart = (values) => cumulativeChart(values, { end: false, h: "h-full" });

// ---------- Messagerie par campagne (Messages du clipper, de l'agence et de l'équipe) ----------
// Une conversation (db.threads) est la paire campagne × clipper : { id « <campagne>~<clipper> », campaignId, clipperId,
// unread (messages de l'autre côté non lus), awaiting (réponse attendue), lastAt, messages [{ fromClipper, body, at, read }] }.
// Mise en page commune : liste et conversation côte à côte (≥ lg), l'une ou l'autre sur mobile (retour à la liste).
const msgThreads = () => db.threads || [];
const msgUnread = () => msgThreads().reduce((n, x) => n + x.unread, 0);
// Conversation vue par son lecteur : mine sur chaque message écrit de son côté (clipperSide : le lecteur est le clipper).
const msgMine = (thread, clipperSide) => ({ ...thread, messages: thread.messages.map((m) => ({ ...m, mine: m.fromClipper === clipperSide })) });
const MSG_PANE_H = "h-[calc(100dvh-14.5rem)] min-h-[26rem] lg:h-[calc(100dvh-13rem)]";

// Ligne de la liste : vignette, titre, sous-titre, dernier message (« Vous : … »), heure, pastille des non lus.
function msgThreadItem({ href, current, thumb, title, sub, thread }) {
  const last = thread.messages[thread.messages.length - 1], own = last && last.mine;
  // Texte du message dans sa propre direction (dir="auto"), « Vous : » dans celle de la page.
  const preview = last ? `${own ? `<span class="shrink-0">${t("Vous :")}</span>` : ""}<span class="min-w-0 truncate" dir="auto">${esc(last.body.replace(/\s+/g, " "))}</span>` : "";
  return `<a href="${href}" ${current ? 'aria-current="true"' : ""} class="flex items-start gap-3 px-4 py-3 transition-colors duration-150 hover:bg-subtle aria-[current=true]:bg-brand-soft/60 ${FOCUS_INSET}">
    ${thumb}
    <span class="min-w-0 flex-1">
      <span class="flex items-baseline gap-2"><span class="min-w-0 flex-1 truncate text-sm ${thread.unread ? "font-semibold" : "font-medium"} text-fg">${title}</span><span class="shrink-0 text-xs text-fg-subtle">${ago(thread.lastAt)}</span></span>
      <span class="block truncate text-xs text-fg-subtle">${sub}</span>
      <span class="mt-0.5 flex items-center gap-2"><span class="flex min-w-0 flex-1 gap-1 text-small ${thread.unread ? "font-medium text-fg" : "text-fg-muted"}">${preview}</span>${thread.unread ? `${countBadge(thread.unread, "unread")}<span class="sr-only">${esc(t("(non lue)"))}</span>` : ""}</span>
    </span></a>`;
}

// Bulles : les siennes à la fin (bg-brand-soft), celles de l'autre côté au début (bg-subtle), heure sous chacune, un
// séparateur par jour. « Lu » sous son dernier message quand l'autre côté l'a lu.
function msgBubbles(messages) {
  let lastDay = "";
  const lastMine = messages.reduce((k, m, i) => (m.mine ? i : k), -1);
  const hour = (iso) => { const f = uiIntl("DateTimeFormat", { hour: "2-digit", minute: "2-digit" }); return f ? f.format(new Date(iso)) : iso.slice(11, 16); };
  return messages.map((m, i) => {
    const d = m.at.slice(0, 10), sep = d !== lastDay ? `<li class="my-2 flex justify-center" aria-hidden="true"><span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-fg-subtle">${date(m.at)}</span></li>` : "";
    lastDay = d;
    const seen = i === lastMine && m.read ? ` · ${t("Lu")}` : "";
    return `${sep}<li class="flex flex-col ${m.mine ? "items-end" : "items-start"}">
      ${m.label ? `<span class="mb-1 px-1 text-xs text-fg-subtle">${m.label}</span>` : ""}
      <span class="sr-only">${esc(m.mine ? t("Vous :") : t("Message reçu :"))}</span>
      <p class="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-5 text-fg sm:max-w-[75%] ${m.mine ? "rounded-ee-md bg-brand-soft" : "rounded-es-md bg-subtle"}" dir="auto">${esc(m.body)}</p>
      <span class="mt-1 px-1 text-xs text-fg-subtle"><time datetime="${m.at}">${hour(m.at)}</time>${seen}</span></li>`;
  }).join("");
}

// Zone de saisie : Entrée envoie, Maj + Entrée passe à la ligne (main.js) ; la hauteur suit le texte (data-autogrow).
// note : texte affiché à la place de la saisie (campagne terminée).
const msgComposer = (form, placeholder, note = "") => note
  ? `<div class="border-t border-line bg-subtle px-4 py-3 text-small text-fg-muted">${note}</div>`
  : `<form data-form="${form}" novalidate class="flex items-end gap-2 border-t border-line bg-surface p-3">
      <label class="sr-only" for="${form}-body">${t("Votre message")}</label>
      <textarea id="${form}-body" name="body" rows="1" maxlength="1000" data-autogrow data-send-on-enter placeholder="${esc(placeholder)}" class="${inputCls} h-auto max-h-36 min-h-10 resize-none py-2 leading-5" dir="auto"></textarea>
      <button class="${btn("primary", "md", "shrink-0")}" aria-label="${esc(t("Envoyer"))}">${icon("send", "size-4 rtl:-scale-x-100")}<span class="max-sm:hidden">${t("Envoyer")}</span></button>
    </form>`;

// Conversation : en-tête (back : lien de retour à la liste, mobile), messages (data-msg-scroll : défile jusqu'au dernier
// après chaque affichage, main.js), puis la saisie. empty : contenu affiché tant qu'aucun message n'a été envoyé.
const msgConversation = ({ back, head, actions = "", messages, empty = "", composer }) =>
  `<div class="flex min-h-0 flex-1 flex-col">
    <div class="flex items-center gap-3 border-b border-line px-4 py-3">
      <a href="${back}" class="${iconBtn("sm", false, "-ms-1.5 lg:hidden")}" aria-label="${esc(t("Retour aux conversations"))}">${icon("arrowLeft", "size-4 rtl:-scale-x-100")}</a>
      <div class="flex min-w-0 flex-1 items-center gap-3">${head}</div>${actions}
    </div>
    <div data-msg-scroll class="min-h-0 flex-1 overflow-y-auto px-4 py-4">${messages.length ? `<ol class="grid gap-3" aria-label="${esc(t("Messages"))}">${msgBubbles(messages)}</ol>` : empty}</div>
    ${composer}
  </div>`;

// Page Messages : la liste (avec ses filtres) et la conversation ouverte, dans une carte de hauteur fixe.
function msgLayout({ title, text, filters = "", list, conversation }) {
  const open = !!conversation;
  return `<div class="${open ? "max-lg:hidden" : ""}">${pageHeader(title, text)}</div>
    <section class="${CARD} ${open ? "max-lg:-mt-2" : "mt-6"} lg:mt-6 flex overflow-hidden ${MSG_PANE_H}">
      <div class="${open ? "max-lg:hidden" : "flex"} w-full flex-col border-line lg:flex lg:w-80 lg:shrink-0 lg:border-e xl:w-96">
        ${filters ? `<div class="border-b border-line px-3 py-2.5">${filters}</div>` : ""}
        <div class="min-h-0 flex-1 divide-y divide-line overflow-y-auto">${list}</div>
      </div>
      <div class="${open ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col">${conversation
        || `<div class="grid flex-1 place-items-center">${emptyState("message", t("Choisissez une conversation"), t("Ouvrez une conversation dans la liste pour lire les messages et répondre."), "", { inCard: true })}</div>`}</div>
    </section>`;
}

// Conversation affichée avec des messages non lus : lecture enregistrée (une fois par conversation et par nombre de
// non lus), puis données rechargées (pastilles, notifications de la conversation).
const msgReading = new Set();
function msgAutoRead(thread, payload) {
  if (!thread || !thread.unread) return;
  const key = `${thread.id}:${thread.messages.length}`;
  if (msgReading.has(key)) return;
  msgReading.add(key);
  setTimeout(() => api("POST", "/api/messages/read", payload).then(refresh).then(render).catch(() => {}), 0);
}

// Messages de l'agence (ses campagnes) et de l'équipe (campagnes de ClipBoost) : conversations ouvertes par les clippers,
// filtre « À répondre » (dernier message du clipper), réponse seulement (aucun premier message).
// area : « agence » ou « admin » ; form : formulaire de réponse ; campaignAction : action qui ouvre la fiche de la campagne ;
// filter : filtre courant ("all" | "awaiting"), filterAction : action du filtre.
function msgTeamPage({ area, form, campaignAction, filter, filterAction, title, text, emptyText }) {
  const id = state.route.item || "", all = msgThreads().filter((x) => campaignById(x.campaignId));
  const awaiting = all.filter((x) => x.awaiting), threads = filter === "awaiting" ? awaiting : all;
  const who = (x) => userById(x.clipperId) || { id: x.clipperId, name: t("Clipper"), role: "clipper" };
  const href = (x) => `#/${area}/messages/${encodeURIComponent(x.id)}`;
  const filters = all.length ? segmented(filterAction, filter, [["all", t("Toutes"), all.length], ["awaiting", t("À répondre"), awaiting.length]], t("Filtrer les conversations")) : "";
  const list = threads.length
    ? threads.map((x) => msgThreadItem({ href: href(x), current: x.id === id, thumb: avatar(who(x), "md"), title: esc(who(x).name), sub: esc(campaignById(x.campaignId).title), thread: msgMine(x, false) })).join("")
    : all.length ? emptyState("check", t("Aucune question en attente"), t("Vous avez répondu à tous les clippers."), "", { inCard: true })
      : emptyState("message", t("Aucune conversation"), emptyText, "", { inCard: true });
  let conversation = "";
  if (id) {
    const x = all.find((y) => y.id === id);
    if (!x) conversation = `<div class="grid flex-1 place-items-center">${emptyState("message", t("Conversation introuvable"), t("Cette conversation n'existe pas ou sa campagne a été supprimée."), `<a href="#/${area}/messages" class="${btn("secondary")}">${t("Voir les conversations")}</a>`, { inCard: true })}</div>`;
    else {
      const c = campaignById(x.campaignId), u = who(x), view = msgMine(x, false);
      msgAutoRead(x, { campaignId: x.campaignId, clipperId: x.clipperId });
      // Équipe : plusieurs admins répondent, le nom de l'auteur est rappelé au-dessus de ses messages.
      const messages = area === "admin" ? view.messages.map((m) => (m.mine && m.senderId !== state.session ? { ...m, label: esc((userById(m.senderId) || { name: t("Équipe ClipBoost") }).name) } : m)) : view.messages;
      conversation = msgConversation({
        back: `#/${area}/messages`,
        head: `${avatar(u, "md")}<div class="min-w-0"><p class="truncate text-sm font-semibold text-fg">${esc(u.name)}${u.handle ? ` <span class="font-normal text-fg-subtle" dir="ltr">${esc(u.handle)}</span>` : ""}</p><p class="truncate text-xs text-fg-subtle">${esc(c.title)}</p></div>`,
        actions: `<button type="button" data-action="${campaignAction}" data-id="${c.id}" class="${btn("secondary", "sm", "shrink-0")}">${icon("target", "size-4")}<span class="max-sm:hidden">${t("Voir la campagne")}</span></button>`,
        messages, composer: msgComposer(form, t("Écrivez votre réponse…")),
      });
    }
  }
  return msgLayout({ title, text, filters, list, conversation });
}

// ---------- Classement hebdomadaire (page Classement du clipper et de l'administration) ----------
// db.leaderboard : { week « 2026-W43 », number, start, end (ISO ; fin exclue : lundi 00:00, heure d'Alger), prizes (du 1er
// au 10e, en DA), ranked (clippers classés), top [{ rank, userId, name, avatar, views, prize }] (en direct), me (clipper :
// { rank | null, views }), last (dernière semaine clôturée : { week, number, closedAt, winners [{ rank, userId, name,
// avatar, views, amount }] } | null), history (admin : semaines clôturées, la plus récente d'abord) }.
const lbData = () => db.leaderboard || null;
// Rang ordinal : « 1er », « 2e »… ; anglais « 1st », « 22nd » ; arabe « الأول » … « العاشر », puis le nombre (« المركز 14 »).
const LB_RANKS = () => [t("1er"), t("2e"), t("3e"), t("4e"), t("5e"), t("6e"), t("7e"), t("8e"), t("9e"), t("10e")];
function lbOrdinal(n) {
  if (n >= 1 && n <= 10) return LB_RANKS()[n - 1];
  if (LANG === "en") {
    let cat = "other";
    try { cat = new Intl.PluralRules("en", { type: "ordinal" }).select(n); } catch (e) {}
    return `${fmt(n)}${{ one: "st", two: "nd", few: "rd" }[cat] || "th"}`;
  }
  return t("{n}e", { n: fmt(n) });
}
// Temps restant jusqu'à `iso` : « 3 jours et 5 heures », « 5 heures et 12 minutes », « 8 minutes ».
function lbTimeLeft(iso) {
  const m = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
  if (d) return h ? t("{first} et {second}", { first: plural(d, "jour", "jours"), second: plural(h, "heure", "heures") }) : plural(d, "jour", "jours");
  if (h) return min ? t("{first} et {second}", { first: plural(h, "heure", "heures"), second: plural(min, "minute", "minutes") }) : plural(h, "heure", "heures");
  return plural(min, "minute", "minutes");
}
// Clipper du classement (données publiques seulement) pour avatar().
const lbPerson = (r) => ({ id: r.userId, name: r.name, avatar: r.avatar, role: "clipper" });
// Pastille du rang : or, argent et bronze pour le podium (tons warning, idle, brand), neutre ensuite.
const LB_MEDAL = { 1: "bg-warning-bg text-warning-fg ring-warning-border", 2: "bg-idle-bg text-idle-fg ring-idle-border", 3: "bg-brand-soft text-brand-fg ring-brand-line" };
const lbRankChip = (rank, size = "size-8") =>
  `<span class="grid ${size} shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums ring-1 ring-inset ${LB_MEDAL[rank] || "bg-subtle text-fg-muted ring-line"}" aria-label="${esc(lbOrdinal(rank))}">${fmt(rank)}</span>`;
const lbPrize = (n) => (n ? `<span class="whitespace-nowrap text-sm font-semibold tabular-nums text-income">${da(n)}</span>` : `<span class="text-sm text-fg-subtle">—</span>`);

/**
 * Lignes du classement : rang, photo, nom, vues validées, prime (amountKey : « prize » en direct, « amount » versée).
 * meId : ligne du clipper connecté mise en avant ; name(r) : nom en HTML (échappé, ou lien vers la fiche chez l'admin) ;
 * open : rangs primés encore libres cette semaine (« Place à prendre », avec leur prime).
 */
function lbRows(rows, { meId = "", name = (r) => esc(r.name), amountKey = "prize", open = [] } = {}) {
  const item = (inner, mine = false) => `<li class="flex min-w-0 items-center gap-3 py-3 ${mine ? "-mx-3 rounded-control bg-brand-soft px-3" : ""}">${inner}</li>`;
  return `<ol class="divide-y divide-line">${rows.map((r) => item(`${lbRankChip(r.rank)}${avatar(lbPerson(r), "sm")}
      <div class="min-w-0 flex-1"><p class="flex min-w-0 items-center gap-2 text-sm font-medium text-fg"><span class="min-w-0 truncate">${name(r)}</span>${r.userId === meId ? badge(t("Vous"), "brand") : ""}</p>
        <p class="text-xs tabular-nums text-fg-subtle">${plural(r.views, "vue validée", "vues validées")}</p></div>
      ${lbPrize(r[amountKey])}`, r.userId === meId)).join("")}${open.map((x) => item(`<span class="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-xs font-semibold tabular-nums text-fg-subtle" aria-label="${esc(lbOrdinal(x.rank))}">${fmt(x.rank)}</span>
      <p class="min-w-0 flex-1 truncate text-sm text-fg-subtle">${t("Place à prendre")}</p>${lbPrize(x.prize)}`)).join("")}</ol>`;
}
// Rangs primés sans clipper classé cette semaine (prime non nulle).
const lbOpenRanks = (lb) => lb.prizes.map((prize, i) => ({ rank: i + 1, prize })).filter((x) => x.rank > lb.top.length && x.prize > 0);

// ---------- Académie (leçons des clippers, gérées par l'admin) ----------
// Textes d'une leçon : { fr, en?, ar? } écrits par l'équipe (données, pas des clés de traduction) ; la langue de
// l'interface s'il est traduit, sinon le français. Corps : HTML déjà échappé par le serveur (lessonBodyHtml,
// lib/server/academy.ts), dans les mêmes langues (l.html).
const lsLang = (v) => (v && LANG !== "fr" && v[LANG] && String(v[LANG]).trim() ? LANG : "fr");
const lsText = (v) => (v ? v[lsLang(v)] || v.fr || "" : "");
const lsHtml = (l) => (l.html && l.html[LANG]) || (l.html && l.html.fr) || "";
// Catégories de départ traduites ; une catégorie libre écrite par l'équipe s'affiche telle quelle.
const LS_CATS = { Montage: () => t("Montage"), Accroche: () => t("Accroche"), Formats: () => t("Formats"), Campagnes: () => t("Campagnes") };
const lsCat = (c) => (LS_CATS[c] ? LS_CATS[c]() : esc(c));
const lsMinutes = (n) => t("{n} min", { n: fmt(n) });
// Tuile emoji d'une leçon (cartes, listes, en-tête de la leçon).
const lsTile = (l, size = "md") => `<span class="grid ${THUMB[size]} shrink-0 place-items-center bg-brand-soft" aria-hidden="true">${esc(l.emoji || "🎓")}</span>`;
// Mise en forme du corps (balises p, br, ul, ol, li seulement) : classes posées sur le conteneur.
const LS_BODY = "text-sm leading-6 text-fg-muted [&>*+*]:mt-4 [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5 [&_li]:ps-1 [&_li+li]:mt-1.5 [&_li]:marker:text-brand-fg [&_li]:marker:font-semibold";

