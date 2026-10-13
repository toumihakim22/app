// Utilitaires et composants partagés par toutes les zones du site (formats, icônes, recettes du design system :
// docs/design-system.md §4). Les noms déclarés ici sont réservés : aucun autre fichier de web/src ne les redéclare.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const date = (iso) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}${NB}${MONTHS[+m - 1]}${NB}${y}`; };
// Temps écoulé depuis une date ISO : « À l'instant », « Il y a 5 min », « Hier »…
function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "À l'instant";
  if (s < 3600) return `Il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `Il y a ${Math.floor(s / 3600)} h`;
  if (s < 172800) return "Hier";
  if (s < 604800) return `Il y a ${Math.floor(s / 86400)} j`;
  return date(iso);
}
const initials = (name) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
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

async function handlePasswordSubmit(data) {
  try {
    await api("POST", "/api/auth/password", { current: data.current || "", next: data.next || "" });
    state.pwdError = "";
    render();
    toast("Mot de passe modifié");
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
const da = (n) => `${n < 0 ? MINUS : ""}${fmt(n)}${NB}DA`;                                  // texte brut : phrases, toasts, aria
const daSigned = (n) => `${n > 0 ? "+" : n < 0 ? MINUS : ""}${fmt(n)}${NB}DA`;              // mouvements : historiques, deltas
// Montant HTML en ligne ou en cellule : chiffres tabulaires, « DA » atténué. signed : vert + « + » si positif.
// pending : montant en attente (rétention, recharge non confirmée) : garde le « + » mais reste en text-fg (§3.3).
const money = (n, { signed = false, pending = false, cls = "" } = {}) =>
  `<span class="whitespace-nowrap tabular-nums ${signed && n > 0 && !pending ? "text-income" : "text-fg"} ${cls}">${signed ? (n > 0 ? "+" : n < 0 ? MINUS : "") : n < 0 ? MINUS : ""}${fmt(n)}<span class="font-normal text-fg-subtle">${NB}DA</span></span>`;
// Grand montant (KPI, solde) : chiffres proportionnels, unité plus petite. size : "kpi" | "money".
const BIG = { kpi: ["text-xl font-semibold tracking-tight sm:text-kpi", "text-sm sm:text-base"], money: ["text-[1.875rem] leading-9 font-semibold tracking-[-0.03em] sm:text-money", "text-base sm:text-lg"] };
const bigMoney = (n, size = "kpi") =>
  `<span class="whitespace-nowrap text-fg ${BIG[size][0]}">${n < 0 ? MINUS : ""}${fmt(n)}<span class="font-medium tracking-normal text-fg-subtle ${BIG[size][1]}">${NB}DA</span></span>`;
// Compact (axes, puces, cartes étroites) : 9 800 → « 9 800 » ; 48 200 → « 48,2 k » ; 1 250 000 → « 1,3 M ».
const compact = (n) => {
  const a = Math.abs(n), f = (v, d) => v.toFixed(d).replace(".", ",").replace(/,0$/, "");
  if (a >= 1e6) return `${n < 0 ? MINUS : ""}${f(a / 1e6, a >= 1e7 ? 0 : 1)}${NB}M`;
  if (a >= 1e4) return `${n < 0 ? MINUS : ""}${f(a / 1e3, a >= 1e5 ? 0 : 1)}${NB}k`;
  return `${n < 0 ? MINUS : ""}${fmt(a)}`;
};
const pct = (x) => (x > 0 && x < 1 ? `<${NB}1${NB}%` : `${String(x < 10 && x % 1 ? x.toFixed(1) : Math.round(x)).replace(".", ",")}${NB}%`);
const plural = (n, one, many) => `${fmt(n)}${NB}${Math.abs(n) <= 1 ? one : many}`;
const rate = (r) => `${fmt(r)}${NB}DA / 1${NB}000${NB}vues`;           // forme pleine
const rateShort = (r) => `${fmt(r)}${NB}DA / 1k${NB}vues`;              // puces et cartes uniquement
const code = (s) => `<span class="font-mono text-[0.92em] tracking-wide">${esc(s)}</span>`;
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
};
const icon = (name, cls = "size-5", fill = false) =>
  `<svg viewBox="0 0 24 24" class="${cls}" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true" focusable="false">${icons[name] || ""}</svg>`;

