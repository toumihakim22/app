// Espace Agence (7/8) : fenêtres (modales).
// Les fichiers de web/src/agency/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Modales ----------

// Ajouter du budget : débit immédiat (budget + commission) si la campagne est déjà financée.
LIVE.budget = (d) => {
  const c = state.modal && campaignById(state.modal.id), u = me();
  if (!c) return {};
  const a = agNum(d.amount);
  const label = a ? t("Ajouter {amount} au budget", { amount: da(a) }) : t("Ajouter au budget");
  if (c.status === "En attente") {
    return { "": summary([[t("Budget actuel"), money(c.budget)], [t("Ajout"), money(a)], [t("Nouveau budget"), money(c.budget + a), true]]), btn: label, presets: agPresets(agTopupPresets(c, u), a) };
  }
  const cost = withCommission(a, c.commissionRate), fee = cost - a;
  return {
    "": `${summary([[t("Ajouté au budget"), money(a)], [t("Commission {brand} ({rate} %)", { rate: c.commissionRate }), money(fee)], [t("Débité de votre crédit"), money(cost), true]])}
      <div class="mt-3">${cost > u.credit
        ? alertBox("warning", `${t("Crédit insuffisant : il manque {missing}.", { missing: `<strong class="font-semibold tabular-nums">${da(cost - u.credit)}</strong>` })} <button type="button" data-action="ag-credit" class="${btn("link")}">${t("Recharger le crédit")}</button>`)
        : `<p class="text-xs tabular-nums text-fg-subtle">${t("Crédit restant après l'opération : {amount}", { amount: da(u.credit - cost) })}</p>`}</div>`,
    btn: label,
    presets: agPresets(agTopupPresets(c, u), a),
  };
};

// Recharger le crédit : rien n'est débité ici. Edahabia, CIB : paiement en ligne sur la page de Chargily Pay (page simulée
// sans clé), crédit ajouté dès le paiement confirmé ; virement, Visa / Mastercard : à la confirmation de l'équipe.
LIVE.recharge = (d) => {
  const a = agNum(d.amount), u = me(), brand = agCardBrand(agDigits(d.cardNumber)), online = AG_ONLINE.includes(d.method);
  const hint = (ic, html) => `<p class="mt-3 flex items-start gap-2 text-small text-fg-muted">${icon(ic, "mt-0.5 size-4 shrink-0 text-fg-subtle")}<span>${html}</span></p>`;
  return {
    "": summary([[t("Crédit actuel"), money(u.credit)], [t("Recharge demandée"), money(a)], [online ? t("Crédit après paiement") : t("Crédit après confirmation"), money(u.credit + a), true]]),
    btn: online ? (a ? `${icon("lock")}${t("Payer {amount} en ligne", { amount: da(a) })}` : `${icon("lock")}${t("Payer en ligne")}`)
      : a ? t("Demander {amount}", { amount: da(a) }) : t("Envoyer la demande de recharge"),
    presets: agPresets(AG_RECHARGES.map((v) => [v, da(v)]), a),
    brand: brand ? agBrandMark(brand) : "",
    note: online
      ? `${hint("lock", t("Vous saisissez votre carte sur la page de paiement sécurisée de Chargily Pay ; le crédit est ajouté dès que le paiement est confirmé."))}${(db.payments || {}).simulated
        ? `<div class="mt-3">${alertBox("warning", `<strong class="font-semibold">${t("Mode simulé")}</strong> · ${t("Aucune carte n'est débitée : vous choisissez l'issue du paiement sur la page suivante.")}`)}</div>` : ""}`
      : d.method === AG_CARD ? "" : hint("info", t("Après l'envoi, vous recevez une référence à indiquer dans votre paiement.")),
  };
};

