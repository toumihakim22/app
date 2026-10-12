// Espace Agence : les créateurs de campagnes lancent et suivent leurs campagnes.
// Une nouvelle campagne part « En attente » et n'est visible des clippers qu'après approbation par l'administrateur.

const AGENCY_NAV = [
  { id: "apercu", label: "Vue d'ensemble", short: "Aperçu", icon: "home" },
  { id: "campagnes", label: "Mes campagnes", short: "Campagnes", icon: "target" },
  { id: "clips", label: "Clips reçus", short: "Clips", icon: "film" },
  { id: "budget", label: "Budget", icon: "wallet" },
  { id: "profil", label: "Profil de l'agence", short: "Profil", icon: "user" },
];

const myCampaigns = () => db.campaigns.filter((c) => c.ownerId === state.session);
const clipsOf = (ids) => db.publications.filter((p) => ids.includes(p.campaign));
// Vues cumulées des clips validés de la campagne.
const campaignViews = (c) => clipsOf([c.id]).filter((p) => p.status === "Validée").reduce((s, p) => s + p.views, 0);
// Montant prélevé sur le crédit : budget + commission ClipBoost.
const withCommission = (amount, rate = db.settings.commissionRate) => amount + Math.round((amount * rate) / 100);

function agencyStatusHint(c) {
  return {
    "En attente": "En cours de vérification par l'équipe ClipBoost.",
    "Active": "Visible par les clippers.",
    "En pause": "Masquée aux clippers, aucun nouveau clip.",
    "Terminée": "Campagne archivée.",
    "Refusée": "Refusée par l'équipe ClipBoost.",
  }[c.status];
}

function gApercu() {
  const u = me(), list = myCampaigns(), ids = list.map((c) => c.id), clips = clipsOf(ids);
  const views = list.reduce((s, c) => s + campaignViews(c), 0);
  const kpis = [
    { label: "Campagnes actives", value: String(list.filter((c) => c.status === "Active").length), sub: `${list.filter((c) => c.status === "En attente").length} en vérification`, icon: "target", tone: "bg-brand-50 text-brand-600" },
    { label: "Budget engagé", value: da(list.reduce((s, c) => s + c.budget, 0)), sub: `${da(list.reduce((s, c) => s + c.spent, 0))} consommés`, icon: "wallet", tone: "bg-emerald-50 text-income" },
    { label: "Vues générées", value: fmt(views), sub: "Clips validés uniquement", icon: "chart", tone: "bg-sky-50 text-sky-600" },
    { label: "Clips reçus", value: String(clips.length), sub: `${clips.filter((p) => p.status === "En attente").length} en modération`, icon: "film", tone: "bg-amber-50 text-amber-600" },
  ];
  const hasData = views > 0;
  return `${pageHeader(`Bonjour ${esc((u.contact || u.name).split(" ")[0])} 👋`, `Espace agence de ${esc(u.name)}.`, `<button type="button" data-action="ag-new" class="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">+ Nouvelle campagne</button>`)}
    ${!list.length ? `<div class="mt-8 flex flex-col gap-4 rounded-3xl bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between"><div><p class="text-lg font-bold">Lancez votre première campagne 🚀</p><p class="mt-1 text-white/70">Fixez un budget et un tarif pour 1 000 vues : des centaines de clippers diffusent votre marque.</p></div><button type="button" data-action="ag-new" class="shrink-0 rounded-2xl bg-white px-5 py-3 font-semibold text-ink">Créer une campagne</button></div>` : ""}
    <div class="mt-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      ${kpis.map((k) => card(`<div class="flex items-start justify-between gap-2"><p class="text-xs font-medium text-gray-500 sm:text-sm">${k.label}</p><span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 ${k.tone}">${icon(k.icon)}</span></div>
        <p class="mt-3 whitespace-nowrap text-lg font-extrabold sm:text-2xl">${k.value}</p><p class="mt-1 text-xs font-medium text-gray-500">${k.sub}</p>`, "p-4 sm:p-5")).join("")}
    </div>
    <div class="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      ${card(`<div><p class="font-bold">Budget consommé</p><p class="text-sm text-gray-500">30 derniers jours, en DA</p></div>
        ${hasData ? `<div class="mt-6 h-56">${areaChart(db.series.daily, { h: 200, color: "#0f766e" })}</div>` : `<div class="mt-6 grid h-56 place-items-center rounded-2xl bg-gray-50 text-center text-sm text-gray-500">Les vues apparaîtront dès que vos premiers clips seront validés.</div>`}`)}
      ${card(`<p class="font-bold">Vos campagnes</p><div class="mt-4 space-y-3">${list.length ? list.slice(0, 4).map((c) => `<button type="button" data-action="ag-open" data-id="${c.id}" class="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-gray-50">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${c.gradient} text-xl">${c.emoji}</span>
        <span class="min-w-0 flex-1"><span class="block truncate font-semibold">${esc(c.title)}</span><span class="block text-xs text-gray-500">${c.rate} DA /1K · ${c.clippers} clippers</span></span>${statusBadge(c.status)}</button>`).join("") : `<p class="text-sm text-gray-500">Aucune campagne pour l'instant.</p>`}</div>`)}
    </div>
    <div class="mt-10 flex items-center justify-between"><h2 class="text-xl font-extrabold">Derniers clips reçus</h2><a href="#/agence/clips" class="text-sm font-semibold text-brand-700 hover:underline">Tout voir</a></div>
    <div class="mt-4">${publicationsTable(clips.slice(0, 4), { showUser: true })}</div>`;
}

