// Espace Agence (8/8) : actions des boutons et envoi des formulaires.
// Les fichiers de web/src/agency/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

function handleAgencyAction(action, el) {
  const id = el.dataset.id;
  switch (action) {
    case "ag-status": state.ag.status = el.dataset.value; return render();
    case "ag-msg-filter": state.ag.msgFilter = el.dataset.value; return render();
    case "ag-clip-status": state.ag.clipStatus = el.dataset.value; return render();
    case "ag-clear": state.ag.q = ""; state.ag.status = "Toutes"; return render();
    case "ag-show-refused": state.ag.q = ""; state.ag.status = "Refusée"; return navigate("#/agence/campagnes");
    case "ag-period": state.period = +el.dataset.value; return render();
    // Formulaires de campagne : toujours vierges à l'ouverture (draft: {}), le brouillon d'une autre ouverture n'est pas repris.
    case "ag-new": state.modal = { type: "ag-new", draft: {} }; state.drawer = false; return render();
    case "ag-open": state.modal = { type: "ag-open", id }; return render();
    // Depuis la fiche d'une campagne, ces modales s'empilent : « Annuler » ramène à la fiche.
    case "ag-edit": return agOpen({ type: "ag-edit", id, draft: {} });
    case "ag-cancel": case "ag-delete": return agOpen({ type: action, id });
    case "ag-topup": return agOpen({ type: "ag-topup", id });
    // Depuis un formulaire (campagne, ajout de budget) ou une fiche, la recharge s'empile : le formulaire revient ensuite.
    case "ag-credit": return agOpen({ type: "ag-credit" });
    case "ag-verify": return agOpen({ type: "ag-verify" });
    case "ag-copy": return copy(el.dataset.value, t("Référence copiée"));
    // Paiement en ligne : page simulée (« Payer » ou « Annuler »), reprise d'un paiement en cours, annulation (mode simulé).
    case "ag-pay-sim": case "ag-pay-cancel": {
      const x = myTx().find((y) => y.id === id), paid = action === "ag-pay-sim" && el.dataset.value === "pay";
      return act("POST", `/api/payments/simulate/${id}`, { paid }, null, () => { navigate(`#/agence/budget/${id}`); if (x) agPayOutcome({ ...x, status: paid ? "Validé" : "Refusé" }); });
    }
    case "ag-pay-resume":
      return act("POST", `/api/credit/checkout/${id}`, null, null, (r) => {
        if (r.checkoutUrl) return agGoPay(r.checkoutUrl);
        const x = myTx().find((y) => y.id === id);
        if (x) agPayOutcome(x);
      });
    case "ag-amount": {
      const input = root.querySelector('[aria-modal="true"] [name="amount"]');
      if (input) { input.value = fmt(+el.dataset.value); input.dispatchEvent(new Event("input", { bubbles: true })); }
      return;
    }
    case "ag-pause": case "ag-resume":
      return act("PATCH", `/api/campaigns/${id}`, { status: action === "ag-pause" ? "En pause" : "Active" }, action === "ag-pause" ? t("Campagne mise en pause") : t("Campagne relancée"));
    case "ag-cancel-confirm": case "ag-delete-confirm":
      return act("DELETE", `/api/campaigns/${id}`, null, action === "ag-delete-confirm" ? t("Campagne supprimée") : t("Campagne annulée"), () => { state.modal = null; agFixFilter(); });
  }
}

// Erreur de saisie dans un formulaire de l'agence : message sous le champ, focus dessus (pas de toast éphémère).
function agInvalid(form, name, msg) {
  markInvalid(root.querySelector(`form[data-form="${form}"]`), name, msg);
}

// Contrôles côté client, mêmes règles que l'API ; renvoie [champ, message traduit] ou null.
function agCampaignError(d) {
  const n = campaignPayload(d), min = db.settings.minBudget;
  if (!n.title) return ["title", t("Donnez un titre à la campagne.")];
  if (d.category === "Autre" && (n.category.length < 2 || agFold(n.category) === "autre")) return ["categoryOther", t("Précisez la catégorie de la campagne (2 caractères minimum).")];
  if (n.category.length > 30) return ["categoryOther", t("Catégorie trop longue : 30 caractères maximum.")];
  if (!(n.rate >= 20)) return ["rate", t("Tarif minimum : 20 DA pour 1 000 vues.")];
  if (n.rate > 2000) return ["rate", t("Tarif maximum : 2 000 DA pour 1 000 vues.")];
  if (!(n.maxPayout > n.minPayout)) return ["maxPayout", t("Le plafond doit être supérieur au seuil.")];
  if (!(n.budget >= min)) return ["budget", t("Le budget minimum est de {amount}.", { amount: da(min) })];
  if (n.maxPayout > n.budget) return ["maxPayout", t("Le plafond par clip ne peut pas dépasser le budget.")];
  if (!n.platforms.length) return [`pf-${PLATFORMS[0]}`, t("Choisissez au moins une plateforme.")];
  return null;
}

