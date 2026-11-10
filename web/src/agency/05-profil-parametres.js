// Espace Agence (5/8) : profil de l'agence, paramètres et table des vues (AGENCY_VIEWS).
// Les fichiers de web/src/agency/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Profil de l'agence ----------

// Catégorie principale (teinte de la couverture en dégradé, comme sur la page vue par les clippers) : celle de la
// première campagne en ligne, sinon de la première campagne.
const agMainCategory = (list) => { const c = list.find((x) => !agEditable(x)) || list[0]; return c && CATEGORIES.includes(c.category) ? c.category : "Autre"; };

// En-tête de la page de l'agence telle que les clippers la voient (#/clipper/agence/<id>) : couverture 3:1, logo en
// carré arrondi (une structure, pas une personne), nom avec le badge bleu, pays, présentation.
function agPublicHeader(u, cat) {
  const tone = AVATARS[[...String(u.id)].reduce((h, ch) => h + ch.charCodeAt(0), 0) % AVATARS.length];
  const country = u.country || "Algérie";
  const cover = u.cover
    ? `<div class="relative aspect-[3/1] w-full overflow-hidden bg-muted"><img src="${esc(u.cover)}" alt="" class="absolute inset-0 size-full object-cover"/></div>`
    : `<div class="cover aspect-[3/1] w-full" data-cat="${cat}"></div>`;
  const mark = u.avatar
    ? `<img src="${esc(u.avatar)}" alt="" class="relative -mt-8 block size-16 rounded-tile bg-muted object-cover ring-4 ring-surface"/>`
    : `<span class="relative -mt-8 grid size-16 select-none place-items-center rounded-tile text-xl font-semibold text-on-brand ring-4 ring-surface ${tone}">${esc(initials(u.name))}</span>`;
  return `<div aria-hidden="true">${cover}</div>
    <div class="px-4 pb-4">
      <div aria-hidden="true">${mark}</div>
      <p class="mt-2.5 break-words text-section text-fg">${nameWithBadge(u)}</p>
      <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-fg-muted">${badge(t("Agence"), "info")}<span class="inline-flex items-center gap-1.5">${esc(t(country))}${country === "Algérie" ? flagDz() : ""}</span></p>
      ${u.bio ? `<p class="mt-3 line-clamp-4 break-words text-small text-fg-muted">${esc(u.bio)}</p>`
        : `<p class="mt-3 text-small text-fg-subtle">${t("Ajoutez une présentation : les clippers la lisent avant de rejoindre vos campagnes.")}</p>`}
    </div>`;
}

// Aperçu en direct pendant la saisie du profil (nom, présentation, pays, logo, couverture).
LIVE.agProfile = (d) => {
  const u = me();
  return { preview: agPublicHeader({ ...u, name: String(d.name || "").trim() || u.name, bio: String(d.bio || "").trim(), country: d.country || u.country, avatar: d.avatar || null, cover: d.cover || null }, agMainCategory(myCampaigns())) };
};