// Événements (notifications, activité) : la base stocke un emoji, l'interface affiche une icône au trait.
const EVENT_ICON = { "✅": ["check", "bg-success-bg text-success-fg"], "🚫": ["ban", "bg-danger-bg text-danger-fg"], "⛔": ["ban", "bg-danger-bg text-danger-fg"], "⚠": ["alert", "bg-warning-bg text-warning-fg"],
  "⏳": ["clock", "bg-muted text-fg-muted"], "⚙": ["gear", "bg-muted text-fg-muted"], "🎬": ["film", "bg-muted text-fg-muted"], "🎯": ["target", "bg-muted text-fg-muted"],
  "🏁": ["flag", "bg-muted text-fg-muted"], "🏢": ["building", "bg-muted text-fg-muted"], "🏦": ["bank", "bg-muted text-fg-muted"], "💰": ["wallet", "bg-muted text-fg-muted"], "💸": ["wallet", "bg-muted text-fg-muted"] };
const eventIcon = (emoji) => {
  const [ic, tone] = EVENT_ICON[String(emoji || "").replace(/️/g, "")] || ["bell", "bg-muted text-fg-muted"];
  return `<span class="grid size-8 shrink-0 place-items-center rounded-full ${tone}" aria-hidden="true">${icon(ic, "size-4")}</span>`;
};

// Drapeau algérien (SVG, jamais d'emoji : Windows n'affiche pas les drapeaux emoji).
const flagDz = (cls = "h-3 w-[18px]") =>
  `<svg viewBox="0 0 30 20" class="${cls} shrink-0 rounded-[2px] ring-1 ring-fg/10" role="img" aria-label="Algérie"><rect width="15" height="20" fill="#006233"/><rect x="15" width="15" height="20" fill="#ffffff"/><mask id="dz-crescent"><rect width="30" height="20" fill="#fff"/><circle cx="16.25" cy="10" r="4" fill="#000"/></mask><circle cx="15" cy="10" r="5" fill="#d21034" mask="url(#dz-crescent)"/><polygon fill="#d21034" points="15.50,10.00 16.91,9.50 16.95,8.00 17.86,9.19 19.30,8.77 18.45,10.00 19.30,11.23 17.86,10.81 16.95,12.00 16.91,10.50"/></svg>`;

// ---------- Logo ----------
// logo() sur surface ; logo({ tone: "text-on-brand" }) sur bg-night ; logo({ wordmark: false }) : symbole seul.
// Compatibilité : logo(true) = version claire sur fond sombre.
function logo(opts = {}) {
  const o = typeof opts === "boolean" ? { tone: opts ? "text-on-brand" : "text-fg" } : opts;
  const { wordmark = true, tone = "text-fg", size = "md", href = "/" } = o;
  const S = { md: ["size-9 rounded-tile", "text-[1.375rem]"], sm: ["size-8 rounded-[10px]", "text-[1.125rem]"] }[size];
  return `<a href="${href}" class="inline-flex items-center gap-2.5 rounded-control" aria-label="ClipBoost, retour au site">
    <span class="grid ${S[0]} shrink-0 place-items-center bg-brand text-on-brand">${icon("play", "size-[18px] translate-x-px", true)}</span>
    ${wordmark ? `<span class="inline-block -skew-x-6 font-display ${S[1]} font-extrabold leading-none tracking-[-0.03em] ${tone}" aria-hidden="true">ClipBoost</span>` : ""}</a>`;
}

// ---------- Classes de base ----------
const cx = (...a) => a.filter(Boolean).join(" ");
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
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
const selectCls = `${inputCls} cursor-pointer appearance-none pr-9`;
const CHEVRON = icon("chevronDown", "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle");

// select(name, value, options[[v, l]], { label, cls }) ; 4e argument texte = classes du conteneur (compatibilité).
function select(name, value, options, opts = {}) {
  const o = typeof opts === "string" ? { cls: opts } : opts;
  return `<label class="relative block ${o.cls || ""}">${o.label ? `<span class="sr-only">${esc(o.label)}</span>` : ""}<select data-input="${name}" class="${selectCls}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>${CHEVRON}</label>`;
}
// Compatibilité : un 3e argument (ancien `cls`) ou { invalid } ; un champ en erreur porte aria-invalid="true".
const countrySelect = (name, value, opts = {}) =>
  `<span class="relative block"><select name="${name}" class="${selectCls}"${(typeof opts === "string" ? /rose|danger|invalid/.test(opts) : opts.invalid) ? ' aria-invalid="true"' : ""}>${COUNTRIES.map((c) => `<option${c === value ? " selected" : ""}>${esc(c)}</option>`).join("")}</select>${CHEVRON}</span>`;