function gCampagnes() {
  const q = state.ag.q.trim().toLowerCase();
  const list = myCampaigns().filter((c) => (state.ag.status === "Toutes" || c.status === state.ag.status) && (!q || c.title.toLowerCase().includes(q)));
  return `${pageHeader("Mes campagnes", "Créez, suivez et pilotez vos campagnes. Chaque nouvelle campagne est vérifiée par ClipBoost avant publication.", `<button type="button" data-action="ag-new" class="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">+ Nouvelle campagne</button>`)}
    <div class="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
      <label class="relative block flex-1 lg:max-w-sm"><span class="sr-only">Rechercher une campagne</span>
        <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">${icon("search")}</span>
        <input data-input="ag-q" type="search" value="${esc(state.ag.q)}" placeholder="Rechercher une campagne" class="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"/></label>
      <div class="lg:ml-auto">${pills("ag-status", state.ag.status, ["Toutes", "Active", "En attente", "En pause", "Terminée"])}</div>
    </div>
    <div class="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">${list.length ? list.map((c) => {
      const pct = Math.min(100, Math.round((c.spent / c.budget) * 100)), clips = clipsOf([c.id]);
      const toggle = c.status === "Active" ? `<button type="button" data-action="ag-pause" data-id="${c.id}" class="flex-1 rounded-xl bg-amber-50 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100">Mettre en pause</button>`
        : c.status === "En pause" ? `<button type="button" data-action="ag-resume" data-id="${c.id}" class="flex-1 rounded-xl bg-emerald-50 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">Reprendre</button>` : "";
      return `<article class="flex flex-col rounded-3xl bg-white p-2.5 shadow-sm ring-1 ring-gray-100">
        <button type="button" data-action="ag-open" data-id="${c.id}" class="relative block aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gradient-to-br ${c.gradient}" aria-label="Détails de ${esc(c.title)}">
          <span class="absolute left-3 top-3 rounded-lg bg-ink/90 px-2 py-1 text-sm font-bold text-white">${c.rate} DA<span class="font-medium text-white/70"> /1K</span></span>
          <span class="absolute inset-0 grid place-items-center text-6xl drop-shadow-lg">${c.emoji}</span>
          <span class="absolute right-3 top-3">${statusBadge(c.status)}</span>
        </button>
        <div class="flex flex-1 flex-col px-3 pb-2 pt-3">
          <h3 class="text-lg font-semibold">${esc(c.title)}</h3>
          <p class="text-xs text-gray-500">${agencyStatusHint(c)}</p>
          <div class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-xl bg-gray-50 p-2"><p class="text-[11px] text-gray-500">Clippers</p><p class="font-bold">${c.clippers}</p></div>
            <div class="rounded-xl bg-gray-50 p-2"><p class="text-[11px] text-gray-500">Clips</p><p class="font-bold">${clips.length}</p></div>
            <div class="rounded-xl bg-gray-50 p-2"><p class="text-[11px] text-gray-500">Vues</p><p class="font-bold">${fmt(campaignViews(c) / 1000)} K</p></div>
          </div>
          <div class="mt-3"><div class="flex justify-between text-xs text-gray-500"><span>${da(c.spent)} / ${da(c.budget)}</span><span>${pct} %</span></div><div class="mt-1 h-1.5 rounded-full bg-gray-100"><div class="h-1.5 rounded-full bg-brand-600" style="width:${pct}%"></div></div></div>
          <div class="mt-4 flex gap-2">${toggle}<button type="button" data-action="ag-open" data-id="${c.id}" class="flex-1 rounded-xl bg-ink py-2 text-sm font-semibold text-white hover:bg-black">Détails</button></div>
        </div>
      </article>`;
    }).join("") : `<div class="rounded-3xl bg-gray-50 p-12 text-center md:col-span-2 xl:col-span-3"><p class="text-4xl">🎯</p><p class="mt-3 font-semibold">Aucune campagne</p><p class="mt-1 text-sm text-gray-500">Créez une campagne ou modifiez les filtres.</p></div>`}</div>`;
}

