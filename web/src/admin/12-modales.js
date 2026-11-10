// Espace Admin (12/13) : fenêtres (modales).
// Les fichiers de web/src/admin/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Modales ----------

// Relevé de vues : gain estimé en direct (même règle que le serveur : rien sous le seuil, plafonné au-delà).
LIVE.admViews = (d) => {
  const p = state.modal && db.publications.find((x) => x.id === state.modal.id);
  if (!p) return "";
  const c = campaignById(p.campaign), seuil = viewsFor(c, c.minPayout || 0);
  const typed = Math.floor(admParse(d.views));
  if (!Number.isFinite(typed) || typed < p.views) return `<div class="mt-5">${alertBox("warning", t("Indiquez au moins {views} : le dernier relevé ne peut pas diminuer.", { views: plural(p.views, "vue", "vues") }))}</div>`;
  const v = typed;
  const raw = Math.floor((v * c.rate) / 1000), capped = c.maxPayout && raw >= c.maxPayout;
  const est = raw < (c.minPayout || 0) ? 0 : Math.min(raw, c.maxPayout || Infinity);
  const rows = [[t("Seuil de paiement"), v >= seuil ? t("Atteint") : t("{pct} atteint", { pct: pct(Math.floor((v / Math.max(1, seuil)) * 100)) })]];
  if (p.status === "Validée") {
    rows.push([t("Déjà crédité"), money(p.paid || 0), true]);
    return `${summary(rows)}<p class="mt-2 text-xs text-fg-subtle">${t("Les vues supplémentaires sont payées pendant {days} après la validation, dans la limite du plafond et du budget restant.", { days: plural(db.settings.earningDays, "jour", "jours") })}</p>`;
  }
  rows.push([t("Gain estimé"), est ? `${money(est)}${capped ? `<span class="ms-1.5 text-xs font-normal text-fg-subtle">${t("plafond")}</span>` : ""}` : `<span class="font-normal text-fg-subtle">${t("— sous le seuil")}</span>`, true]);
  return summary(rows);
};

// Motif d'un refus (campagne et décision sur un recours : 300 caractères, badge : 200) : compteur en direct (« 12 / 300 », de gauche à droite).
LIVE.admReason = (d) => ({ count: `${fmt(String(d.reason || "").length)}${NB}/${NB}${state.modal && ["adm-refuse", "adm-appeal-decide"].includes(state.modal.type) ? 300 : 200}` });

// Motifs fréquents de refus d'une campagne : [puce, texte inséré dans le motif], sources françaises. Le texte est
// inséré dans la langue affichée : le motif est un message libre de l'admin, envoyé tel qu'il le lit.
const ADM_CAMP_REASONS = [
  ["Budget incohérent", "Le budget, le tarif et le plafond par clip ne sont pas cohérents entre eux."],
  ["Règles trop vagues", "Les règles de la campagne sont trop vagues : précisez ce que les clips doivent montrer."],
  ["Marque non autorisée", "Cette marque ou ce produit ne peut pas être promu sur {brand}."],
  ["Photo inappropriée", "La photo de la campagne n'est pas appropriée : remplacez-la."],
  ["Marque à préciser", "Les informations sur la marque sont insuffisantes : précisez qui finance la campagne."],
];
// Motifs de refus d'un clip : valeurs envoyées en français (le clipper les lit traduites, voir tServer) ; libellés traduits.
const ADM_CLIP_REASONS = ["Règles de la campagne non respectées", "Vues suspectes ou achetées", "Contenu inapproprié", "Lien invalide ou vidéo supprimée", "Doublon d'un clip existant"];
const ADM_REASON_CHIP = `inline-flex h-10 shrink-0 items-center rounded-full border border-line-strong bg-surface px-3.5 text-small font-medium text-fg-muted transition-colors duration-150 hover:border-line-control hover:text-fg md:h-8 ${FOCUS}`;
// Champ de motif avec compteur (refus d'une campagne, refus ou retrait d'un badge). Textes déjà traduits.
const admReasonField = (id, label, max, required, placeholder, hint) => `<div class="grid gap-1.5" data-field>
    <div class="flex items-baseline justify-between gap-3"><label for="${id}" class="text-small font-medium text-fg">${label}</label><span data-live-out="count" dir="ltr" class="text-xs tabular-nums text-fg-subtle">0${NB}/${NB}${max}</span></div>
    <textarea id="${id}" name="reason" rows="4" maxlength="${max}" ${required ? "required " : ""}autofocus dir="auto" placeholder="${esc(placeholder)}" aria-describedby="${id}-hint" class="${textareaCls}"></textarea>
    <span id="${id}-hint" class="text-xs text-fg-subtle">${hint}</span>
  </div>`;