// Moyens de recharge : [valeur envoyée à l'API (français), libellé, icône, précision] ; libellé et précision sont
// traduits à l'affichage (t). Edahabia et CIB se paient en ligne (Chargily Pay, AG_ONLINE) ; virement et carte
// Visa / Mastercard sont confirmés à la main par l'équipe.
const AG_METHODS = [
  ["virement bancaire", "Virement bancaire", "bank", "Indiquez la référence reçue dans le libellé du virement."],
  ["carte Edahabia", "Carte Edahabia", "wallet", "Carte Algérie Poste, paiement en ligne."],
  ["carte CIB", "Carte CIB", "wallet", "Carte bancaire interbancaire, paiement en ligne."],
  [AG_CARD, "Carte Visa / Mastercard", "card", "Carte bancaire internationale."],
];
const AG_ONLINE = ["carte Edahabia", "carte CIB"];

// Fiche de retrait (annuler une campagne en attente, supprimer une campagne refusée) : rappel de la campagne.
const agCampaignSummary = (c) => `<div class="flex items-center gap-3 rounded-tile bg-muted p-3">${coverThumb(c, "md")}
    <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(c.title)}</p><p class="truncate text-xs tabular-nums text-fg-subtle">${esc(t(c.category))} · ${t("budget {amount}", { amount: da(c.budget) })}</p></div>${statusBadge(c.status)}</div>`;

