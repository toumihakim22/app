// Espace Clipper (2/9) : accueil et découvrir.
// Les fichiers de web/src/clipper/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

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
        : emptyState("compass", t("Aucune campagne active pour le moment"), t("Les nouvelles campagnes apparaissent ici dès leur validation par l'équipe {brand}."))
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
