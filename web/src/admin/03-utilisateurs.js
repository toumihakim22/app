// Espace Admin (3/13) : liste des utilisateurs et fiche d'un utilisateur.
// Les fichiers de web/src/admin/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Utilisateurs ----------

const roleTag = (u) => roleBadge(u.role);
// Filtre de rôle : clé (valeur du filtre, en français) → rôle ; libellés traduits à l'affichage.
const ADM_ROLES = { "Tous les rôles": null, Clippers: "clipper", Agences: "agence", Admins: "admin" };
// Solde : gains disponibles d'un clipper, crédit d'une agence.
const admBalance = (u) => (u.role === "agence" ? u.credit || 0 : balance(u));
const admBalanceLabel = (u) => (u.role === "agence" ? t("crédit") : t("gains"));
// Étiquette « Badge demandé » (même gabarit que roleBadge) : l'agence attend une décision sur le badge bleu.
const admBadgeAsked = () => `<span class="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] bg-info-bg px-1.5 text-micro font-semibold text-info-fg ring-1 ring-inset ring-info-border">${icon("shield", "size-3")}${t("Badge demandé")}</span>`;

// Colonne d'actions : « Profil » partout ; un compte admin ne se suspend pas, un espace vide garde l'alignement du tableau.
function admUserActions(u, size, table = false) {
  const profile = `<a href="${admUserHref(u)}" class="${btn("ghost", size)}">${t("Profil")}</a>`;
  if (u.role === "admin") return table ? `${profile}<span class="w-[6.5rem] shrink-0" aria-hidden="true"></span>` : profile;
  return `${profile}
    <button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="${btn("secondary", size, "sm:min-w-[6.5rem]")}">${u.status === "Actif" ? t("Suspendre") : t("Réactiver")}</button>`;
}

// Demandes de badge en attente (haut de la page Utilisateurs) : message de l'agence, puis refuser (motif) ou accorder.
function admBadgeRequests(list) {
  if (!list.length) return "";
  const items = list.map((u) => {
    const n = db.campaigns.filter((c) => c.ownerId === u.id).length;
    return `<li data-row="${u.id}" class="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-6 sm:px-5">
      <div class="flex min-w-0 items-start gap-3">${avatar(u, "md")}
        <div class="min-w-0 flex-1">
          <p class="flex min-w-0 text-sm font-medium text-fg">${admUserLink(u)}</p>
          <p class="mt-0.5 truncate text-xs text-fg-subtle"><span dir="ltr">${esc(u.email)}</span> · ${plural(n, "campagne", "campagnes")} · ${t("inscrite le {date}", { date: date(u.joined) })}</p>
          ${u.verificationNote
            ? `<p class="mt-2 break-words border-s-2 border-line-strong ps-3 text-small text-fg-muted">${esc(u.verificationNote)}</p>`
            : `<p class="mt-2 text-small text-fg-subtle">${t("Aucun message joint à la demande.")}</p>`}
        </div></div>
      <div class="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" data-action="adm-verify" data-id="${u.id}" data-value="reject" class="${btn("dangerSoft", "md")}">${t("Refuser")}</button>
        <button type="button" data-action="adm-verify-approve" data-id="${u.id}" class="${btn("primary", "md")}">${icon("shield")}${t("Accorder le badge")}</button>
      </div></li>`;
  }).join("");
  return `<section class="mt-6" aria-labelledby="adm-badges-title">
      <div class="flex items-center gap-2"><h2 id="adm-badges-title" class="text-heading text-fg">${t("Badges à vérifier")}</h2>${countBadge(list.length, "queue")}</div>
      <p class="mt-1 max-w-2xl text-small text-fg-muted">${t("Ces agences demandent le badge bleu. Vérifiez leur identité avant de l'accorder : il s'affiche à côté de leur nom, partout sur {brand}.")}</p>
      <ul class="mt-3 divide-y divide-line overflow-hidden ${CARD}">${items}</ul>
    </section>`;
}