// Badge de vérification : aucune demande (ou badge retiré, motif rappelé), demande en cours, refusée (motif), vérifiée.
function agVerifyCard(u) {
  const st = u.verification || "none", note = u.verificationNote || "";
  if (st === "verified") {
    return card(`<div class="flex items-start gap-3">${verifiedBadge("size-8", t("Agence vérifiée"))}
      <div class="min-w-0"><h2 class="text-section text-fg">${t("Votre agence est vérifiée")}</h2>
        <p class="mt-1 text-small text-fg-muted">${t("Le badge bleu s'affiche à côté de son nom : sur sa page, sur ses campagnes et dans la liste des agences.")}</p></div></div>`);
  }
  const head = (right = "") => `<header class="flex flex-wrap items-center justify-between gap-2"><h2 class="flex items-center gap-2 text-section text-fg">${icon("shield", "size-5 text-fg-subtle")}${t("Badge de vérification")}</h2>${right}</header>`;
  const intro = `<p class="mt-3 text-small text-fg-muted">${t("Le badge bleu {badge} montre aux clippers que votre agence a été vérifiée par l'équipe {brand}. Il s'affiche à côté de son nom, sur sa page et sur ses campagnes.", { badge: `<span aria-hidden="true">${verifiedBadge("size-4")}</span>` })}</p>`;
  const ask = (label) => `<button type="button" data-action="ag-verify" class="${btn("secondary", "md", "mt-4 w-full")}">${icon("send")}${label}</button>`;
  if (st === "pending") {
    return card(`${head(badge(t("En cours d'examen"), "warning", { ic: "clock" }))}
      <p class="mt-3 text-sm font-medium text-fg">${t("Demande en cours d'examen")}</p>
      <p class="mt-0.5 text-small text-fg-muted">${t("L'équipe {brand} examine votre demande. Vous serez prévenu de sa décision par notification.")}</p>
      ${note ? `<figure class="mt-3 rounded-tile bg-subtle p-3"><figcaption class="text-xs text-fg-subtle">${t("Votre message")}</figcaption><blockquote class="mt-1 whitespace-pre-line break-words text-small text-fg">${esc(note)}</blockquote></figure>` : ""}`);
  }
  if (st === "rejected") {
    return card(`${head(badge(t("Refusée"), "danger", { dot: true }))}
      <div class="mt-3">${alertBox("danger", `<p class="font-medium">${t("Votre demande a été refusée")}</p>${note ? `<p class="mt-0.5 break-words">${esc(note)}</p>` : ""}`)}</div>
      ${intro}${ask(t("Refaire une demande"))}`);
  }
  return card(`${head()}
    ${note ? `<div class="mt-3">${alertBox("warning", `<p class="font-medium">${t("Le badge de votre agence a été retiré")}</p><p class="mt-0.5 break-words">${esc(note)}</p>`)}</div>` : ""}
    ${intro}${ask(t("Demander le badge"))}`);
}

// Formulaire de page (brouillon gardé par main.js d'un réaffichage à l'autre, photos comprises) qui couvre aussi la
// colonne de droite : l'aperçu de la page publique suit la saisie (LIVE.agProfile).
function gProfil() {
  const u = me(), list = myCampaigns(), cat = agMainCategory(list);
  const coverFallback = `<span class="cover absolute inset-0" data-cat="${cat}"></span>`;
  const logoFallback = avatar({ ...u, avatar: null }, "size-full text-2xl");
  const edit = card(`<h2 class="text-section text-fg">${t("Logo et couverture")}</h2>
      <p class="mt-0.5 text-small text-fg-muted">${t("Ils illustrent la page de votre agence et vos campagnes auprès des clippers.")}</p>
      <div class="mt-5 grid gap-5">
        ${imageField({ name: "cover", value: u.cover || "", shape: "cover", label: t("Photo de couverture"), hint: t("Bandeau en haut de la page de votre agence, recadré au format 3:1. JPEG, PNG ou WebP."), fallback: coverFallback })}
        ${imageField({ name: "avatar", value: u.avatar || "", shape: "avatar", label: t("Logo ou photo de l'agence"), hint: t("Recadré en carré. Il s'affiche à côté du nom de l'agence."), fallback: logoFallback })}
      </div>
      <div class="mt-6 border-t border-line pt-6">
        <h2 class="text-section text-fg">${t("Informations de l'agence")}</h2>
        <p class="mt-0.5 text-small text-fg-muted">${t("Le nom de l'agence sert de marque sur vos nouvelles campagnes.")}</p>
        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          ${field(t("Nom de l'agence ou de la marque"), `<input name="name" required maxlength="80" value="${esc(u.name)}" autocomplete="organization" class="${inputCls}"/>`)}
          ${field(t("Nom du contact"), `<input name="contact" maxlength="80" value="${esc(u.contact || "")}" autocomplete="name" class="${inputCls}"/>`)}
          ${field(t("Pays"), countrySelect("country", u.country))}
          <div class="sm:col-span-2">${field(`${t("Présentation de l'agence")} ${agOptional()}`, `<textarea name="bio" rows="3" maxlength="300" placeholder="${t("Votre activité, vos marques, le type de clips que vous recherchez…")}" class="${textareaCls}">${esc(u.bio || "")}</textarea>`, t("Visible par les clippers sur la page de votre agence. 300 caractères maximum."))}</div>
        </div>
      </div>
      <div class="mt-6 flex justify-end border-t border-line pt-4"><button type="submit" class="${btn("primary")}">${t("Enregistrer")}</button></div>`, "p-5 self-start");
  const preview = `<section class="overflow-hidden ${CARD}">
      <header class="flex items-center justify-between gap-3 border-b border-line px-4 py-3"><h2 class="flex items-center gap-2 text-small font-medium text-fg">${icon("eye", "size-4 text-fg-subtle")}${t("Aperçu de votre page")}</h2><span class="text-xs text-fg-subtle">${t("Vue par les clippers")}</span></header>
      <div data-live-out="preview">${agPublicHeader(u, cat)}</div>
      <dl class="grid grid-cols-2 gap-2 border-t border-line p-4">
        <div class="${TILE}"><dt class="text-xs text-fg-subtle">${t("Campagnes")}</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${fmt(list.length)}</dd></div>
        <div class="${TILE}"><dt class="text-xs text-fg-subtle">${t("Clips reçus")}</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${fmt(clipsOf(list.map((c) => c.id)).length)}</dd></div>
      </dl>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line px-4 py-3 text-xs text-fg-subtle"><span>${t("Membre depuis le {date}", { date: date(u.joined) })}</span>${agMoreLink("#/agence/parametres", t("Compte, langue et thème"))}</div>
    </section>`;
  return `${pageHeader(t("Profil de l'agence"), t("Votre vitrine auprès des clippers : logo, couverture, présentation et badge de vérification."))}
    <form data-form="ag-profile" data-live="agProfile" novalidate class="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-5">
      ${edit}
      <div class="grid content-start gap-4 lg:gap-5">${preview}${agVerifyCard(u)}</div>
    </form>`;
}

