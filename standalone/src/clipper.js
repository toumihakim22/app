// Espace Clipper : tableau de bord, campagnes, publications, portefeuille, statistiques, profil, paramètres.

const me = () => userById(state.session);
const myPubs = () => db.publications.filter((p) => p.userId === state.session);
const myTx = () => db.transactions.filter((t) => t.userId === state.session);
const myNotifs = () => db.notifications.filter((n) => n.userId === state.session);
const activeCampaigns = () => db.campaigns.filter((c) => c.status === "Active");

const totalEarned = (u = me()) => db.publications.filter((p) => p.userId === u.id).reduce((s, p) => s + earningsOf(p), 0) + u.baseEarned;
const pendingAmount = (u = me()) => db.transactions.filter((t) => t.userId === u.id && t.type === "gain" && t.status === "En cours").reduce((s, t) => s + t.amount, 0);
// Un retrait en cours est déjà déduit du solde ; un retrait refusé est rendu.
const balance = (u = me()) => db.transactions.filter((t) => t.userId === u.id && (t.status === "Validé" || (t.type === "retrait" && t.status === "En cours"))).reduce((s, t) => s + t.amount, 0) + u.baseBalance;
const userViews = () => views30.map((v) => +(v * me().viewsFactor).toFixed(1));

const CLIPPER_NAV = [
  { id: "accueil", label: "Vue d'ensemble", short: "Accueil", icon: "home" },
  { id: "campagnes", label: "Campagnes", icon: "target" },
  { id: "publications", label: "Mes publications", short: "Publications", icon: "film" },
  { id: "portefeuille", label: "Portefeuille", icon: "wallet" },
  { id: "statistiques", label: "Statistiques", icon: "chart" },
  { id: "profil", label: "Profil", icon: "user" },
  { id: "parametres", label: "Paramètres", icon: "gear" },
];