// Champ numérique avec unité en suffixe (DA, %, jours, vues). attrs : attributs bruts de l'input.
const unitInput = (attrs, unit, { lg = false } = {}) =>
  `<span class="relative block"><input ${attrs} inputmode="numeric" class="${inputCls} ${lg ? inputLg : ""} ${unit.length > 3 ? "pr-16" : "pr-12"} tabular-nums"/><span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-fg-subtle">${unit}</span></span>`;
// Bouton « Effacer » maison (la croix native de WebKit est masquée dans web/styles.css) : visible dès que le champ n'est plus vide.
const searchInput = (name, value, placeholder, label, cls = "") =>
  `<label class="relative block ${cls}"><span class="sr-only">${esc(label)}</span>${icon("search", "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle")}<input data-input="${name}" type="search" value="${esc(value)}" placeholder="${esc(placeholder)}" class="peer ${inputCls} pl-9 pr-10 md:pr-9"/><span class="absolute inset-y-0 right-0 flex items-center pr-0 peer-placeholder-shown:hidden md:pr-1"><button type="button" data-action="clear-search" data-value="${name}" class="${iconBtn("sm", false, "text-fg-subtle")}" aria-label="Effacer la recherche">${icon("close")}</button></span></label>`;
// field(libellé, champ, aide, erreur) : l'erreur remplace l'aide ; poser aria-invalid="true" sur le champ en erreur.
// L'aide et l'erreur restent hors du <label> : elles ne s'ajoutent pas au nom accessible du champ.
const field = (label, input, hint = "", error = "") =>
  `<div class="grid gap-1.5" data-field><label class="contents"><span class="text-small font-medium text-fg">${label}</span>${input}</label>${error
    ? `<span class="flex items-center gap-1 text-xs font-medium text-danger-fg" role="alert">${icon("alert", "size-3.5 shrink-0")}${error}</span>`
    : hint ? `<span class="text-xs text-fg-subtle">${hint}</span>` : ""}</div>`;
const OPTIONAL = `<span class="font-normal text-fg-subtle">(facultatif)</span>`;
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
  `<button type="button" role="switch" aria-checked="${on}" data-action="${action}" data-key="${key}" aria-label="${esc(label)}" class="group relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full bg-line-control transition-colors duration-150 ease-standard after:absolute after:-inset-2 aria-checked:bg-brand ${FOCUS}"><span class="pointer-events-none ml-0.5 size-5 rounded-full bg-on-brand shadow-control transition-transform duration-150 ease-standard group-aria-checked:translate-x-4"></span></button>`;

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
const statusBadge = (s) => badge(esc(s), STATUS_TONE[s] || "idle", s === "En pause" ? { ic: "pause" } : { dot: true });
const PLATFORM_ICON = { TikTok: "tiktok", Instagram: "instagram", YouTube: "youtube" };
const platformTag = (p) => `<span class="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-badge bg-muted px-2 text-xs font-medium text-fg-muted">${icon(PLATFORM_ICON[p] || "film", "size-3.5")}${esc(p)}</span>`;
// Liseré : brand-soft et info-bg se confondent avec le fond canvas en clair (même correction que countBadge).
const roleBadge = (role) => ({ agence: `<span class="inline-flex h-5 items-center rounded-[4px] bg-info-bg px-1.5 text-micro font-semibold text-info-fg ring-1 ring-inset ring-info-border">Agence</span>`, admin: `<span class="inline-flex h-5 items-center rounded-[4px] bg-brand-soft px-1.5 text-micro font-semibold text-brand-fg ring-1 ring-inset ring-brand-line/70">Admin</span>` }[role] || "");
// queue : liseré brand-line, sinon la pastille brand-soft se confond avec le fond canvas en clair.
const COUNT = { queue: "bg-brand-soft text-brand-fg ring-1 ring-inset ring-brand-line/70", unread: "bg-brand text-on-brand", total: "bg-muted text-fg-muted" };
const countBadge = (n, tone = "queue") => `<span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${COUNT[tone]}">${fmt(n)}</span>`;

