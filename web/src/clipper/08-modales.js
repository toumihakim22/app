// Espace Clipper (8/9) : fenêtres (modales).
// Les fichiers de web/src/clipper/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Modales ----------

// Fiche d'une campagne : photo (ou couverture en dégradé), organisateur (lien vers sa page, badge bleu), chiffres,
// règles et plateformes. Une campagne en pause ou terminée reste consultable (lien d'une notification) : statut, sans action.
function clCampaignSheet(c, u) {
  const joined = u.joinedCampaigns.has(c.id), remaining = Math.max(0, c.budget - c.spent), open = c.status === "Active", o = clOrgOf(c);
  const plats = PLATFORMS.filter((p) => c.platforms.includes(p));
  const strong = (html) => `<strong class="font-semibold">${html}</strong>`;
  const tile = (label, value, extra = "", cls = "") => `<div class="${TILE} ${cls}"><p class="text-xs text-fg-subtle">${label}</p><p class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${value}</p>${extra}</div>`;
  return modalShell({
    title: esc(c.title), description: t("{category} · créée le {date}", { category: clCatLabel(c), date: date(c.createdAt) }), size: "lg",
    body: `<div class="cover relative aspect-[16/9] overflow-hidden rounded-tile sm:aspect-[2/1]" ${coverAttr(c)}>
        ${coverArt(c, "text-6xl")}
        ${c.top ? `<span class="absolute bottom-3 start-3 inline-flex items-center gap-1 rounded-badge bg-on-brand/90 px-1.5 py-0.5 text-[11px] font-semibold text-night">${icon("star", "size-3", true)}${t("Top campagne")}</span>` : ""}</div>
      <a href="${clOrgHref(o.key)}" data-action="close-modal" class="group mt-4 flex items-center gap-3 rounded-tile border border-line p-3 transition-colors duration-150 hover:border-line-strong hover:bg-subtle ${FOCUS}">
        ${clOrgMark(o, "size-10 text-sm")}
        <span class="min-w-0 flex-1"><span class="block text-xs text-fg-subtle">${t("Organisée par")}</span>
          <span class="flex min-w-0 items-center gap-1 text-sm font-medium text-fg"><span class="truncate">${esc(o.name)}</span>${o.verified ? verifiedBadge("size-4", t("Agence vérifiée")) : ""}</span></span>
        <span class="inline-flex shrink-0 items-center gap-0.5 text-small font-medium text-brand-fg">${t("Voir la page")}${icon("chevronRight", "size-4 rtl:-scale-x-100")}</span></a>
      <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        ${tile(t("Tarif"), rate(c.rate))}
        ${tile(t("Clippers"), fmt(c.clippers))}
        ${open
          ? tile(t("Budget restant"), da(remaining), `<div class="mt-2">${progress(c.spent, c.budget, { label: false, aria: t("Budget utilisé") })}</div>`, "col-span-2 sm:col-span-1")
          : `<div class="${TILE} col-span-2 sm:col-span-1"><p class="text-xs text-fg-subtle">${t("Statut")}</p><p class="mt-1">${statusBadge(c.status)}</p></div>`}
      </div>
      <div class="mt-4">${open ? alertBox("info", t("Vous êtes payé à partir de {minViews} ({min}) et jusqu'à {maxViews} ({max}) par clip.", { minViews: strong(plural(clThresholdViews(c), "vue", "vues")), min: da(c.minPayout), maxViews: strong(plural(viewsFor(c, c.maxPayout), "vue", "vues")), max: da(c.maxPayout) }))
        : alertBox("warning", c.status === "En pause"
          ? t("Cette campagne est {status} : elle n'accepte ni nouveaux clippers ni nouveaux clips pour le moment.", { status: strong(t("en pause")) })
          : t("Cette campagne est {status} : elle n'accepte plus de clippers ni de clips.", { status: strong(t("terminée")) }))}</div>
      <h3 class="mt-6 text-section text-fg">${t("Règles de la campagne")}</h3>
      <ul class="mt-2 grid gap-2">${c.rules.map((r) => `<li class="flex gap-2.5 text-sm text-fg-muted">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span>${esc(r)}</span></li>`).join("")}</ul>
      <h3 class="mt-6 text-section text-fg">${plats.length > 1 ? t("Plateformes acceptées") : t("Plateforme acceptée")}</h3>
      <div class="mt-2 flex flex-wrap gap-2">${plats.map(platformTag).join("")}</div>
      ${open && plats.length > 1 ? `<p class="mt-2 text-xs text-fg-subtle">${t("Publiez votre clip sur une seule de ces plateformes ou sur toutes : vous indiquerez un lien par plateforme, chacun payé selon ses vues.")}</p>` : ""}`,
    // Question à l'organisateur : sur une campagne active ou en pause, ou conversation déjà ouverte.
    footer: `<button type="button" data-action="close-modal" class="${btn(open ? "ghost" : "secondary")}">${t("Fermer")}</button>${clAskable(c) || clThreadOf(c.id)
      ? `<a href="#/clipper/messages/${encodeURIComponent(c.id)}" data-action="close-modal" class="${btn("secondary")}">${icon("message", "size-4")}${clThreadOf(c.id) ? t("Voir la conversation") : t("Poser une question")}</a>` : ""}${!open ? "" : joined
      ? `<button type="button" data-action="submit-clip" data-id="${c.id}" class="${btn("primary")}">${icon("plus")}${t("Soumettre un clip")}</button>`
      : `<button type="button" data-action="join" data-id="${c.id}" class="${btn("primary")}">${t("Rejoindre la campagne")}</button>`}`,
  });
}