function incomeCard() {
  const u = me();
  return `<div class="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
    <div class="flex items-start justify-between gap-3 p-6 pb-2">
      <div>
        <p class="text-sm font-medium text-gray-700">Revenus</p>
        <p class="mt-2 whitespace-nowrap text-3xl font-extrabold tracking-tight">${da(totalEarned())}</p>
        <p class="mt-2 text-sm text-gray-600">${u.viewsFactor ? `${icon("trend", "mr-1 inline h-4 w-4 align-[-2px]")}<span class="font-semibold text-ink">+8,2 %</span> par rapport au mois dernier` : "Vos premiers gains apparaîtront ici."}</p>
      </div>
      <span class="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-income text-white shadow-md">${icon("arrowUp", "h-6 w-6")}</span>
    </div>
    <div class="h-32">${areaChart(u.viewsFactor ? income12 : income12.map(() => 0.01))}</div>
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
  const u = me(), fav = u.favorites.has(c.id), joined = u.joinedCampaigns.has(c.id);
  const generated = myPubs().filter((p) => p.campaign === c.id).reduce((s, p) => s + earningsOf(p), 0);
  const pct = Math.min(100, Math.round((c.spent / c.budget) * 100));
  return `<article class="flex flex-col rounded-3xl bg-white p-2.5 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-md">
    <div class="relative">
      <button type="button" data-action="open-campaign" data-id="${c.id}" class="relative block w-full ${compact ? "aspect-[16/10]" : "aspect-[4/3]"} overflow-hidden rounded-2xl bg-gradient-to-br ${c.gradient}" aria-label="Voir la campagne ${esc(c.title)}">
        <span class="absolute left-3 top-3 rounded-lg bg-ink/90 px-2 py-1 text-sm font-bold text-white">${c.rate} DA<span class="font-medium text-white/70"> /1K</span></span>
        <span class="absolute inset-0 grid place-items-center text-6xl drop-shadow-lg">${c.emoji}</span>
        ${c.top ? `<span class="absolute bottom-3 right-3 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-ink">⭐ Top campagne</span>` : ""}
      </button>
      <button type="button" data-action="toggle-fav" data-id="${c.id}" aria-pressed="${fav}" aria-label="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}"
        class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow ${fav ? "text-rose-500" : "text-gray-400 hover:text-rose-500"}">${icon("heart", "h-4 w-4", fav)}</button>
    </div>
    <div class="flex flex-1 flex-col px-3 pb-2 pt-3">
      <p class="text-xs text-gray-400">Créée le ${date(c.createdAt)}</p>
      <h3 class="mt-1.5 text-lg font-semibold">${esc(c.title)}</h3>
      <ul class="mt-3 space-y-2 text-sm text-gray-700">
        <li class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-rose-500"></span>${esc(c.brand)} · ${c.category}</li>
        <li class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>${joined ? `${da(generated)} générés` : `${c.clippers} clippers inscrits`}</li>
        <li class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-amber-500"></span>Max ${da(c.maxPayout)} par clip</li>
      </ul>
      ${compact ? "" : `<div class="mt-3"><div class="flex justify-between text-xs text-gray-500"><span>Budget utilisé</span><span>${pct} %</span></div><div class="mt-1 h-1.5 rounded-full bg-gray-100"><div class="h-1.5 rounded-full bg-brand-600" style="width:${pct}%"></div></div></div>`}
      ${joined
        ? `<button type="button" data-action="copy" data-id="${c.id}" class="mt-4 rounded-xl bg-brand-50 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100">Copier le lien</button>`
        : `<button type="button" data-action="join" data-id="${c.id}" class="mt-4 rounded-xl bg-ink py-2 text-sm font-semibold text-white hover:bg-black">Rejoindre</button>`}
    </div>
  </article>`;
}

function campaignRow(c) {
  const u = me(), fav = u.favorites.has(c.id), joined = u.joinedCampaigns.has(c.id);
  return `<div class="flex items-center gap-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
    <button type="button" data-action="open-campaign" data-id="${c.id}" class="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${c.gradient} text-3xl" aria-label="Voir ${esc(c.title)}">${c.emoji}</button>
    <div class="min-w-0 flex-1"><p class="truncate font-semibold">${esc(c.title)}</p><p class="truncate text-sm text-gray-500">${esc(c.brand)} · ${c.category} · ${c.clippers} clippers</p></div>
    <span class="hidden rounded-lg bg-ink px-2 py-1 text-sm font-bold text-white sm:inline">${c.rate} DA /1K</span>
    <button type="button" data-action="toggle-fav" data-id="${c.id}" aria-pressed="${fav}" aria-label="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}" class="grid h-9 w-9 place-items-center rounded-full ${fav ? "text-rose-500" : "text-gray-400 hover:text-rose-500"}">${icon("heart", "h-4 w-4", fav)}</button>
    ${joined
      ? `<button type="button" data-action="copy" data-id="${c.id}" class="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100">Copier</button>`
      : `<button type="button" data-action="join" data-id="${c.id}" class="rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-black">Rejoindre</button>`}
  </div>`;
}

function publicationsTable(list, { showUser = false, actions = false } = {}) {
  if (!list.length) return `<div class="rounded-3xl bg-gray-50 p-12 text-center text-gray-500">Aucune publication pour le moment.</div>`;
  const platformTone = { TikTok: "bg-ink text-white", Instagram: "bg-pink-100 text-pink-700", YouTube: "bg-red-100 text-red-700" };
  return `<div class="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
    <div class="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 border-b border-gray-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 md:grid"><span>Clip</span><span>Plateforme</span><span>Vues</span><span>Gains</span><span>${actions ? "Décision" : "Statut"}</span></div>
    ${list.map((p) => {
      const c = campaignById(p.campaign), owner = userById(p.userId);
      const thumb = `<span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${c.gradient} text-xl">${c.emoji}</span>`;
      const platform = `<span class="rounded-md px-2 py-1 text-xs font-semibold ${platformTone[p.platform]}">${p.platform}</span>`;
      const gain = p.status === "Validée" ? `${da(earningsOf(p))}${isCapped(p) ? `<span class="block text-xs font-medium text-amber-600">Plafond atteint</span>` : ""}`
        : p.status === "En attente" && belowMin(p) ? `<span class="text-xs font-medium text-gray-500">Sous le seuil<span class="block">${fmt(p.views)} / ${fmt(viewsFor(c, c.minPayout))} vues</span></span>` : "—";
      const sub = showUser ? `${esc(owner.name)} · ${esc(c.title)}` : `${esc(c.title)} · ${date(p.date)}`;
      const decision = actions && p.status === "En attente" && belowMin(p)
        ? `<span class="flex flex-wrap items-center gap-2"><span class="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500" title="Le clip n'a pas encore atteint le seuil minimum de la campagne">Seuil non atteint</span><button type="button" data-action="adm-reject" data-id="${p.id}" class="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100">Refuser</button></span>`
        : actions && p.status === "En attente"
        ? `<span class="flex gap-2"><button type="button" data-action="adm-validate" data-id="${p.id}" class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Valider</button><button type="button" data-action="adm-reject" data-id="${p.id}" class="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100">Refuser</button></span>`
        : `${statusBadge(p.status)}${p.reason ? `<span class="mt-1 block text-xs text-rose-500">${esc(p.reason)}</span>` : ""}`;
      return `<div class="border-b border-gray-50 px-4 py-4 last:border-0 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:items-center md:gap-4 md:px-6">
        <div class="flex min-w-0 items-center gap-3">${thumb}
          <div class="min-w-0 flex-1"><p class="truncate font-semibold">${esc(p.title)}</p><p class="truncate text-xs text-gray-500">${sub}</p></div>
          ${actions ? "" : `<span class="md:hidden">${statusBadge(p.status)}</span>`}
        </div>
        <div class="mt-3 flex items-center gap-3 pl-14 text-sm text-gray-700 md:hidden">${platform}<span>${fmt(p.views)} vues</span><span class="ml-auto font-semibold text-ink">${gain}</span></div>
        ${actions ? `<div class="mt-3 pl-14 md:hidden">${decision}</div>` : p.reason ? `<p class="mt-2 pl-14 text-xs text-rose-500 md:hidden">${esc(p.reason)}</p>` : ""}
        <span class="hidden md:block">${platform}</span>
        <span class="hidden text-sm text-gray-700 md:block">${fmt(p.views)}</span>
        <span class="hidden text-sm font-semibold md:block">${gain}</span>
        <span class="hidden md:block">${decision}</span>
      </div>`;
    }).join("")}</div>`;
}

// ---------- Vues ----------

function cAccueil() {
  const u = me(), pubs = myPubs();
  const totalViews = pubs.reduce((s, p) => s + p.views, 0), validated = pubs.filter((p) => p.status === "Validée").length;
  const stats = [
    { label: "Gains du mois", value: da(pubs.reduce((s, p) => s + earningsOf(p), 0)), delta: u.viewsFactor ? "+8,2 %" : "Ce mois-ci", icon: "wallet", tone: "bg-emerald-50 text-income" },
    { label: "Vues totales", value: fmt(totalViews), delta: u.viewsFactor ? "+12,4 %" : "Ce mois-ci", icon: "chart", tone: "bg-brand-50 text-brand-600" },
    { label: "Clips publiés", value: String(pubs.length), delta: "Depuis l'inscription", icon: "film", tone: "bg-amber-50 text-amber-600" },
    { label: "Taux de validation", value: pubs.length ? `${Math.round((validated / pubs.length) * 100)} %` : "—", delta: "Objectif 80 %", icon: "check", tone: "bg-sky-50 text-sky-600" },
  ];
  const recommended = activeCampaigns().filter((c) => !u.joinedCampaigns.has(c.id)).slice(0, 3);
  const views = state.period === 7 ? userViews().slice(-7) : userViews();
  const onboarding = !u.joinedCampaigns.size
    ? `<div class="mt-8 flex flex-col gap-4 rounded-3xl bg-brand-600 p-6 text-white sm:flex-row sm:items-center sm:justify-between"><div><p class="text-lg font-bold">Bienvenue ${esc(u.name.split(" ")[0])} ! Prêt pour votre premier clip ?</p><p class="mt-1 text-white/80">1. Rejoignez une campagne · 2. Publiez votre clip · 3. Soumettez le lien pour validation.</p></div><a href="#/clipper/campagnes" class="shrink-0 rounded-2xl bg-white px-5 py-3 text-center font-semibold text-brand-700">Voir les campagnes</a></div>` : "";
  return `${pageHeader(`Bonjour ${esc(u.name.split(" ")[0])} 👋`, "Voici le résumé de votre activité de clipping.", `<button type="button" data-action="submit-clip" class="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-black">+ Soumettre un clip</button>`)}
    ${onboarding}
    <div class="mt-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      ${stats.map((s) => card(`<div class="flex items-start justify-between gap-2"><p class="text-xs font-medium text-gray-500 sm:text-sm">${s.label}</p><span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 ${s.tone}">${icon(s.icon)}</span></div>
        <p class="mt-3 whitespace-nowrap text-lg font-extrabold sm:text-2xl">${s.value}</p><p class="mt-1 text-xs font-medium text-gray-500">${s.delta}</p>`, "p-4 sm:p-5")).join("")}
    </div>
    <div class="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      ${card(`<div class="flex flex-wrap items-center justify-between gap-3"><div><p class="font-bold">Vues de vos clips</p><p class="text-sm text-gray-500">${state.period} derniers jours, en milliers</p></div>
        ${pills("period", `${state.period} jours`, ["7 jours", "30 jours"])}</div>
        ${u.viewsFactor ? `<div class="mt-6 h-56">${areaChart(views, { h: 200, color: "#7c3aed" })}</div>` : `<div class="mt-6 grid h-56 place-items-center rounded-2xl bg-gray-50 text-center text-sm text-gray-500">Pas encore de vues.<br/>Vos statistiques apparaîtront après votre premier clip validé.</div>`}`)}
      <div class="space-y-3">${incomeCard()}${myTx().slice(0, 2).map(txRow).join("")}</div>
    </div>
    ${recommended.length ? `<div class="mt-10 flex items-center justify-between"><h2 class="text-xl font-extrabold">Campagnes recommandées</h2><a href="#/clipper/campagnes" class="text-sm font-semibold text-brand-700 hover:underline">Tout voir</a></div>
    <div class="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">${recommended.map((c) => campaignCard(c, true)).join("")}</div>` : ""}
    <div class="mt-10 flex items-center justify-between"><h2 class="text-xl font-extrabold">Dernières publications</h2><a href="#/clipper/publications" class="text-sm font-semibold text-brand-700 hover:underline">Tout voir</a></div>
    <div class="mt-4">${publicationsTable(pubs.slice(0, 4))}</div>`;
}