function aUtilisateurs() {
  const f = state.adm, q = f.userQ.trim().toLowerCase();
  const byRole = (r) => db.users.filter((u) => !ADM_ROLES[r] || u.role === ADM_ROLES[r]);
  // La recherche trouve aussi le pays dans la langue affichée (« Algeria », « الجزائر »).
  const list = byRole(f.userRole).filter((u) => (f.userStatus === "Tous" || u.status === f.userStatus) && (!q || `${u.name} ${u.email} ${u.country} ${u.country ? t(u.country) : ""}`.toLowerCase().includes(q)));
  const roles = Object.keys(ADM_ROLES).map((r) => [r, t(r === "Tous les rôles" ? "Tous" : r), byRole(r).length]);
  const statuses = [["Tous", t("Tous les statuts")], ["Actif", t("Actifs")], ["Suspendu", t("Suspendus")]];
  const requests = admPendingBadges();
  const nameLine = (u, cls) => `<div class="flex min-w-0 items-center gap-1.5">${admUserLink(u, cls)}${roleTag(u)}${u.verification === "pending" ? admBadgeAsked() : ""}</div>`;

  const rows = list.map((u) => {
    const money_ = u.role === "admin" ? admDash : `${money(admBalance(u))}<span class="${TBL.tdSub} font-normal">${admBalanceLabel(u)}</span>`;
    return {
      tr: `<tr data-row="${u.id}" class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}"><div class="flex min-w-0 items-center gap-3">${avatar(u, "sm")}<div class="min-w-0">${nameLine(u, "font-medium text-fg")}<span class="${TBL.tdSub} truncate"><span dir="ltr">${esc(u.email)}</span></span></div></div></td>
        <td class="${TBL.td} hidden xl:table-cell"><span class="whitespace-nowrap text-fg-muted">${esc(t(u.country || ""))}</span></td>
        <td class="${TBL.td} hidden xl:table-cell"><span class="whitespace-nowrap tabular-nums text-fg-muted">${date(u.joined)}</span></td>
        <td class="${TBL.td} ${TBL.tdNum}">${money_}</td>
        <td class="${TBL.td}">${statusBadge(u.status)}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admUserActions(u, "sm", true)}</div></td>
      </tr>`,
      li: `<li data-row="${u.id}" class="${TBL.item}">
        <div class="flex items-start gap-3">${avatar(u, "md")}<div class="min-w-0 flex-1">${nameLine(u, "text-sm font-medium text-fg")}<p class="truncate text-xs text-fg-subtle"><span dir="ltr">${esc(u.email)}</span></p></div>${statusBadge(u.status)}</div>
        <div class="flex items-center justify-between gap-3 text-small"><span class="min-w-0 truncate text-fg-subtle">${esc(t(u.country || ""))} · ${t("inscrit le {date}", { date: date(u.joined) })}</span>${u.role === "admin" ? "" : `<span class="shrink-0 font-medium">${money(admBalance(u))}<span class="font-normal text-fg-subtle"> ${admBalanceLabel(u)}</span></span>`}</div>
        <div class="grid grid-cols-2 gap-2">${admUserActions(u, "md")}</div>
      </li>`,
    };
  });

  // Pays et date d'inscription : visibles à partir de xl (et toujours sur la fiche et dans la liste mobile).
  const table = admTable("md", `<th scope="col" class="${TBL.th}">${t("Utilisateur")}</th><th scope="col" class="${TBL.th} hidden xl:table-cell">${t("Pays")}</th><th scope="col" class="${TBL.th} hidden xl:table-cell">${t("Date d'inscription")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Solde")}</th><th scope="col" class="${TBL.th}">${t("Statut")}</th>${admThActions()}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));

  return `${pageHeader(t("Utilisateurs"), t("Clippers, agences et administrateurs. Les nouvelles inscriptions apparaissent ici automatiquement."))}
    ${admBadgeRequests(requests)}
    ${requests.length ? `<h2 class="mt-8 text-heading text-fg">${t("Tous les comptes")}</h2>` : ""}
    ${admToolbar(`<div class="flex min-w-0 gap-2 xl:contents">${searchInput("adm-user-q", f.userQ, t("Nom, email, pays"), t("Rechercher un utilisateur"), "min-w-0 flex-1 xl:max-w-xs")}${select("adm-user-status", f.userStatus, [["Tous", t("Tous statuts")], ...statuses.slice(1)], { label: t("Statut"), cls: "w-36 shrink-0 sm:hidden" })}</div>`,
      `<div class="flex min-w-0 items-center gap-2">${segmented("adm-user-role", f.userRole, roles, t("Rôle"), { scroll: true })}<span class="hidden sm:contents">${segmented("adm-user-status", f.userStatus, statuses, t("Statut"))}</span></div>`)}
    ${admCountLine(list.length, db.users.length, "compte", "comptes")}
    <div class="mt-3">${list.length ? table
      : emptyState("search", t("Aucun utilisateur ne correspond"), t("Essayez un autre nom, un autre rôle ou effacez les filtres."), `<button type="button" data-action="adm-user-clear" class="${btn("secondary")}">${t("Effacer les filtres")}</button>`)}</div>`;
}

// ---------- Fiche d'un utilisateur (#/admin/utilisateur/<id>) ----------

// Bannière d'une agence : sa photo de couverture (3:1), sinon le dégradé de la catégorie de ses campagnes.
function admCoverBanner(u, camps) {
  if (u.cover) return `<div class="relative aspect-[3/1] w-full overflow-hidden bg-muted" aria-hidden="true"><img src="${esc(u.cover)}" alt="" loading="lazy" decoding="async" class="absolute inset-0 size-full object-cover"/></div>`;
  const c = camps.find((x) => x.status === "Active") || camps[0];
  return `<div class="cover aspect-[3/1] w-full" data-cat="${c && CATEGORIES.includes(c.category) ? c.category : "Autre"}" aria-hidden="true"></div>`;
}

// Badge de vérification d'une agence : état de la demande et décision (accorder, refuser avec motif, retirer).
const ADM_VERIF_TAG = {
  pending: () => badge(t("Demande en attente"), "info", { ic: "clock" }),
  verified: () => badge(`${verifiedBadge("size-3.5")}${t("Agence vérifiée")}`, "info"),
  rejected: () => badge(t("Demande refusée"), "danger", { dot: true }),
  none: () => badge(t("Non vérifiée"), "idle", { dot: true }),
};
function admVerifCard(u) {
  const v = ADM_VERIF_TAG[u.verification] ? u.verification : "none";
  const note = u.verificationNote ? esc(u.verificationNote) : "";
  const act_ = (action, variant, label, ic = "", value = "") => `<button type="button" data-action="${action}" data-id="${u.id}"${value ? ` data-value="${value}"` : ""} class="${btn(variant, "md")}">${ic ? icon(ic) : ""}${label}</button>`;
  const body = {
    pending: () => `<div class="mt-4 rounded-tile bg-subtle p-3.5">
        <p class="text-xs font-medium text-fg-subtle">${t("Message de l'agence")}</p>
        <p class="mt-1 break-words text-sm ${note ? "text-fg" : "text-fg-subtle"}">${note || t("Aucun message joint à la demande.")}</p></div>
      <p class="mt-3 text-small text-fg-muted">${t("Vérifiez l'identité de l'agence (registre du commerce, site officiel, comptes de la marque) avant d'accorder le badge.")}</p>
      <div class="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">${act_("adm-verify", "dangerSoft", t("Refuser"), "", "reject")}${act_("adm-verify-approve", "primary", t("Accorder le badge"), "shield")}</div>`,
    verified: () => `<p class="mt-4 flex items-start gap-2.5 text-sm text-fg">${verifiedBadge("mt-0.5 size-5")}<span>${t("Le badge bleu s'affiche à côté du nom de l'agence, sur ses campagnes et sur sa page.")}</span></p>
      <div class="mt-4 flex sm:justify-end">${act_("adm-verify", "dangerSoft", t("Retirer le badge"), "", "revoke")}</div>`,
    rejected: () => `${note ? `<div class="mt-4">${alertBox("danger", `<p class="font-medium">${t("Motif du refus")}</p><p class="mt-0.5 break-words">${note}</p>`)}</div>` : ""}
      <p class="mt-3 text-small text-fg-muted">${t("L'agence peut envoyer une nouvelle demande depuis son profil. Vous pouvez aussi lui accorder le badge directement.")}</p>
      <div class="mt-4 flex sm:justify-end">${act_("adm-verify-approve", "secondary", t("Accorder le badge"), "shield")}</div>`,
    none: () => `${note ? `<p class="mt-4 text-small text-fg-muted">${t("Badge retiré : {note}", { note })}</p>` : `<p class="mt-4 text-small text-fg-muted">${t("Aucune demande en cours. L'agence peut demander le badge depuis son profil, ou vous pouvez le lui accorder directement.")}</p>`}
      <div class="mt-4 flex sm:justify-end">${act_("adm-verify-approve", "secondary", t("Accorder le badge"), "shield")}</div>`,
  }[v]();
  return card(`${cardHeader(t("Badge de vérification"), t("Le badge bleu certifie l'identité de l'agence."), ADM_VERIF_TAG[v]())}${body}`);
}

// Mouvements d'argent d'un compte (retraits d'un clipper, recharges d'une agence) : une demande en cours mène à
// Paiements, sur sa ligne (#/admin/retraits/<id>). Libellé de l'opération (texte du serveur) traduit par tServer.
function admTxList(list) {
  return `<ul class="divide-y divide-line overflow-hidden ${CARD}">${list.map((tx) => {
    const card_ = tx.type === "recharge" ? admCardOf(tx) : null, out = tx.type === "retrait";
    const how = !card_ && !out ? admMethod(tx.method) : "";
    // Sortie ↗ ou entrée ↙ : flèches retournées en arabe (sens de lecture) ; la carte bancaire reste telle quelle.
    return `<li data-row="${tx.id}" class="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-fg-muted" aria-hidden="true">${card_ ? icon("card", "size-4") : icon(out ? "arrowUpRight" : "arrowDownLeft", "size-4 rtl:-scale-x-100")}</span>
      <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(tServer(tx.label))}</p>
        <p class="truncate text-xs tabular-nums text-fg-subtle">${admWhen(tx)}${how ? ` · ${how}` : ""}${admOnlinePay(tx) ? " · Chargily" : ""} · ${code(tx.ref)}${tx.fee ? ` · ${t("frais {amount}", { amount: da(tx.fee) })}` : ""}</p></div>
      <div class="flex shrink-0 flex-col items-end gap-1"><span class="text-sm font-medium">${money(Math.abs(tx.amount))}</span>
        ${tx.status === "En cours" ? (admOnlinePay(tx) ? admOnlineWaiting() : `<a href="#/admin/retraits/${encodeURIComponent(tx.id)}" class="${btn("link", "", "text-xs")}">${t("À traiter")}</a>`) : statusBadge(tx.status)}</div>
      ${txDocBtn(tx, { compact: true })}
    </li>`;
  }).join("")}</ul>`;
}

function aUtilisateur() {
  const u = userById(state.route.item || "");
  const crumb = (name) => `<nav aria-label="${esc(t("Fil d'Ariane"))}"><ol class="flex min-w-0 items-center gap-1.5 text-small">
      <li class="shrink-0"><a href="#/admin/utilisateurs" class="${HIT} inline-flex items-center gap-1 rounded-sm font-medium text-fg-muted transition-colors duration-150 hover:text-fg ${FOCUS}">${icon("arrowLeft", "size-4 sm:hidden rtl:-scale-x-100")}${t("Utilisateurs")}</a></li>
      <li class="hidden shrink-0 text-fg-subtle sm:block" aria-hidden="true">${icon("chevronRight", "size-3.5 rtl:-scale-x-100")}</li>
      <li class="hidden min-w-0 truncate text-fg-subtle sm:block" aria-current="page">${esc(name)}</li></ol></nav>`;
  if (!u) {
    return `${crumb(t("Compte introuvable"))}
      <h1 class="sr-only">${t("Compte introuvable")}</h1>
      <div class="mt-6">${emptyState("users", t("Compte introuvable"), t("Ce compte n'existe pas ou a été supprimé."), `<a href="#/admin/utilisateurs" class="${btn("secondary")}">${t("Voir les utilisateurs")}</a>`)}</div>`;
  }
  const agency = u.role === "agence", clipper = u.role === "clipper", admin = u.role === "admin", self = u.id === state.session;
  const camps = agency ? db.campaigns.filter((c) => c.ownerId === u.id) : [];
  const pubs = clipper ? db.publications.filter((p) => p.userId === u.id) : [];
  const txs = db.transactions.filter((tx) => tx.userId === u.id && tx.type === (agency ? "recharge" : "retrait"));

  // En-tête : couverture (agence), photo, nom et badge, rôle et statut, coordonnées.
  const tags = [
    admin ? badge(t("Administrateur"), "brand", { ic: "shield" }) : agency ? badge(t("Agence"), "info", { ic: "building" }) : badge(esc(t(u.level || "Clipper")), "brand", { ic: "medal" }),
    statusBadge(u.status),
    agency && u.verification === "pending" ? badge(t("Badge demandé"), "info", { ic: "clock" }) : "",
  ].filter(Boolean).join("");
  const toggle = admin ? (self ? `<a href="#/admin/compte" class="${btn("secondary")}">${icon("pencil")}${t("Modifier mon compte")}</a>` : "")
    : u.status === "Actif"
      ? `<button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="${btn("dangerSoft")}">${icon("ban")}${t("Suspendre le compte")}</button>`
      : `<button type="button" data-action="adm-user-toggle" data-id="${u.id}" class="${btn("secondary")}">${icon("play")}${t("Réactiver le compte")}</button>`;
  const fact = (label, value) => `<div class="min-w-0"><dt class="text-xs text-fg-subtle">${label}</dt><dd class="mt-0.5 flex min-w-0 items-center gap-1 text-sm text-fg">${value}</dd></div>`;
  const country = u.country || "Algérie";
  // Contact libre (nom, téléphone…) : dir="auto", un numéro reste lisible de gauche à droite en arabe.
  const facts = [
    fact(t("Email"), `<span class="min-w-0 break-all" dir="ltr">${esc(u.email || "")}</span>${u.email ? admCopyBtn(u.email, t("Copier l'adresse email"), t("Adresse copiée")) : ""}`),
    agency ? fact(t("Contact"), u.contact ? `<span class="min-w-0 break-words" dir="auto">${esc(u.contact)}</span>` : `<span class="text-fg-subtle">${t("Non renseigné")}</span>`) : "",
    clipper && u.handle ? fact(t("Compte principal"), `<span class="min-w-0 truncate" dir="ltr">${esc(u.handle)}</span>`) : "",
    fact(t("Pays"), `<span class="inline-flex items-center gap-1.5">${esc(t(country))}${country === "Algérie" ? flagDz() : ""}</span>`),
    fact(agency ? t("Inscrite le") : t("Inscrit le"), `<span class="tabular-nums">${date(u.joined)}</span>`),
    // Parrainage d'un clipper : son parrain (lien vers sa fiche), ses filleuls et son code.
    clipper ? fact(t("Parrainé par"), u.referredBy ? admUserLink(userById(u.referredBy) || { id: u.referredBy, name: "" }) : `<span class="text-fg-subtle">${t("Personne")}</span>`) : "",
    clipper ? fact(t("Filleuls"), `<span class="tabular-nums">${fmt(db.users.filter((x) => x.referredBy === u.id).length)}</span>${u.referralCode ? `<span class="text-fg-subtle">·</span>${code(u.referralCode)}` : ""}`) : "",
    u.locale && LOCALES[u.locale] ? fact(t("Langue"), `<span lang="${u.locale}" dir="${LOCALES[u.locale].dir}">${esc(LOCALES[u.locale].label)}</span>`) : "",
  ].filter(Boolean).join("");
  const header = `<section class="mt-4 overflow-hidden ${CARD}">
      ${agency ? admCoverBanner(u, camps) : ""}
      <div class="px-4 pb-5 sm:px-6 sm:pb-6 ${agency ? "" : "pt-5 sm:pt-6"}">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            ${avatar(u, `size-20 text-2xl sm:size-24 sm:text-3xl ${agency ? "relative -mt-10 ring-4 ring-surface sm:-mt-12" : ""}`)}
            <h1 class="mt-3 break-words text-title-sm text-fg sm:text-title">${nameWithBadge(u, "size-5 sm:size-6")}</h1>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">${tags}</div>
          </div>
          ${toggle ? `<div class="flex shrink-0 flex-wrap gap-2">${toggle}</div>` : ""}
        </div>
        ${u.bio ? `<p class="mt-4 max-w-2xl break-words text-sm leading-6 text-fg-muted" dir="auto">${esc(u.bio)}</p>` : ""}
        <dl class="mt-5 grid gap-x-8 gap-y-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3">${facts}</dl>
      </div>
    </section>`;

  if (admin) {
    return `${crumb(u.name)}${header}
      <div class="mt-4 lg:mt-5">${alertBox("info", t("Compte administrateur : accès complet à l'espace d'administration. Il ne peut pas être suspendu depuis l'administration."))}</div>`;
  }

  if (agency) {
    const running = camps.filter((c) => c.status === "Active" || c.status === "En pause"), clips = db.publications.filter((p) => camps.some((c) => c.id === p.campaign));
    const waiting = camps.filter((c) => c.status === "En attente").length, toModerate = clips.filter((p) => p.status === "En attente").length;
    const toConfirm = admSum(txs.filter((tx) => tx.status === "En cours" && !admOnlinePay(tx)), (tx) => tx.amount);
    const kpis = [
      kpi({ label: t("Crédit disponible"), value: bigMoney(u.credit || 0), sub: toConfirm ? t("{amount} de recharge à confirmer", { amount: da(toConfirm) }) : t("pour financer ses campagnes") }),
      kpi({ label: t("Campagnes en cours"), value: kpiValue(fmt(running.length)), sub: waiting ? t("{n} en attente de vérification", { n: fmt(waiting) }) : t("sur {count}", { count: plural(camps.length, "campagne", "campagnes") }) }),
      kpi({ label: t("Budget consommé"), value: bigMoney(admSum(camps, (c) => c.spent)), sub: t("sur {amount} engagés", { amount: da(admSum(running, (c) => c.budget)) }) }),
      kpi({ label: t("Clips reçus"), value: kpiValue(fmt(clips.length)), sub: toModerate ? t("{n} à modérer", { n: fmt(toModerate) }) : t("Tout est modéré") }),
    ];
    return `${crumb(u.name)}${header}
      <div class="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-5 lg:gap-5 xl:grid-cols-4">${kpis.join("")}</div>
      <div class="mt-4 max-w-3xl lg:mt-5">${admVerifCard(u)}</div>
      ${sectionHeader(t("Campagnes de l'agence"))}
      ${camps.length ? admCampTable(camps, { owner: false }) : emptyState("target", t("Aucune campagne"), t("Les campagnes créées par cette agence apparaîtront ici."))}
      ${sectionHeader(t("Recharges de crédit"))}
      ${txs.length ? admTxList(txs) : emptyState("bank", t("Aucune recharge"), t("Les recharges de crédit annoncées par l'agence apparaîtront ici."))}`;
  }

  // Clipper : gains, moyen de retrait, comptes sociaux, clips (décision possible depuis sa fiche) et retraits.
  const count = (s) => pubs.filter((p) => p.status === s).length;
  const views = admSum(pubs.filter((p) => p.status === "Validée"), (p) => p.views), acc = admAccountValue(u.payoutAccount);
  const kpis = [
    kpi({ label: t("Gains totaux"), value: bigMoney(totalEarned(u)), sub: t("depuis l'inscription") }),
    kpi({ label: t("Solde retirable"), value: bigMoney(balance(u)), sub: pendingAmount(u) ? t("{amount} en rétention", { amount: da(pendingAmount(u)) }) : t("aucun gain en rétention") }),
    kpi({ label: t("Clips soumis"), value: kpiValue(fmt(pubs.length)), sub: t("{validated} · {pending} en attente", { validated: plural(count("Validée"), "validé", "validés"), pending: fmt(count("En attente")) }) }),
    kpi({ label: t("Vues validées"), value: kpiValue(compact(views)), sub: count("Refusée") ? plural(count("Refusée"), "clip refusé", "clips refusés") : t("aucun clip refusé") }),
  ];
  const payout = card(`${cardHeader(t("Moyen de retrait"), t("Compte sur lequel ses retraits sont virés."))}
      <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">${u.payoutMethod
        ? `${badge(esc(t(u.payoutMethod)), "idle")}${acc ? `<span class="flex min-w-0 items-center gap-0.5"><span class="min-w-0 break-all font-mono text-small font-medium text-fg" dir="ltr">${admAccount(acc)}</span>${admCopyBtn(acc, t("Copier le numéro"), t("Numéro copié"))}</span>` : `<span class="text-small text-fg-subtle">${t("Numéro non renseigné")}</span>`}`
        : `<span class="text-small text-fg-subtle">${t("Aucun moyen de retrait enregistré.")}</span>`}</div>`);
  // Comptes sociaux : vérifiés (code dans la bio) ou en attente (avec le code remis au clipper). Un « @compte » du profil
  // sans compte vérifié derrière (saisi avant la vérification des comptes) est montré « Non vérifié ».
  const social = u.socialAccounts || [];
  const legacy = PLATFORMS.filter((p) => u.handles && u.handles[p.toLowerCase()] && !social.some((a) => a.platform === p && a.status === "verified"))
    .map((p) => ({ id: `legacy-${p}`, platform: p, handle: String(u.handles[p.toLowerCase()]).replace(/^@+/, ""), status: "legacy" }));
  const accRow = (a) => {
    const tag = a.status === "verified" ? badge(t("Vérifié"), "success", { ic: "check" }) : a.status === "pending" ? badge(t("En attente"), "warning", { dot: true }) : badge(t("Non vérifié"), "idle");
    const meta = a.status === "verified" ? t("Vérifié le {date}", { date: date(a.verifiedAt) })
      : a.status === "pending" ? `${t("Code {code}", { code: code(a.code) })}${a.checkedAt ? ` · ${t("Dernier essai : {when}", { when: ago(a.checkedAt).replace(/^./, (ch) => ch.toLowerCase()) })}` : ""}`
      : t("Indiqué dans le profil, jamais vérifié");
    return `<li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span class="grid size-9 shrink-0 place-items-center rounded-tile bg-muted text-fg">${icon(PLATFORM_ICON[a.platform] || "film", "size-4")}</span>
      <div class="min-w-0 flex-1"><p class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span class="min-w-0 truncate text-sm font-medium text-fg" dir="ltr">@${esc(a.handle)}</span>${tag}</p>
        <p class="mt-0.5 text-xs text-fg-subtle">${esc(a.platform)} · ${meta}</p></div></li>`;
  };
  const rows = [...social, ...legacy];
  const accounts = card(`${cardHeader(t("Comptes sociaux"), t("Vérifiés par un code dans leur bio : seuls leurs clips sont acceptés."))}
      ${rows.length ? `<ul class="mt-4 divide-y divide-line">${rows.map(accRow).join("")}</ul>`
        : `<p class="mt-4 text-small text-fg-subtle">${t("Aucun compte social ajouté.")}</p>`}`);
  // amountLabel : texte source français, traduit par publicationsTable.
  return `${crumb(u.name)}${header}
    <div class="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-5 lg:gap-5 xl:grid-cols-4">${kpis.join("")}</div>
    <div class="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">${payout}${accounts}</div>
    ${sectionHeader(t("Clips"))}
    ${pubs.length ? admPubTable(publicationsTable(pubs, { actions: true, amountLabel: "Gain", tag: admRiskTag }), "xl") : emptyState("film", t("Aucun clip pour le moment"), t("Les clips soumis par ce clipper apparaîtront ici."))}
    ${sectionHeader(t("Retraits"))}
    ${txs.length ? admTxList(txs) : emptyState("wallet", t("Aucun retrait"), t("Les demandes de retrait de ce clipper apparaîtront ici."))}`;
}
