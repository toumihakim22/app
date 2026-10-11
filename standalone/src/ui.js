// Utilitaires et composants partagés par toutes les zones du site.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const da = (n) => `${n < 0 ? "− " : ""}${fmt(n)} DA`;
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const date = (iso) => { const [y, m, d] = iso.split("-"); return `${d} ${MONTHS[+m - 1]} ${y}`; };
const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const initials = (name) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const campaignById = (id) => db.campaigns.find((c) => c.id === id);
const userById = (id) => db.users.find((u) => u.id === id);
const rawEarnings = (p) => (p.views / 1000) * campaignById(p.campaign).rate;
// Sous le seuil minimum, un clip ne rapporte rien ; au-delà du plafond, ses gains s'arrêtent.
const belowMin = (p) => rawEarnings(p) < (campaignById(p.campaign).minPayout || 0);
const isCapped = (p) => rawEarnings(p) >= (campaignById(p.campaign).maxPayout || Infinity);
const payoutOf = (p) => (belowMin(p) ? 0 : Math.min(rawEarnings(p), campaignById(p.campaign).maxPayout || Infinity));
const earningsOf = (p) => (p.status === "Validée" ? payoutOf(p) : 0);
const viewsFor = (c, amount) => Math.ceil((amount / c.rate) * 1000);
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

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
};
const icon = (name, cls = "h-5 w-5", fill = false) =>
  `<svg viewBox="0 0 24 24" class="${cls}" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${icons[name]}</svg>`;

const logo = (dark = false) => `<a href="#/" class="flex items-center gap-2" aria-label="ClipBoost, retour au site">
  <span class="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">${icon("play", "h-5 w-5", true)}</span>
  <span class="text-2xl font-black italic tracking-tight ${dark ? "text-white" : "text-ink"}">ClipBoost</span></a>`;

let chartSeq = 0;
function areaChart(values, { h = 120, color = "#0f766e" } = {}) {
  const id = `g${++chartSeq}`;
  const w = 320, max = Math.max(...values, 1), step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, h - (v / max) * (h - 10)]);
  let line = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2;
    line += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="h-full w-full" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.2"/><stop offset="100%" stop-color="${color}" stop-opacity="0.02"/></linearGradient></defs>
    <path d="${line} L ${w} ${h} L 0 ${h} Z" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>`;
}

const card = (inner, cls = "") => `<div class="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 ${cls}">${inner}</div>`;

function statusBadge(status) {
  const map = {
    "En cours": "bg-amber-50 text-amber-600", "En attente": "bg-amber-50 text-amber-600", "En pause": "bg-amber-50 text-amber-600",
    "Validé": "bg-emerald-50 text-emerald-600", "Validée": "bg-emerald-50 text-emerald-600", "Active": "bg-emerald-50 text-emerald-600", "Actif": "bg-emerald-50 text-emerald-600",
    "Refusée": "bg-rose-50 text-rose-600", "Refusé": "bg-rose-50 text-rose-600", "Suspendu": "bg-rose-50 text-rose-600",
    "Terminée": "bg-gray-100 text-gray-500",
  };
  return `<span class="whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ${map[status] || "bg-gray-100 text-gray-600"}">${status}</span>`;
}

const select = (name, value, options, cls = "") =>
  `<select data-input="${name}" class="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 ${cls}">
    ${options.map(([v, l]) => `<option value="${v}" ${v === value ? "selected" : ""}>${l}</option>`).join("")}</select>`;

const pills = (name, value, options) =>
  `<div class="flex gap-2 overflow-x-auto pb-1">${options.map((o) => `<button type="button" data-action="${name}" data-value="${o}" aria-pressed="${o === value}" class="shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${o === value ? "bg-ink text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-ink"}">${o}</button>`).join("")}</div>`;

const pageHeader = (title, text, action = "") =>
  `<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">${title}</h1>${text ? `<p class="mt-1 text-gray-500">${text}</p>` : ""}</div>${action}</div>`;

const field = (label, input, hint = "") =>
  `<label class="block text-sm"><span class="font-medium text-gray-700">${label}</span>${input}${hint ? `<span class="mt-1 block text-xs text-gray-500">${hint}</span>` : ""}</label>`;
const inputCls = "mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

const switchBtn = (on, action, key, label) =>
  `<button type="button" role="switch" aria-checked="${on}" data-action="${action}" data-key="${key}" aria-label="${label}" class="relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-brand-600" : "bg-gray-200"}"><span class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}"></span></button>`;

