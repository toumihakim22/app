// Espace Agence (2/8) : accueil.
// Les fichiers de web/src/agency/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Accueil ----------

// Agence sans campagne : premier pas, sur fond nuit (aucun KPI vide).
function agOnboarding(u, pending) {
  const steps = [
    [t("Créez la campagne"), t("Budget, tarif pour 1 000 vues, seuil et plafond par clip.")],
    [t("{brand} la vérifie"), t("Le budget et la commission de {rate} % sont débités à l'approbation.", { rate: db.settings.commissionRate })],
    [t("Les clippers publient"), t("Vous ne payez que les vues des clips validés.")],
  ];
  return `<section class="rounded-card bg-night p-6 text-on-brand sm:p-8">
    <div class="max-w-2xl">
      <h2 class="text-heading text-on-brand">${t("Lancez votre première campagne")}</h2>
      <p class="mt-2 text-sm text-on-brand/80">${t("Fixez un budget et un tarif pour 1 000 vues : des centaines de clippers diffusent votre marque.")}</p>
    </div>
    <ol class="mt-6 grid gap-4 sm:grid-cols-3">${steps.map(([title, text], i) => `<li class="flex gap-3">
      <span class="grid size-6 shrink-0 place-items-center rounded-full bg-on-brand/15 text-xs font-semibold tabular-nums text-on-brand">${i + 1}</span>
      <span class="min-w-0"><span class="block text-sm font-medium text-on-brand">${title}</span><span class="mt-0.5 block text-small text-on-brand/80">${text}</span></span></li>`).join("")}</ol>
    <div class="mt-7 flex flex-col gap-2 sm:flex-row sm:items-center">
      <button type="button" data-action="ag-new" class="${btn("onColor")}">${icon("plus")}${t("Créer ma première campagne")}</button>
      <button type="button" data-action="ag-credit" class="${btn("onColorGhost")}">${t("Recharger le crédit")}</button>
    </div>
    <p class="mt-5 text-xs tabular-nums text-on-brand/65">${t("Crédit disponible : {amount}", { amount: da(u.credit) })}${pending ? ` · ${t("{amount} en attente de confirmation", { amount: da(pending) })}` : ""}</p>
  </section>`;
}

// Campagnes refusées : à corriger avant tout le reste (motif, « Modifier et relancer »).
function agRefusedAlert(list) {
  const refused = list.filter((c) => c.status === "Refusée");
  if (!refused.length) return "";
  if (refused.length === 1) {
    const c = refused[0];
    const what = c.reviewNote
      ? t("« {title} » a été refusée : {reason}", { title: esc(c.title), reason: esc(agSentence(c.reviewNote)) })
      : t("« {title} » a été refusée par l'équipe {brand}.", { title: esc(c.title) });
    return alertBox("danger", `<p><span class="font-medium">${what}</span> ${t("Modifiez-la pour la relancer, ou supprimez-la.")}</p>
      <p class="mt-2 flex flex-wrap gap-x-4 gap-y-1"><button type="button" data-action="ag-edit" data-id="${c.id}" class="${btn("link")}">${t("Modifier et relancer")}</button><button type="button" data-action="ag-open" data-id="${c.id}" class="${btn("link")}">${t("Voir la campagne")}</button></p>`);
  }
  return alertBox("danger", `<p><span class="font-medium">${plural(refused.length, "campagne a été refusée par l'équipe {brand}.", "campagnes ont été refusées par l'équipe {brand}.")}</span> ${t("Modifiez-les pour les relancer, ou supprimez-les.")}</p>
    <p class="mt-2"><button type="button" data-action="ag-show-refused" class="${btn("link")}">${t("Voir les campagnes refusées")}</button></p>`);
}

// Ligne compacte « Vos campagnes » : toute la ligne ouvre le détail (bouton étiré sur le titre).
function agCampaignRow(c) {
  const sub = c.status === "Refusée" ? `<p class="mt-0.5 truncate text-xs text-danger-fg">${t("Modifiez-la pour la relancer")}</p>`
    : c.status === "En attente" ? `<p class="mt-0.5 truncate text-xs tabular-nums text-fg-subtle">${rateShort(c.rate)} · ${t("en vérification")}</p>`
    : `<p class="mt-0.5 truncate text-xs tabular-nums text-fg-subtle">${rateShort(c.rate)} · ${plural(c.clippers, "clipper", "clippers")}</p>
      <div class="mt-2">${progress(c.spent, c.budget, { label: false, aria: t("Budget consommé de {title}", { title: c.title }) })}</div>`;
  return `<li class="relative flex min-w-0 items-center gap-3 rounded-tile p-2 transition-colors duration-150 hover:bg-subtle">
    ${coverThumb(c, "sm")}
    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-2">
        <button type="button" data-action="ag-open" data-id="${c.id}" class="min-w-0 truncate text-start text-sm font-medium text-fg after:absolute after:inset-0 after:rounded-tile focus-visible:outline-hidden focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus">${esc(c.title)}</button>
        <span class="shrink-0">${statusBadge(c.status)}</span>
      </div>
      ${sub}
    </div></li>`;
}