// ---------- Paramètres ----------

function gParametres() {
  const u = me();
  const pref = (title, text, control) => `<div class="grid gap-3 py-4 first:pt-0 last:pb-0">
      <div class="min-w-0"><p class="text-sm font-medium text-fg">${title}</p><p class="mt-0.5 text-xs text-fg-subtle">${text}</p></div>${control}</div>`;
  const prefs = card(`${cardHeader(t("Préférences"), t("La langue et l'apparence de votre espace."))}
      <div class="mt-4 divide-y divide-line">
        ${pref(t("Langue"), t("Enregistrée sur votre compte : elle vous suit sur tous vos appareils."), langSwitch({ full: true, cls: "w-full sm:w-auto" }))}
        ${pref(t("Thème"), t("Clair, sombre, ou selon le réglage de votre appareil."), themeModeSwitch({ labels: true, cls: "w-full sm:w-auto" }))}
      </div>`);
  const profile = card(`<div class="flex items-center gap-3">${avatar(u, "md")}
      <div class="min-w-0 flex-1"><p class="break-words text-sm font-semibold text-fg">${nameWithBadge(u)}</p><p class="mt-0.5 text-xs text-fg-subtle">${t("Logo, couverture, présentation et badge de vérification.")}</p></div>
      <a href="#/agence/profil" class="${btn("secondary", "sm")}">${t("Modifier")}</a></div>`);
  return `${pageHeader(t("Paramètres"), t("Langue, thème et sécurité de votre compte."))}
    <div class="mt-6 grid items-start gap-4 lg:gap-5 xl:grid-cols-2">
      <div class="grid content-start gap-4 lg:gap-5">${prefs}${profile}</div>
      ${accountCard(u)}
    </div>`;
}

// paiement : page hors navigation (ITEM_PAGES dans main.js), « Budget » y reste l'entrée courante.
// Messages : questions des clippers sur les campagnes de l'agence (#/agence/messages/<campagne>~<clipper>).
const gMessages = () => msgTeamPage({
  area: "agence", form: "ag-msg", campaignAction: "ag-open", filter: state.ag.msgFilter || "all", filterAction: "ag-msg-filter",
  title: t("Messages"), text: t("Les questions des clippers sur vos campagnes. Répondez-leur ici : ils sont prévenus."),
  emptyText: t("Les clippers peuvent vous poser une question depuis la fiche de chaque campagne active ou en pause."),
});

const AGENCY_VIEWS = { apercu: gApercu, campagnes: gCampagnes, clips: gClips, messages: gMessages, budget: gBudget, paiement: gPaiement, profil: gProfil, parametres: gParametres };
