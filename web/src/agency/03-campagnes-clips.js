// Espace Agence (3/8) : mes campagnes et clips reçus.
// Les fichiers de web/src/agency/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Mes campagnes ----------

// Carte campagne, variante agence (§4.4) : photo ou couverture, statut sous le titre, pas de favori.
// En ligne : chiffres, consommation, pause ou reprise + Détails. Pas encore en ligne : budget, plateformes,
// Modifier (ou Modifier et relancer, avec le motif du refus) et le retrait (annuler ou supprimer) en bouton-icône.
function agCampaignCard(c) {
  const live = !agEditable(c), refused = c.status === "Refusée";
  let actions;
  if (live) {
    const toggle = agToggle(c, "sm", "w-full");
    actions = `<div class="mt-auto grid grid-cols-2 gap-2 pt-1">${toggle}<button type="button" data-action="ag-open" data-id="${c.id}" class="${btn("ghost", "sm", toggle ? "w-full" : "col-span-2 w-full")}">${t("Détails")}</button></div>`;
  } else {
    const [rmAction, rmIcon, label, aria] = agRemoveAction(c);
    const remove = agRemovable(c) ? `<button type="button" data-action="${rmAction}" data-id="${c.id}" class="${AG_ICON_DANGER}" aria-label="${aria}" title="${label}">${icon(rmIcon)}</button>` : "";
    const details = refused ? "" : `<button type="button" data-action="ag-open" data-id="${c.id}" class="${btn("ghost", "sm", "w-full")}">${t("Détails")}</button>`;
    const cols = refused ? (remove ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1") : remove ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" : "grid-cols-2";
    actions = `<div class="mt-auto grid ${cols} gap-2 pt-1">${agEditBtn(c, "sm", "w-full")}${details}${remove}</div>`;
  }
  const rows = live
    ? [[t("Clippers"), fmt(c.clippers)], [t("Clips"), fmt(clipsOf([c.id]).length)], [t("Vues"), compact(campaignViews(c))]]
    : [[t("Budget"), da(c.budget)], ...(refused ? [] : [[t("Débité à l'approbation"), da(withCommission(c.budget, c.commissionRate))]]), [t("Plateformes"), agPlatformIcons(c.platforms)]];
  return `<article class="group flex flex-col ${CARD} ${CARD_HOVER} p-2">
    <button type="button" data-action="ag-open" data-id="${c.id}" class="cover relative block aspect-[16/9] w-full overflow-hidden rounded-tile ${FOCUS}" ${coverAttr(c)} aria-label="${t("Détails de {title}", { title: esc(c.title) })}">
      ${coverArt(c)}${agRateChip(c.rate)}
    </button>
    <div class="flex flex-1 flex-col gap-3 px-2 pb-1 pt-3">
      <div>
        <p class="truncate text-xs text-fg-subtle">${esc(t(c.category))}</p>
        <h3 class="mt-0.5 break-words font-sans text-[15px] font-semibold leading-snug text-fg">${esc(c.title)}</h3>
        <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">${statusBadge(c.status)}<span class="text-xs text-fg-subtle">${agencyStatusHint(c)}</span></div>
      </div>
      ${refused ? agReasonBox(c) : ""}
      <dl class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 text-small">${rows.map(([k, v]) =>
        `<dt class="text-fg-subtle">${k}</dt><dd class="flex justify-end text-end font-medium tabular-nums text-fg">${v}</dd>`).join("")}</dl>
      ${live ? progress(c.spent, c.budget, { aria: t("Budget consommé de {title}", { title: c.title }) }) : ""}
      ${actions}
    </div>
  </article>`;
}

function gCampagnes() {
  const all = myCampaigns(), q = state.ag.q.trim().toLowerCase();
  const list = all.filter((c) => (state.ag.status === "Toutes" || c.status === state.ag.status) && (!q || c.title.toLowerCase().includes(q)));
  const n = (s) => all.filter((c) => c.status === s).length;
  // Valeurs (statuts de l'API) en français, libellés traduits. « Refusées » n'apparaît que s'il y en a (ou si le filtre
  // est déjà posé).
  const statuses = [["Toutes", t("Toutes"), all.length], ["Active", t("Actives"), n("Active")], ["En attente", t("En attente"), n("En attente")], ["En pause", t("En pause"), n("En pause")], ["Terminée", t("Terminées"), n("Terminée")],
    ...(n("Refusée") || state.ag.status === "Refusée" ? [["Refusée", t("Refusées"), n("Refusée")]] : [])];
  const body = list.length
    ? `<div class="grid gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3">${list.map(agCampaignCard).join("")}</div>`
    : all.length
      ? emptyState("search", t("Aucune campagne ne correspond"), t("Essayez un autre statut ou effacez la recherche."), `<button type="button" data-action="ag-clear" class="${btn("secondary")}">${t("Effacer les filtres")}</button>`)
      : emptyState("megaphone", t("Aucune campagne"), t("Créez votre première campagne : elle sera publiée après vérification par l'équipe {brand}."), agNewBtn());
  return `${pageHeader(t("Mes campagnes"), t("Créez, suivez et pilotez vos campagnes. Chaque nouvelle campagne est vérifiée par {brand} avant publication : d'ici là, vous pouvez la modifier ou l'annuler."), all.length ? `<span class="lg:hidden">${agNewBtn()}</span>` : "")}
    ${all.length ? `<div class="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      ${searchInput("ag-q", state.ag.q, t("Rechercher une campagne"), t("Rechercher une campagne"), "w-full xl:max-w-xs")}
      ${segmented("ag-status", state.ag.status, statuses, t("Filtrer par statut"), { scroll: true })}
    </div>` : ""}
    <div class="mt-5">${body}</div>`;
}

// ---------- Clips reçus ----------

function gClips() {
  const all = clipsOf(myCampaigns().map((c) => c.id));
  const list = all.filter((p) => state.ag.clipStatus === "Toutes" || p.status === state.ag.clipStatus);
  const n = (s) => all.filter((p) => p.status === s).length;
  const statuses = [["Toutes", t("Tous"), all.length], ["Validée", t("Validés"), n("Validée")], ["En attente", t("En attente"), n("En attente")], ["Refusée", t("Refusés"), n("Refusée")]];
  const none = { "Validée": t("Aucun clip validé"), "En attente": t("Aucun clip en attente"), "Refusée": t("Aucun clip refusé") }[state.ag.clipStatus];
  const body = list.length ? publicationsTable(list, { showUser: true, amountLabel: "Coût" })
    : all.length ? emptyState("film", none, t("Les autres clips restent visibles dans « Tous »."), `<button type="button" data-action="ag-clip-status" data-value="Toutes" class="${btn("secondary")}">${t("Voir tous les clips")}</button>`)
    : emptyState("film", t("Aucun clip reçu"), t("Dès qu'un clipper publie sur l'une de vos campagnes, son clip apparaît ici avec ses vues et son coût."));
  return `${pageHeader(t("Clips reçus"), t("Les clips publiés par les clippers sur vos campagnes. Modération assurée par l'équipe {brand}."))}
    ${all.length ? `<div class="mt-6">${segmented("ag-clip-status", state.ag.clipStatus, statuses, t("Filtrer par statut"), { scroll: true })}</div>` : ""}
    <div class="${all.length ? "mt-4" : "mt-6"}">${body}</div>`;
}