function cCampagnes() {
  const f = state.camp, q = f.q.trim().toLowerCase(), u = me();
  let list = activeCampaigns().filter((c) =>
    (f.category === "Toutes" || c.category === f.category) &&
    (!f.favOnly || u.favorites.has(c.id)) &&
    (!q || `${c.title} ${c.brand}`.toLowerCase().includes(q)));
  const sorters = { recent: (a, b) => b.createdAt.localeCompare(a.createdAt), rate: (a, b) => b.rate - a.rate, popular: (a, b) => b.clippers - a.clippers };
  list = list.slice().sort(sorters[f.sort]);
  return `${pageHeader("Campagnes", `${activeCampaigns().length} campagnes actives · tarif pour 1 000 vues validées`)}
    <div class="mt-8 flex flex-col gap-3 xl:flex-row xl:items-center">
      <label class="relative block flex-1 xl:max-w-sm"><span class="sr-only">Rechercher une campagne</span>
        <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">${icon("search")}</span>
        <input data-input="camp-q" type="search" value="${esc(f.q)}" placeholder="Rechercher" class="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"/></label>
      <div class="flex flex-wrap items-center gap-3 xl:ml-auto">
        ${select("camp-category", f.category, [["Toutes", "Toutes les catégories"], ...CATEGORIES.map((c) => [c, c])])}
        ${select("camp-sort", f.sort, [["recent", "Plus récentes"], ["rate", "Mieux payées"], ["popular", "Plus populaires"]])}
        <button type="button" data-action="fav-only" aria-pressed="${f.favOnly}" class="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${f.favOnly ? "bg-rose-50 text-rose-600 ring-1 ring-rose-100" : "bg-white text-gray-600 ring-1 ring-gray-200"}">${icon("heart", "h-4 w-4", f.favOnly)} Favoris (${u.favorites.size})</button>
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

function cPublications() {
  const pubs = myPubs(), list = pubs.filter((p) => state.pub.status === "Toutes" || p.status === state.pub.status);
  const count = (s) => pubs.filter((p) => p.status === s).length;
  return `${pageHeader("Mes publications", `${pubs.length} clips soumis · ${count("Validée")} validés · ${count("En attente")} en attente`, `<button type="button" data-action="submit-clip" class="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-black">+ Soumettre un clip</button>`)}
    <div class="mt-8">${pills("pub-status", state.pub.status, ["Toutes", "Validée", "En attente", "Refusée"])}</div>
    <div class="mt-5">${publicationsTable(list)}</div>`;
}

function cPortefeuille() {
  const list = myTx().filter((t) => state.tx.type === "tous" || t.type === state.tx.type);
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
        <div class="mt-4 space-y-3">${list.length ? list.map((t) => `<div class="flex items-center gap-4 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-gray-100">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.type === "retrait" ? "bg-gray-100 text-gray-600" : "bg-emerald-50 text-income"}">${icon(t.type === "retrait" ? "wallet" : "arrowUp", "h-4 w-4")}</span>
          <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold">${esc(t.label)}</p><p class="text-xs text-gray-500">${date(t.date)} · ${t.time} · ${t.id}</p></div>
          <p class="whitespace-nowrap text-sm font-semibold ${t.amount < 0 ? "text-gray-500" : "text-income"}">${t.amount < 0 ? "" : "+ "}${da(t.amount)}</p>
          <span class="hidden sm:inline">${statusBadge(t.status)}</span></div>`).join("") : `<div class="rounded-3xl bg-gray-50 p-10 text-center text-gray-500">Aucune opération pour le moment.</div>`}</div>
      </div>
    </div>`;
}

