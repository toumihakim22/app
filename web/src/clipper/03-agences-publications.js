// Espace Clipper (3/9) : agences, page d'une agence et publications.
// Les fichiers de web/src/clipper/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

function clAgencyCard(o) {
  const n = o.active.length, dash = `<span class="font-normal text-fg-subtle">—</span>`;
  const thumbs = o.active.slice(0, 3).map(clMiniCover).join("");
  return `<a href="${clOrgHref(o.key)}" data-org="${esc(o.key)}" class="group flex min-w-0 flex-col overflow-hidden ${CARD} ${CARD_HOVER}">
    ${clOrgCover(o, "aspect-[3/1] w-full")}
    <div class="flex flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5">
      ${clOrgMark(o, "relative -mt-6 size-12 text-sm ring-4 ring-surface")}
      <h3 class="mt-2.5 flex min-w-0 items-center gap-1 font-sans text-[15px] font-semibold leading-snug text-fg"><span class="truncate">${esc(o.name)}</span>${o.verified ? verifiedBadge("size-4", t("Agence vérifiée")) : ""}</h3>
      <p class="mt-0.5 truncate text-xs text-fg-subtle">${clOrgType(o)}</p>
      <p class="mt-3 line-clamp-2 min-h-[2lh] text-small ${o.bio ? "text-fg-muted" : "text-fg-subtle"}">${clOrgAbout(o)}</p>
      <dl class="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t border-line pt-3.5 text-small">
        <dt class="text-fg-subtle">${t("Campagnes actives")}</dt><dd class="flex items-center justify-end gap-2 font-medium tabular-nums text-fg">${thumbs ? `<span class="flex -space-x-1" aria-hidden="true">${thumbs}</span>` : ""}${n ? fmt(n) : `<span class="font-normal text-fg-subtle">${t("Aucune")}</span>`}</dd>
        <dt class="text-fg-subtle">${t("Meilleur tarif")}</dt><dd class="text-end font-medium tabular-nums text-fg">${n ? rateShort(o.best) : dash}</dd>
        <dt class="text-fg-subtle">${t("Budget restant")}</dt><dd class="text-end font-medium">${n ? money(o.remaining) : dash}</dd>
      </dl>
      <div class="mt-auto flex items-center justify-between gap-3 pt-4">
        <ul class="flex min-w-0 flex-wrap gap-1.5" aria-label="${t("Catégories")}">${o.categories.map((cat) => `<li class="inline-flex h-6 items-center rounded-badge bg-muted px-2 text-xs font-medium text-fg-muted">${esc(t(cat))}</li>`).join("")}</ul>
        <span class="inline-flex shrink-0 items-center gap-0.5 text-small font-medium text-brand-fg">${t("Voir les projets")}${icon("chevronRight", "size-4 transition-transform duration-150 ease-standard group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5")}</span>
      </div>
    </div>
  </a>`;
}

// Agences : qui propose des projets de clipping. Recherche par nom (accents ignorés) ; les agences avec une campagne active d'abord.
function cAgences() {
  const all = clOrganisers(), q = clNorm(state.camp.aq || "");
  const list = q ? all.filter((o) => clNorm(o.name).includes(q)) : all;
  const active = activeCampaigns().length, withActive = all.filter((o) => o.active.length).length;
  const results = !all.length
    ? emptyState("building", t("Aucune agence pour le moment"), t("Les agences apparaîtront ici dès leur première campagne en ligne."))
    : !list.length
      ? emptyState("search", t("Aucune agence ne correspond"), t("Vérifiez l'orthographe ou effacez la recherche."), `<button type="button" data-action="reset-agencies" class="${btn("secondary")}">${t("Effacer la recherche")}</button>`)
      : `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">${list.map(clAgencyCard).join("")}</div>`;
  return `${pageHeader(t("Agences"), t("{agencies} des clippers sur {campaigns}. Ouvrez une agence pour voir ses projets.", { agencies: plural(withActive, "agence recrute", "agences recrutent"), campaigns: plural(active, "campagne active", "campagnes actives") }))}
    <div class="mt-6 flex items-center gap-2 md:gap-3">${searchInput("camp-aq", state.camp.aq || "", t("Rechercher une agence"), t("Rechercher une agence par son nom"), "min-w-0 flex-1 md:max-w-sm")}</div>
    <p class="mb-3 mt-4 text-small text-fg-subtle" aria-live="polite">${plural(list.length, "agence", "agences")}</p>
    ${results}`;
}

