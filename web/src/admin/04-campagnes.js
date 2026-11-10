// Espace Admin (4/13) : liste des campagnes.
// Les fichiers de web/src/admin/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Campagnes ----------

// Filtre de statut : [valeur (statut du serveur, en français), libellé source traduit à l'affichage].
const ADM_CAMP_STATUS = [["Toutes", "Toutes"], ["Active", "Actives"], ["En attente", "En attente"], ["En pause", "En pause"], ["Terminée", "Terminées"], ["Refusée", "Refusées"]];
const admTopTag = () => `<span class="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] bg-warning-bg px-1.5 text-micro font-semibold text-warning-fg ring-1 ring-inset ring-warning-border" title="${esc(t("Top campagne"))}">${icon("star", "size-3", true)}${t("Top")}</span>`;

// Sous-ligne d'une campagne : agence (lien vers sa fiche) ou ClipBoost, marque si elle diffère, catégorie (traduite ;
// une catégorie précisée par l'agence, hors liste, s'affiche telle quelle).
function admCampSub(c, withOwner = true) {
  const o = c.ownerId ? userById(c.ownerId) : null;
  const sep = `<span class="shrink-0" aria-hidden="true">·</span>`;
  const who = !withOwner ? ""
    : o ? `${admUserLink(o, "font-medium text-fg-muted hover:text-fg")}${sep}`
    : `<span class="shrink-0">${c.ownerId ? t("Agence supprimée") : esc(BRAND)}</span>${sep}`;
  const brand = !o || c.brand !== o.name ? `${esc(c.brand)} · ` : "";
  return `${who}<span class="min-w-0 truncate">${brand}${esc(t(c.category))}</span>`;
}

// Actions par statut, sur une ligne ; l'action principale est en bout de ligne (comme la colonne Décision de la modération).
// Une campagne en attente s'examine dans sa fiche (approbation) ; un refus passe toujours par son motif ; « Terminer »
// demande une confirmation (définitif, le budget non consommé est rendu à l'agence).
function admCampActions(c, size) {
  // Action secondaire à largeur fixe dès sm : « Terminer » garde la même position d'une ligne à l'autre.
  const b = (action, variant, label, ic = "") => `<button type="button" data-action="${action}" data-id="${c.id}" class="${btn(variant, size, variant === "ghost" || variant === "dangerSoft" ? "" : "sm:min-w-[7.5rem]")}">${ic ? icon(ic) : ""}${label}</button>`;
  if (c.status === "En attente") return b("adm-camp-refuse", "dangerSoft", t("Refuser")) + b("adm-camp", "primary", t("Examiner"));
  if (c.status === "Active") return b("adm-camp-end", "ghost", t("Terminer")) + b("adm-camp-pause", "secondary", t("Pause"), "pause");
  if (c.status === "En pause") return b("adm-camp-end", "ghost", t("Terminer")) + b("adm-camp-resume", "secondary", t("Reprendre"), "play");
  return b("adm-camp", "ghost", t("Détails"));
}

// Tableau des campagnes (page Campagnes, fiche d'une agence) : la vignette et le titre ouvrent la fiche d'examen.
function admCampTable(list, { owner = true } = {}) {
  const thumb = (c) => `<button type="button" data-action="adm-camp" data-id="${c.id}" tabindex="-1" aria-hidden="true" class="shrink-0 rounded-tile">${coverThumb(c, "sm")}</button>`;
  const title = (c, cls = "") => `<p class="flex min-w-0 items-center gap-1.5"><button type="button" data-action="adm-camp" data-id="${c.id}" class="${ADM_ROW_LINK} ${cls}" title="${esc(t("Examiner la campagne"))}"><span class="block truncate">${esc(c.title)}</span></button>${c.top ? admTopTag() : ""}</p>`;
  const trs = list.map((c) => `<tr data-row="${c.id}" class="${TBL.tr}">
      <td class="${ADM_TD_MAIN}"><div class="flex min-w-0 items-center gap-3">${thumb(c)}<div class="min-w-0">${title(c)}<p class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${admCampSub(c, owner)}</p></div></div></td>
      <td class="${TBL.td}">${statusBadge(c.status)}</td>
      <td class="${TBL.td} ${TBL.tdNum}">${money(c.rate)}<span class="${TBL.tdSub} font-normal">${t("/ 1 000 vues")}</span></td>
      <td class="${TBL.td}"><div class="min-w-44">${progress(c.spent, c.budget)}</div></td>
      <td class="${TBL.td} ${TBL.tdNum}">${fmt(c.clippers)}</td>
      <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admCampActions(c, "sm")}</div></td>
    </tr>`).join("");
  // Sous xl : une ligne par campagne (identité | budget), actions en boutons md dessous, alignées en bout de ligne dès sm.
  const lis = list.map((c) => `<li data-row="${c.id}" class="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:items-center sm:gap-x-8 sm:px-5">
      <div class="flex min-w-0 items-start gap-3">${thumb(c)}<div class="min-w-0 flex-1">${title(c, "text-sm")}<p class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${admCampSub(c, owner)}</p>
        <p class="mt-1 text-xs tabular-nums text-fg-subtle">${rateShort(c.rate)} · ${plural(c.clippers, "clipper", "clippers")}</p></div>${statusBadge(c.status)}</div>
      <div class="min-w-0">${progress(c.spent, c.budget)}</div>
      <div class="grid grid-cols-2 gap-2 sm:col-span-2 sm:flex sm:justify-end [&>:only-child]:col-span-2">${admCampActions(c, "md")}</div>
    </li>`).join("");
  return admTable("xl", `<th scope="col" class="${TBL.th}">${t("Campagne")}</th><th scope="col" class="${TBL.th}">${t("Statut")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Tarif")}</th><th scope="col" class="${TBL.th}">${t("Budget")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Clippers")}</th>${admThActions()}`, trs, lis);
}

function aCampagnes() {
  const f = state.adm, q = f.campQ.trim().toLowerCase();
  const owner = (c) => (c.ownerId ? userById(c.ownerId) : null);
  // La recherche trouve aussi la catégorie dans la langue affichée.
  const searched = db.campaigns.filter((c) => { const o = owner(c); return !q || `${c.title} ${c.brand} ${c.category} ${t(c.category)} ${o ? o.name : ""}`.toLowerCase().includes(q); });
  const list = searched.filter((c) => f.campStatus === "Toutes" || c.status === f.campStatus);
  const options = ADM_CAMP_STATUS.map(([v, l]) => [v, t(l), v === "Toutes" ? searched.length : searched.filter((c) => c.status === v).length]);
  return `${pageHeader(t("Campagnes"), t("Examinez, approuvez, mettez en pause ou créez des campagnes. Seules les campagnes actives sont visibles par les clippers."),
      `<button type="button" data-action="adm-new-campaign" class="${btn("primary")}">${icon("plus")}${t("Nouvelle campagne")}</button>`)}
    ${admToolbar(searchInput("adm-camp-q", f.campQ, t("Titre, marque, catégorie ou agence"), t("Rechercher une campagne"), "w-full xl:max-w-xs"),
      chips("adm-camp-status", f.campStatus, options, t("Statut")))}
    ${admCountLine(list.length, db.campaigns.length, "campagne", "campagnes")}
    <div class="mt-3">${list.length ? admCampTable(list)
      : emptyState("search", t("Aucune campagne ne correspond"), t("Essayez un autre statut ou effacez la recherche."), `<button type="button" data-action="adm-camp-clear" class="${btn("secondary")}">${t("Effacer les filtres")}</button>`)}</div>`;
}