function cStatistiques() {
  const pubs = myPubs();
  if (!pubs.length) return `${pageHeader("Statistiques", "Comprenez ce qui fait performer vos clips.")}<div class="mt-8 rounded-3xl bg-gray-50 p-12 text-center"><p class="text-4xl">📊</p><p class="mt-3 font-semibold">Pas encore de données</p><p class="mt-1 text-sm text-gray-500">Soumettez votre premier clip pour voir vos statistiques.</p></div>`;
  const byPlatform = ["TikTok", "Instagram", "YouTube"].map((pl) => ({ pl, views: pubs.filter((p) => p.platform === pl).reduce((s, p) => s + p.views, 0) }));
  const maxP = Math.max(...byPlatform.map((b) => b.views), 1);
  const byCampaign = db.campaigns.map((c) => ({ c, earn: pubs.filter((p) => p.campaign === c.id).reduce((s, p) => s + earningsOf(p), 0) })).filter((x) => x.earn > 0).sort((a, b) => b.earn - a.earn);
  const maxC = byCampaign.length ? byCampaign[0].earn : 1;
  const top = pubs.slice().sort((a, b) => b.views - a.views).slice(0, 3);
  const colors = { TikTok: "bg-ink", Instagram: "bg-pink-500", YouTube: "bg-red-500" };
  return `${pageHeader("Statistiques", "Comprenez ce qui fait performer vos clips.", pills("period", `${state.period} jours`, ["7 jours", "30 jours"]))}
    <div class="mt-8">${card(`<p class="font-bold">Vues quotidiennes (milliers)</p><div class="mt-6 h-64">${areaChart(state.period === 7 ? userViews().slice(-7) : userViews(), { h: 220, color: "#7c3aed" })}</div>`)}</div>
    <div class="mt-6 grid gap-6 lg:grid-cols-2">
      ${card(`<p class="font-bold">Vues par plateforme</p><div class="mt-6 space-y-5">${byPlatform.map((b) => `<div><div class="flex justify-between text-sm"><span class="font-medium">${b.pl}</span><span class="text-gray-500">${fmt(b.views)} vues</span></div><div class="mt-2 h-3 rounded-full bg-gray-100"><div class="h-3 rounded-full ${colors[b.pl]}" style="width:${(b.views / maxP) * 100}%"></div></div></div>`).join("")}</div>`)}
      ${card(`<p class="font-bold">Gains par campagne</p><div class="mt-6 space-y-5">${byCampaign.length ? byCampaign.map((x) => `<div><div class="flex justify-between text-sm"><span class="font-medium">${x.c.emoji} ${esc(x.c.title)}</span><span class="text-gray-500">${da(x.earn)}</span></div><div class="mt-2 h-3 rounded-full bg-gray-100"><div class="h-3 rounded-full bg-income" style="width:${(x.earn / maxC) * 100}%"></div></div></div>`).join("") : `<p class="text-sm text-gray-500">Aucun gain validé pour l'instant.</p>`}</div>`)}
    </div>
    <h2 class="mt-10 text-xl font-extrabold">Vos meilleurs clips</h2>
    <div class="mt-4 grid gap-4 md:grid-cols-3">${top.map((p, i) => { const c = campaignById(p.campaign); return card(`<div class="flex items-center gap-3"><span class="text-3xl font-black text-gray-200">#${i + 1}</span><span class="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${c.gradient} text-2xl">${c.emoji}</span></div><p class="mt-4 font-semibold">${esc(p.title)}</p><p class="text-sm text-gray-500">${p.platform} · ${esc(c.title)}</p><p class="mt-3 text-2xl font-extrabold">${fmt(p.views)} <span class="text-sm font-medium text-gray-500">vues</span></p>`, "p-5"); }).join("")}</div>`;
}