function avatar(u, size = "h-9 w-9 text-sm") {
  const colors = ["bg-brand-600", "bg-rose-400", "bg-amber-400", "bg-emerald-500", "bg-sky-500", "bg-fuchsia-500"];
  return `<span class="grid ${size} shrink-0 place-items-center rounded-full font-bold text-white ${u.role === "admin" ? "bg-brand-700" : colors[u.id % colors.length]}">${initials(u.name)}</span>`;
}

function toast(msg) {
  const box = document.getElementById("toasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = "toast-in pointer-events-auto rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl";
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function copy(text, msg) {
  try { navigator.clipboard && navigator.clipboard.writeText(text).catch(() => {}); } catch (e) {}
  toast(msg);
}

function notify(userId, icon, text) {
  db.notifications.unshift({ id: Date.now() + Math.random(), userId, icon, text, time: "À l'instant", unread: true });
}

function logActivity(icon, text) {
  db.activity.unshift({ icon, text, time: `Aujourd'hui, ${nowTime()}` });
}

function modalShell(body, size = "max-w-lg") {
  return `<div class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" data-action="close-modal">
    <div class="relative max-h-[92vh] w-full ${size} overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" role="dialog" aria-modal="true" data-stop>
      <button type="button" data-action="close-modal" class="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-gray-500 shadow-sm hover:text-ink" aria-label="Fermer">${icon("close", "h-4 w-4")}</button>
      ${body}
    </div></div>`;
}

function siteBanner() {
  const s = db.settings, parts = [];
  if (s.maintenance) parts.push(`<div class="bg-rose-600 px-4 py-2 text-center text-sm font-semibold text-white">🛠️ Le site est en maintenance : les connexions des clippers et des agences sont temporairement suspendues.</div>`);
  if (s.announcement) parts.push(`<div class="bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white">📣 ${esc(s.announcement)}</div>`);
  return parts.join("");
}

// Bouton clair / sombre : géré globalement (voir landing.js), l'icône suit la classe .dark.
const themeToggle = (cls = "") =>
  `<button type="button" data-theme-toggle class="grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-gray-200 hover:bg-gray-50 ${cls}" aria-label="Changer de thème (clair ou sombre)" title="Mode clair / sombre">
    <svg viewBox="0 0 24 24" class="theme-moon h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    <svg viewBox="0 0 24 24" class="theme-sun h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
  </button>`;

const countrySelect = (name, value, cls = inputCls) =>
  `<select name="${name}" class="${cls}">${COUNTRIES.map((c) => `<option ${c === value ? "selected" : ""}>${c}</option>`).join("")}</select>`;

// Carte « Compte et connexion » partagée par les espaces Clipper et Agence.
function accountCard(u) {
  const pe = state.pwdError;
  return card(`<p class="font-bold">Compte et connexion</p>
    <div class="mt-4 flex items-center gap-3 rounded-2xl bg-gray-50 p-4"><span class="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-gray-100">${icon("mail")}</span>
      <div class="min-w-0 flex-1"><p class="truncate font-semibold">${esc(u.email)}</p><p class="text-xs ${u.verified ? "text-emerald-600" : "text-amber-600"}">${u.verified ? "✓ Email vérifié" : "Email non vérifié"}</p></div></div>
    <form data-form="password" class="mt-5 space-y-3" novalidate>
      ${pe ? `<p class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">${pe}</p>` : ""}
      ${field("Mot de passe actuel", `<input name="current" type="password" autocomplete="current-password" class="${inputCls}"/>`)}
      ${field("Nouveau mot de passe", `<input name="next" type="password" autocomplete="new-password" class="${inputCls}"/>`, "8 caractères minimum.")}
      <button class="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-white hover:bg-black">Changer le mot de passe</button>
    </form>
    <button type="button" data-action="logout" class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-rose-600 ring-1 ring-rose-100 hover:bg-rose-50">${icon("logout", "h-4 w-4")} Se déconnecter</button>`);
}

function handlePasswordSubmit(data) {
  const u = userById(state.session);
  if (data.current !== u.password) state.pwdError = "Le mot de passe actuel est incorrect.";
  else if ((data.next || "").length < 8) state.pwdError = "Le nouveau mot de passe doit faire au moins 8 caractères.";
  else { u.password = data.next; state.pwdError = ""; render(); return toast("Mot de passe modifié ✓"); }
  render();
}

const homeOf = (u) => ({ admin: "#/admin/apercu", agence: "#/agence/apercu", clipper: "#/clipper/accueil" }[u.role]);