function gClips() {
  const ids = myCampaigns().map((c) => c.id);
  const list = clipsOf(ids).filter((p) => state.ag.clipStatus === "Toutes" || p.status === state.ag.clipStatus);
  return `${pageHeader("Clips reçus", "Les clips publiés par les clippers sur vos campagnes. La modération est assurée par l'équipe ClipBoost.")}
    <div class="mt-8">${pills("ag-clip-status", state.ag.clipStatus, ["Toutes", "Validée", "En attente", "Refusée"])}</div>
    <div class="mt-5">${publicationsTable(list, { showUser: true })}</div>`;
}

function gBudget() {
  const u = me(), list = myCampaigns();
  const total = list.reduce((s, c) => s + c.budget, 0), spent = list.reduce((s, c) => s + c.spent, 0);
  return `${pageHeader("Budget", "Suivez la consommation de vos campagnes et rechargez leur budget.")}
    <div class="mt-8 grid gap-4 sm:grid-cols-3">
      ${card(`<p class="text-sm text-gray-500">Crédit disponible</p><p class="mt-2 text-2xl font-extrabold">${da(u.credit)}</p><button type="button" data-action="ag-credit" class="mt-4 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Recharger le crédit</button>`, "p-5")}
      ${card(`<p class="text-sm text-gray-500">Budget engagé</p><p class="mt-2 text-2xl font-extrabold">${da(total)}</p><p class="mt-1 text-xs text-gray-500">sur ${list.length} campagne(s)</p>`, "p-5")}
      ${card(`<p class="text-sm text-gray-500">Budget consommé</p><p class="mt-2 text-2xl font-extrabold text-income">${da(spent)}</p><p class="mt-1 text-xs text-gray-500">${total ? Math.round((spent / total) * 100) : 0} % du budget engagé</p>`, "p-5")}
    </div>
    ${myTx().some((t) => t.type === "recharge") ? `<h2 class="mt-10 text-xl font-extrabold">Recharges</h2>
    <div class="mt-4 space-y-3">${myTx().filter((t) => t.type === "recharge").map((t) => `<div class="flex items-center gap-4 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-gray-100">
      <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold">${esc(t.label)}</p><p class="text-xs text-gray-500">${date(t.date)} · ${t.time} · réf. ${t.ref}</p></div>
      <p class="whitespace-nowrap text-sm font-semibold text-income">+ ${da(t.amount)}</p>${statusBadge(t.status === "En cours" ? "En attente" : t.status)}</div>`).join("")}</div>` : ""}
    <h2 class="mt-10 text-xl font-extrabold">Par campagne</h2>
    <div class="mt-4 space-y-3">${list.length ? list.map((c) => {
      const pct = Math.min(100, Math.round((c.spent / c.budget) * 100));
      return `<div class="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 md:flex-row md:items-center">
        <div class="flex min-w-0 flex-1 items-center gap-3"><span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${c.gradient} text-2xl">${c.emoji}</span><div class="min-w-0"><p class="truncate font-semibold">${esc(c.title)} <span class="ml-1 align-middle">${statusBadge(c.status)}</span></p><p class="text-xs text-gray-500">${c.rate} DA pour 1 000 vues</p></div></div>
        <div class="w-full md:w-72"><div class="flex justify-between text-xs text-gray-500"><span>${da(c.spent)} consommés</span><span>${pct} %</span></div><div class="mt-1 h-2 rounded-full bg-gray-100"><div class="h-2 rounded-full ${pct > 85 ? "bg-rose-500" : "bg-brand-600"}" style="width:${pct}%"></div></div><p class="mt-1 text-xs text-gray-400">Reste ${da(c.budget - c.spent)} sur ${da(c.budget)}</p></div>
        ${c.status === "Terminée" || c.status === "Refusée" ? `<span class="text-xs text-gray-400 md:w-36 md:text-right">Archivée</span>` : `<button type="button" data-action="ag-topup" data-id="${c.id}" class="rounded-xl px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-50 md:w-36">+ Ajouter du budget</button>`}
      </div>`;
    }).join("") : `<div class="rounded-3xl bg-gray-50 p-10 text-center text-gray-500">Aucune campagne pour l'instant.</div>`}</div>`;
}

function gProfil() {
  const u = me();
  return `${pageHeader("Profil de l'agence", "Les informations de votre structure.")}
    <div class="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      ${card(`<div class="flex items-center gap-4">${avatar(u, "h-16 w-16 text-xl")}<div><p class="text-xl font-extrabold">${esc(u.name)}</p><p class="text-sm text-gray-500">Agence · ${esc(u.country)} · membre depuis le ${date(u.joined)}</p></div></div>
        <form data-form="ag-profile" class="mt-6 grid gap-4 sm:grid-cols-2">
          ${field("Nom de l'agence ou de la marque", `<input name="name" value="${esc(u.name)}" class="${inputCls}"/>`)}
          ${field("Nom du contact", `<input name="contact" value="${esc(u.contact || "")}" class="${inputCls}"/>`)}
          <label class="block text-sm"><span class="font-medium text-gray-700">Pays</span>${countrySelect("country", u.country)}</label>
          <div class="sm:col-span-2"><button class="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-black">Enregistrer</button></div>
        </form>`)}
      ${accountCard(u)}
    </div>`;
}