function cProfil() {
  const u = me();
  const accounts = [["TikTok", u.handle, u.viewsFactor ? "18,4 K abonnés" : "Non connecté", !!u.viewsFactor], ["Instagram", u.handle, u.viewsFactor ? "6,1 K abonnés" : "Non connecté", !!u.viewsFactor], ["YouTube", u.name, "Non connecté", false]];
  return `${pageHeader("Profil", "Vos informations et votre compte.")}
    <div class="mt-8 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
      <div class="space-y-6">
        ${card(`<div class="flex flex-col items-center text-center">${avatar(u, "h-24 w-24 text-3xl")}
          <p class="mt-4 text-xl font-extrabold">${esc(u.name)}</p><p class="text-gray-500">${esc(u.handle)} · ${esc(u.country)}</p>
          <span class="mt-3 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">🥈 ${u.level}</span>
          ${u.bio ? `<p class="mt-5 text-sm leading-relaxed text-gray-600">${esc(u.bio)}</p>` : ""}
          <p class="mt-4 text-xs text-gray-400">Membre depuis le ${date(u.joined)}</p></div>`)}
        ${accountCard(u)}
      </div>
      <div class="space-y-6">
        ${card(`<p class="font-bold">Informations publiques</p><form data-form="profile" class="mt-5 grid gap-4 sm:grid-cols-2">
          ${field("Nom complet", `<input name="name" value="${esc(u.name)}" class="${inputCls}"/>`)}
          <label class="block text-sm"><span class="font-medium text-gray-700">Pays</span><select name="country" class="${inputCls}">${COUNTRIES.map((w) => `<option ${w === u.country ? "selected" : ""}>${w}</option>`).join("")}</select></label>
          <div class="sm:col-span-2">${field("Bio", `<textarea name="bio" rows="3" placeholder="Présentez votre style de clips aux marques…" class="${inputCls}">${esc(u.bio)}</textarea>`)}</div>
          <div class="sm:col-span-2"><button class="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-black">Enregistrer</button></div></form>`)}
        ${card(`<p class="font-bold">Comptes connectés</p><div class="mt-4 divide-y divide-gray-100">${accounts.map(([pl, h, f, on]) => `<div class="flex items-center justify-between gap-3 py-3"><div><p class="font-semibold">${pl}</p><p class="text-sm text-gray-500">${on ? `${esc(h)} · ${f}` : f}</p></div>
          <button type="button" data-action="toast" data-msg="${on ? `Compte ${pl} déjà connecté` : `Redirection vers ${pl} pour autoriser ClipBoost…`}" class="rounded-xl px-3 py-2 text-sm font-semibold ${on ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"}">${on ? "Connecté" : "Connecter"}</button></div>`).join("")}</div>`)}
      </div>
    </div>`;
}