// ---------- Filtres : segmented (2 à 5 choix), chips (au-delà, défilable) ----------
// options : "Libellé" | [valeur, libellé] | [valeur, libellé, compteur]
const opt = (o) => (Array.isArray(o) ? o : [o, o]);
// segmented(…, { scroll: true }) : filtre de statut ; sous sm il devient une rangée de puces défilante bord à bord
// (comme chips), pour qu'aucune option ne soit rognée dans le cadre ; à partir de sm, le contrôle segmenté.
const SEG_WRAP = "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-control border border-line bg-subtle p-0.5 [scrollbar-width:none]";
const SEG_WRAP_SCROLL = "max-sm:-mx-4 max-sm:flex max-sm:max-w-none max-sm:gap-2 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:px-4 max-sm:pb-1";
const SEG_BTN = `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-small font-medium text-fg-muted transition-colors duration-150 hover:text-fg aria-pressed:bg-surface-raised aria-pressed:text-fg aria-pressed:shadow-control md:h-8 ${FOCUS}`;
const SEG_BTN_SCROLL = "max-sm:rounded-full max-sm:border max-sm:border-line-strong max-sm:bg-surface max-sm:px-3.5 max-sm:aria-pressed:border-brand-line max-sm:aria-pressed:bg-brand-soft max-sm:aria-pressed:text-brand-fg max-sm:aria-pressed:shadow-none";
const segmented = (name, value, options, label = "Filtrer", { scroll = false } = {}) =>
  `<div class="${SEG_WRAP} ${scroll ? SEG_WRAP_SCROLL : ""}" role="group" aria-label="${esc(label)}">${options.map((o) => {
    const [v, l, n] = opt(o);
    return `<button type="button" data-action="${name}" data-value="${esc(v)}" aria-pressed="${String(v) === String(value)}" class="${SEG_BTN} ${scroll ? SEG_BTN_SCROLL : ""}">${esc(l)}${n !== undefined ? `<span class="tabular-nums ${scroll ? "text-fg-subtle max-sm:text-current" : "text-fg-subtle"}">${fmt(n)}</span>` : ""}</button>`;
  }).join("")}</div>`;