const AGENCY_VIEWS = { apercu: gApercu, campagnes: gCampagnes, clips: gClips, budget: gBudget, profil: gProfil };

function campaignForm(formName, submitLabel, note) {
  const emojis = ["🎬", "⚽", "🍔", "📱", "👗", "🎵", "😂", "🚗", "💄", "🏝️", "🥤", "👕"];
  return `<form data-form="${formName}" class="mt-6 grid gap-4 sm:grid-cols-2">
    <div class="sm:col-span-2">${field("Titre de la campagne", `<input name="title" required maxlength="40" placeholder="Ex. Spécial Ramadan" class="${inputCls}"/>`)}</div>
    ${formName === "adm-campaign" ? field("Marque", `<input name="brand" required maxlength="30" class="${inputCls}"/>`) : ""}
    ${field("Catégorie", `<select name="category" class="${inputCls}">${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select>`)}
    ${field("Tarif pour 1 000 vues (DA)", `<input name="rate" type="number" min="20" max="2000" value="120" required class="${inputCls}"/>`)}
    ${field("Budget (DA)", `<input name="budget" type="number" min="${db.settings.minBudget}" step="1000" value="${Math.max(200000, db.settings.minBudget)}" required class="${inputCls}"/>`, `Minimum ${da(db.settings.minBudget)}.`)}
    ${field("Seuil minimum par clip (DA)", `<input name="minPayout" type="number" min="0" step="10" value="240" required class="${inputCls}"/><span class="mt-1 block text-xs text-gray-500">Gain à atteindre avant que le clip soit examiné.</span>`)}
    ${field("Plafond par clip (DA)", `<input name="maxPayout" type="number" min="100" step="100" value="24000" required class="${inputCls}"/><span class="mt-1 block text-xs text-gray-500">Un clip viral ne peut pas dépasser ce montant.</span>`)}
    <div class="sm:col-span-2"><span class="text-sm font-medium text-gray-700">Visuel</span><div class="mt-1.5 flex flex-wrap gap-2">${emojis.map((e, i) => `<label class="cursor-pointer"><input type="radio" name="emoji" value="${e}" ${i === 0 ? "checked" : ""} class="peer sr-only"/><span class="grid h-11 w-11 place-items-center rounded-xl text-xl ring-1 ring-gray-200 peer-checked:bg-brand-50 peer-checked:ring-2 peer-checked:ring-brand-500">${e}</span></label>`).join("")}</div></div>
    <div class="sm:col-span-2"><span class="text-sm font-medium text-gray-700">Plateformes</span><div class="mt-1.5 flex flex-wrap gap-2">${["TikTok", "Instagram", "YouTube"].map((pl) => `<label class="cursor-pointer"><input type="checkbox" name="pf-${pl}" checked class="peer sr-only"/><span class="block rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-gray-200 peer-checked:bg-brand-50 peer-checked:text-brand-700 peer-checked:ring-brand-500">${pl}</span></label>`).join("")}</div></div>
    <div class="sm:col-span-2">${field("Règles (une par ligne)", `<textarea name="rules" rows="3" class="${inputCls}">Clip de 15 à 60 secondes\nMentionner la marque</textarea>`)}</div>
    ${note ? `<p class="text-xs text-gray-500 sm:col-span-2">${note}</p>` : ""}
    <button class="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 sm:col-span-2">${submitLabel}</button>
  </form>`;
}

// Données du formulaire de campagne au format attendu par l'API.
function campaignPayload(data) {
  return {
    title: data.title, brand: data.brand, category: data.category, rate: +data.rate, budget: +data.budget, minPayout: +data.minPayout, maxPayout: +data.maxPayout,
    emoji: data.emoji, platforms: ["TikTok", "Instagram", "YouTube"].filter((pl) => data[`pf-${pl}`]),
    rules: (data.rules || "").split("\n").map((r) => r.trim()).filter(Boolean),
  };
}

function agencyModal() {
  const m = state.modal;
  if (!m) return "";
  if (m.type === "ag-new") {
    return modalShell(`<h2 class="text-2xl font-extrabold">Nouvelle campagne</h2><p class="mt-1 text-sm text-gray-500">Elle sera publiée après vérification par l'équipe ClipBoost.</p>
      ${campaignForm("ag-campaign", "Envoyer pour validation", `À l'approbation, le budget et la commission ClipBoost de ${db.settings.commissionRate} % sont prélevés sur votre crédit (crédit actuel : ${da(me().credit)}). Le budget non consommé vous est rendu à la fin de la campagne.`)}`, "max-w-xl");
  }
  if (m.type === "ag-open") {
    const c = campaignById(m.id), clips = clipsOf([c.id]), pct = Math.min(100, Math.round((c.spent / c.budget) * 100));
    return modalShell(`<div class="grid h-36 place-items-center rounded-2xl bg-gradient-to-br ${c.gradient} text-7xl">${c.emoji}</div>
      <div class="mt-5 flex items-start justify-between gap-3"><div><p class="text-sm text-gray-500">${c.category} · créée le ${date(c.createdAt)}</p><h2 class="text-2xl font-extrabold">${esc(c.title)}</h2></div>${statusBadge(c.status)}</div>
      <p class="mt-1 text-sm text-gray-500">${agencyStatusHint(c)}</p>
      <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        ${[["Tarif", `${c.rate} DA /1K`], ["Seuil", da(c.minPayout)], ["Plafond", da(c.maxPayout)], ["Clippers", c.clippers], ["Clips", clips.length], ["Vues", fmt(campaignViews(c))]].map(([k, v]) => `<div class="rounded-2xl bg-gray-50 p-3 text-center"><p class="text-xs text-gray-500">${k}</p><p class="font-bold">${v}</p></div>`).join("")}
      </div>
      <div class="mt-4"><div class="flex justify-between text-xs text-gray-500"><span>${da(c.spent)} consommés sur ${da(c.budget)}</span><span>${pct} %</span></div><div class="mt-1 h-2 rounded-full bg-gray-100"><div class="h-2 rounded-full bg-brand-600" style="width:${pct}%"></div></div></div>
      <p class="mt-5 font-bold">Règles</p><ul class="mt-2 space-y-1.5">${c.rules.map((r) => `<li class="flex gap-2 text-sm text-gray-700"><span class="text-income">${icon("check", "h-4 w-4")}</span>${esc(r)}</li>`).join("")}</ul>
      <p class="mt-5 font-bold">Clips reçus</p>
      <div class="mt-2 space-y-2">${clips.length ? clips.slice(0, 5).map((p) => `<div class="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5"><div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold">${esc(p.title)}</p><p class="text-xs text-gray-500">${esc(userById(p.userId).name)} · ${p.platform} · ${fmt(p.views)} vues</p></div>${statusBadge(p.status)}</div>`).join("") : `<p class="text-sm text-gray-500">Aucun clip pour l'instant.</p>`}</div>
      <div class="mt-6 flex gap-2">
        ${c.status === "Active" ? `<button type="button" data-action="ag-pause" data-id="${c.id}" class="flex-1 rounded-xl bg-amber-50 py-3 font-semibold text-amber-700">Mettre en pause</button>` : ""}
        ${c.status === "En pause" ? `<button type="button" data-action="ag-resume" data-id="${c.id}" class="flex-1 rounded-xl bg-emerald-50 py-3 font-semibold text-emerald-700">Reprendre</button>` : ""}
        ${c.status !== "Terminée" ? `<button type="button" data-action="ag-topup" data-id="${c.id}" class="flex-1 rounded-xl bg-ink py-3 font-semibold text-white">+ Ajouter du budget</button>` : ""}
      </div>`);
  }
  if (m.type === "ag-topup") {
    const c = campaignById(m.id), u = me(), funded = c.status !== "En attente";
    return modalShell(`<h2 class="text-2xl font-extrabold">Ajouter du budget</h2><p class="mt-1 text-sm text-gray-500">« ${esc(c.title)} » · crédit disponible : <b>${da(u.credit)}</b>.</p>
      <form data-form="ag-topup" class="mt-6 space-y-4">
        ${field("Montant ajouté au budget (DA)", `<input name="amount" type="number" min="1000" step="1000" value="50000" required class="${inputCls}"/>`,
          funded ? `Prélevé sur votre crédit avec la commission de ${c.commissionRate} % (50 000 DA ajoutés = ${da(withCommission(50000, c.commissionRate))}).` : "La campagne n'est pas encore approuvée : rien n'est prélevé pour l'instant.")}
        <button class="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700">Ajouter au budget</button></form>
      ${funded && u.credit < withCommission(1000, c.commissionRate) ? `<p class="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Crédit insuffisant. <button type="button" data-action="ag-credit" class="font-semibold underline">Recharger le crédit</button></p>` : ""}`);
  }
  if (m.type === "ag-credit") {
    return modalShell(`<h2 class="text-2xl font-extrabold">Recharger le crédit</h2><p class="mt-1 text-sm text-gray-500">Le crédit est ajouté dès que l'équipe ClipBoost confirme la réception de votre paiement.</p>
      <form data-form="ag-credit" class="mt-6 space-y-4">
        ${field("Montant (DA)", `<input name="amount" type="number" min="10000" step="1000" value="250000" required class="${inputCls}"/>`, "Minimum 10 000 DA.")}
        <div class="space-y-2">${["virement bancaire", "carte Edahabia", "carte CIB"].map((v, i) => `<label class="flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 ring-gray-200 has-[:checked]:bg-brand-50 has-[:checked]:ring-brand-500"><input type="radio" name="method" value="${v}" ${i === 0 ? "checked" : ""} class="accent-brand-600"/> <span class="font-semibold">${v[0].toUpperCase()}${v.slice(1)}</span></label>`).join("")}</div>
        <button class="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700">Envoyer la demande de recharge</button></form>`);
  }
  return "";
}

function handleAgencyAction(action, t) {
  const id = t.dataset.id;
  switch (action) {
    case "ag-status": state.ag.status = t.dataset.value; return render();
    case "ag-clip-status": state.ag.clipStatus = t.dataset.value; return render();
    case "ag-new": state.modal = { type: "ag-new" }; state.drawer = false; return render();
    case "ag-open": state.modal = { type: "ag-open", id }; return render();
    case "ag-topup": state.modal = { type: "ag-topup", id }; return render();
    case "ag-credit": state.modal = { type: "ag-credit" }; state.drawer = false; return render();
    case "ag-pause": case "ag-resume":
      return act("PATCH", `/api/campaigns/${id}`, { status: action === "ag-pause" ? "En pause" : "Active" }, action === "ag-pause" ? "Campagne mise en pause" : "Campagne relancée");
  }
}

function handleAgencySubmit(form, data) {
  if (form === "ag-campaign") {
    return act("POST", "/api/campaigns", campaignPayload(data), "Campagne envoyée pour validation ✓", () => {
      state.modal = null; state.ag.status = "Toutes";
      navigate("#/agence/campagnes");
    });
  }
  if (form === "ag-topup") {
    const amount = Math.floor(+data.amount);
    return act("POST", `/api/campaigns/${state.modal.id}/budget`, { amount }, `${da(amount)} ajoutés au budget`, () => { state.modal = null; });
  }
  if (form === "ag-credit") {
    return act("POST", "/api/credit", { amount: Math.floor(+data.amount), method: data.method }, (r) => `Demande envoyée · référence ${r.ref} à indiquer dans votre paiement`, () => { state.modal = null; });
  }
  if (form === "ag-profile") {
    return act("PATCH", "/api/me", { name: data.name, contact: data.contact, country: data.country }, "Profil de l'agence mis à jour ✓");
  }
}