function cParametres() {
  const row = (key, title, text) => `<div class="flex items-center justify-between gap-4 py-4"><div><p class="font-semibold">${title}</p><p class="text-sm text-gray-500">${text}</p></div>${switchBtn(state.settings[key], "setting", key, title)}</div>`;
  return `${pageHeader("Paramètres", "Gérez vos préférences.")}
    <div class="mt-8 grid gap-6 lg:grid-cols-2">
      ${card(`<p class="font-bold">Notifications</p><div class="mt-2 divide-y divide-gray-100">
        ${row("email", "E-mails", "Validations, refus et versements.")}
        ${row("push", "Notifications navigateur", "Alertes en temps réel.")}
        ${row("newCampaigns", "Nouvelles campagnes", "Être prévenu dès qu'une campagne correspond à vos catégories.")}
        ${row("weekly", "Résumé hebdomadaire", "Un bilan de vos vues et gains chaque dimanche.")}</div>`)}
      <div class="space-y-6">
        ${card(`<p class="font-bold">Langue et région</p><div class="mt-4 grid gap-4 sm:grid-cols-2">
          ${field("Langue", `<select class="${inputCls}"><option>Français</option></select>`)}
          ${field("Devise", `<select class="${inputCls}"><option>Dinar algérien (DA)</option></select>`)}</div>`)}
        ${card(`<p class="font-bold">Moyen de retrait</p><p class="mt-1 text-sm text-gray-500">Utilisé pour vos demandes de retrait.</p>
          <div class="mt-4 space-y-2">${["CCP •••• 5678", "BaridiMob"].map((m, i) => `<label class="flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 ring-gray-200 has-[:checked]:bg-brand-50 has-[:checked]:ring-brand-500"><input type="radio" name="payout" ${i === 0 ? "checked" : ""} class="accent-brand-600"/> <span class="font-medium">${m}</span></label>`).join("")}</div>`)}
        <button type="button" data-action="toast" data-msg="Préférences enregistrées" class="w-full rounded-2xl bg-ink py-3.5 font-semibold text-white hover:bg-black">Enregistrer les préférences</button>
      </div>
    </div>`;
}

const CLIPPER_VIEWS = { accueil: cAccueil, campagnes: cCampagnes, publications: cPublications, portefeuille: cPortefeuille, statistiques: cStatistiques, profil: cProfil, parametres: cParametres };