// Lien accepté pour la coche verte : bon domaine (https) et, s'il nomme un compte, le compte vérifié `handle`.
const clUrlGood = (p, v, handle) => clUrlOk(p, v) && !clUrlForeign(p, v, handle);
// Champ de lien d'une plateforme : pictogramme et nom, compte vérifié d'où vient le clip (« @compte »), lien en LTR,
// coche en direct (LIVE.clip), erreur sous le champ.
function clUrlField(p, value, error, handle) {
  const placeholder = p === "TikTok" && handle ? `https://www.tiktok.com/@${handle}/video/…` : PLATFORM_PLACEHOLDER[p] || "https://…";
  return `<div class="grid gap-1.5" data-field>
    <label class="contents"><span class="flex items-center gap-1.5 text-small font-medium text-fg">${icon(PLATFORM_ICON[p] || "film", "size-4 shrink-0 text-fg-muted")}${t("Lien {platform}", { platform: esc(p) })}${handle ? `<span class="ms-auto inline-flex min-w-0 items-center gap-1 text-xs font-normal text-fg-subtle">${icon("shield", "size-3.5 shrink-0 text-success-fg")}<span class="truncate" dir="ltr">@${esc(handle)}</span></span>` : ""}</span>
      <span class="relative block" dir="ltr">${icon("link", "pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle")}<input name="url-${p}" type="url" inputmode="url" required value="${esc(value || "")}" placeholder="${esc(placeholder)}" autocomplete="off" autocapitalize="off" spellcheck="false" class="${inputCls} ps-9 pe-10"${error ? ' aria-invalid="true"' : ""}/>
        <span data-live-out="ok-${p}" class="pointer-events-none absolute inset-y-0 end-3 flex items-center text-income" aria-hidden="true">${clUrlGood(p, value, handle) ? icon("checkCircle", "size-4") : ""}</span></span></label>
    ${error ? clErr(esc(error)) : ""}</div>`;
}