function adminModal() {
  const m = state.modal;
  if (!m) return "";
  const cancel = (label = t("Annuler")) => `<button type="button" data-action="close-modal" class="${btn("ghost")}">${label}</button>`;

  if (m.type === "adm-lesson") return admLessonModal(m);
  // Suppression d'une leçon : définitive, après confirmation.
  if (m.type === "adm-lesson-delete") {
    const l = admLessonById(m.id);
    if (!l) return admGone(t("Leçon introuvable"), t("Cette leçon a été supprimée."));
    return modalShell({
      title: t("Supprimer la leçon ?"), description: admQuoted(lsText(l.title)),
      body: `<p class="text-sm text-fg-muted">${l.published ? t("Elle disparaît aussitôt de l'Académie des clippers et ses textes sont effacés dans toutes les langues : cette action est définitive.") : t("Ce brouillon est effacé avec ses textes dans toutes les langues : cette action est définitive.")}</p>
        ${l.published ? `<p class="mt-3 text-small text-fg-subtle">${t("Pour la cacher sans la perdre, repassez-la plutôt en brouillon.")}</p>` : ""}`,
      footer: `${cancel()}<button type="button" data-action="adm-lesson-delete-confirm" data-id="${esc(l.id)}" class="${btn("danger")}">${icon("trash")}${t("Supprimer la leçon")}</button>`,
    });
  }
  if (m.type === "adm-camp") return admCampSheet(m);
  if (m.type === "adm-export") return admExportModal(m);
  if (m.type === "adm-clip") return admClipSheet(m);
  if (m.type === "adm-appeal") return admAppealSheet(m);
  // Preuve d'un recours en grand (image entière, proportions gardées).
  if (m.type === "adm-proof") {
    const a = admAppeals().find((x) => x.id === m.id), p = a && db.publications.find((x) => x.id === a.publicationId);
    if (!a || !a.proof) return admGone(t("Recours introuvable"), t("Ce recours n'existe plus."));
    return modalShell({
      title: t("Preuve du recours"), description: `${p ? `${admQuoted(p.title)} · ` : ""}${esc(admUser(a.userId).name)}`, size: "xl",
      body: `<div class="grid place-items-center rounded-tile bg-muted"><img src="${esc(a.proof)}" alt="${esc(t("Capture d'écran jointe au recours"))}" class="max-h-[70dvh] w-auto max-w-full object-contain"/></div>`,
      footer: `<button type="button" data-action="close-modal" class="${btn("secondary")}">${t("Fermer")}</button>`,
    });
  }
  // Décision sur un recours : motif obligatoire (3 à 300 caractères), lu par le clipper dans sa notification.
  if (m.type === "adm-appeal-decide") {
    const a = admAppeals().find((x) => x.id === m.id), p = a && db.publications.find((x) => x.id === a.publicationId), c = p && campaignById(p.campaign);
    if (!a || !p || !c) return admGone(t("Recours introuvable"), t("Ce recours n'existe plus."));
    const approve = m.decision === "approve", { est, blocked } = admAppealCheck(p, c);
    const note = approve
      ? blocked ? alertBox("warning", esc(blocked))
        : alertBox("info", est ? t("Le clip passe en « Validée » et {amount} sont crédités au clipper, comme pour une validation normale.", { amount: `<strong class="font-semibold">${da(est)}</strong>` })
          : t("Le clip passe en « Validée », comme pour une validation normale (aucun gain à créditer : plafond ou budget atteint)."))
      : alertBox("warning", t("Décision définitive : le clip reste refusé et le clipper ne pourra plus le contester."));
    return modalShell({
      title: approve ? t("Accepter le recours") : t("Refuser le recours"), description: `${admQuoted(p.title)} · ${esc(admUser(a.userId).name)}`, form: "adm-appeal-decide", live: "admReason",
      body: `${admReasonField("adm-appeal-reason", t("Motif de la décision"), 300, true,
          approve ? t("Ex. Licence de la musique vérifiée : le son est libre de droits.") : t("Ex. La capture ne montre pas la licence du son utilisé."),
          t("Entre 3 et 300 caractères. Le clipper le lit dans sa notification."))}
        <div class="mt-5">${note}</div>`,
      footer: `${cancel()}<button type="submit" class="${btn(approve ? "primary" : "danger")}"${approve && blocked ? " disabled" : ""}>${approve ? `${icon("check")}${t("Accepter et valider le clip")}` : t("Refuser le recours")}</button>`,
    });
  }
  if (m.type === "adm-refuse") {
    const c = campaignById(m.id);
    if (!c) return admGone(t("Campagne introuvable"), t("Cette campagne a été annulée ou supprimée par son agence."));
    const o = c.ownerId ? userById(c.ownerId) : null;
    return modalShell({
      title: t("Refuser la campagne"), description: `${admQuoted(c.title)}${o ? ` · ${esc(o.name)}` : ""}`, form: "adm-refuse", live: "admReason",
      body: `${admReasonField("adm-refuse-reason", t("Motif du refus"), 300, true, t("Ex. Le plafond par clip est trop élevé pour ce budget."), t("Entre 3 et 300 caractères. L'agence le lit dans sa notification et sur sa campagne."))}
        <div class="mt-4"><p class="text-xs text-fg-subtle">${t("Motifs fréquents")}</p>
          <div class="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="${esc(t("Motifs fréquents"))}">${ADM_CAMP_REASONS.map(([l], i) => `<button type="button" data-action="adm-reason" data-value="${i}" class="${ADM_REASON_CHIP}">${esc(t(l))}</button>`).join("")}</div></div>
        <div class="mt-5">${alertBox("info", t("L'agence est prévenue et peut modifier sa campagne puis la relancer, ou la supprimer. Rien n'est débité de son crédit."))}</div>`,
      footer: `${cancel()}<button type="submit" class="${btn("danger")}">${t("Refuser la campagne")}</button>`,
    });
  }
  if (m.type === "adm-end") {
    const c = campaignById(m.id);
    if (!c) return admGone(t("Campagne introuvable"), t("Cette campagne n'existe plus."));
    const o = c.ownerId ? userById(c.ownerId) : null, unspent = Math.max(0, c.budget - c.spent);
    const refund = o && c.reserved > 0 ? admFunding(unspent, c.commissionRate) : 0;
    return modalShell({
      title: t("Terminer la campagne ?"), description: `${admQuoted(c.title)}${o ? ` · ${esc(o.name)}` : ""}`,
      body: `<p class="text-sm text-fg-muted">${t("La campagne disparaît de Découvrir et n'accepte plus de nouveaux clips. Les gains déjà crédités aux clippers restent acquis. Cette action est définitive.")}</p>
        ${refund ? summary([[t("Budget non consommé"), money(unspent)], [t("Commission correspondante ({rate} %)", { rate: c.commissionRate }), money(refund - unspent)], [t("Rendu au crédit de l'agence"), money(refund), true]]) : ""}`,
      footer: `${cancel()}<button type="button" data-action="adm-camp-end-confirm" data-id="${c.id}" class="${btn("danger")}">${t("Terminer la campagne")}</button>`,
    });
  }
  if (m.type === "adm-verify") {
    const u = userById(m.id);
    if (!u) return admGone(t("Compte introuvable"), t("Ce compte n'existe plus."));
    const reject = m.decision !== "revoke";
    return modalShell({
      title: reject ? t("Refuser la demande de badge") : t("Retirer le badge de vérification"), description: esc(u.name), form: "adm-verify", live: "admReason",
      body: `${reject ? `<div class="mb-4 rounded-tile bg-muted p-3"><p class="text-xs font-medium text-fg-subtle">${t("Message de l'agence")}</p><p class="mt-1 break-words text-small ${u.verificationNote ? "text-fg" : "text-fg-subtle"}" dir="auto">${u.verificationNote ? esc(u.verificationNote) : t("Aucun message joint à la demande.")}</p></div>` : ""}
        ${reject
          ? admReasonField("adm-verify-reason", t("Motif du refus"), 200, true, t("Ex. Impossible de vérifier le registre du commerce de l'agence."), t("Entre 3 et 200 caractères. L'agence pourra faire une nouvelle demande."))
          : admReasonField("adm-verify-reason", `${t("Motif")} ${OPTIONAL}`, 200, false, t("Ex. Informations de l'agence devenues inexactes."), t("Transmis à l'agence s'il est indiqué. Elle pourra demander de nouveau le badge."))}`,
      footer: `${cancel()}<button type="submit" class="${btn("danger")}">${reject ? t("Refuser la demande") : t("Retirer le badge")}</button>`,
    });
  }
  if (m.type === "suspend") {
    const u = userById(m.id);
    if (!u) return "";
    return modalShell({
      title: t("Suspendre ce compte ?"), description: `${esc(u.name)} · <span dir="ltr">${esc(u.email)}</span>`,
      body: `<p class="text-sm text-fg-muted">${t("{name} sera déconnecté immédiatement et ne pourra plus se connecter. Vous pourrez réactiver le compte à tout moment depuis sa fiche ou la liste des utilisateurs.", { name: esc(u.name) })}</p>`,
      footer: `${cancel()}<button type="button" data-action="adm-user-toggle" data-id="${u.id}" data-confirm="true" class="${btn("danger")}">${t("Suspendre le compte")}</button>`,
    });
  }
  if (m.type === "reject") {
    const p = db.publications.find((x) => x.id === m.id);
    if (!p) return "";
    return modalShell({
      title: t("Refuser le clip"), description: t("« {title} » de {name}. Le clipper sera notifié du motif.", { title: esc(p.title), name: esc(admUser(p.userId).name) }), form: "adm-reject",
      body: `<fieldset class="grid gap-2"><legend class="mb-1.5 text-small font-medium text-fg">${t("Motif du refus")}</legend>
        ${ADM_CLIP_REASONS.map((r, i) => `<label class="${CHOICE_DANGER}"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? "checked autofocus" : ""} class="mt-0.5 size-4 shrink-0 cursor-pointer accent-danger-solid focus-visible:outline-none"/><span class="text-sm font-medium text-fg">${esc(t(r))}</span></label>`).join("")}</fieldset>`,
      footer: `${cancel()}<button type="submit" class="${btn("danger")}">${t("Confirmer le refus")}</button>`,
    });
  }
  if (m.type === "views") {
    const p = db.publications.find((x) => x.id === m.id);
    if (!p) return "";
    const c = campaignById(p.campaign);
    return modalShell({
      title: t("Relever les vues"), description: `${admQuoted(p.title)} · ${esc(admUser(p.userId).name)}`, form: "adm-views", live: "admViews",
      body: `${field(t("Nombre de vues affiché sur la plateforme"),
          unitInput(`name="views" type="text" value="${fmt(p.views)}" required autofocus autocomplete="off"`, tPlural(p.views, "vue", "vues"), { lg: true }),
          t("Seuil {min} · plafond {max}. Le nombre ne peut pas diminuer.", { min: plural(viewsFor(c, c.minPayout), "vue", "vues"), max: plural(viewsFor(c, c.maxPayout), "vue", "vues") }))}
        <div class="mt-4">${field(`${t("Likes")} ${OPTIONAL}`, `<input name="likes" type="text" inputmode="numeric" value="${typeof p.likes === "number" ? fmt(p.likes) : ""}" autocomplete="off" class="${inputCls} tabular-nums"/>`,
          t("Servent au score de risque : beaucoup de vues pour très peu de likes est suspect."))}</div>
        <div data-live-out>${LIVE.admViews({ views: p.views })}</div>
        ${p.url ? `<p class="mt-4"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="${btn("link", "", "text-small")}">${icon("external", "size-4")}${t("Ouvrir le clip sur {platform}", { platform: esc(p.platform) })}</a></p>` : ""}`,
      footer: `${cancel()}<button type="submit" class="${btn("primary")}">${t("Enregistrer")}</button>`,
    });
  }
  if (m.type === "reset-demo") {
    return modalShell({
      title: t("Réinitialiser la démo ?"),
      body: `<p class="text-sm text-fg-muted">${t("Les comptes créés, campagnes, clips et paiements enregistrés dans ce navigateur seront effacés, puis les données d'exemple recréées. Vous serez déconnecté.")}</p>`,
      footer: `${cancel()}<button type="button" data-action="adm-reset-demo-confirm" class="${btn("danger")}">${t("Effacer et recommencer")}</button>`,
    });
  }
  // Campagne créée par l'équipe : même formulaire que l'agence (agency.js : photo, catégories et « Autre », plateformes
  // dont Facebook), avec la marque en plus ; publiée aussitôt, sans crédit d'agence. campaignForm attend des textes traduits.
  if (m.type === "new-campaign") {
    return modalShell({
      title: t("Nouvelle campagne"), description: t("Créée par {brand}, elle est immédiatement visible par les clippers."), size: "xl", form: "adm-campaign", live: "campaign",
      body: campaignForm("adm-campaign", t("Publier la campagne"), t("Campagne gérée directement par {brand} : aucun crédit d'agence n'est prélevé.")),
      footer: `${cancel()}<button type="submit" class="${btn("primary")}">${t("Publier la campagne")}</button>`,
    });
  }
  return "";
}