const pills = segmented; // compatibilité
const chips = (name, value, options, label = "Filtrer") =>
  `<div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" role="group" aria-label="${esc(label)}">${options.map((o) => {
    const [v, l, n] = opt(o);
    return `<button type="button" data-action="${name}" data-value="${esc(v)}" aria-pressed="${String(v) === String(value)}" class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-small font-medium text-fg-muted transition-colors hover:border-line-control hover:text-fg aria-pressed:border-brand-line aria-pressed:bg-brand-soft aria-pressed:text-brand-fg md:h-8 ${FOCUS}">${esc(l)}${n !== undefined ? `<span class="tabular-nums">${fmt(n)}</span>` : ""}</button>`;
  }).join("")}</div>`;
// Onglets soulignés (sections d'une même page).
const TABLIST = "flex gap-6 border-b border-line";
const TAB = `-mb-px inline-flex h-10 items-center gap-2 border-b-2 border-transparent text-sm font-medium text-fg-muted transition-colors hover:text-fg aria-selected:border-brand aria-selected:text-fg ${FOCUS}`;

// ---------- En-têtes, état vide, progression ----------
const pageHeader = (title, text, action = "") =>
  `<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0"><h1 class="text-title-sm text-fg sm:text-title">${title}</h1>${text ? `<p class="mt-1 max-w-2xl text-sm text-fg-muted">${text}</p>` : ""}</div>
    ${action ? `<div class="flex shrink-0 flex-wrap items-center gap-2">${action}</div>` : ""}</div>`;
const sectionHeader = (title, href = "", link = "Tout voir") =>
  `<div class="mb-3 mt-8 flex items-end justify-between gap-3"><h2 class="text-heading text-fg">${title}</h2>${href ? `<a href="${href}" class="inline-flex items-center gap-1 rounded-sm text-small font-medium text-brand-fg underline-offset-4 hover:underline ${FOCUS}">${link}${icon("chevronRight", "size-3.5")}</a>` : ""}</div>`;
// emptyState(icône, titre, texte, action HTML, { inCard }) : inCard = à l'intérieur d'une carte existante (pas de bordure).
const emptyState = (ic, title, text = "", action = "", { inCard = false } = {}) =>
  `<div class="flex flex-col items-center justify-center px-6 text-center ${inCard ? "py-10" : "rounded-card border border-dashed border-line-strong bg-surface py-12"}">
    <span class="grid size-10 place-items-center rounded-full bg-muted text-fg-subtle">${icon(ic, "size-5")}</span>
    <p class="mt-3 text-sm font-semibold text-fg">${title}</p>${text ? `<p class="mt-1 max-w-sm text-small text-fg-muted">${text}</p>` : ""}${action ? `<div class="mt-4">${action}</div>` : ""}</div>`;
// progress(dépensé, budget, { label, aria }) : violet ; ≥ 85 % ambre ; 100 % gris. Jamais rouge.
function progress(spent, budget, { label = true, aria = "Budget utilisé" } = {}) {
  const p = budget ? (spent / budget) * 100 : 0;
  const fill = p >= 100 ? "bg-idle-solid" : p >= 85 ? "bg-warning-solid" : "bg-brand";
  return `<div>${label ? `<div class="mb-1.5 flex items-baseline justify-between gap-3 text-xs tabular-nums text-fg-subtle"><span><span class="font-medium text-fg">${fmt(spent)}</span> / ${da(budget)}</span><span>${pct(p)}</span></div>` : ""}
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(100, p))}" aria-label="${esc(aria)}">
      <div class="h-full rounded-full ${fill} transition-[width] duration-300 ease-standard" style="width:${p > 0 ? `max(3px, ${Math.min(100, p).toFixed(1)}%)` : "0"}"></div></div></div>`;
}

// ---------- Couvertures de campagne (catégorie → teinte, voir .cover dans app/theme.css) ----------
const coverAttr = (c) => `data-cat="${CATEGORIES.includes(c.category) ? c.category : "Autre"}"`;
const THUMB = { xs: "size-5 rounded-[4px] text-[11px]", sm: "size-10 rounded-tile text-lg", md: "size-12 rounded-tile text-2xl", lg: "size-14 rounded-tile text-2xl" };
const coverThumb = (c, size = "sm") => `<span class="cover grid ${THUMB[size]} shrink-0 place-items-center" ${coverAttr(c)} aria-hidden="true">${c.emoji}</span>`;

// ---------- Avatar : 6 fonds AA (texte blanc ≥ 5:1), admin = violet ----------
const AVATARS = ["bg-avatar-1", "bg-avatar-2", "bg-avatar-3", "bg-avatar-4", "bg-avatar-5", "bg-avatar-6"];
const AVATAR_SIZE = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-9 text-small", lg: "size-16 text-xl", xl: "size-20 text-2xl" };
function avatar(u, size = "md") {
  const tone = u.role === "admin" ? "bg-avatar-1" : AVATARS[[...String(u.id)].reduce((h, ch) => h + ch.charCodeAt(0), 0) % AVATARS.length];
  return `<span class="inline-grid ${AVATAR_SIZE[size] || size} shrink-0 select-none place-items-center rounded-full font-semibold text-on-brand ${tone}" aria-hidden="true">${esc(initials(u.name))}</span>`;
}

// ---------- Tableau (≥ md) et liste (< md) dans le même conteneur ----------
const TBL = {
  // relative : les .sr-only (position absolue) des en-têtes restent dans le cadre et ne créent pas de défilement de page.
  wrap: "relative overflow-hidden rounded-card border border-line bg-surface shadow-card",
  table: "hidden w-full border-collapse text-sm md:table",
  headRow: "bg-subtle",
  th: "h-9 whitespace-nowrap px-4 text-left align-middle text-xs font-medium text-fg-subtle first:pl-5 last:pr-5",
  thNum: "text-right",
  tr: "border-t border-line transition-colors duration-150 hover:bg-subtle/70",
  td: "h-14 px-4 py-2 align-middle text-fg first:pl-5 last:pr-5",
  tdNum: "text-right font-medium tabular-nums whitespace-nowrap",
  tdSub: "mt-0.5 block text-xs text-fg-subtle",
  tdActions: "w-px whitespace-nowrap text-right",
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
        <button type="button" data-action="close-modal" class="${iconBtn("sm", false, "-mr-1.5 -mt-0.5")}" aria-label="Fermer">${icon("close")}</button>
      </header>` : `<button type="button" data-action="close-modal" class="${iconBtn("sm", false, "absolute right-3 top-3 z-10")}" aria-label="Fermer">${icon("close")}</button>`}
      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">${body}</div>
      ${footer ? `<footer class="flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:pb-3.5">${footer}</footer>` : ""}
    </${tag}></div>`;
}
// Récapitulatifs en direct : chaque fichier de zone enregistre LIVE.nom = (data) => html au niveau supérieur.
const LIVE = {};
// Récapitulatif d'argent (au-dessus du pied des modales qui touchent à l'argent).
// rows : [[libellé, valeurHTML, fort?]] ; la ligne forte est séparée par un trait.
const summary = (rows) =>
  `<dl class="mt-5 grid gap-2 rounded-tile bg-subtle p-4 text-sm">${rows.map(([l, v, strong]) => `<div class="flex items-baseline justify-between gap-4 ${strong ? "mt-1 border-t border-line pt-3 font-semibold text-fg" : "text-fg-muted"}"><dt>${l}</dt><dd class="tabular-nums text-right ${strong ? "" : "text-fg"}">${v}</dd></div>`).join("")}</dl>`;
// Alerte en ligne : alert("info" | "warning" | "danger" | "success", texteHTML)
const ALERT_ICON = { info: "info", warning: "alert", danger: "alert", success: "check" };
const alertBox = (tone, html) =>
  `<div class="flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-sm ${TONE[tone]}" role="${tone === "danger" ? "alert" : "note"}">${icon(ALERT_ICON[tone], "mt-0.5 size-4 shrink-0")}<div class="min-w-0">${html}</div></div>`;

// ---------- Carte « Compte et connexion » (Profil clipper et Profil agence) ----------
function accountCard(u) {
  const pe = state.pwdError;
  return card(`${cardHeader("Compte et connexion")}
    <div class="mt-4 flex items-center gap-3 rounded-tile bg-subtle p-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-tile border border-line bg-surface text-fg-muted">${icon("mail", "size-[18px]")}</span>
      <p class="min-w-0 flex-1 truncate text-sm font-medium text-fg">${esc(u.email)}</p>${badge("Vérifié", "success", { ic: "check" })}</div>
    <form data-form="password" class="mt-5 grid gap-4" novalidate>
      ${pe ? alertBox("danger", esc(pe)) : ""}
      ${field("Mot de passe actuel", `<input name="current" type="password" autocomplete="current-password" class="${inputCls}"${pe ? ' aria-invalid="true"' : ""}/>`)}
      ${field("Nouveau mot de passe", `<input name="next" type="password" autocomplete="new-password" class="${inputCls}"/>`, "8 caractères minimum, avec au moins une lettre et un chiffre.")}
      <button class="${btn("secondary", "md", "w-full")}">Changer le mot de passe</button>
    </form>
    <button type="button" data-action="logout" class="${btn("dangerSoft", "md", "mt-3 w-full")}">${icon("logout")}Se déconnecter</button>`);
}

// ---------- Bandeau du site, bascule de thème ----------
function siteBanner() {
  const s = db.settings, parts = [];
  if (s.maintenance) parts.push(`<div class="flex items-center justify-center gap-2 border-b border-warning-border bg-warning-bg px-4 py-2 text-center text-small font-medium text-warning-fg">${icon("alert", "size-4 shrink-0")}Le site est en maintenance : les connexions des clippers et des agences sont temporairement suspendues.</div>`);
  if (s.announcement) parts.push(`<div class="flex items-center justify-center gap-2 border-b border-brand-line bg-brand-soft px-4 py-2 text-center text-small font-medium text-brand-fg">${icon("megaphone", "size-4 shrink-0")}${esc(s.announcement)}</div>`);
  return parts.join("");
}
const themeToggle = (cls = "") =>
  `<button type="button" data-theme-toggle class="${iconBtn("md", false, cls)}" aria-label="Changer de thème (clair ou sombre)">
    <svg viewBox="0 0 24 24" class="dark:hidden" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    <svg viewBox="0 0 24 24" class="hidden dark:block" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
  </button>`;

// ---------- Graphiques (voir §6) ----------
const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
const seriesDates = (n, end = new Date()) => Array.from({ length: n }, (_, i) => new Date(end.getFullYear(), end.getMonth(), end.getDate() - (n - 1 - i)));
// Graduation : même unité sur tout l'axe (« 5 k » à côté de « 10 k », jamais « 5 000 »).
const axisTick = (t, max) => (t && max >= 1e4 && max < 1e6 ? `${String(+(t / 1e3).toFixed(1)).replace(".", ",")}${NB}k` : compact(t));
const dayLabel = (d) => `${d.getDate()}${NB}${MONTHS[d.getMonth()]}`;

// barChart(valeursJournalières, { tone: "income" | "brand", unit: "DA" | libellé singulier, unitPlural, integer, h, caption })
function barChart(values, { tone = "income", unit = "DA", unitPlural = "", integer = false, h = "h-44", caption = "" } = {}) {
  const n = values.length, peak = Math.max(0, ...values);
  const max = integer ? Math.max(1, Math.ceil(niceMax(peak))) : niceMax(peak);
  const dates = seriesDates(n), bar = tone === "income" ? "bg-chart-income" : "bg-chart-brand";
  const fv = (v) => (unit === "DA" ? da(v) : plural(v, unit, unitPlural || `${unit}s`));
  const ticks = integer && max < 4 ? [max, 0] : [max, max / 2, 0];
  return `<figure class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
    <div class="${h} flex flex-col justify-between text-right text-micro leading-none tabular-nums text-fg-subtle" aria-hidden="true">${ticks.map((t) => `<span>${axisTick(t, max)}</span>`).join("")}</div>
    <div class="relative ${h} border-b border-chart-axis bg-[linear-gradient(to_bottom,var(--color-chart-grid)_1px,transparent_1px)] bg-[size:100%_50%]" aria-hidden="true">
      <div class="absolute inset-0 flex items-end gap-[2px] px-0.5">${values.map((v, i) =>
        `<span class="flex h-full min-w-0 flex-1 items-end justify-center" title="${dayLabel(dates[i])} · ${fv(v)}">${v > 0 ? `<span class="w-full max-w-6 rounded-t-[3px] ${bar}" style="height:max(2px, ${((v / max) * 100).toFixed(2)}%)"></span>` : ""}</span>`).join("")}</div>
    </div>
    <span></span>
    <div class="mt-2 flex justify-between text-micro tabular-nums text-fg-subtle" aria-hidden="true"><span>${dayLabel(dates[0])}</span><span>${dayLabel(dates[Math.floor((n - 1) / 2)])}</span><span>Auj.</span></div>
    <table class="sr-only"><caption>${esc(caption)}</caption>${values.map((v, i) => (v ? `<tr><th>${dayLabel(dates[i])}</th><td>${fv(v)}</td></tr>` : "")).join("")}</table>
  </figure>`;
}

// cumulativeChart(valeursJournalières, { h, label, end, onNight }) : courbe verte du cumul (monotone, sans dépassement).
// end : affiche la valeur finale au-dessus du point. onNight : variante sur bg-night (panneau auth, CTA final).
function cumulativeChart(daily, { h = "h-24", label = "Gains cumulés", end = true, onNight = false } = {}) {
  let s = 0; const cum = (daily.length > 1 ? daily : [0, ...daily, 0].slice(0, 2)).map((v) => (s += v));
  const max = niceMax(Math.max(...cum, 1)), W = 300, H = 100, step = W / Math.max(1, cum.length - 1);
  const pts = cum.map((v, i) => [i * step, H - (v / max) * (H - 6)]);
  let d = `M ${pts[0][0]} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], m = (x0 + x1) / 2; d += ` C ${m} ${y0.toFixed(2)}, ${m} ${y1.toFixed(2)}, ${x1} ${y1.toFixed(2)}`; }
  const [ex, ey] = pts.at(-1);
  const stroke = onNight ? "stroke-night-income" : "stroke-chart-income", fill = onNight ? "fill-night-income/15" : "fill-chart-income/12", dot = onNight ? "bg-night-income ring-night" : "bg-chart-income ring-surface";
  return `<div class="relative ${h}" role="img" aria-label="${esc(`${label} : ${da(s)} sur ${daily.length} jours`)}">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="absolute inset-0 size-full overflow-visible" aria-hidden="true">
      <path d="${d} L ${W} ${H} L 0 ${H} Z" class="${fill}"/>
      <path d="${d}" class="fill-none ${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
    <span class="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ${dot}" style="left:${((ex / W) * 100).toFixed(2)}%;top:${((ey / H) * 100).toFixed(2)}%"></span>
    ${end && !onNight ? `<span class="absolute right-0 -translate-y-[calc(100%+8px)] text-small font-semibold tabular-nums text-fg" style="top:${((ey / H) * 100).toFixed(2)}%">${da(s)}</span>` : ""}
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