// Soumission d'un clip : campagne, titre, « Où avez-vous publié ce clip ? » (toutes les plateformes de la campagne ou
// une seule, puis laquelle), et un champ de lien par plateforme retenue. Les choix (data-rerender) sont relus dans
// state.modal.draft (main.js garde les saisies à chaque rendu) ; une erreur ne s'affiche que tant que la valeur fautive
// n'a pas changé (m.errorValues : la saisie au moment de l'envoi). Seules les plateformes où le clipper a un compte
// vérifié se choisissent (les autres sont désactivées, avec un lien vers Profil → Comptes sociaux) ; sans aucune,
// la modale l'explique et l'envoi est désactivé.
function clSubmitModal(m) {
  const joined = clJoinedOpen();
  if (!joined.length) {
    return modalShell({
      title: t("Soumettre un clip"),
      body: emptyState("target", t("Aucune campagne rejointe"), t("Rejoignez d'abord une campagne pour pouvoir soumettre un clip."), "", { inCard: true }),
      footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><a href="#/clipper/decouvrir" data-action="close-modal" class="${btn("primary")}">${icon("compass")}${t("Découvrir les campagnes")}</a>`,
    });
  }
  const d = m.draft || {}, e = m.errors || {}, ev = m.errorValues || {};
  const same = (k) => String(d[k] ?? "") === String(ev[k] ?? "");
  const c = joined.find((x) => x.id === d.campaign) || joined.find((x) => x.id === m.id) || joined[0];
  const plats = PLATFORMS.filter((p) => c.platforms.includes(p)), single = plats.length === 1;
  const verified = clVerifiedMap(), usable = plats.filter((p) => verified.has(p)), missing = plats.filter((p) => !verified.has(p));
  const blocked = !usable.length;
  const mode = single ? "one" : (d.mode === "all" && !missing.length) || d.mode === "one" ? d.mode : "";
  const platform = single ? plats[0] : usable.includes(d.platform) ? d.platform : "";
  const targets = mode === "all" ? plats : platform ? [platform] : [];
  const errOf = (k) => (e[k] && same(k) ? e[k] : "");
  const modeErr = e.mode && !mode ? e.mode : "", platformErr = e.platform && mode === "one" && !platform ? e.platform : "";
  const titleErr = errOf("title"), campaignErr = errOf("campaign");
  const LEGEND = "mb-1.5 text-small font-medium text-fg";
  const choice = (value, title, text, off = false) => `<label class="${CHOICE} has-[[aria-invalid=true]]:border-danger-solid has-disabled:cursor-not-allowed has-disabled:opacity-50"><input type="radio" name="mode" value="${value}" data-rerender class="${RADIO}" ${mode === value ? "checked" : ""}${off ? " disabled" : ""}${modeErr ? ' aria-invalid="true"' : ""}/>
      <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${title}</span>${text}</span></label>`;
  // Plateformes de la campagne sans compte vérifié : lien vers la carte des comptes du Profil.
  const missingHint = missing.length && !blocked
    ? `<p class="text-xs text-fg-subtle">${t("Pas encore de compte vérifié sur {platforms}.", { platforms: esc(clList(missing)) })} ${clSocialLink(t("Vérifier mes comptes"), true)}</p>`
    : "";

  // Campagne à une seule plateforme : une phrase (la pastille de la plateforme s'insère à sa place dans chaque langue).
  const where = single ? `<div class="flex items-start gap-2 rounded-tile bg-subtle p-3 text-small leading-6 text-fg-muted in-[[aria-modal=true]]:bg-muted">${icon("info", "mt-1 size-4 shrink-0 text-fg-subtle")}<span class="min-w-0 [&>span]:align-middle">${t("Cette campagne se publie uniquement sur {platform}", { platform: platformTag(plats[0]) })}</span></div>`
    : `<fieldset class="grid gap-2" data-field><legend class="${LEGEND}">${t("Où avez-vous publié ce clip ?")}</legend>
        <div class="grid gap-2 sm:grid-cols-2">
          ${choice("all", t("Sur toutes les plateformes de la campagne"), `<span class="mt-2 flex flex-wrap gap-1.5">${plats.map(platformTag).join("")}</span>`, missing.length > 0)}
          ${choice("one", t("Sur une seule plateforme"), `<span class="mt-0.5 block text-xs text-fg-subtle">${t("Vous choisissez laquelle juste après.")}</span>`)}
        </div>
        ${modeErr ? clErr(esc(modeErr)) : mode === "one" ? "" : missingHint}</fieldset>`;

  const which = !single && mode === "one"
    ? `<fieldset class="grid gap-2" data-field><legend class="${LEGEND}">${t("Sur quelle plateforme ?")}</legend>
        <div class="grid grid-cols-2 gap-2 ${CL_COLS[plats.length] || ""}">${plats.map((p) => `<label class="block min-w-0"><input type="radio" name="platform" value="${p}" data-rerender class="peer sr-only" ${p === platform ? "checked" : ""}${verified.has(p) ? "" : " disabled"}${platformErr ? ' aria-invalid="true"' : ""}/><span class="${SEG_CHOICE} h-11 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-aria-[invalid=true]:border-danger-solid">${icon(PLATFORM_ICON[p] || "film")}<span class="truncate">${p}</span></span></label>`).join("")}</div>
        ${platformErr ? clErr(esc(platformErr)) : missingHint}</fieldset>`
    : "";

  const links = targets.length
    ? `<div class="grid gap-4">
        ${targets.length > 1 ? `<p class="text-xs text-fg-subtle">${t("Un lien par plateforme : chaque publication est vérifiée, puis payée selon ses propres vues.")}</p>` : ""}
        ${targets.map((p) => clUrlField(p, d[`url-${p}`], errOf(`url-${p}`), verified.get(p))).join("")}</div>`
    : `<div class="flex items-center gap-2.5 rounded-tile border border-dashed border-line-strong px-3.5 py-3 text-small text-fg-subtle">${icon("link", "size-4 shrink-0")}<span>${mode === "one" ? t("Choisissez la plateforme pour coller le lien de votre clip.") : t("Les champs de lien s'affichent selon votre choix.")}</span></div>`;

  return modalShell({
    title: t("Soumettre un clip"), description: t("Le clip sera vérifié par l'équipe {brand} avant validation."), form: "submit", live: "clip", size: "lg",
    body: `<div class="grid gap-5">
      ${field(t("Campagne"), `<span class="relative block"><select name="campaign" data-rerender class="${selectCls}"${campaignErr ? ' aria-invalid="true"' : ""}>${joined.map((x) => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${esc(x.title)} · ${rateShort(x.rate)}</option>`).join("")}</select>${CHEVRON}</span>`, "", campaignErr ? esc(campaignErr) : "")}
      <div class="grid gap-1.5" data-field><label class="contents"><span class="text-small font-medium text-fg">${t("Titre du clip")}</span><input name="title" required maxlength="100" value="${esc(d.title || "")}" placeholder="${t("Ex. Le but de l'année")}" autocomplete="off" autofocus class="${inputCls}"${titleErr ? ' aria-invalid="true"' : ""}/></label>${titleErr ? clErr(esc(titleErr)) : ""}</div>
      ${blocked ? alertBox("warning", `${single
        ? t("Vérifiez d'abord votre compte {platform} : seuls les clips publiés depuis un compte vérifié sont acceptés.", { platform: esc(plats[0]) })
        : t("Vérifiez d'abord l'un de vos comptes {platforms} : seuls les clips publiés depuis un compte vérifié sont acceptés.", { platforms: esc(clList(plats)) })} ${clSocialLink(t("Vérifier mes comptes"), true)}`)
        : `${where}
      ${which}
      ${links}`}
    </div>`,
    footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><button class="${btn("primary")}"${blocked ? " disabled" : ""}>${icon("send", "rtl:-scale-x-100")}${t("Envoyer pour validation")}</button>`,
  });
}

// Recours sur un clip refusé : formulaire de contestation (une seule par clip : message de 20 à 1 000 caractères et
// capture d'écran en preuve, envoyée entière), puis, une fois envoyé, son suivi (statut, motif de l'équipe, message
// et preuve envoyés).
function clAppealModal(m) {
  const p = db.publications.find((x) => x.id === m.id && x.userId === state.session);
  if (!p) return "";
  const c = campaignById(p.campaign), a = clAppealOf(p);
  const description = [t("« {title} »", { title: `<bdi>${esc(p.title)}</bdi>` }), esc(p.platform), c ? esc(c.title) : ""].filter(Boolean).join(" · ");
  const refusal = p.reason
    ? `<div class="${TILE}"><p class="text-xs text-fg-subtle">${t("Motif du refus")}</p><p class="mt-0.5 break-words text-sm text-fg" dir="auto">${esc(tServer(p.reason))}</p></div>`
    : "";
  if (a) {
    const decided = a.status !== "En attente", day = date(a.decidedAt || a.createdAt);
    const decision = !decided
      ? alertBox("info", t("L'équipe {brand} examine votre recours. Vous serez prévenu de sa décision par une notification."))
      : alertBox(a.status === "Acceptée" ? "success" : "danger", `${a.status === "Acceptée" ? t("Recours accepté le {date} : votre clip est validé.", { date: day }) : t("Recours refusé le {date} : le clip reste refusé.", { date: day })}${a.decisionNote ? `<span class="mt-1 block">${t("Motif de l'équipe : {note}", { note: esc(a.decisionNote) })}</span>` : ""}`);
    return modalShell({
      title: t("Votre recours"), description, size: "lg",
      body: `<div class="grid gap-4">
        <div class="flex flex-wrap items-center gap-2">${appealBadge(a.status)}<span class="text-small text-fg-subtle">${t("Envoyé le {date}", { date: date(a.createdAt) })}</span></div>
        ${decision}
        ${refusal}
        <div><p class="text-small font-medium text-fg">${t("Votre message")}</p><p class="mt-1 whitespace-pre-line break-words text-sm text-fg-muted" dir="auto">${esc(a.message)}</p></div>
        ${a.proof ? `<div><p class="text-small font-medium text-fg">${t("Votre preuve")}</p><div class="mt-1.5 grid place-items-center overflow-hidden rounded-tile bg-muted"><img src="${esc(a.proof)}" alt="${t("Capture d'écran jointe au recours")}" class="max-h-96 w-auto max-w-full object-contain"/></div></div>` : ""}
      </div>`,
      footer: `<button type="button" data-action="close-modal" class="${btn("secondary")}">${t("Fermer")}</button>`,
    });
  }
  if (p.status !== "Refusée") return "";
  return modalShell({
    title: t("Contester le refus"), description, form: "cl-appeal", live: "clAppeal", size: "lg",
    body: `<div class="grid gap-5">
      ${refusal}
      ${alertBox("info", `<strong class="font-semibold">${t("Une seule contestation possible par clip.")}</strong> ${t("Expliquez pourquoi ce refus vous semble injustifié et joignez une capture d'écran qui le prouve. L'équipe {brand} revoit le clip et vous répond par une notification.")}`)}
      <div class="grid gap-1.5" data-field><label class="contents"><span class="text-small font-medium text-fg">${t("Votre message")}</span>
        <textarea name="message" rows="5" maxlength="1000" required autofocus dir="auto" placeholder="${esc(t("Ex. La musique vient de la bibliothèque audio libre de droits de la plateforme : la licence est sur la capture."))}" aria-describedby="cl-appeal-hint" class="${textareaCls}"></textarea></label>
        <span id="cl-appeal-hint" class="flex justify-between gap-3 text-xs text-fg-subtle"><span>${t("Entre 20 et 1 000 caractères.")}</span><span data-live-out="count" dir="ltr" class="shrink-0 tabular-nums">${LIVE.clAppeal({}).count}</span></span></div>
      ${imageField({
        name: "proof", shape: "proof", label: t("Preuve (capture d'écran)"),
        hint: t("JPEG, PNG ou WebP, envoyée entière, sans recadrage : statistiques de la vidéo, licence de la musique, message de la plateforme…"),
        labels: { pick: t("Choisir une capture"), change: t("Changer la capture"), clear: t("Retirer la capture") },
        fallback: `<span class="flex flex-col items-center gap-1.5 text-small text-fg-subtle">${icon("image", "size-6")}${t("Aucune capture choisie")}</span>`,
      })}
    </div>`,
    footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><button class="${btn("primary")}">${icon("send", "rtl:-scale-x-100")}${t("Envoyer la contestation")}</button>`,
  });
}

function clipperModal() {
  const m = state.modal;
  if (!m) return "";
  const u = me();
  if (m.type === "campaign") {
    const c = campaignById(m.id);
    return c ? clCampaignSheet(c, u) : "";
  }
  if (m.type === "submit") return clSubmitModal(m);
  if (m.type === "cl-appeal") return clAppealModal(m);
  if (m.type === "cl-social-remove") {
    const a = clSocial().find((x) => x.id === m.id);
    if (!a) return "";
    const handle = `<span class="font-medium text-fg" dir="ltr">@${esc(a.handle)}</span>`;
    return modalShell({
      title: t("Retirer votre compte {platform} ?", { platform: esc(a.platform) }),
      body: `<p class="text-sm text-fg-muted">${t("Le compte {handle} ne sera plus vérifié : vos clips déjà envoyés ne changent pas, mais vous ne pourrez plus soumettre de clip {platform} avant d'avoir vérifié un compte, avec un nouveau code.", { handle, platform: esc(a.platform) })}</p>`,
      footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><button type="button" data-action="cl-social-remove-confirm" data-id="${a.id}" class="${btn("danger")}">${icon("trash")}${t("Retirer le compte")}</button>`,
    });
  }
  if (m.type === "withdraw") {
    const set = db.settings, min = set.minWithdraw, bal = Math.floor(balance());
    const blocked = !u.payoutMethod
      ? alertBox("info", t("Ajoutez d'abord le compte sur lequel vous voulez être payé (BaridiMob, CCP ou RIB). {link}", { link: `<a href="#/clipper/parametres" class="${btn("link")}">${t("Ajouter un moyen de retrait")}</a>` }))
      : bal < min
        ? alertBox("info", `${t("Votre solde disponible ({balance}) est inférieur au minimum de retrait, fixé à {min}.", { balance: da(bal), min: `<strong class="font-semibold">${da(min)}</strong>` })}${pendingAmount() ? ` ${t("{amount} deviendront retirables à la fin de leur période de rétention.", { amount: da(pendingAmount()) })}` : ""}`)
        : "";
    if (blocked) {
      return modalShell({
        title: t("Demander un retrait"), description: t("Solde disponible : {amount}", { amount: da(bal) }),
        body: blocked,
        footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Fermer")}</button><button type="button" class="${btn("primary")}" disabled>${t("Confirmer le retrait")}</button>`,
      });
    }
    const amount = m.amount !== undefined ? String(m.amount) : fmt(bal), speed = m.speed === "instant" ? "instant" : "standard";
    const init = LIVE.withdraw({ amount, speed });
    const choice = (value, title, text, right) => `<label class="${CHOICE}"><input type="radio" name="speed" value="${value}" class="${RADIO}" ${speed === value ? "checked" : ""}/><span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${title}</span><span class="block text-xs text-fg-subtle">${text}</span></span><span class="shrink-0 text-end text-small font-medium tabular-nums text-fg">${right}</span></label>`;
    return modalShell({
      title: t("Demander un retrait"), description: t("Solde disponible : {amount}", { amount: da(bal) }), form: "withdraw", live: "withdraw",
      body: `${field(t("Montant"), `<div class="flex gap-2"><div class="min-w-0 flex-1">${unitInput(`name="amount" value="${esc(amount)}" autocomplete="off" autofocus aria-describedby="wd-hint"${m.error ? ' aria-invalid="true"' : ""}`, t("DA"), { lg: true })}</div><button type="button" data-action="wd-max" class="${btn("secondary", "lg")}">${t("Tout retirer")}</button></div>`, `<span id="wd-hint">${t("Minimum {min} · maximum {max}", { min: da(min), max: da(bal) })}</span>`, m.error ? esc(m.error) : "")}
        <fieldset class="mt-5 grid gap-2"><legend class="mb-1.5 text-small font-medium text-fg">${t("Délai")}</legend>
          ${choice("standard", t("Standard"), t("Traité sous 48 h ouvrées"), t("Gratuit"))}
          ${choice("instant", t("Instantané"), t("Traité en priorité"), `${pct(set.instantFeePercent)}<span class="block text-xs font-normal text-fg-subtle">${t("min. {amount}", { amount: da(set.instantMinFee) })}</span>`)}
        </fieldset>
        <div data-live-out>${init[""]}</div>
        <p class="mt-4 flex items-center gap-2 text-small text-fg-muted">${icon(CL_PAYOUT_ICON[u.payoutMethod] || "bank", "size-4 shrink-0 text-fg-subtle")}<span class="min-w-0 truncate">${t("Vers {method} {account}", { method: esc(t(u.payoutMethod)), account: `<span class="font-mono" dir="ltr">${maskAccount(u.payoutAccount)}</span>` })}</span></p>`,
      footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><button class="${btn("primary")}" data-live-out="btn">${init.btn}</button>`,
    });
  }
  return "";
}

// el : l'élément cliqué (data-action). Les toasts reçoivent du texte brut : toast() l'échappe.