function agencyModal() {
  const m = state.modal;
  if (!m) return "";
  const cancel = `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button>`;
  const closeBtn = `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Fermer")}</button>`;
  const noReason = t("L'équipe {brand} n'a pas précisé de motif.");
  if (m.type === "ag-new") {
    return modalShell({
      title: t("Nouvelle campagne"), description: t("Elle sera publiée après vérification par l'équipe {brand}."), size: "xl", form: "ag-campaign", live: "campaign",
      body: campaignForm("ag-campaign", t("Envoyer pour validation"), t("Le budget non consommé vous est rendu à la fin de la campagne.")),
      footer: `${cancel}<button type="submit" class="${btn("primary")}">${t("Envoyer pour validation")}</button>`,
    });
  }
  if (m.type === "ag-edit") {
    const c = agMine(m.id);
    if (!c) return "";
    // Approuvée entre-temps (données rechargées pendant la saisie) : plus modifiable.
    if (!agEditable(c)) {
      return modalShell({
        title: t("Modification impossible"), description: esc(c.title),
        body: alertBox("info", t("Cette campagne a changé de statut entre-temps : elle ne peut plus être modifiée. Vous pouvez encore lui ajouter du budget ou la mettre en pause.")),
        footer: closeBtn,
      });
    }
    const relaunch = c.status === "Refusée";
    return modalShell({
      title: relaunch ? t("Modifier et relancer") : t("Modifier la campagne"),
      description: relaunch ? t("Corrigez la campagne : elle repassera en vérification par l'équipe {brand}.") : t("Elle reste en attente de vérification par l'équipe {brand}."),
      size: "xl", form: "ag-edit", live: "campaign",
      body: `${relaunch ? alertBox("danger", `<p class="font-medium">${t("Motif du refus")}</p><p class="mt-0.5 break-words">${c.reviewNote ? esc(c.reviewNote) : noReason}</p>`) : ""}
        ${campaignForm("ag-edit", relaunch ? t("Relancer la campagne") : t("Enregistrer les modifications"), t("Rien n'est prélevé avant l'approbation. Le budget non consommé vous est rendu à la fin de la campagne."), c)}`,
      footer: `${cancel}<button type="submit" class="${btn("primary")}">${relaunch ? `${icon("refresh")}${t("Relancer la campagne")}` : t("Enregistrer les modifications")}</button>`,
    });
  }
  if (m.type === "ag-cancel" || m.type === "ag-delete") {
    const c = agMine(m.id), del = m.type === "ag-delete";
    if (!c) return "";
    if (!agRemovable(c) || c.status !== (del ? "Refusée" : "En attente")) {
      return modalShell({ title: t("Action impossible"), description: esc(c.title), body: alertBox("info", t("Cette campagne a changé de statut entre-temps : elle ne peut plus être retirée.")), footer: closeBtn });
    }
    return modalShell({
      title: del ? t("Supprimer la campagne ?") : t("Annuler la campagne ?"),
      body: `${agCampaignSummary(c)}
        <p class="mt-4 text-sm text-fg-muted">${del
          ? t("La campagne refusée et sa photo seront supprimées définitivement. Pour la corriger plutôt, choisissez « Modifier et relancer ».")
          : t("La campagne n'a pas encore été vérifiée : elle est retirée de la file d'examen et supprimée définitivement.")} ${t("Rien n'a été prélevé sur votre crédit.")}</p>`,
      footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${del ? t("Annuler") : t("Garder la campagne")}</button><button type="button" data-action="${m.type}-confirm" data-id="${c.id}" class="${btn("danger")}">${del ? `${icon("trash")}${t("Supprimer définitivement")}` : `${icon("xCircle")}${t("Annuler la campagne")}`}</button>`,
    });
  }
  if (m.type === "ag-open") {
    const c = agMine(m.id);
    if (!c) return "";
    const live = !agEditable(c), pending = c.status === "En attente", refused = c.status === "Refusée", u = me();
    const clips = clipsOf([c.id]), views = campaignViews(c), cost = withCommission(c.budget, c.commissionRate);
    const tiles = [
      [t("Tarif"), `${fmt(c.rate)}${NB}${t("DA")}`, t("pour 1 000 vues")],
      [t("Seuil"), da(c.minPayout), t("dès {views}", { views: plural(viewsFor(c, c.minPayout), "vue", "vues") })],
      [t("Plafond"), da(c.maxPayout), t("atteint à {views}", { views: plural(viewsFor(c, c.maxPayout), "vue", "vues") })],
      ...(live ? [[t("Clippers"), fmt(c.clippers), t("ont rejoint")], [t("Clips"), fmt(clips.length), t("{count} en modération", { count: fmt(clips.filter((p) => p.status === "En attente").length) })], [t("Vues"), fmt(views), t("clips validés")]] : []),
    ];
    const notice = refused
      ? alertBox("danger", `<p class="font-medium">${t("Motif du refus")}</p><p class="mt-0.5 break-words">${c.reviewNote ? esc(c.reviewNote) : noReason}</p><p class="mt-2">${t("Corrigez la campagne puis relancez-la : elle repassera en vérification. Vous pouvez aussi la supprimer.")}</p>`)
      : pending ? alertBox("info", t("L'équipe {brand} vérifie la campagne avant sa mise en ligne. D'ici là, vous pouvez la modifier ou l'annuler : rien n'est prélevé sur votre crédit avant l'approbation."))
      : "";
    const short = pending && cost > u.credit
      ? `<div class="mt-3">${alertBox("warning", `${t("Crédit insuffisant pour l'approbation : il manque {missing}.", { missing: `<strong class="font-semibold tabular-nums">${da(cost - u.credit)}</strong>` })} <button type="button" data-action="ag-credit" class="${btn("link")}">${t("Recharger le crédit")}</button>`)}</div>` : "";
    const budgetBlock = live
      ? `<div class="mt-5"><p class="mb-2 text-small font-medium text-fg">${t("Budget")}</p>${progress(c.spent, c.budget, { aria: t("Budget consommé de {title}", { title: c.title }) })}
          <p class="mt-1.5 text-xs tabular-nums text-fg-subtle">${agClosed(c) ? t("Le budget non consommé a été rendu à votre crédit.") : t("Reste {amount} à consommer.", { amount: da(Math.max(0, c.budget - c.spent)) })}</p></div>`
      : `${summary([[t("Budget"), money(c.budget)], [t("Commission {brand} ({rate} %)", { rate: c.commissionRate }), money(cost - c.budget)], [t("Débité à l'approbation"), money(cost), true]])}${short}`;
    const [rmAction, rmIcon] = agRemoveAction(c);
    const remove = agRemovable(c) ? `<button type="button" data-action="${rmAction}" data-id="${c.id}" class="${btn("dangerSoft", "md", "sm:me-auto")}">${icon(rmIcon)}${refused ? t("Supprimer") : t("Annuler la campagne")}</button>` : "";
    const footer = !live ? `${remove}${agEditBtn(c, "md", "", "primary")}`
      : c.status === "Terminée" ? closeBtn
      : `${agToggle(c, "md")}<button type="button" data-action="ag-topup" data-id="${c.id}" class="${btn("primary")}">${icon("plus")}${t("Ajouter du budget")}</button>`;
    const edited = pending && c.updatedAt && date(c.updatedAt) !== date(c.createdAt) ? ` · ${t("modifiée le {date}", { date: date(c.updatedAt) })}` : "";
    return modalShell({
      title: esc(c.title), description: `${t("{category} · créée le {date}", { category: esc(t(c.category)), date: date(c.createdAt) })}${edited}`, size: "lg", footer,
      body: `<div class="cover relative grid ${c.image ? "aspect-[2/1] sm:aspect-[5/2]" : "h-28 sm:h-32"} place-items-center overflow-hidden rounded-tile" ${coverAttr(c)} aria-hidden="true">${coverArt(c)}${agRateChip(c.rate)}</div>
        <div class="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1">${statusBadge(c.status)}<span class="text-small text-fg-muted">${agencyStatusHint(c)}</span></div>
        ${notice ? `<div class="mt-4">${notice}</div>` : ""}
        <dl class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">${tiles.map(([k, v, sub]) => `<div class="${TILE}"><dt class="text-xs text-fg-subtle">${k}</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${v}<span class="block text-xs font-normal text-fg-subtle">${sub}</span></dd></div>`).join("")}</dl>
        ${budgetBlock}
        <div class="mt-5 grid gap-5 sm:grid-cols-2">
          <div><p class="text-small font-medium text-fg">${t("Règles")}</p>${c.rules.length ? `<ul class="mt-2 grid gap-1.5">${c.rules.map((r) => `<li class="flex gap-2 text-sm text-fg">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span class="min-w-0 break-words">${esc(r)}</span></li>`).join("")}</ul>` : `<p class="mt-2 text-sm text-fg-subtle">${t("Aucune règle particulière.")}</p>`}</div>
          <div><p class="text-small font-medium text-fg">${t("Plateformes")}</p><div class="mt-2 flex flex-wrap gap-1.5">${PLATFORMS.filter((p) => (c.platforms || []).includes(p)).map(platformTag).join("")}</div></div>
        </div>
        ${live ? `<div class="mt-6"><div class="mb-2 flex items-baseline justify-between gap-3"><p class="text-small font-medium text-fg">${t("Clips reçus")}</p>${clips.length > 5 ? agMoreLink("#/agence/clips", t("Voir les {count}", { count: fmt(clips.length) })) : ""}</div>
          ${clips.length ? `<ul class="divide-y divide-line rounded-tile border border-line px-3">${clips.slice(0, 5).map((p) => { const owner = userById(p.userId); return `<li class="flex items-center gap-3 py-2.5">
            ${owner ? avatar(owner, "sm") : ""}
            <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="rounded-sm hover:underline ${FOCUS}">${esc(p.title)}</a>` : esc(p.title)}</p>
              <p class="flex min-w-0 items-center gap-1 text-xs tabular-nums text-fg-subtle"><span class="min-w-0 truncate">${esc((owner || {}).name || t("Clipper"))}</span><span class="shrink-0" aria-hidden="true">·</span>${icon(PLATFORM_ICON[p.platform] || "film", "size-3.5 shrink-0")}<span class="shrink-0">${esc(p.platform)} · ${plural(p.views, "vue", "vues")}</span></p></div>
            <div class="flex shrink-0 flex-col items-end gap-1"><span class="text-sm font-medium">${p.status === "Validée" ? money(earningsOf(p)) : `<span class="text-fg-subtle">—</span>`}</span>${statusBadge(p.status)}</div></li>`; }).join("")}</ul>`
            : `<p class="rounded-tile border border-dashed border-line-strong px-4 py-6 text-center text-small text-fg-muted">${t("Aucun clip pour l'instant.")}</p>`}</div>` : ""}`,
    });
  }
  if (m.type === "ag-topup") {
    const c = agMine(m.id), u = me();
    if (!c) return "";
    const funded = c.status !== "En attente", init = LIVE.budget({ amount: 50000 });
    return modalShell({
      title: t("Ajouter du budget"), description: t("« {title} » · crédit disponible : {amount}", { title: esc(c.title), amount: da(u.credit) }), form: "ag-topup", live: "budget",
      body: `<div class="grid gap-3">
          ${field(t("Montant ajouté au budget"), unitInput(`name="amount" value="${fmt(50000)}" autocomplete="off" autofocus`, t("DA"), { lg: true }), funded ? t("Commission {brand} de {rate} % en plus, prélevée sur votre crédit.", { rate: c.commissionRate }) : "")}
          ${agPresetRow(init.presets)}
        </div>
        ${funded ? "" : `<div class="mt-4">${alertBox("info", t("La campagne n'est pas encore approuvée : rien n'est prélevé pour l'instant. Le budget et la commission seront débités à l'approbation."))}</div>`}
        <div data-live-out>${init[""]}</div>`,
      footer: `${cancel}<button type="submit" class="${btn("primary")}" data-live-out="btn">${init.btn}</button>`,
    });
  }
  if (m.type === "ag-credit") {
    const init = LIVE.recharge({ amount: fmt(250000), method: AG_METHODS[0][0] });
    return modalShell({
      title: t("Recharger le crédit"), description: t("Carte Edahabia ou CIB : paiement en ligne, crédit ajouté aussitôt. Virement ou carte Visa / Mastercard : crédit ajouté à la confirmation de l'équipe {brand}."), form: "ag-credit", live: "recharge",
      body: `<div class="group/pay grid gap-5">
          <div class="grid gap-3">
            ${field(t("Montant"), unitInput(`name="amount" value="${fmt(250000)}" autocomplete="off" autofocus`, t("DA"), { lg: true }), t("Minimum {amount}.", { amount: da(10000) }))}
            ${agPresetRow(init.presets)}
          </div>
          <fieldset class="grid gap-2"><legend class="mb-1.5 text-small font-medium text-fg">${t("Moyen de paiement")}</legend>
            <div class="grid gap-2 sm:grid-cols-2">${AG_METHODS.map(([v, l, ic, d], i) => `<label class="${CHOICE}"><input type="radio" name="method" value="${esc(v)}" ${i === 0 ? "checked" : ""}${v === AG_CARD ? " data-card-method" : ""} class="${RADIO}"/>
              <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${t(l)}</span><span class="block text-xs text-fg-subtle">${t(d)}</span></span>${icon(ic, "mt-0.5 size-4 shrink-0 text-fg-subtle")}</label>`).join("")}</div>
          </fieldset>
          <div class="hidden gap-4 rounded-tile border border-line p-4 group-has-[[data-card-method]:checked]/pay:grid" data-nodraft>
            <div class="flex flex-wrap items-center justify-between gap-2"><p class="text-small font-medium text-fg">${t("Carte bancaire")}</p><span class="flex gap-1.5" aria-hidden="true">${agBrandMark("Visa")}${agBrandMark("Mastercard")}</span></div>
            ${field(t("Titulaire de la carte"), `<input name="cardName" maxlength="60" autocomplete="cc-name" autocapitalize="characters" spellcheck="false" placeholder="${t("Nom inscrit sur la carte")}" class="${inputCls}"/>`)}
            ${field(t("Numéro de carte"), `<span class="relative block" dir="ltr"><input name="cardNumber" inputmode="numeric" autocomplete="cc-number" maxlength="23" spellcheck="false" placeholder="1234 5678 9012 3456" data-card-number class="${inputCls} pe-28 tabular-nums"/><span data-live-out="brand" class="pointer-events-none absolute inset-y-0 end-3 flex items-center" aria-hidden="true">${init.brand}</span></span>`)}
            <div class="grid grid-cols-2 gap-4">
              ${field(t("Expiration"), `<input name="cardExp" inputmode="numeric" autocomplete="cc-exp" maxlength="5" spellcheck="false" placeholder="${t("MM/AA")}" dir="ltr" data-card-exp class="${inputCls} tabular-nums"/>`)}
              ${field(t("Code de sécurité"), `<input name="cardCvc" inputmode="numeric" autocomplete="cc-csc" maxlength="3" spellcheck="false" placeholder="123" dir="ltr" data-card-cvc class="${inputCls} tabular-nums"/>`, t("3 chiffres, au dos de la carte."))}
            </div>
            <p class="flex items-start gap-2 text-xs text-fg-muted">${icon("lock", "mt-px size-3.5 shrink-0 text-fg-subtle")}<span>${t("Le numéro complet de votre carte ne quitte jamais votre navigateur : seuls la marque et les 4 derniers chiffres sont transmis. Comme pour les autres moyens, le crédit est ajouté après confirmation du paiement par l'équipe {brand}.")}</span></p>
          </div>
        </div>
        <div data-live-out>${init[""]}</div>
        <div data-live-out="note">${init.note}</div>`,
      footer: `${cancel}<button type="submit" class="${btn("primary")}" data-live-out="btn">${init.btn}</button>`,
    });
  }
  if (m.type === "ag-verify") {
    const u = me();
    // Demande déjà envoyée ou badge accordé entre-temps (données rechargées) : l'état seul.
    if (u.verification === "pending" || u.verification === "verified") {
      return modalShell({
        title: t("Badge de vérification"),
        body: alertBox("info", u.verification === "verified" ? t("Votre agence est déjà vérifiée : le badge bleu s'affiche à côté de son nom.") : t("Votre demande est déjà en cours d'examen par l'équipe {brand}.")),
        footer: closeBtn,
      });
    }
    const perks = [
      t("Le badge s'affiche à côté du nom de l'agence : sur sa page, sur ses campagnes et dans la liste des agences."),
      t("Les clippers savent que l'agence et ses campagnes sont authentiques."),
    ];
    return modalShell({
      title: t("Demander le badge de vérification"), description: t("Le badge bleu indique aux clippers que votre agence a été vérifiée par l'équipe {brand}."), form: "ag-verify",
      body: `<div class="flex items-center gap-3 rounded-tile bg-muted p-3">${avatar(u, "md")}<p class="min-w-0 break-words text-sm font-semibold text-fg">${esc(u.name)}${NB}<span aria-hidden="true">${verifiedBadge("size-4")}</span></p></div>
        <ul class="mt-4 grid gap-2">${perks.map((p) => `<li class="flex gap-2 text-sm text-fg-muted">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span>${p}</span></li>`).join("")}</ul>
        <div class="mt-5">${field(`${t("Message pour l'équipe")} ${agOptional()}`, `<textarea name="message" rows="3" maxlength="300" placeholder="${t("Site web, comptes officiels de la marque, registre du commerce…")}" class="${textareaCls}"></textarea>`, t("300 caractères maximum."))}</div>
        <p class="mt-4 flex items-start gap-2 text-small text-fg-muted">${icon("info", "mt-0.5 size-4 shrink-0 text-fg-subtle")}<span>${t("L'équipe {brand} examine chaque demande et vous informe de sa décision par notification. Des justificatifs pourront vous être demandés.")}</span></p>`,
      footer: `${cancel}<button type="submit" class="${btn("primary")}">${icon("send")}${t("Envoyer la demande")}</button>`,
    });
  }
  return "";
}

// el : l'élément [data-action] cliqué (paramètre nommé el, pas t : t() traduit les textes).
