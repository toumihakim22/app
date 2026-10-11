// Tableau de bord administrateur : pilotage des utilisateurs, campagnes, clips, retraits et réglages du site.
// Chaque action modifie les mêmes données que l'espace Clipper et la page d'accueil.

const ADMIN_NAV = [
  { id: "apercu", label: "Vue d'ensemble", short: "Aperçu", icon: "home" },
  { id: "utilisateurs", label: "Utilisateurs", icon: "users" },
  { id: "campagnes", label: "Campagnes", icon: "target" },
  { id: "moderation", label: "Modération des clips", short: "Clips", icon: "shield" },
  { id: "retraits", label: "Retraits", icon: "wallet" },
  { id: "parametres", label: "Réglages du site", short: "Réglages", icon: "gear" },
];

const clippers = () => db.users.filter((u) => u.role === "clipper");
const pendingPubs = () => db.publications.filter((p) => p.status === "En attente");
const pendingWithdrawals = () => db.transactions.filter((t) => t.type === "retrait" && t.status === "En cours");
const adminBadge = (id) => ({ moderation: pendingPubs().length, retraits: pendingWithdrawals().length, campagnes: db.campaigns.filter((c) => c.status === "En attente").length }[id] || 0);

function aApercu() {
  const users = clippers();
  const kpis = [
    { label: "Clippers inscrits", value: fmt(users.length + 12395), sub: `${users.filter((u) => u.status === "Suspendu").length} suspendu(s)`, icon: "users", tone: "bg-brand-50 text-brand-600", go: "utilisateurs" },
    { label: "Campagnes actives", value: String(db.campaigns.filter((c) => c.status === "Active").length), sub: `${adminBadge("campagnes")} en attente d'approbation`, icon: "target", tone: "bg-emerald-50 text-income", go: "campagnes" },
    { label: "Clips à modérer", value: String(pendingPubs().length), sub: "En attente de décision", icon: "shield", tone: "bg-amber-50 text-amber-600", go: "moderation" },
    { label: "Retraits en attente", value: da(-pendingWithdrawals().reduce((s, t) => s + t.amount, 0)), sub: `${pendingWithdrawals().length} demande(s)`, icon: "wallet", tone: "bg-rose-50 text-rose-600", go: "retraits" },
  ];
  const budget = db.campaigns.reduce((s, c) => s + c.spent, 0);
  return `${pageHeader("Vue d'ensemble", "Pilotez l'activité de ClipBoost en temps réel.", `<a href="#/" class="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold ring-1 ring-gray-200 hover:bg-gray-50">${icon("globe", "h-4 w-4")} Voir le site</a>`)}
    ${db.settings.maintenance ? `<div class="mt-6 rounded-2xl bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700 ring-1 ring-rose-100">🛠️ Le mode maintenance est activé : les clippers ne peuvent pas se connecter. <a href="#/admin/parametres" class="font-semibold underline">Modifier</a></div>` : ""}
    <div class="mt-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      ${kpis.map((k) => `<a href="#/admin/${k.go}" class="block rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-brand-500 sm:p-5">
        <div class="flex items-start justify-between gap-2"><p class="text-xs font-medium text-gray-500 sm:text-sm">${k.label}</p><span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 ${k.tone}">${icon(k.icon)}</span></div>
        <p class="mt-3 whitespace-nowrap text-lg font-extrabold sm:text-2xl">${k.value}</p><p class="mt-1 text-xs font-medium text-gray-500">${k.sub}</p></a>`).join("")}
    </div>
    <div class="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      ${card(`<div class="flex items-end justify-between gap-3"><div><p class="font-bold">Nouvelles inscriptions</p><p class="text-sm text-gray-500">30 derniers jours</p></div><p class="text-2xl font-extrabold">${fmt(signups30.reduce((a, b) => a + b, 0))}</p></div>
        <div class="mt-6 h-56">${areaChart(signups30, { h: 200, color: "#7c3aed" })}</div>`)}
      ${card(`<p class="font-bold">Activité récente</p><div class="mt-4 space-y-4">${db.activity.slice(0, 6).map((a) => `<div class="flex gap-3"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-50">${a.icon}</span><div class="min-w-0"><p class="text-sm">${esc(a.text)}</p><p class="text-xs text-gray-400">${a.time}</p></div></div>`).join("")}</div>`)}
    </div>
    <div class="mt-6 grid gap-6 lg:grid-cols-3">
      ${card(`<p class="text-sm text-gray-500">Budget consommé (toutes campagnes)</p><p class="mt-2 text-2xl font-extrabold">${da(budget)}</p>`, "p-5")}
      ${card(`<p class="text-sm text-gray-500">Vues générées ce mois</p><p class="mt-2 text-2xl font-extrabold">3,2 M</p>`, "p-5")}
      ${card(`<p class="text-sm text-gray-500">Clips validés</p><p class="mt-2 text-2xl font-extrabold">${fmt(db.publications.filter((p) => p.status === "Validée").length + 18420)}</p>`, "p-5")}
    </div>
    <div class="mt-10 flex items-center justify-between"><h2 class="text-xl font-extrabold">Clips en attente</h2><a href="#/admin/moderation" class="text-sm font-semibold text-brand-700 hover:underline">Tout voir</a></div>
    <div class="mt-4">${publicationsTable(pendingPubs().slice(0, 3), { showUser: true, actions: true })}</div>`;
}