function clipperModal() {
  const m = state.modal;
  if (!m) return "";
  const u = me();
  if (m.type === "campaign") {
    const c = campaignById(m.id), joined = u.joinedCampaigns.has(c.id);
    return modalShell(`<div class="grid h-40 place-items-center rounded-2xl bg-gradient-to-br ${c.gradient} text-7xl">${c.emoji}</div>
      <div class="mt-5 flex items-start justify-between gap-3"><div><p class="text-sm text-gray-500">${esc(c.brand)} · ${c.category}</p><h2 class="text-2xl font-extrabold">${esc(c.title)}</h2></div><span class="whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-sm font-bold text-white">${c.rate} DA /1K</span></div>
      <div class="mt-5 grid grid-cols-3 gap-3 text-center">
        <div class="rounded-2xl bg-gray-50 p-3"><p class="text-xs text-gray-500">Budget</p><p class="text-sm font-bold sm:text-base">${da(c.budget)}</p></div>
        <div class="rounded-2xl bg-gray-50 p-3"><p class="text-xs text-gray-500">Restant</p><p class="text-sm font-bold sm:text-base">${da(c.budget - c.spent)}</p></div>
        <div class="rounded-2xl bg-gray-50 p-3"><p class="text-xs text-gray-500">Clippers</p><p class="text-sm font-bold sm:text-base">${c.clippers}</p></div></div>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <div class="rounded-2xl bg-brand-50 p-3"><p class="text-xs text-brand-700">Seuil minimum</p><p class="text-sm font-bold sm:text-base">${da(c.minPayout)}</p><p class="text-xs text-gray-500">soit ${fmt(viewsFor(c, c.minPayout))} vues pour être payé</p></div>
        <div class="rounded-2xl bg-amber-50 p-3"><p class="text-xs text-amber-700">Plafond par clip</p><p class="text-sm font-bold sm:text-base">${da(c.maxPayout)}</p><p class="text-xs text-gray-500">atteint à ${fmt(viewsFor(c, c.maxPayout))} vues</p></div></div>
      <p class="mt-5 font-bold">Règles de la campagne</p>
      <ul class="mt-2 space-y-2">${c.rules.map((r) => `<li class="flex gap-2 text-sm text-gray-700"><span class="text-income">${icon("check", "h-4 w-4")}</span>${esc(r)}</li>`).join("")}</ul>
      <p class="mt-4 text-sm text-gray-500">Plateformes : ${c.platforms.join(", ")}</p>
      <div class="mt-6 flex gap-3">${joined
        ? `<button type="button" data-action="copy" data-id="${c.id}" class="flex-1 rounded-xl bg-brand-50 py-3 font-semibold text-brand-700">Copier le lien</button><button type="button" data-action="submit-clip" data-id="${c.id}" class="flex-1 rounded-xl bg-ink py-3 font-semibold text-white">Soumettre un clip</button>`
        : `<button type="button" data-action="join" data-id="${c.id}" class="flex-1 rounded-xl bg-ink py-3 font-semibold text-white">Rejoindre la campagne</button>`}</div>`);
  }
  if (m.type === "submit") {
    const joined = activeCampaigns().filter((c) => u.joinedCampaigns.has(c.id));
    if (!joined.length) return modalShell(`<h2 class="text-2xl font-extrabold">Soumettre un clip</h2><p class="mt-3 text-gray-600">Rejoignez d'abord une campagne pour pouvoir soumettre un clip.</p><a href="#/clipper/campagnes" data-action="close-modal" class="mt-6 block rounded-xl bg-ink py-3 text-center font-semibold text-white">Voir les campagnes</a>`);
    return modalShell(`<h2 class="text-2xl font-extrabold">Soumettre un clip</h2><p class="mt-1 text-sm text-gray-500">Le clip sera vérifié par l'équipe ClipBoost avant validation.</p>
      <form data-form="submit" class="mt-6 space-y-4">
        ${field("Campagne", `<select name="campaign" required class="${inputCls}">${joined.map((c) => `<option value="${c.id}" ${c.id === m.id ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select>`)}
        ${field("Titre du clip", `<input name="title" required maxlength="80" placeholder="Ex. Le but de l'année" class="${inputCls}"/>`)}
        ${field("Lien de la vidéo", `<input name="url" type="url" required placeholder="https://www.tiktok.com/@…" class="${inputCls}"/>`)}
        ${field("Plateforme", `<select name="platform" class="${inputCls}"><option>TikTok</option><option>Instagram</option><option>YouTube</option></select>`)}
        <button class="w-full rounded-xl bg-ink py-3 font-semibold text-white hover:bg-black">Envoyer pour validation</button>
      </form>`);
  }
  if (m.type === "withdraw") {
    const min = db.settings.minWithdraw, bal = Math.floor(balance());
    if (bal < min) return modalShell(`<h2 class="text-2xl font-extrabold">Demander un retrait</h2><p class="mt-3 text-gray-600">Votre solde disponible (${da(bal)}) est inférieur au minimum de retrait fixé à <b>${da(min)}</b>.</p>`);
    return modalShell(`<h2 class="text-2xl font-extrabold">Demander un retrait</h2><p class="mt-1 text-sm text-gray-500">Solde disponible : <b>${da(bal)}</b>. Le virement est traité sous 48 h ouvrées.</p>
      <form data-form="withdraw" class="mt-6 space-y-4">
        ${field("Montant (DA)", `<input name="amount" type="number" min="${min}" max="${bal}" step="100" required value="${Math.min(10000, bal)}" class="${inputCls}"/>`, `Minimum ${da(min)} · validé par l'équipe ClipBoost.`)}
        ${field("Vers", `<select name="to" class="${inputCls}"><option>CCP •••• 5678</option><option>BaridiMob</option></select>`)}
        <button class="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700">Confirmer la demande</button>
      </form>`);
  }
  if (m.type === "invite") {
    const code = u.handle.replace("@", "").replace(/[^a-z0-9]/gi, "") || "ami";
    return modalShell(`<h2 class="text-2xl font-extrabold">Inviter un créateur 🙋</h2><p class="mt-1 text-sm text-gray-500">Partagez votre lien de parrainage : 500 DA par créateur actif (offre fictive).</p>
      <div class="mt-6 flex gap-2"><input readonly value="https://clipboost.dz/invite/${esc(code)}" class="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm"/><button type="button" data-action="copy-invite" data-code="${esc(code)}" class="rounded-xl bg-brand-600 px-4 font-semibold text-white">Copier</button></div>`);
  }
  return "";
}

function handleClipperAction(action, t) {
  const u = me(), { id, value } = t.dataset;
  switch (action) {
    case "toggle-fav":
      u.favorites.has(id) ? u.favorites.delete(id) : u.favorites.add(id);
      toast(u.favorites.has(id) ? "Ajoutée aux favoris ❤️" : "Retirée des favoris");
      return render();
    case "join": {
      const c = campaignById(id);
      u.joinedCampaigns.add(id); c.clippers++;
      toast(`Vous avez rejoint « ${c.title} » 🎉`);
      logActivity("🎯", `${u.name} a rejoint « ${c.title} ».`);
      if (state.modal) state.modal = { type: "campaign", id };
      return render();
    }
    case "copy": return copy(`https://clipboost.dz/c/${id}?ref=${u.id}`, "Lien de suivi copié ✓");
    case "copy-invite": return copy(`https://clipboost.dz/invite/${t.dataset.code}`, "Lien d'invitation copié ✓");
    case "open-campaign": state.modal = { type: "campaign", id }; return render();
    case "submit-clip": state.modal = { type: "submit", id }; state.notifOpen = false; return render();
    case "withdraw": state.modal = { type: "withdraw" }; return render();
    case "invite": state.modal = { type: "invite" }; state.drawer = false; return render();
    case "fav-only": state.camp.favOnly = !state.camp.favOnly; return render();
    case "layout": state.camp.layout = value; return render();
    case "reset-filters": state.camp = { ...state.camp, q: "", category: "Toutes", favOnly: false }; return render();
    case "pub-status": state.pub.status = value; return render();
    case "tx-type": state.tx.type = { Tous: "tous", Gains: "gain", Retraits: "retrait" }[value]; return render();
    case "period": state.period = parseInt(value, 10); return render();
    case "setting": state.settings[t.dataset.key] = !state.settings[t.dataset.key]; return render();
  }
  return false;
}

function handleClipperSubmit(form, data) {
  const u = me();
  if (form === "submit") {
    db.publications.unshift({ id: Date.now(), userId: u.id, campaign: data.campaign, title: data.title.trim(), platform: data.platform, date: TODAY, views: 0, status: "En attente" });
    logActivity("🎬", `${u.name} a soumis le clip « ${data.title.trim()} ».`);
    state.modal = null; state.pub.status = "Toutes";
    navigate("#/clipper/publications");
    toast("Clip envoyé pour validation ✓");
  } else if (form === "withdraw") {
    const amount = Math.floor(Number(data.amount));
    db.transactions.unshift({ id: `T-${1046 + db.transactions.length}`, userId: u.id, date: TODAY, time: nowTime(), label: `Retrait vers ${data.to}`, amount: -amount, type: "retrait", status: "En cours" });
    logActivity("💸", `${u.name} a demandé un retrait de ${da(amount)}.`);
    state.modal = null; render(); toast(`Demande de retrait de ${da(amount)} envoyée`);
  } else if (form === "profile") {
    u.name = data.name.trim() || u.name; u.country = data.country || u.country; u.bio = data.bio.trim();
    render(); toast("Profil mis à jour ✓");
  }
}
