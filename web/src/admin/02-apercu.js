// Espace Admin (2/13) : vue d'ensemble.
// Les fichiers de web/src/admin/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Vue d'ensemble ----------

function aApercu() {
  const s = db.settings, users = clippers(), pubs = pendingPubs(), wd = pendingWithdrawals(), rc = pendingRecharges();
  const campPending = db.campaigns.filter((c) => c.status === "En attente").length, badges = admPendingBadges().length;
  const appeals = admPendingAppeals().length;
  const under = pubs.filter(belowMin).length, toPay = admSum(wd, admNet), queue = pubs.length + appeals + campPending + wd.length + rc.length + badges;

  // 1. À traiter : cartes interactives neutres (jamais de rose pour une file normale). Les demandes de badge n'ont leur
  // carte que lorsqu'il y en a. Sous sm : une liste compacte (une ligne par file, compteur en bout de ligne).
  const paySub = [
    wd.length ? t("{amount} à virer", { amount: money(toPay) }) : "",
    rc.length ? t("{count} à confirmer", { count: plural(rc.length, "recharge", "recharges") }) : "",
  ].filter(Boolean).join(" · ");
  const queues = [
    ["moderation", t("Clips à modérer"), pubs.length + appeals, [
      pubs.length ? (under ? t("dont {n} sous le seuil", { n: fmt(under) }) : t("En attente de décision")) : "",
      appeals ? plural(appeals, "recours à examiner", "recours à examiner") : "",
    ].filter(Boolean).join(" · ") || t("Tout est à jour")],
    ["campagnes", t("Campagnes à approuver"), campPending, campPending ? t("Soumises par les agences") : t("Aucune en attente")],
    ["retraits", t("Paiements à traiter"), wd.length + rc.length, paySub || t("Tout est à jour")],
    ...(badges ? [["utilisateurs", t("Badges à vérifier"), badges, t("Demandes des agences")]] : []),
  ];
  // Chevron de kpi() (ui.js) retourné en arabe : il pointe vers la suite de la lecture.
  const chevron = icon("chevronRight", "size-4"), chevronRtl = icon("chevronRight", "size-4 rtl:-scale-x-100");
  const todoCards = queues.map(([id, label, n, sub]) =>
    kpi({ href: `#/admin/${id}`, label, value: kpiValue(fmt(n)), sub, ic: "chevronRight" }).replace("<a ", `<a data-action="adm-focus" data-value="${id}" `).replace(chevron, chevronRtl));
  const todoList = queues.map(([id, label, n, sub]) => `<li><a href="#/admin/${id}" data-action="adm-focus" data-value="${id}" class="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
      <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${label}</span><span class="mt-0.5 block truncate text-xs text-fg-subtle">${sub}</span></span>
      ${n ? countBadge(n, "queue") : `<span class="text-small tabular-nums text-fg-subtle">0</span>`}${icon("chevronRight", "size-4 shrink-0 text-fg-subtle rtl:-scale-x-100")}</a></li>`).join("");

  // 2. KPI plateforme : chaque chiffre une seule fois sur l'écran.
  const active = db.campaigns.filter((c) => c.status === "Active").length, suspended = users.filter((u) => u.status === "Suspendu").length;
  const spent = admSum(db.campaigns, (c) => c.spent), commission = admSum(db.campaigns, (c) => Math.round((c.spent * c.commissionRate) / 100));
  const validated = db.publications.filter((p) => p.status === "Validée"), views = admSum(validated, (p) => p.views);
  const kpis = [
    kpi({ label: t("Clippers inscrits"), value: kpiValue(fmt(users.length)), sub: plural(suspended, "suspendu", "suspendus") }),
    kpi({ label: t("Campagnes actives"), value: kpiValue(fmt(active)), sub: t("sur {count}", { count: plural(db.campaigns.length, "campagne", "campagnes") }) }),
    kpi({ label: t("Budget consommé"), value: bigMoney(spent), sub: `${plural(validated.length, "clip validé", "clips validés")} · ${t("{n} vues", { n: compact(views) })}` }),
    kpi({ label: t("Commissions {brand}"), value: admIncome(commission), sub: t("sur le budget consommé") }),
  ];

  // 3. Inscriptions (un comptage : barres entières ; barChart se lit de gauche à droite, y compris en arabe, alors que
  // l'état vide suit le sens de la langue) et activité récente (textes du serveur, traduits à l'affichage).
  const period = state.period === 7 ? 7 : 30, series = (db.series.daily || []).slice(-period);
  const total = admSum(series, (v) => v), activeDays = series.filter((v) => v > 0).length;
  const chart = `<header class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0"><h2 class="text-section text-fg">${t("Nouvelles inscriptions")}</h2>
        <p class="mt-2">${kpiValue(fmt(total))}</p>
        <p class="mt-0.5 text-small text-fg-subtle">${t("sur {days}", { days: plural(period, "jour", "jours") })} · ${plural(activeDays, "jour actif", "jours actifs")}</p></div>
      ${segmented("adm-period", period, [[7, t("7 j")], [30, t("30 j")]], t("Période du graphique"))}
    </header>
    <div class="mt-5">${total
      ? barChart(series, { tone: "brand", unit: "inscription", unitPlural: "inscriptions", integer: true, caption: period === 7 ? t("Nouvelles inscriptions par jour, 7 derniers jours") : t("Nouvelles inscriptions par jour, 30 derniers jours") })
      : emptyState("users", t("Aucune inscription sur la période"), t("Les nouveaux comptes clippers et agences apparaîtront ici."), "", { inCard: true })}</div>`;
  const acts = (db.activity || []).slice(0, 6);
  const activity = `${cardHeader(t("Activité récente"))}
    ${acts.length
      ? `<ul class="mt-3 divide-y divide-line">${acts.map((a) => `<li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">${eventIcon(a.icon)}
          <div class="min-w-0 flex-1"><p class="break-words text-small text-fg">${esc(tServer(a.text))}</p><p class="mt-0.5 text-xs text-fg-subtle">${ago(a.at)}</p></div></li>`).join("")}</ul>`
      : `<div class="grid flex-1 place-items-center">${emptyState("clock", t("Aucune activité sur les 7 derniers jours"), t("Inscriptions, validations et paiements s'afficheront ici."), "", { inCard: true })}</div>`}`;

  return `${pageHeader(t("Vue d'ensemble"), t("Pilotez l'activité de {brand} en temps réel."))}
    ${s.maintenance ? `<div class="mt-6">${alertBox("warning", `<strong class="font-semibold">${t("Mode maintenance activé.")}</strong> ${t("Les clippers et les agences ne peuvent pas se connecter.")} <a href="#/admin/parametres" class="${btn("link")}">${t("Modifier dans les réglages")}</a>`)}</div>` : ""}
    <section class="mt-6" aria-label="${esc(t("À traiter"))}">
      ${admSectionTitle(t("À traiter"), queue ? countBadge(queue, "queue") : "")}
      <ul class="mt-3 divide-y divide-line overflow-hidden ${CARD} sm:hidden">${todoList}</ul>
      <div class="mt-3 hidden gap-4 sm:grid ${queues.length > 3 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"} lg:gap-5">${todoCards.join("")}</div>
    </section>
    <section class="mt-8" aria-label="${esc(t("Plateforme"))}">
      ${admSectionTitle(t("Plateforme"))}
      <div class="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-4">${kpis.join("")}</div>
    </section>
    <div class="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-5">
      ${card(chart, acts.length ? "" : "lg:col-span-2")}
      ${acts.length ? card(activity, "flex flex-col p-5") : ""}
    </div>
    ${sectionHeader(t("Clips en attente"), pubs.length ? "#/admin/moderation" : "")}
    ${pubs.length ? admPubTable(publicationsTable(pubs.slice(0, 3), { showUser: true, actions: true, tag: admRiskTag }))
      : emptyState("check", t("Aucun clip en attente"), t("Les nouveaux clips soumis par les clippers apparaîtront ici."))}`;
}