function aUtilisateurs() {
  const f = state.adm, q = f.userQ.trim().toLowerCase();
  const list = db.users.filter((u) => (f.userStatus === "Tous" || u.status === f.userStatus) && (!q || `${u.name} ${u.email} ${u.city}`.toLowerCase().includes(q)));
  return `${pageHeader("Utilisateurs", `${db.users.length} comptes · les nouvelles inscriptions apparaissent ici automatiquement.`)}
    <div class="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
      <label class="relative block flex-1 md:max-w-sm"><span class="sr-only">Rechercher un utilisateur</span>
        <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">${icon("search")}</span>
        <input data-input="adm-user-q" type="search" value="${esc(f.userQ)}" placeholder="Nom, email ou wilaya" class="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"/></label>
      <div class="md:ml-auto">${pills("adm-user-status", f.userStatus, ["Tous", "Actif", "Suspendu"])}</div>
    </div>
    <div class="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
      <div class="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-gray-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 lg:grid"><span>Utilisateur</span><span>Wilaya</span><span>Inscrit le</span><span>Gains</span><span>Statut</span><span class="w-44 text-right">Actions</span></div>
      ${list.length ? list.map((u) => {
        const actions = u.role === "admin" ? `<span class="text-xs text-gray-400">Administrateur</span>`
          : `<button type="button" data-action="adm-user-view" data-id="${u.id}" class="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">Détails</button>
             <button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="rounded-lg px-3 py-1.5 text-xs font-semibold ${u.status === "Actif" ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}">${u.status === "Actif" ? "Suspendre" : "Réactiver"}</button>`;
        return `<div class="border-b border-gray-50 px-4 py-4 last:border-0 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] lg:items-center lg:gap-4 lg:px-6">
          <div class="flex min-w-0 items-center gap-3">${avatar(u)}<div class="min-w-0 flex-1"><p class="truncate font-semibold">${esc(u.name)} ${u.verified ? "" : `<span class="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">NON VÉRIFIÉ</span>`}</p><p class="truncate text-xs text-gray-500">${esc(u.email)}</p></div><span class="lg:hidden">${statusBadge(u.status)}</span></div>
          <p class="mt-2 pl-12 text-xs text-gray-500 lg:hidden">${esc(u.city)} · inscrit le ${date(u.joined)}${u.role === "clipper" ? ` · ${da(totalEarned(u))}` : ""}</p>
          <span class="hidden text-sm text-gray-700 lg:block">${esc(u.city)}</span>
          <span class="hidden text-sm text-gray-700 lg:block">${date(u.joined)}</span>
          <span class="hidden text-sm font-semibold lg:block">${u.role === "clipper" ? da(totalEarned(u)) : "—"}</span>
          <span class="hidden lg:block">${statusBadge(u.status)}</span>
          <div class="mt-3 flex gap-2 pl-12 lg:mt-0 lg:w-44 lg:justify-end lg:pl-0">${actions}</div>
        </div>`;
      }).join("") : `<p class="p-10 text-center text-gray-500">Aucun utilisateur ne correspond.</p>`}
    </div>`;
}