function gApercu() {
  const u = me(), list = myCampaigns(), clips = clipsOf(list.map((c) => c.id)), pending = agPendingCredit();
  const hello = t("Bonjour {name}", { name: esc((u.contact || u.name).split(" ")[0]) });
  const intro = t("{name} · activité au {date}", { name: esc(u.name), date: date(agToday()) });
  if (!list.length) return `${pageHeader(hello, t("{name} · bienvenue sur {brand}", { name: esc(u.name) }))}<div class="mt-6">${agOnboarding(u, pending)}</div>`;

  const { spent, engaged, left } = agTotals(list);
  const views = list.reduce((s, c) => s + campaignViews(c), 0), inReview = clips.filter((p) => p.status === "En attente").length;
  // Aucun KPI en vert : ce sont des dépenses.
  const kpis = [
    kpi({ label: t("Crédit disponible"), value: bigMoney(u.credit),
      sub: `<button type="button" data-action="ag-credit" class="${btn("link")}">${t("Recharger")}</button>${pending ? `<span class="tabular-nums"> · ${t("{amount} en attente", { amount: da(pending) })}</span>` : ""}` }),
    kpi({ label: t("Budget consommé"), value: bigMoney(spent), sub: t("sur {amount} engagés", { amount: da(engaged) }),
      extra: `<div class="mt-3">${progress(spent, engaged, { label: false, aria: t("Part du budget engagé déjà consommée") })}</div>` }),
    kpi({ label: t("Vues générées"), value: kpiValue(fmt(views)), sub: views ? t("soit {rate}", { rate: rate(Math.round((spent / views) * 1000)) }) : t("Clips validés uniquement") }),
    kpi({ label: t("Clips reçus"), value: kpiValue(fmt(clips.length)), sub: inReview ? t("{count} en modération", { count: fmt(inReview) }) : t("Aucun en modération") }),
  ];

  const period = state.period === 7 ? 7 : 30, series = (db.series.daily || []).slice(-period);
  const total = series.reduce((s, v) => s + v, 0), activeDays = series.filter((v) => v > 0).length;
  const chart = `<header class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0"><h2 class="text-section text-fg">${t("Budget consommé par jour")}</h2>
        <p class="mt-2">${bigMoney(total)}</p>
        <p class="mt-0.5 text-small text-fg-subtle">${t("sur {days} · {active}", { days: plural(period, "jour", "jours"), active: plural(activeDays, "jour actif", "jours actifs") })}</p></div>
      ${segmented("ag-period", period, [[7, t("7 j")], [30, t("30 j")]], t("Période du graphique"))}
    </header>
    <div class="mt-5">${total
      ? barChart(series, { tone: "brand", caption: t("Budget consommé par jour, {days}", { days: plural(period, "dernier jour", "derniers jours") }) })
      : emptyState("chart", t("Aucune dépense sur la période"), t("Le budget est consommé dès que les clips validés de vos campagnes génèrent des vues."), "", { inCard: true })}</div>`;

  const attention = agRefusedAlert(list);
  return `${pageHeader(hello, intro, `<span class="lg:hidden">${agNewBtn()}</span>`)}
    ${attention ? `<div class="mt-6">${attention}</div>` : ""}
    <div class="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-4">${kpis.join("")}</div>
    <div class="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-5">
      ${card(chart)}
      ${card(`${cardHeader(t("Vos campagnes"), "", agMoreLink("#/agence/campagnes"))}
        <ul class="-mx-2 mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">${list.slice(0, 4).map(agCampaignRow).join("")}${list.length < 4 ? agNewRow() : ""}</ul>
        <div class="mt-auto pt-5"><dl class="flex items-baseline justify-between gap-3 border-t border-line pt-4 text-small"><dt class="text-fg-muted">${t("Restant à consommer")}</dt><dd class="font-medium">${money(left)}</dd></dl></div>`, "flex flex-col p-5")}
    </div>
    ${sectionHeader(t("Derniers clips reçus"), clips.length ? "#/agence/clips" : "", t("Tout voir"))}
    ${clips.length ? publicationsTable(clips.slice(0, 4), { showUser: true, amountLabel: "Coût" })
      : emptyState("film", t("Aucun clip reçu pour l'instant"), t("Les clips publiés par les clippers sur vos campagnes apparaîtront ici."))}`;
}