function handleAgencySubmit(form, data) {
  if (form === "ag-msg") {
    const x = msgThreads().find((y) => y.id === state.route.item), body = String(data.body || "").trim();
    if (!x || !body) return;
    return act("POST", `/api/campaigns/${encodeURIComponent(x.campaignId)}/messages`, { body, clipperId: x.clipperId });
  }
  if (form === "ag-campaign") {
    const err = agCampaignError(data);
    if (err) return agInvalid(form, ...err);
    return act("POST", "/api/campaigns", campaignPayload(data), t("Campagne envoyée pour validation"), () => {
      state.modal = null; state.ag.status = "Toutes";
      navigate("#/agence/campagnes");
    });
  }
  if (form === "ag-edit") {
    const c = agMine(state.modal && state.modal.id);
    if (!c) return;
    const err = agCampaignError(data);
    if (err) return agInvalid(form, ...err);
    const relaunch = c.status === "Refusée";
    // Ouverte depuis la fiche : la fiche revient, à jour ; sinon plus aucune modale.
    return act("PUT", `/api/campaigns/${c.id}`, campaignPayload(data), relaunch ? t("Campagne relancée : elle repasse en vérification") : t("Campagne modifiée"), () => { closeStacked(); agFixFilter(); });
  }
  if (form === "ag-topup") {
    const amount = agNum(data.amount);
    if (!amount) return agInvalid(form, "amount", t("Indiquez le montant à ajouter."));
    return act("POST", `/api/campaigns/${state.modal.id}/budget`, { amount }, t("{amount} ajoutés au budget", { amount: da(amount) }), () => closeStacked());
  }
  if (form === "ag-credit") {
    const amount = agNum(data.amount), method = AG_METHODS.some(([v]) => v === data.method) ? data.method : AG_METHODS[0][0];
    if (amount < 10000) return agInvalid(form, "amount", t("Recharge minimum : {amount}.", { amount: da(10000) }));
    let card = null;
    if (method === AG_CARD) {
      const err = agCardError(data);
      if (err) return agInvalid(form, ...err);
      const digits = agDigits(data.cardNumber);
      card = { brand: agCardBrand(digits), last4: digits.slice(-4) };
    }
    // Edahabia, CIB : paiement en ligne. La page de paiement de Chargily (ou la page simulée de l'app) s'ouvre.
    if (AG_ONLINE.includes(method)) return act("POST", "/api/credit/checkout", { amount, method }, null, (r) => { state.modal = null; agGoPay(r.checkoutUrl); });
    // Recharge empilée (depuis un formulaire de campagne, un ajout de budget ou une fiche) : ce qui était ouvert revient.
    return act("POST", "/api/credit", card ? { amount, method, card } : { amount, method },
      (r) => (card ? t("Demande envoyée · {brand} •••• {last4} · référence {ref}", { brand: card.brand, last4: card.last4, ref: r.ref })
        : t("Demande envoyée · référence {ref} à indiquer dans votre paiement", { ref: r.ref })),
      () => closeStacked());
  }
  if (form === "ag-verify") {
    const message = String(data.message || "").trim();
    return act("POST", "/api/verification", message ? { message } : {}, t("Demande de badge envoyée à l'équipe {brand}"), () => { state.modal = null; });
  }
  if (form === "ag-profile") {
    if (!String(data.name || "").trim()) return agInvalid(form, "name", t("Indiquez le nom de l'agence."));
    // avatar, cover : data URL (nouvelle photo), adresse actuelle (inchangée) ou "" (retirée), voir imageField (ui.js).
    return act("PATCH", "/api/me", { name: data.name, contact: data.contact, country: data.country, bio: data.bio, avatar: data.avatar, cover: data.cover }, t("Profil de l'agence mis à jour"));
  }
}