function aCampagnes() {
  const f = state.adm;
  const list = db.campaigns.filter((c) => f.campStatus === "Toutes" || c.status === f.campStatus);
  return `${pageHeader("Campagnes", "Approuvez, mettez en pause ou créez des campagnes. Seules les campagnes actives sont visibles par les clippers.", `<button type="button" data-action="adm-new-campaign" class="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">+ Nouvelle campagne</button>`)}
    <div class="mt-8">${pills("adm-camp-status", f.campStatus, ["Toutes", "Active", "En attente", "En pause", "Terminée"])}</div>
    <div class="mt-5 space-y-3">${list.length ? list.map((c) => {
      const pct = Math.min(100, Math.round((c.spent / c.budget) * 100));
      const btn = (action, label, tone) => `<button type="button" data-action="${action}" data-id="${c.id}" class="rounded-lg px-3 py-1.5 text-xs font-semibold ${tone}">${label}</button>`;
      const actions = {
        "En attente": btn("adm-camp-approve", "Approuver", "bg-emerald-600 text-white hover:bg-emerald-700") + btn("adm-camp-end", "Rejeter", "bg-rose-50 text-rose-600 hover:bg-rose-100"),
        "Active": btn("adm-camp-pause", "Mettre en pause", "bg-amber-50 text-amber-700 hover:bg-amber-100") + btn("adm-camp-end", "Terminer", "text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"),
        "En pause": btn("adm-camp-approve", "Reprendre", "bg-emerald-600 text-white hover:bg-emerald-700") + btn("adm-camp-end", "Terminer", "text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"),
        "Terminée": `<span class="text-xs text-gray-400">Archivée</span>`,
      }[c.status];
      return `<div class="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 md:flex-row md:items-center">
        <div class="flex min-w-0 flex-1 items-center gap-4"><span class="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${c.gradient} text-2xl">${c.emoji}</span>
          <div class="min-w-0"><p class="truncate font-semibold">${esc(c.title)} <span class="ml-1 align-middle">${statusBadge(c.status)}</span></p><p class="truncate text-sm text-gray-500">${esc(c.brand)} · ${c.category} · ${c.rate} DA /1K · ${c.clippers} clippers</p></div></div>
        <div class="w-full md:w-48"><div class="flex justify-between text-xs text-gray-500"><span>${da(c.spent)}</span><span>${pct} %</span></div><div class="mt-1 h-1.5 rounded-full bg-gray-100"><div class="h-1.5 rounded-full bg-brand-600" style="width:${pct}%"></div></div><p class="mt-1 text-xs text-gray-400">sur ${da(c.budget)}</p></div>
        <div class="flex shrink-0 gap-2 md:w-56 md:justify-end">${actions}</div>
      </div>`;
    }).join("") : `<div class="rounded-3xl bg-gray-50 p-10 text-center text-gray-500">Aucune campagne avec ce statut.</div>`}</div>`;
}

function aModeration() {
  const f = state.adm;
  const list = db.publications.filter((p) => f.modStatus === "En attente" ? p.status === "En attente" : f.modStatus === "Toutes" || p.status === f.modStatus);
  return `${pageHeader("Modération des clips", "Validez les clips conformes : les gains sont crédités au clipper. Refusez ceux qui ne respectent pas les règles.")}
    <div class="mt-8">${pills("adm-mod-status", f.modStatus, ["En attente", "Validée", "Refusée", "Toutes"])}</div>
    <div class="mt-5">${list.length ? publicationsTable(list, { showUser: true, actions: true }) : `<div class="rounded-3xl bg-gray-50 p-12 text-center"><p class="text-4xl">🎉</p><p class="mt-3 font-semibold">Tout est à jour</p><p class="mt-1 text-sm text-gray-500">Aucun clip dans cette catégorie.</p></div>`}</div>`;
}

