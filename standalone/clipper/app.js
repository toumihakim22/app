// ClipBoost — Espace Clipper (version HTML autonome).
// Toutes les données sont fictives et ne vivent qu'en mémoire : rien n'est envoyé ni enregistré.
(function () {
  "use strict";

  // ---------- Données fictives ----------

  const CATEGORIES = ["Sport", "Food", "Tech", "Mode", "Musique", "Humour"];

  const campaigns = [
    { id: "derby", title: "Derby Algérois", brand: "Tassili Sport", category: "Sport", rate: 150, budget: 600000, spent: 412000, clippers: 86, createdAt: "2026-10-02", top: true, gradient: "from-emerald-400 via-teal-500 to-cyan-600", emoji: "⚽", platforms: ["TikTok", "Instagram", "YouTube"], rules: ["Clip de 15 à 60 secondes", "Mentionner @tassilisport", "Pas de musique protégée"] },
    { id: "kahwa", title: "Kahwa du matin", brand: "Kahwa Lounge", category: "Food", rate: 110, budget: 250000, spent: 98000, clippers: 41, createdAt: "2026-09-28", gradient: "from-amber-300 via-orange-400 to-rose-500", emoji: "☕", platforms: ["TikTok", "Instagram"], rules: ["Montrer le produit dans les 3 premières secondes", "Ajouter #KahwaDuMatin"] },
    { id: "sahara", title: "Unboxing Sahara X", brand: "Sahara Tech", category: "Tech", rate: 130, budget: 400000, spent: 301000, clippers: 63, createdAt: "2026-09-25", top: true, gradient: "from-sky-400 via-indigo-500 to-violet-600", emoji: "📱", platforms: ["YouTube", "TikTok"], rules: ["Format vertical 9:16", "Afficher le logo Sahara X", "Durée minimale 20 secondes"] },
    { id: "casbah", title: "Casbah Street Food", brand: "Casbah Food", category: "Food", rate: 120, budget: 180000, spent: 45000, clippers: 22, createdAt: "2026-09-20", gradient: "from-red-400 via-orange-500 to-yellow-400", emoji: "🥙", platforms: ["TikTok", "Instagram"], rules: ["Tourné dans un lieu réel", "Mentionner l'adresse en description"] },
    { id: "atlas", title: "Collection Atlas", brand: "Atlas Mode", category: "Mode", rate: 140, budget: 350000, spent: 270000, clippers: 58, createdAt: "2026-09-18", top: true, gradient: "from-fuchsia-400 via-pink-500 to-rose-500", emoji: "🧥", platforms: ["Instagram", "TikTok"], rules: ["Porter au moins une pièce de la collection", "Ajouter #AtlasMode"] },
    { id: "oran", title: "Oran Beats Live", brand: "Oran Beats", category: "Musique", rate: 100, budget: 150000, spent: 38000, clippers: 19, createdAt: "2026-09-12", gradient: "from-violet-500 via-purple-600 to-indigo-700", emoji: "🎧", platforms: ["TikTok", "YouTube"], rules: ["Utiliser un extrait officiel", "Créditer l'artiste"] },
    { id: "rire", title: "Les Sketchs du Bled", brand: "Studio Numidia", category: "Humour", rate: 125, budget: 220000, spent: 120000, clippers: 47, createdAt: "2026-09-08", gradient: "from-lime-300 via-green-400 to-emerald-600", emoji: "😂", platforms: ["TikTok", "Instagram", "YouTube"], rules: ["Garder le sous-titrage", "Ne pas couper la chute"] },
    { id: "gaming", title: "Tournoi Djurdjura Gaming", brand: "Djurdjura Esport", category: "Tech", rate: 115, budget: 200000, spent: 64000, clippers: 30, createdAt: "2026-09-03", gradient: "from-slate-500 via-slate-700 to-ink", emoji: "🎮", platforms: ["YouTube", "TikTok"], rules: ["Montrer une action de jeu", "Lien du tournoi en bio"] },
  ];

  const publications = [
    { id: 1, campaign: "derby", title: "But de la 89e en slow-motion", platform: "TikTok", date: "2026-10-09", views: 48200, status: "Validée" },
    { id: 2, campaign: "atlas", title: "Look d'automne Atlas", platform: "Instagram", date: "2026-10-08", views: 21500, status: "Validée" },
    { id: 3, campaign: "sahara", title: "Unboxing en 30 secondes", platform: "YouTube", date: "2026-10-07", views: 15300, status: "En attente" },
    { id: 4, campaign: "kahwa", title: "Mon café du matin à Alger", platform: "TikTok", date: "2026-10-05", views: 9800, status: "Validée" },
    { id: 5, campaign: "rire", title: "Le taxi clandestin", platform: "TikTok", date: "2026-10-03", views: 63400, status: "Validée" },
    { id: 6, campaign: "casbah", title: "Garantita brûlante", platform: "Instagram", date: "2026-10-01", views: 4100, status: "Refusée", reason: "Lieu non visible à l'écran" },
    { id: 7, campaign: "derby", title: "Ambiance des tribunes", platform: "YouTube", date: "2026-09-29", views: 27700, status: "Validée" },
  ];

  const transactions = [
    { id: "T-1045", date: "2026-10-09", time: "17:01", label: "Derby Algérois", amount: 2850, type: "gain", status: "En cours" },
    { id: "T-1044", date: "2026-10-07", time: "16:33", label: "Collection Atlas", amount: 8755, type: "gain", status: "Validé" },
    { id: "T-1043", date: "2026-10-05", time: "13:04", label: "Les Sketchs du Bled", amount: 18755, type: "gain", status: "Validé" },
    { id: "T-1042", date: "2026-10-01", time: "10:20", label: "Retrait vers CCP", amount: -25000, type: "retrait", status: "Validé" },
    { id: "T-1041", date: "2026-09-29", time: "19:45", label: "Derby Algérois", amount: 4155, type: "gain", status: "Validé" },
    { id: "T-1040", date: "2026-09-26", time: "11:12", label: "Kahwa du matin", amount: 1078, type: "gain", status: "Validé" },
  ];

  const views30 = [3.1, 3.4, 2.9, 4.2, 5.1, 4.8, 5.6, 6.2, 5.9, 6.8, 7.4, 7.1, 6.5, 7.9, 8.6, 8.2, 9.4, 10.1, 9.7, 11.2, 12.4, 11.8, 12.9, 14.1, 13.6, 15.2, 16.8, 15.9, 17.4, 18.6];
  const income12 = [8, 9, 12, 18, 24, 27, 27, 26, 29, 33, 35, 33, 27];

  const user = { name: "Yacine Benali", handle: "@yacine.clips", city: "Alger", initials: "YB", level: "Clipper Argent", bio: "Monteur passionné de foot et d'humour. Je publie 2 à 3 clips par jour." };

  // ---------- État (en mémoire uniquement) ----------

  const state = {
    view: "accueil",
    drawer: false,
    notifOpen: false,
    modal: null,
    favorites: new Set(["derby", "atlas"]),
    joined: new Set(["derby", "atlas", "sahara", "kahwa", "rire", "casbah"]),
    camp: { q: "", category: "Toutes", sort: "recent", favOnly: false, layout: "grid" },
    pub: { status: "Toutes" },
    tx: { type: "tous" },
    period: 30,
    settings: { email: true, push: true, weekly: false, newCampaigns: true },
    notifications: [
      { id: 1, icon: "✅", text: "Votre clip « Le taxi clandestin » a été validé.", time: "Il y a 2 h", unread: true },
      { id: 2, icon: "🎯", text: "Nouvelle campagne : Tournoi Djurdjura Gaming.", time: "Il y a 5 h", unread: true },
      { id: 3, icon: "💸", text: "8 755 DA ajoutés à votre portefeuille.", time: "Hier", unread: true },
      { id: 4, icon: "⚠️", text: "Clip « Garantita brûlante » refusé : lieu non visible.", time: "Il y a 3 j", unread: false },
    ],
  };

  // ---------- Utilitaires ----------

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (n) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const da = (n) => `${n < 0 ? "− " : ""}${fmt(n)} DA`;
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const date = (iso) => { const [y, m, d] = iso.split("-"); return `${d} ${MONTHS[+m - 1]} ${y}`; };
  const campaignById = (id) => campaigns.find((c) => c.id === id);
  const earningsOf = (p) => (p.status === "Validée" ? (p.views / 1000) * campaignById(p.campaign).rate : 0);

  const icons = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 13.5h2"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    list: '<path d="M4 6h16M4 12h10M4 18h13"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrowUp: '<path d="M7 17L17 7M9 7h8v8"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    dots: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
  };
  const icon = (name, cls = "h-5 w-5", fill = false) =>
    `<svg viewBox="0 0 24 24" class="${cls}" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${icons[name]}</svg>`;

  const NAV = [
    { id: "accueil", label: "Vue d'ensemble", icon: "home" },
    { id: "campagnes", label: "Campagnes", icon: "target" },
    { id: "publications", label: "Mes publications", icon: "film" },
    { id: "portefeuille", label: "Portefeuille", icon: "wallet" },
    { id: "statistiques", label: "Statistiques", icon: "chart" },
    { id: "profil", label: "Profil", icon: "user" },
    { id: "parametres", label: "Paramètres", icon: "gear" },
  ];
  const MOBILE_NAV = ["accueil", "campagnes", "publications", "portefeuille"];

  // ---------- Composants ----------

  function areaChart(values, { h = 120, color = "#0f766e", id = "g" } = {}) {
    const w = 320, max = Math.max(...values), step = w / (values.length - 1);
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
      "En cours": "bg-amber-50 text-amber-600", "En attente": "bg-amber-50 text-amber-600",
      "Validé": "bg-emerald-50 text-emerald-600", "Validée": "bg-emerald-50 text-emerald-600",
      "Refusée": "bg-rose-50 text-rose-600",
    };
    return `<span class="whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ${map[status] || "bg-gray-100 text-gray-600"}">${status}</span>`;
  }

  function incomeCard() {
    return `<div class="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
      <div class="flex items-start justify-between gap-3 p-6 pb-2">
        <div>
          <p class="text-sm font-medium text-gray-700">Revenus</p>
          <p class="mt-2 whitespace-nowrap text-3xl font-extrabold tracking-tight">${da(totalEarned())}</p>
          <p class="mt-2 text-sm text-gray-600">${icon("trend", "mr-1 inline h-4 w-4 align-[-2px]")}<span class="font-semibold text-ink">+8,2 %</span> par rapport au mois dernier</p>
        </div>
        <span class="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-income text-white shadow-md">${icon("arrowUp", "h-6 w-6")}</span>
      </div>
      <div class="h-32">${areaChart(income12, { id: "inc" + Math.random().toString(36).slice(2, 7) })}</div>
    </div>`;
  }

  function txRow(t) {
    return `<div class="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-gray-100">
      <div class="min-w-0"><p class="whitespace-nowrap text-sm font-medium text-gray-800">${date(t.date)}</p><p class="text-xs text-gray-500">${t.time}</p></div>
      <p class="whitespace-nowrap text-sm font-medium ${t.amount < 0 ? "text-gray-500" : "text-gray-800"}">${t.amount < 0 ? "" : "+ "}${da(t.amount)}</p>
      ${statusBadge(t.status)}
    </div>`;
  }

  function campaignCard(c, compact = false) {
    const fav = state.favorites.has(c.id), joined = state.joined.has(c.id);
    const generated = publications.filter((p) => p.campaign === c.id).reduce((s, p) => s + earningsOf(p), 0);
    return `<article class="flex flex-col rounded-3xl bg-white p-2.5 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-md">
      <div class="relative">
      <button type="button" data-action="open-campaign" data-id="${c.id}" class="relative block ${compact ? "aspect-[16/10]" : "aspect-[4/3]"} w-full overflow-hidden rounded-2xl bg-gradient-to-br ${c.gradient} text-left" aria-label="Voir la campagne ${esc(c.title)}">
        <span class="absolute left-3 top-3 rounded-lg bg-ink/90 px-2 py-1 text-sm font-bold text-white">${c.rate} DA<span class="font-medium text-white/70"> /1K</span></span>
        <span class="absolute inset-0 grid place-items-center text-6xl drop-shadow-lg">${c.emoji}</span>
        ${c.top ? `<span class="absolute bottom-3 right-3 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-ink">⭐ Top campagne</span>` : ""}
      </button>
      <button type="button" data-action="toggle-fav" data-id="${c.id}" aria-pressed="${fav}" aria-label="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}"
        class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow ${fav ? "text-rose-500" : "text-gray-400 hover:text-rose-500"}">
        ${icon("heart", "h-4 w-4", fav)}
      </button>
      </div>
      <div class="flex flex-1 flex-col px-3 pb-2 pt-3">
        <p class="text-xs text-gray-400">Créée le ${date(c.createdAt)}</p>
        <h3 class="mt-1.5 text-lg font-semibold">${esc(c.title)}</h3>
        <ul class="mt-3 space-y-2 text-sm text-gray-700">
          <li class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-rose-500"></span>${esc(c.brand)} · ${c.category}</li>
          <li class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>${joined ? `${da(generated)} générés` : `${c.clippers} clippers inscrits`}</li>
        </ul>
        ${compact ? "" : `<div class="mt-3"><div class="flex justify-between text-xs text-gray-500"><span>Budget utilisé</span><span>${Math.round((c.spent / c.budget) * 100)} %</span></div><div class="mt-1 h-1.5 rounded-full bg-gray-100"><div class="h-1.5 rounded-full bg-brand-600" style="width:${Math.round((c.spent / c.budget) * 100)}%"></div></div></div>`}
        ${joined
          ? `<button type="button" data-action="copy" data-id="${c.id}" class="mt-4 rounded-xl bg-brand-50 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100">Copier le lien</button>`
          : `<button type="button" data-action="join" data-id="${c.id}" class="mt-4 rounded-xl bg-ink py-2 text-sm font-semibold text-white hover:bg-black">Rejoindre</button>`}
      </div>
    </article>`;
  }

  function campaignRow(c) {
    const fav = state.favorites.has(c.id), joined = state.joined.has(c.id);
    return `<div class="flex items-center gap-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
      <button type="button" data-action="open-campaign" data-id="${c.id}" class="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${c.gradient} text-3xl" aria-label="Voir ${esc(c.title)}">${c.emoji}</button>
      <div class="min-w-0 flex-1">
        <p class="truncate font-semibold">${esc(c.title)}</p>
        <p class="truncate text-sm text-gray-500">${esc(c.brand)} · ${c.category} · ${c.clippers} clippers</p>
      </div>
      <span class="hidden rounded-lg bg-ink px-2 py-1 text-sm font-bold text-white sm:inline">${c.rate} DA /1K</span>
      <button type="button" data-action="toggle-fav" data-id="${c.id}" aria-pressed="${fav}" aria-label="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}" class="grid h-9 w-9 place-items-center rounded-full ${fav ? "text-rose-500" : "text-gray-400 hover:text-rose-500"}">${icon("heart", "h-4 w-4", fav)}</button>
      ${joined
        ? `<button type="button" data-action="copy" data-id="${c.id}" class="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100">Copier le lien</button>`
        : `<button type="button" data-action="join" data-id="${c.id}" class="rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-black">Rejoindre</button>`}
    </div>`;
  }

  const select = (name, value, options) =>
    `<select data-input="${name}" class="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
      ${options.map(([v, l]) => `<option value="${v}" ${v === value ? "selected" : ""}>${l}</option>`).join("")}</select>`;

  const pills = (name, value, options) =>
    `<div class="flex gap-2 overflow-x-auto pb-1">${options.map((o) => `<button type="button" data-action="${name}" data-value="${o}" aria-pressed="${o === value}" class="shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${o === value ? "bg-ink text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-ink"}">${o}</button>`).join("")}</div>`;

  function pageHeader(title, text, action = "") {
    return `<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">${title}</h1>${text ? `<p class="mt-1 text-gray-500">${text}</p>` : ""}</div>${action}</div>`;
  }

  // ---------- Calculs ----------

  const totalEarned = () => publications.reduce((s, p) => s + earningsOf(p), 0) + 857500;
  const pendingAmount = () => transactions.filter((t) => t.type === "gain" && t.status === "En cours").reduce((s, t) => s + t.amount, 0);
  // Un retrait en cours est déjà déduit du solde disponible.
  const balance = () => transactions.filter((t) => t.status === "Validé" || t.type === "retrait").reduce((s, t) => s + t.amount, 0) + 41200;

  // ---------- Vues ----------

  function viewAccueil() {
    const totalViews = publications.reduce((s, p) => s + p.views, 0);
    const validated = publications.filter((p) => p.status === "Validée").length;
    const stats = [
      { label: "Gains du mois", value: da(34893), delta: "+8,2 %", icon: "wallet", tone: "bg-emerald-50 text-income" },
      { label: "Vues totales", value: fmt(totalViews), delta: "+12,4 %", icon: "chart", tone: "bg-brand-50 text-brand-600" },
      { label: "Clips publiés", value: String(publications.length), delta: "+3 cette semaine", icon: "film", tone: "bg-amber-50 text-amber-600" },
      { label: "Taux de validation", value: `${Math.round((validated / publications.length) * 100)} %`, delta: "Objectif 80 %", icon: "check", tone: "bg-sky-50 text-sky-600" },
    ];
    const recommended = campaigns.filter((c) => !state.joined.has(c.id)).slice(0, 3);
    return `${pageHeader(`Bonjour ${user.name.split(" ")[0]} 👋`, "Voici le résumé de votre activité de clipping.", `<button type="button" data-action="submit-clip" class="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-black">+ Soumettre un clip</button>`)}
      <div class="mt-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        ${stats.map((s) => card(`<div class="flex items-start justify-between gap-2"><p class="text-xs font-medium text-gray-500 sm:text-sm">${s.label}</p><span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 ${s.tone}">${icon(s.icon)}</span></div>
          <p class="mt-3 whitespace-nowrap text-lg font-extrabold sm:text-2xl">${s.value}</p><p class="mt-1 text-xs font-medium text-gray-500">${s.delta}</p>`, "p-4 sm:p-5")).join("")}
      </div>
      <div class="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        ${card(`<div class="flex flex-wrap items-center justify-between gap-3"><div><p class="font-bold">Vues de vos clips</p><p class="text-sm text-gray-500">${state.period} derniers jours, en milliers</p></div>
          ${pills("period", `${state.period} jours`, ["7 jours", "30 jours"])}</div>
          <div class="mt-6 h-56">${areaChart(state.period === 7 ? views30.slice(-7) : views30, { h: 200, color: "#7c3aed", id: "views" })}</div>`)}
        <div class="space-y-3">${incomeCard()}${transactions.slice(0, 2).map(txRow).join("")}</div>
      </div>
      <div class="mt-10 flex items-center justify-between"><h2 class="text-xl font-extrabold">Campagnes recommandées</h2><button type="button" data-action="nav" data-view="campagnes" class="text-sm font-semibold text-brand-700 hover:underline">Tout voir</button></div>
      <div class="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">${recommended.map((c) => campaignCard(c, true)).join("")}</div>
      <div class="mt-10 flex items-center justify-between"><h2 class="text-xl font-extrabold">Dernières publications</h2><button type="button" data-action="nav" data-view="publications" class="text-sm font-semibold text-brand-700 hover:underline">Tout voir</button></div>
      <div class="mt-4">${publicationsTable(publications.slice(0, 4))}</div>`;
  }

  function viewCampagnes() {
    const f = state.camp, q = f.q.trim().toLowerCase();
    let list = campaigns.filter((c) =>
      (f.category === "Toutes" || c.category === f.category) &&
      (!f.favOnly || state.favorites.has(c.id)) &&
      (!q || `${c.title} ${c.brand}`.toLowerCase().includes(q)));
    const sorters = { recent: (a, b) => b.createdAt.localeCompare(a.createdAt), rate: (a, b) => b.rate - a.rate, popular: (a, b) => b.clippers - a.clippers };
    list = list.slice().sort(sorters[f.sort]);
    return `${pageHeader("Campagnes", `${campaigns.length} campagnes disponibles · tarif pour 1 000 vues validées`)}
      <div class="mt-8 flex flex-col gap-3 xl:flex-row xl:items-center">
        <label class="relative block flex-1 xl:max-w-sm"><span class="sr-only">Rechercher une campagne</span>
          <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">${icon("search")}</span>
          <input data-input="camp-q" type="search" value="${esc(f.q)}" placeholder="Rechercher" class="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"/></label>
        <div class="flex flex-wrap items-center gap-3 xl:ml-auto">
          ${select("camp-category", f.category, [["Toutes", "Toutes les catégories"], ...CATEGORIES.map((c) => [c, c])])}
          ${select("camp-sort", f.sort, [["recent", "Plus récentes"], ["rate", "Mieux payées"], ["popular", "Plus populaires"]])}
          <button type="button" data-action="fav-only" aria-pressed="${f.favOnly}" class="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${f.favOnly ? "bg-rose-50 text-rose-600 ring-1 ring-rose-100" : "bg-white text-gray-600 ring-1 ring-gray-200"}">${icon("heart", "h-4 w-4", f.favOnly)} Favoris (${state.favorites.size})</button>
          <div class="flex rounded-2xl bg-gray-50 p-1 ring-1 ring-gray-100">
            <button type="button" data-action="layout" data-value="list" aria-label="Affichage en liste" aria-pressed="${f.layout === "list"}" class="grid h-10 w-10 place-items-center rounded-xl ${f.layout === "list" ? "bg-white shadow-sm" : "text-gray-400"}">${icon("list")}</button>
            <button type="button" data-action="layout" data-value="grid" aria-label="Affichage en grille" aria-pressed="${f.layout === "grid"}" class="grid h-10 w-10 place-items-center rounded-xl ${f.layout === "grid" ? "bg-white shadow-sm" : "text-gray-400"}">${icon("grid")}</button>
          </div>
        </div>
      </div>
      <p class="mt-6 text-sm text-gray-500">${list.length} résultat${list.length > 1 ? "s" : ""}</p>
      ${list.length === 0
        ? `<div class="mt-4 rounded-3xl bg-gray-50 p-12 text-center"><p class="text-4xl">🔍</p><p class="mt-3 font-semibold">Aucune campagne trouvée</p><p class="mt-1 text-sm text-gray-500">Modifiez la recherche ou les filtres.</p><button type="button" data-action="reset-filters" class="mt-5 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white">Réinitialiser les filtres</button></div>`
        : f.layout === "grid"
          ? `<div class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">${list.map((c) => campaignCard(c)).join("")}</div>`
          : `<div class="mt-4 space-y-3">${list.map(campaignRow).join("")}</div>`}`;
  }

  function publicationsTable(list) {
    if (!list.length) return `<div class="rounded-3xl bg-gray-50 p-12 text-center text-gray-500">Aucune publication pour ce filtre.</div>`;
    const platformTone = { TikTok: "bg-ink text-white", Instagram: "bg-pink-100 text-pink-700", YouTube: "bg-red-100 text-red-700" };
    return `<div class="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
      <div class="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 border-b border-gray-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 md:grid"><span>Clip</span><span>Plateforme</span><span>Vues</span><span>Gains</span><span>Statut</span></div>
      ${list.map((p) => {
        const c = campaignById(p.campaign);
        const thumb = `<span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${c.gradient} text-xl">${c.emoji}</span>`;
        const platform = `<span class="rounded-md px-2 py-1 text-xs font-semibold ${platformTone[p.platform]}">${p.platform}</span>`;
        const gain = p.status === "Validée" ? da(earningsOf(p)) : "—";
        return `<div class="border-b border-gray-50 px-4 py-4 last:border-0 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:items-center md:gap-4 md:px-6">
          <div class="flex min-w-0 items-center gap-3">${thumb}
            <div class="min-w-0 flex-1"><p class="truncate font-semibold">${esc(p.title)}</p><p class="truncate text-xs text-gray-500">${esc(c.title)} · ${date(p.date)}</p></div>
            <span class="md:hidden">${statusBadge(p.status)}</span>
          </div>
          <div class="mt-3 flex items-center gap-3 pl-14 text-sm text-gray-700 md:hidden">${platform}<span>${fmt(p.views)} vues</span><span class="ml-auto font-semibold text-ink">${gain}</span></div>
          ${p.reason ? `<p class="mt-2 pl-14 text-xs text-rose-500 md:hidden">${esc(p.reason)}</p>` : ""}
          <span class="hidden md:block">${platform}</span>
          <span class="hidden text-sm text-gray-700 md:block">${fmt(p.views)}</span>
          <span class="hidden text-sm font-semibold md:block">${gain}</span>
          <span class="hidden md:block">${statusBadge(p.status)}${p.reason ? `<span class="mt-1 block text-xs text-rose-500">${esc(p.reason)}</span>` : ""}</span>
        </div>`;
      }).join("")}</div>`;
  }

  function viewPublications() {
    const list = publications.filter((p) => state.pub.status === "Toutes" || p.status === state.pub.status);
    const counts = (s) => publications.filter((p) => p.status === s).length;
    return `${pageHeader("Mes publications", `${publications.length} clips soumis · ${counts("Validée")} validés · ${counts("En attente")} en attente`, `<button type="button" data-action="submit-clip" class="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-black">+ Soumettre un clip</button>`)}
      <div class="mt-8">${pills("pub-status", state.pub.status, ["Toutes", "Validée", "En attente", "Refusée"])}</div>
      <div class="mt-5">${publicationsTable(list)}</div>`;
  }

  function viewPortefeuille() {
    const list = transactions.filter((t) => state.tx.type === "tous" || t.type === state.tx.type);
    return `${pageHeader("Portefeuille", "Vos gains, versements et retraits.", `<button type="button" data-action="withdraw" class="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">Demander un retrait</button>`)}
      <div class="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div class="space-y-4 rounded-[2rem] bg-gray-50 p-4 ring-1 ring-gray-100 sm:p-5">
          <div class="flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-gray-100">
            <div><span class="flex"><span class="h-6 w-6 rounded-full bg-brand-600"></span><span class="-ml-2.5 h-6 w-6 rounded-full bg-amber-400/90"></span></span><p class="mt-2 text-sm text-gray-700">CCP •••• •••• 5678</p></div>
            <span class="text-gray-400">${icon("dots")}</span>
          </div>
          ${incomeCard()}
          <div class="grid grid-cols-2 gap-3">
            ${card(`<p class="text-xs text-gray-500">Solde disponible</p><p class="mt-1 whitespace-nowrap text-lg font-extrabold">${da(balance())}</p>`, "p-4")}
            ${card(`<p class="text-xs text-gray-500">En attente</p><p class="mt-1 whitespace-nowrap text-lg font-extrabold text-amber-600">${da(pendingAmount())}</p>`, "p-4")}
          </div>
        </div>
        <div>
          <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-extrabold">Historique</h2>
            ${pills("tx-type", { tous: "Tous", gain: "Gains", retrait: "Retraits" }[state.tx.type], ["Tous", "Gains", "Retraits"])}</div>
          <div class="mt-4 space-y-3">${list.map((t) => `<div class="flex items-center gap-4 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-gray-100">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.type === "retrait" ? "bg-gray-100 text-gray-600" : "bg-emerald-50 text-income"}">${icon(t.type === "retrait" ? "wallet" : "arrowUp", "h-4 w-4")}</span>
            <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold">${esc(t.label)}</p><p class="text-xs text-gray-500">${date(t.date)} · ${t.time} · ${t.id}</p></div>
            <p class="whitespace-nowrap text-sm font-semibold ${t.amount < 0 ? "text-gray-500" : "text-income"}">${t.amount < 0 ? "" : "+ "}${da(t.amount)}</p>
            <span class="hidden sm:inline">${statusBadge(t.status)}</span></div>`).join("")}</div>
        </div>
      </div>`;
  }

  function viewStatistiques() {
    const byPlatform = ["TikTok", "Instagram", "YouTube"].map((pl) => ({ pl, views: publications.filter((p) => p.platform === pl).reduce((s, p) => s + p.views, 0) }));
    const maxP = Math.max(...byPlatform.map((b) => b.views));
    const byCampaign = campaigns.map((c) => ({ c, earn: publications.filter((p) => p.campaign === c.id).reduce((s, p) => s + earningsOf(p), 0) })).filter((x) => x.earn > 0).sort((a, b) => b.earn - a.earn);
    const maxC = byCampaign[0].earn;
    const top = publications.slice().sort((a, b) => b.views - a.views).slice(0, 3);
    const colors = { TikTok: "bg-ink", Instagram: "bg-pink-500", YouTube: "bg-red-500" };
    return `${pageHeader("Statistiques", "Comprenez ce qui fait performer vos clips.", pills("period", `${state.period} jours`, ["7 jours", "30 jours"]))}
      <div class="mt-8">${card(`<p class="font-bold">Vues quotidiennes (milliers)</p><div class="mt-6 h-64">${areaChart(state.period === 7 ? views30.slice(-7) : views30, { h: 220, color: "#7c3aed", id: "stats" })}</div>`)}</div>
      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        ${card(`<p class="font-bold">Vues par plateforme</p><div class="mt-6 space-y-5">${byPlatform.map((b) => `<div><div class="flex justify-between text-sm"><span class="font-medium">${b.pl}</span><span class="text-gray-500">${fmt(b.views)} vues</span></div><div class="mt-2 h-3 rounded-full bg-gray-100"><div class="h-3 rounded-full ${colors[b.pl]}" style="width:${(b.views / maxP) * 100}%"></div></div></div>`).join("")}</div>`)}
        ${card(`<p class="font-bold">Gains par campagne</p><div class="mt-6 space-y-5">${byCampaign.map((x) => `<div><div class="flex justify-between text-sm"><span class="font-medium">${x.c.emoji} ${esc(x.c.title)}</span><span class="text-gray-500">${da(x.earn)}</span></div><div class="mt-2 h-3 rounded-full bg-gray-100"><div class="h-3 rounded-full bg-income" style="width:${(x.earn / maxC) * 100}%"></div></div></div>`).join("")}</div>`)}
      </div>
      <h2 class="mt-10 text-xl font-extrabold">Vos meilleurs clips</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-3">${top.map((p, i) => { const c = campaignById(p.campaign); return card(`<div class="flex items-center gap-3"><span class="text-3xl font-black text-gray-200">#${i + 1}</span><span class="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${c.gradient} text-2xl">${c.emoji}</span></div><p class="mt-4 font-semibold">${esc(p.title)}</p><p class="text-sm text-gray-500">${p.platform} · ${esc(c.title)}</p><p class="mt-3 text-2xl font-extrabold">${fmt(p.views)} <span class="text-sm font-medium text-gray-500">vues</span></p>`, "p-5"); }).join("")}</div>`;
  }

  function viewProfil() {
    const accounts = [["TikTok", "@yacine.clips", "18,4 K abonnés", true], ["Instagram", "@yacine.clips", "6,1 K abonnés", true], ["YouTube", "Yacine Clips", "Non connecté", false]];
    return `${pageHeader("Profil", "Les informations visibles par les marques.")}
      <div class="mt-8 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        ${card(`<div class="flex flex-col items-center text-center"><span class="grid h-24 w-24 place-items-center rounded-full bg-brand-600 text-3xl font-extrabold text-white">${user.initials}</span>
          <p class="mt-4 text-xl font-extrabold">${user.name}</p><p class="text-gray-500">${user.handle} · ${user.city}</p>
          <span class="mt-3 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">🥈 ${user.level}</span>
          <p class="mt-5 text-sm leading-relaxed text-gray-600">${user.bio}</p>
          <div class="mt-6 w-full"><div class="flex justify-between text-xs text-gray-500"><span>Vers Clipper Or</span><span>72 %</span></div><div class="mt-1 h-2 rounded-full bg-gray-100"><div class="h-2 w-[72%] rounded-full bg-amber-400"></div></div></div></div>`)}
        <div class="space-y-6">
          ${card(`<p class="font-bold">Informations</p><form data-form="profile" class="mt-5 grid gap-4 sm:grid-cols-2">
            <label class="text-sm"><span class="font-medium text-gray-600">Nom complet</span><input name="name" value="${esc(user.name)}" class="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"/></label>
            <label class="text-sm"><span class="font-medium text-gray-600">Wilaya</span><input name="city" value="${esc(user.city)}" class="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"/></label>
            <label class="text-sm sm:col-span-2"><span class="font-medium text-gray-600">Bio</span><textarea name="bio" rows="3" class="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">${esc(user.bio)}</textarea></label>
            <div class="sm:col-span-2"><button class="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-black">Enregistrer</button></div></form>`)}
          ${card(`<p class="font-bold">Comptes connectés</p><div class="mt-4 divide-y divide-gray-100">${accounts.map(([pl, h, f, on]) => `<div class="flex items-center justify-between gap-3 py-3"><div><p class="font-semibold">${pl}</p><p class="text-sm text-gray-500">${on ? `${h} · ${f}` : f}</p></div>
            <button type="button" data-action="toast" data-msg="${on ? `${pl} déjà connecté (démonstration)` : `Connexion ${pl} simulée`}" class="rounded-xl px-3 py-2 text-sm font-semibold ${on ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"}">${on ? "Connecté" : "Connecter"}</button></div>`).join("")}</div>`)}
        </div>
      </div>`;
  }

  function toggleRow(key, title, text) {
    const on = state.settings[key];
    return `<div class="flex items-center justify-between gap-4 py-4"><div><p class="font-semibold">${title}</p><p class="text-sm text-gray-500">${text}</p></div>
      <button type="button" role="switch" aria-checked="${on}" data-action="setting" data-key="${key}" aria-label="${title}" class="relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-brand-600" : "bg-gray-200"}"><span class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}"></span></button></div>`;
  }

  function viewParametres() {
    return `${pageHeader("Paramètres", "Gérez vos préférences.")}
      <div class="mt-8 grid gap-6 lg:grid-cols-2">
        ${card(`<p class="font-bold">Notifications</p><div class="mt-2 divide-y divide-gray-100">
          ${toggleRow("email", "E-mails", "Validations, refus et versements.")}
          ${toggleRow("push", "Notifications navigateur", "Alertes en temps réel.")}
          ${toggleRow("newCampaigns", "Nouvelles campagnes", "Être prévenu dès qu'une campagne correspond à vos catégories.")}
          ${toggleRow("weekly", "Résumé hebdomadaire", "Un bilan de vos vues et gains chaque dimanche.")}</div>`)}
        <div class="space-y-6">
          ${card(`<p class="font-bold">Langue et région</p><div class="mt-4 grid gap-4 sm:grid-cols-2">
            <label class="text-sm"><span class="font-medium text-gray-600">Langue</span><select class="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5"><option>Français</option></select></label>
            <label class="text-sm"><span class="font-medium text-gray-600">Devise</span><select class="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5"><option>Dinar algérien (DA)</option></select></label></div>`)}
          ${card(`<p class="font-bold">Moyen de retrait</p><p class="mt-1 text-sm text-gray-500">Utilisé pour vos demandes de retrait (simulation).</p>
            <div class="mt-4 space-y-2">${["CCP •••• 5678", "BaridiMob"].map((m, i) => `<label class="flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 ring-gray-200 has-[:checked]:bg-brand-50 has-[:checked]:ring-brand-500"><input type="radio" name="payout" ${i === 0 ? "checked" : ""} class="accent-brand-600"/> <span class="font-medium">${m}</span></label>`).join("")}</div>`)}
          <button type="button" data-action="toast" data-msg="Préférences enregistrées (démonstration)" class="w-full rounded-2xl bg-ink py-3.5 font-semibold text-white hover:bg-black">Enregistrer les préférences</button>
        </div>
      </div>`;
  }

  const VIEWS = { accueil: viewAccueil, campagnes: viewCampagnes, publications: viewPublications, portefeuille: viewPortefeuille, statistiques: viewStatistiques, profil: viewProfil, parametres: viewParametres };

  // ---------- Coquille (navigation, en-tête, modales) ----------

  function sidebar() {
    return `<div class="flex h-full flex-col">
      <div class="flex items-center gap-2 px-2">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">${icon("play", "h-5 w-5", true)}</span>
        <span class="text-2xl font-black italic tracking-tight">ClipBoost</span>
      </div>
      <p class="mt-8 px-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Espace Clipper</p>
      <nav class="mt-3 space-y-1" aria-label="Navigation principale">
        ${NAV.map((n) => `<button type="button" data-action="nav" data-view="${n.id}" ${state.view === n.id ? 'aria-current="page"' : ""} class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${state.view === n.id ? "bg-white text-ink shadow-sm ring-1 ring-gray-100" : "text-gray-500 hover:bg-white/70 hover:text-ink"}">${icon(n.icon)} ${n.label}</button>`).join("")}
      </nav>
      <div class="mt-auto space-y-3 pt-8">
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"><p class="text-xs text-gray-500">Solde disponible</p><p class="mt-1 text-xl font-extrabold">${da(balance())}</p></div>
        <button type="button" data-action="invite" class="w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700">Inviter un créateur 🙋</button>
      </div>
    </div>`;
  }

  function topbar() {
    const unread = state.notifications.filter((n) => n.unread).length;
    return `<header class="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div class="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" data-action="drawer" class="grid h-10 w-10 place-items-center rounded-xl ring-1 ring-gray-200 lg:hidden" aria-label="Ouvrir le menu">${icon("menu")}</button>
        <span class="text-xl font-black italic tracking-tight lg:hidden">ClipBoost</span>
        <label class="relative ml-auto hidden w-full max-w-xs md:block lg:ml-0"><span class="sr-only">Recherche rapide</span>
          <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">${icon("search", "h-4 w-4")}</span>
          <input data-input="global-q" type="search" placeholder="Rechercher une campagne…" class="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"/></label>
        <div class="relative ml-auto flex items-center gap-2">
          <button type="button" data-action="notif" aria-expanded="${state.notifOpen}" aria-label="Notifications${unread ? ` (${unread} non lues)` : ""}" class="relative grid h-10 w-10 place-items-center rounded-xl ring-1 ring-gray-200 hover:bg-gray-50">
            ${icon("bell")}${unread ? `<span class="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">${unread}</span>` : ""}
          </button>
          ${state.notifOpen ? notifPanel() : ""}
          <button type="button" data-action="nav" data-view="profil" class="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-gray-50" aria-label="Mon profil">
            <span class="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">${user.initials}</span>
            <span class="hidden text-left sm:block"><span class="block text-sm font-semibold leading-tight">${user.name}</span><span class="block text-xs text-gray-500">${user.level}</span></span>
          </button>
        </div>
      </div>
    </header>`;
  }

  function notifPanel() {
    return `<div class="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-white p-2 shadow-xl ring-1 ring-gray-100" role="dialog" aria-label="Notifications">
      <div class="flex items-center justify-between px-3 py-2"><p class="font-bold">Notifications</p><button type="button" data-action="read-all" class="text-xs font-semibold text-brand-700 hover:underline">Tout marquer comme lu</button></div>
      ${state.notifications.map((n) => `<button type="button" data-action="read-one" data-id="${n.id}" class="flex w-full gap-3 rounded-xl p-3 text-left hover:bg-gray-50 ${n.unread ? "bg-brand-50/60" : ""}">
        <span class="text-lg">${n.icon}</span><span class="flex-1"><span class="block text-sm ${n.unread ? "font-semibold" : "text-gray-600"}">${esc(n.text)}</span><span class="text-xs text-gray-400">${n.time}</span></span>
        ${n.unread ? '<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600"></span>' : ""}</button>`).join("")}
    </div>`;
  }

  function mobileNav() {
    return `<nav class="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur lg:hidden" aria-label="Navigation mobile">
      <div class="grid grid-cols-5">
        ${MOBILE_NAV.map((id) => { const n = NAV.find((x) => x.id === id); const on = state.view === id; return `<button type="button" data-action="nav" data-view="${id}" ${on ? 'aria-current="page"' : ""} class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${on ? "text-brand-600" : "text-gray-500"}">${icon(n.icon)}${{ accueil: "Accueil", publications: "Publications" }[id] || n.label}</button>`; }).join("")}
        <button type="button" data-action="drawer" class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${["statistiques", "profil", "parametres"].includes(state.view) ? "text-brand-600" : "text-gray-500"}">${icon("more")}Plus</button>
      </div>
    </nav>`;
  }

  function modal() {
    const m = state.modal;
    if (!m) return "";
    let body = "";
    if (m.type === "campaign") {
      const c = campaignById(m.id), joined = state.joined.has(c.id);
      body = `<div class="h-40 rounded-2xl bg-gradient-to-br ${c.gradient} grid place-items-center text-7xl">${c.emoji}</div>
        <div class="mt-5 flex items-start justify-between gap-3"><div><p class="text-sm text-gray-500">${esc(c.brand)} · ${c.category}</p><h2 class="text-2xl font-extrabold">${esc(c.title)}</h2></div><span class="rounded-lg bg-ink px-2 py-1 text-sm font-bold text-white">${c.rate} DA /1K</span></div>
        <div class="mt-5 grid grid-cols-3 gap-3 text-center">
          <div class="rounded-2xl bg-gray-50 p-3"><p class="text-xs text-gray-500">Budget</p><p class="font-bold">${da(c.budget)}</p></div>
          <div class="rounded-2xl bg-gray-50 p-3"><p class="text-xs text-gray-500">Restant</p><p class="font-bold">${da(c.budget - c.spent)}</p></div>
          <div class="rounded-2xl bg-gray-50 p-3"><p class="text-xs text-gray-500">Clippers</p><p class="font-bold">${c.clippers}</p></div></div>
        <p class="mt-5 font-bold">Règles de la campagne</p>
        <ul class="mt-2 space-y-2">${c.rules.map((r) => `<li class="flex gap-2 text-sm text-gray-700"><span class="text-income">${icon("check", "h-4 w-4")}</span>${esc(r)}</li>`).join("")}</ul>
        <p class="mt-4 text-sm text-gray-500">Plateformes : ${c.platforms.join(", ")}</p>
        <div class="mt-6 flex gap-3">${joined
          ? `<button type="button" data-action="copy" data-id="${c.id}" class="flex-1 rounded-xl bg-brand-50 py-3 font-semibold text-brand-700">Copier le lien</button><button type="button" data-action="submit-clip" data-id="${c.id}" class="flex-1 rounded-xl bg-ink py-3 font-semibold text-white">Soumettre un clip</button>`
          : `<button type="button" data-action="join" data-id="${c.id}" class="flex-1 rounded-xl bg-ink py-3 font-semibold text-white">Rejoindre la campagne</button>`}</div>`;
    } else if (m.type === "submit") {
      const joined = campaigns.filter((c) => state.joined.has(c.id));
      body = `<h2 class="text-2xl font-extrabold">Soumettre un clip</h2><p class="mt-1 text-sm text-gray-500">Le clip sera vérifié par la marque avant validation.</p>
        <form data-form="submit" class="mt-6 space-y-4">
          <label class="block text-sm"><span class="font-medium text-gray-600">Campagne</span><select name="campaign" required class="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5">${joined.map((c) => `<option value="${c.id}" ${c.id === m.id ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select></label>
          <label class="block text-sm"><span class="font-medium text-gray-600">Titre du clip</span><input name="title" required maxlength="80" placeholder="Ex. Le but de l'année" class="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"/></label>
          <label class="block text-sm"><span class="font-medium text-gray-600">Lien de la vidéo</span><input name="url" type="url" required placeholder="https://www.tiktok.com/@…" class="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"/></label>
          <label class="block text-sm"><span class="font-medium text-gray-600">Plateforme</span><select name="platform" class="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5"><option>TikTok</option><option>Instagram</option><option>YouTube</option></select></label>
          <button class="w-full rounded-xl bg-ink py-3 font-semibold text-white hover:bg-black">Envoyer pour validation</button>
        </form>`;
    } else if (m.type === "withdraw") {
      body = `<h2 class="text-2xl font-extrabold">Demander un retrait</h2><p class="mt-1 text-sm text-gray-500">Solde disponible : <b>${da(balance())}</b>. Aucun argent réel n'est transféré.</p>
        <form data-form="withdraw" class="mt-6 space-y-4">
          <label class="block text-sm"><span class="font-medium text-gray-600">Montant (DA)</span><input name="amount" type="number" min="1000" max="${balance()}" step="100" required value="10000" class="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"/></label>
          <label class="block text-sm"><span class="font-medium text-gray-600">Vers</span><select name="to" class="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5"><option>CCP •••• 5678</option><option>BaridiMob</option></select></label>
          <p class="text-xs text-gray-500">Minimum 1 000 DA.</p>
          <button class="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700">Confirmer la demande</button>
        </form>`;
    } else if (m.type === "invite") {
      body = `<h2 class="text-2xl font-extrabold">Inviter un créateur 🙋</h2><p class="mt-1 text-sm text-gray-500">Partagez votre lien de parrainage : vous recevez 500 DA par créateur actif (offre fictive).</p>
        <div class="mt-6 flex gap-2"><input readonly value="https://clipboost.dz/invite/yacine" class="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm"/><button type="button" data-action="copy-invite" class="rounded-xl bg-brand-600 px-4 font-semibold text-white">Copier</button></div>`;
    }
    return `<div class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" data-action="close-modal">
      <div class="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" role="dialog" aria-modal="true" data-stop>
        <button type="button" data-action="close-modal" class="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-gray-500 shadow-sm hover:text-ink" aria-label="Fermer">${icon("close", "h-4 w-4")}</button>
        ${body}
      </div></div>`;
  }

  function drawer() {
    if (!state.drawer) return "";
    return `<div class="fixed inset-0 z-50 lg:hidden"><div class="absolute inset-0 bg-ink/40" data-action="drawer"></div>
      <aside class="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-gray-50 p-5 shadow-2xl">
        <button type="button" data-action="drawer" class="absolute right-4 top-5 grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm" aria-label="Fermer le menu">${icon("close", "h-4 w-4")}</button>
        ${sidebar()}
      </aside></div>`;
  }

  // ---------- Rendu ----------

  const root = document.getElementById("app");

  function render() {
    const active = document.activeElement;
    const focusKey = active && active.dataset ? active.dataset.input : null;
    const caret = focusKey && "selectionStart" in active ? active.selectionStart : null;

    root.innerHTML = `
      <div class="bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800">Démonstration : toutes les données sont fictives, rien n'est enregistré.</div>
      <div class="flex min-h-screen">
        <aside class="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-gray-100 bg-gray-50 p-5 lg:block">${sidebar()}</aside>
        <div class="min-w-0 flex-1">
          ${topbar()}
          <main class="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-12">${VIEWS[state.view]()}</main>
        </div>
      </div>
      ${mobileNav()}${drawer()}${modal()}
      <div id="toasts" class="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"></div>`;

    if (focusKey) {
      const el = root.querySelector(`[data-input="${focusKey}"]`);
      if (el) { el.focus(); if (caret !== null) try { el.setSelectionRange(caret, caret); } catch (e) {} }
    }
  }

  function toast(msg) {
    const box = document.getElementById("toasts");
    const el = document.createElement("div");
    el.className = "toast-in pointer-events-auto rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl";
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function copy(text, msg) {
    try { navigator.clipboard && navigator.clipboard.writeText(text).catch(() => {}); } catch (e) {}
    toast(msg);
  }

  function go(view) {
    state.view = view; state.drawer = false; state.notifOpen = false; state.modal = null;
    render(); window.scrollTo(0, 0);
  }

  // ---------- Événements ----------

  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) { if (state.notifOpen && !e.target.closest('[role="dialog"]')) { state.notifOpen = false; render(); } return; }
    // un clic à l'intérieur de la modale ne doit pas la fermer
    if (t.dataset.action === "close-modal" && e.target.closest("[data-stop]") && !e.target.closest('button[data-action="close-modal"]')) return;
    const { action, id, view, value } = t.dataset;
    switch (action) {
      case "nav": return go(view);
      case "drawer": state.drawer = !state.drawer; state.notifOpen = false; return render();
      case "notif": state.notifOpen = !state.notifOpen; return render();
      case "read-all": state.notifications.forEach((n) => (n.unread = false)); return render();
      case "read-one": state.notifications.find((n) => n.id === +id).unread = false; return render();
      case "toggle-fav":
        state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
        toast(state.favorites.has(id) ? "Ajoutée aux favoris ❤️" : "Retirée des favoris");
        return render();
      case "join":
        state.joined.add(id); toast(`Vous avez rejoint « ${campaignById(id).title} » 🎉`);
        if (state.modal) state.modal = { type: "campaign", id };
        return render();
      case "copy": return copy(`https://clipboost.dz/c/${id}?ref=yacine`, "Lien de suivi copié ✓");
      case "copy-invite": return copy("https://clipboost.dz/invite/yacine", "Lien d'invitation copié ✓");
      case "open-campaign": state.modal = { type: "campaign", id }; return render();
      case "submit-clip": state.modal = { type: "submit", id }; state.notifOpen = false; return render();
      case "withdraw": state.modal = { type: "withdraw" }; return render();
      case "invite": state.modal = { type: "invite" }; state.drawer = false; return render();
      case "close-modal": state.modal = null; return render();
      case "fav-only": state.camp.favOnly = !state.camp.favOnly; return render();
      case "layout": state.camp.layout = value; return render();
      case "reset-filters": state.camp = { ...state.camp, q: "", category: "Toutes", favOnly: false }; return render();
      case "pub-status": state.pub.status = value; return render();
      case "tx-type": state.tx.type = { Tous: "tous", Gains: "gain", Retraits: "retrait" }[value]; return render();
      case "period": state.period = parseInt(value, 10); return render();
      case "setting": state.settings[t.dataset.key] = !state.settings[t.dataset.key]; return render();
      case "toast": return toast(t.dataset.msg);
    }
  });

  root.addEventListener("input", (e) => {
    const k = e.target.dataset.input;
    if (k === "camp-q") { state.camp.q = e.target.value; render(); }
  });

  root.addEventListener("change", (e) => {
    const k = e.target.dataset.input;
    if (k === "camp-category") { state.camp.category = e.target.value; render(); }
    if (k === "camp-sort") { state.camp.sort = e.target.value; render(); }
  });

  root.addEventListener("keydown", (e) => {
    if (e.target.dataset.input === "global-q" && e.key === "Enter") {
      state.camp.q = e.target.value; state.camp.category = "Toutes"; state.camp.favOnly = false;
      go("campagnes");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (state.modal || state.drawer || state.notifOpen)) {
      state.modal = null; state.drawer = false; state.notifOpen = false; render();
    }
  });

  root.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target, data = Object.fromEntries(new FormData(form));
    if (form.dataset.form === "submit") {
      publications.unshift({ id: Date.now(), campaign: data.campaign, title: data.title.trim(), platform: data.platform, date: "2026-10-11", views: 0, status: "En attente" });
      state.modal = null; state.view = "publications"; state.pub.status = "Toutes";
      render(); toast("Clip envoyé pour validation ✓");
    } else if (form.dataset.form === "withdraw") {
      const amount = Math.floor(Number(data.amount));
      transactions.unshift({ id: `T-${1046 + transactions.length}`, date: "2026-10-11", time: "12:00", label: `Retrait vers ${data.to}`, amount: -amount, type: "retrait", status: "En cours" });
      state.modal = null; render(); toast(`Demande de retrait de ${da(amount)} enregistrée (simulation)`);
    } else if (form.dataset.form === "profile") {
      user.name = data.name.trim() || user.name; user.city = data.city.trim() || user.city; user.bio = data.bio.trim();
      user.initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      render(); toast("Profil mis à jour ✓");
    }
  });

  render();
})();