// Page d'un organisateur (#/clipper/agence/<clé>) : couverture, photo, nom et badge, présentation, chiffres clés, projets.
function cAgence() {
  const key = state.route.item || "", o = clOrganisers().find((x) => x.key === key);
  const crumb = (name) => `<nav aria-label="${t("Fil d'Ariane")}"><ol class="flex min-w-0 items-center gap-1.5 text-small">
      <li class="shrink-0"><a href="#/clipper/agences" class="${HIT} inline-flex items-center gap-1 rounded-sm font-medium text-fg-muted transition-colors duration-150 hover:text-fg ${FOCUS}">${icon("arrowLeft", "size-4 sm:hidden rtl:-scale-x-100")}${t("Agences")}</a></li>
      <li class="hidden shrink-0 text-fg-subtle sm:block" aria-hidden="true">${icon("chevronRight", "size-3.5 rtl:-scale-x-100")}</li>
      <li class="hidden min-w-0 truncate text-fg-subtle sm:block" aria-current="page">${esc(name)}</li></ol></nav>`;
  if (!o) {
    return `${crumb(t("Agence introuvable"))}
      <h1 class="sr-only">${t("Agence introuvable")}</h1>
      <div class="mt-6">${emptyState("building", t("Agence introuvable"), t("Cette agence n'existe pas ou n'a plus de campagne visible."), `<a href="#/clipper/agences" class="${btn("secondary")}">${t("Voir les agences")}</a>`)}</div>`;
  }
  const n = o.active.length;
  const country = o.country || "Algérie";
  const grid = (list) => `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">${list.map((c) => campaignCard(c, { org: false })).join("")}</div>`;
  return `${crumb(o.name)}
    <section class="mt-4 overflow-hidden ${CARD}">
      ${clOrgCover(o, "aspect-[3/1] w-full")}
      <div class="px-4 pb-5 sm:px-6 sm:pb-6">
        ${clOrgMark(o, "relative -mt-10 size-20 text-xl ring-4 ring-surface sm:-mt-12 sm:size-24 sm:text-2xl")}
        <h1 class="mt-3 break-words text-title-sm text-fg sm:text-title">${esc(o.name)}${o.verified ? `${NB}${verifiedBadge("size-5 sm:size-6", t("Agence vérifiée"))}` : ""}</h1>
        <p class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-fg-muted">${o.agency
          ? `${badge(t("Agence"), "info")}<span class="inline-flex items-center gap-1.5">${esc(t(country))}${country === "Algérie" ? flagDz() : ""}</span>`
          : `${badge(t("Marque partenaire"), "brand")}<span>${t("Campagne gérée par {brand}")}</span>`}</p>
        <p class="mt-1 text-xs text-fg-subtle">${o.agency ? t("Membre depuis le {date}", { date: date(o.since) }) : t("Sur {brand} depuis le {date}", { date: date(o.since) })}</p>
        ${o.bio || !o.agency ? `<p class="mt-4 max-w-2xl text-sm leading-6 text-fg-muted">${clOrgAbout(o)}</p>` : ""}
      </div>
    </section>
    <div class="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-5 xl:grid-cols-4">
      ${kpi({ label: t("Campagnes actives"), value: kpiValue(fmt(n)), sub: o.closed.length ? `+ ${plural(o.closed.length, "en pause ou terminée", "en pause ou terminées")}` : t("Ouvertes aux clippers") })}
      ${kpi({ label: t("Meilleur tarif"), value: n ? bigMoney(o.best) : kpiValue("—"), sub: t("pour 1 000 vues validées") })}
      ${kpi({ label: t("Budget restant"), value: bigMoney(o.remaining), sub: t("sur les campagnes actives") })}
      ${kpi({ label: t("Participations"), value: kpiValue(fmt(o.entries)), sub: t("tous projets confondus") })}
    </div>
    ${sectionHeader(t("Projets de clipping en cours"))}
    ${n ? grid(o.active) : emptyState("target", t("Aucun projet en cours"), t("{name} n'a pas de campagne ouverte pour le moment.", { name: esc(o.name) }), `<a href="#/clipper/decouvrir" class="${btn("secondary")}">${t("Découvrir toutes les campagnes")}</a>`)}
    ${o.closed.length ? `${sectionHeader(t("Projets terminés ou en pause"))}${grid(o.closed)}` : ""}`;
}

function cPublications() {
  const pubs = myPubs(), list = pubs.filter((p) => state.pub.status === "Toutes" || p.status === state.pub.status);
  const count = (s) => pubs.filter((p) => p.status === s).length;
  const empty = { Validée: t("Aucun clip validé"), "En attente": t("Aucun clip en attente"), Refusée: t("Aucun clip refusé") }[state.pub.status];
  return `${pageHeader(t("Mes publications"), t("Suivez la validation et les gains de chacun de vos clips."), `<button type="button" data-action="submit-clip" class="${btn("primary")}">${icon("plus")}${t("Soumettre un clip")}</button>`)}
    ${pubs.length ? `<div class="mt-6">${segmented("pub-status", state.pub.status, [["Toutes", t("Toutes"), pubs.length], ["Validée", t("Validées"), count("Validée")], ["En attente", t("En attente"), count("En attente")], ["Refusée", t("Refusées"), count("Refusée")]], t("Statut"), { scroll: true })}</div>
    <div class="mt-4">${list.length ? publicationsTable(list)
      : emptyState("film", empty, t("Les clips de ce statut apparaîtront ici."), `<button type="button" data-action="pub-status" data-value="Toutes" class="${btn("secondary")}">${t("Voir tous les clips")}</button>`)}</div>`
    : `<div class="mt-6">${emptyState("film", t("Aucun clip soumis"), t("Rejoignez une campagne, publiez votre clip puis soumettez son lien pour validation."), `<a href="#/clipper/decouvrir" class="${btn("primary")}">${icon("compass")}${t("Découvrir les campagnes")}</a>`)}</div>`}`;
}