function aRetraits() {
  const list = db.transactions.filter((t) => t.type === "retrait");
  return `${pageHeader("Retraits", `Seuil minimum actuel : ${da(db.settings.minWithdraw)}. Aucun virement réel n'est effectué.`)}
    <div class="mt-8 space-y-3">${list.map((t) => {
      const u = userById(t.userId);
      return `<div class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:flex-row sm:items-center">
        <div class="flex min-w-0 flex-1 items-center gap-3">${avatar(u)}<div class="min-w-0"><p class="truncate font-semibold">${esc(u.name)}</p><p class="truncate text-xs text-gray-500">${esc(t.label)} · ${date(t.date)} · ${t.time} · ${t.id}</p></div></div>
        <p class="whitespace-nowrap text-lg font-extrabold sm:w-36 sm:text-right">${da(-t.amount)}</p>
        <div class="flex gap-2 sm:w-52 sm:justify-end">${t.status === "En cours"
          ? `<button type="button" data-action="adm-wd-approve" data-id="${t.id}" class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Approuver</button><button type="button" data-action="adm-wd-reject" data-id="${t.id}" class="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100">Rejeter</button>`
          : statusBadge(t.status)}</div>
      </div>`;
    }).join("")}</div>`;
}

function aParametres() {
  const s = db.settings;
  const row = (key, title, text) => `<div class="flex items-center justify-between gap-4 py-4"><div><p class="font-semibold">${title}</p><p class="text-sm text-gray-500">${text}</p></div>${switchBtn(s[key], "adm-setting", key, title)}</div>`;
  return `${pageHeader("Réglages du site", "Ces réglages s'appliquent immédiatement à la page d'accueil et à l'espace Clipper.")}
    <div class="mt-8 grid gap-6 lg:grid-cols-2">
      ${card(`<p class="font-bold">Accès au site</p><div class="mt-2 divide-y divide-gray-100">
        ${row("signupsOpen", "Inscriptions ouvertes", "Autoriser la création de nouveaux comptes Clipper par email.")}
        ${row("maintenance", "Mode maintenance", "Bloque la connexion des clippers et affiche un bandeau sur le site.")}</div>`)}
      ${card(`<p class="font-bold">Annonce et paiements</p><form data-form="adm-settings" class="mt-4 space-y-4">
        ${field("Annonce affichée sur le site", `<textarea name="announcement" rows="3" maxlength="140" placeholder="Ex. Nouvelle campagne Ramadan disponible !" class="${inputCls}">${esc(s.announcement)}</textarea>`, "Laisser vide pour masquer le bandeau. 140 caractères max.")}
        ${field("Retrait minimum (DA)", `<input name="minWithdraw" type="number" min="100" step="100" value="${s.minWithdraw}" class="${inputCls}"/>`)}
        <button class="w-full rounded-xl bg-ink py-3 font-semibold text-white hover:bg-black">Enregistrer</button></form>`)}
    </div>`;
}

const ADMIN_VIEWS = { apercu: aApercu, utilisateurs: aUtilisateurs, campagnes: aCampagnes, moderation: aModeration, retraits: aRetraits, parametres: aParametres };

function adminModal() {
  const m = state.modal;
  if (!m) return "";
  if (m.type === "user") {
    const u = userById(m.id), pubs = db.publications.filter((p) => p.userId === u.id);
    return modalShell(`<div class="flex items-center gap-4">${avatar(u, "h-16 w-16 text-xl")}<div><h2 class="text-2xl font-extrabold">${esc(u.name)}</h2><p class="text-gray-500">${esc(u.email)}</p></div></div>
      <div class="mt-6 grid grid-cols-2 gap-3 text-sm">
        ${[["Wilaya", esc(u.city)], ["Inscrit le", date(u.joined)], ["Statut", statusBadge(u.status)], ["Email", u.verified ? "✓ Vérifié" : "Non vérifié"], ["Gains totaux", da(totalEarned(u))], ["Solde", da(balance(u))], ["Clips soumis", pubs.length], ["Campagnes", u.joinedCampaigns.size]].map(([k, v]) => `<div class="rounded-2xl bg-gray-50 p-3"><p class="text-xs text-gray-500">${k}</p><p class="mt-0.5 font-semibold">${v}</p></div>`).join("")}
      </div>
      <button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="mt-6 w-full rounded-xl py-3 font-semibold ${u.status === "Actif" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}">${u.status === "Actif" ? "Suspendre ce compte" : "Réactiver ce compte"}</button>`);
  }
  if (m.type === "reject") {
    const p = db.publications.find((x) => x.id === m.id);
    const reasons = ["Règles de la campagne non respectées", "Vues suspectes ou achetées", "Contenu inapproprié", "Lien invalide ou vidéo supprimée", "Doublon d'un clip existant"];
    return modalShell(`<h2 class="text-2xl font-extrabold">Refuser le clip</h2><p class="mt-1 text-sm text-gray-500">« ${esc(p.title)} » de ${esc(userById(p.userId).name)}. Le clipper sera notifié du motif.</p>
      <form data-form="adm-reject" class="mt-6 space-y-2">${reasons.map((r, i) => `<label class="flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 ring-gray-200 has-[:checked]:bg-rose-50 has-[:checked]:ring-rose-300"><input type="radio" name="reason" value="${r}" ${i === 0 ? "checked" : ""} class="accent-rose-600"/> <span class="text-sm font-medium">${r}</span></label>`).join("")}
        <button class="mt-4 w-full rounded-xl bg-rose-600 py-3 font-semibold text-white hover:bg-rose-700">Confirmer le refus</button></form>`);
  }
  if (m.type === "new-campaign") {
    const emojis = ["🎬", "⚽", "🍔", "📱", "👗", "🎵", "😂", "🚗", "💄", "🏝️"];
    return modalShell(`<h2 class="text-2xl font-extrabold">Nouvelle campagne</h2><p class="mt-1 text-sm text-gray-500">Elle sera immédiatement visible par les clippers.</p>
      <form data-form="adm-campaign" class="mt-6 grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">${field("Titre", `<input name="title" required maxlength="40" placeholder="Ex. Spécial Ramadan" class="${inputCls}"/>`)}</div>
        ${field("Marque", `<input name="brand" required maxlength="30" class="${inputCls}"/>`)}
        ${field("Catégorie", `<select name="category" class="${inputCls}">${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select>`)}
        ${field("Tarif pour 1 000 vues (DA)", `<input name="rate" type="number" min="50" max="500" value="120" required class="${inputCls}"/>`)}
        ${field("Budget (DA)", `<input name="budget" type="number" min="10000" step="1000" value="200000" required class="${inputCls}"/>`)}
        <div class="sm:col-span-2"><span class="text-sm font-medium text-gray-700">Visuel</span><div class="mt-1.5 flex flex-wrap gap-2">${emojis.map((e, i) => `<label class="cursor-pointer"><input type="radio" name="emoji" value="${e}" ${i === 0 ? "checked" : ""} class="peer sr-only"/><span class="grid h-11 w-11 place-items-center rounded-xl text-xl ring-1 ring-gray-200 peer-checked:bg-brand-50 peer-checked:ring-2 peer-checked:ring-brand-500">${e}</span></label>`).join("")}</div></div>
        <div class="sm:col-span-2">${field("Règles (une par ligne)", `<textarea name="rules" rows="3" class="${inputCls}">Clip de 15 à 60 secondes\nMentionner la marque</textarea>`)}</div>
        <button class="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 sm:col-span-2">Publier la campagne</button>
      </form>`, "max-w-xl");
  }
  return "";
}

const GRADIENTS = ["from-emerald-400 via-teal-500 to-cyan-600", "from-amber-300 via-orange-400 to-rose-500", "from-sky-400 via-indigo-500 to-violet-600", "from-fuchsia-400 via-pink-500 to-rose-500", "from-violet-500 via-purple-600 to-indigo-700", "from-lime-300 via-green-400 to-emerald-600"];

function handleAdminAction(action, t) {
  const id = t.dataset.id;
  switch (action) {
    case "adm-user-status": state.adm.userStatus = t.dataset.value; return render();
    case "adm-camp-status": state.adm.campStatus = t.dataset.value; return render();
    case "adm-mod-status": state.adm.modStatus = t.dataset.value; return render();
    case "adm-user-view": state.modal = { type: "user", id: +id }; return render();
    case "adm-user-toggle": {
      const u = userById(+id);
      u.status = u.status === "Actif" ? "Suspendu" : "Actif";
      logActivity(u.status === "Suspendu" ? "⛔" : "✅", `${u.name} a été ${u.status === "Suspendu" ? "suspendu" : "réactivé"}.`);
      toast(`${u.name} : compte ${u.status === "Suspendu" ? "suspendu" : "réactivé"}`);
      return render();
    }
    case "adm-camp-approve": case "adm-camp-pause": case "adm-camp-end": {
      const c = campaignById(id), before = c.status;
      c.status = { "adm-camp-approve": "Active", "adm-camp-pause": "En pause", "adm-camp-end": "Terminée" }[action];
      if (c.status === "Active" && before === "En attente") {
        clippers().forEach((u) => notify(u.id, "🎯", `Nouvelle campagne : ${c.title} (${c.rate} DA /1K).`));
      }
      logActivity("🎯", `Campagne « ${c.title} » : ${before} → ${c.status}.`);
      toast(`« ${c.title} » est maintenant ${c.status.toLowerCase()}`);
      return render();
    }
    case "adm-new-campaign": state.modal = { type: "new-campaign" }; return render();
    case "adm-validate": {
      const p = db.publications.find((x) => x.id === +id);
      if (!p.views) p.views = 1500 + Math.floor(Math.random() * 9000); // vues comptabilisées pendant la vérification
      p.status = "Validée";
      const amount = Math.round(earningsOf(p)), c = campaignById(p.campaign);
      c.spent = Math.min(c.budget, c.spent + amount);
      db.transactions.unshift({ id: `T-${1046 + db.transactions.length}`, userId: p.userId, date: TODAY, time: nowTime(), label: c.title, amount, type: "gain", status: "Validé" });
      notify(p.userId, "✅", `Votre clip « ${p.title} » a été validé : +${da(amount)}.`);
      logActivity("✅", `Clip « ${p.title} » validé (${da(amount)}).`);
      toast(`Clip validé, ${da(amount)} crédités`);
      return render();
    }
    case "adm-reject": state.modal = { type: "reject", id: +id }; return render();
    case "adm-wd-approve": case "adm-wd-reject": {
      const tx = db.transactions.find((x) => x.id === id), ok = action === "adm-wd-approve";
      tx.status = ok ? "Validé" : "Refusé";
      notify(tx.userId, ok ? "💸" : "⚠️", ok ? `Votre retrait de ${da(-tx.amount)} a été approuvé.` : `Votre retrait de ${da(-tx.amount)} a été refusé, le montant est rendu à votre solde.`);
      logActivity("💸", `Retrait ${tx.id} de ${userById(tx.userId).name} ${ok ? "approuvé" : "refusé"}.`);
      toast(ok ? "Retrait approuvé" : "Retrait refusé, montant rendu au clipper");
      return render();
    }
    case "adm-setting": {
      const k = t.dataset.key;
      db.settings[k] = !db.settings[k];
      const labels = { maintenance: ["Mode maintenance activé", "Mode maintenance désactivé"], signupsOpen: ["Inscriptions ouvertes", "Inscriptions fermées"] };
      logActivity("⚙️", labels[k][db.settings[k] ? 0 : 1] + ".");
      toast(labels[k][db.settings[k] ? 0 : 1]);
      return render();
    }
  }
  return false;
}

function handleAdminSubmit(form, data) {
  if (form === "adm-reject") {
    const p = db.publications.find((x) => x.id === state.modal.id);
    p.status = "Refusée"; p.reason = data.reason;
    notify(p.userId, "⚠️", `Clip « ${p.title} » refusé : ${data.reason.toLowerCase()}.`);
    logActivity("🚫", `Clip « ${p.title} » refusé.`);
    state.modal = null; render(); toast("Clip refusé, le clipper est notifié");
  } else if (form === "adm-campaign") {
    const id = `c${Date.now()}`;
    db.campaigns.unshift({
      id, title: data.title.trim(), brand: data.brand.trim(), category: data.category, rate: +data.rate, budget: +data.budget, spent: 0, clippers: 0,
      createdAt: TODAY, status: "Active", gradient: GRADIENTS[db.campaigns.length % GRADIENTS.length], emoji: data.emoji, platforms: ["TikTok", "Instagram", "YouTube"],
      rules: data.rules.split("\n").map((r) => r.trim()).filter(Boolean),
    });
    clippers().forEach((u) => notify(u.id, "🎯", `Nouvelle campagne : ${data.title.trim()} (${data.rate} DA /1K).`));
    logActivity("🎯", `Campagne « ${data.title.trim()} » créée.`);
    state.modal = null; state.adm.campStatus = "Toutes"; render(); toast("Campagne publiée 🎉");
  } else if (form === "adm-settings") {
    db.settings.announcement = data.announcement.trim();
    db.settings.minWithdraw = Math.max(100, Math.floor(+data.minWithdraw || 1000));
    logActivity("⚙️", "Réglages du site mis à jour.");
    render(); toast("Réglages enregistrés ✓");
  }
}
