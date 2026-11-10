// Espace Clipper (9/9) : actions des boutons et envoi des formulaires.
// Les fichiers de web/src/clipper/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

function handleClipperAction(action, el) {
  const u = me(), { id, value } = el.dataset;
  switch (action) {
    case "toggle-fav": {
      const fav = !u.favorites.has(id);
      return act("POST", `/api/campaigns/${id}/membership`, { favorite: fav }, fav ? t("Ajoutée aux favoris") : t("Retirée des favoris"));
    }
    case "join": {
      const c = campaignById(id);
      return act("POST", `/api/campaigns/${id}/membership`, { joined: true }, c ? t("Vous avez rejoint « {title} »", { title: c.title }) : t("Campagne rejointe"));
    }
    case "open-campaign": state.modal = { type: "campaign", id }; return render();
    case "submit-clip": state.modal = { type: "submit", id }; state.notifOpen = false; state.menuOpen = false; state.drawer = false; return render();
    case "withdraw": state.modal = { type: "withdraw" }; return render();
    case "cl-appeal": state.modal = { type: "cl-appeal", id }; return render();
    case "wd-max": {
      const i = root.querySelector('[name="amount"]');
      if (i) { i.value = fmt(Math.floor(balance())); i.dispatchEvent(new Event("input", { bubbles: true })); i.focus(); }
      return;
    }
    // Toutes / Rejointes / Favoris ; une puce (data-toggle) déjà active revient à « Toutes ».
    case "camp-scope": state.camp.scope = "toggle" in el.dataset && state.camp.scope === value ? "Toutes" : CL_SCOPES.includes(value) ? value : "Toutes"; return render();
    case "reset-agencies": state.camp.aq = ""; return render();
    case "camp-cat": state.camp.category = value; return render();
    case "layout": state.camp.layout = value; return render();
    case "reset-filters": state.camp = { ...state.camp, q: "", category: "Toutes" }; return render();
    case "pub-status": state.pub.status = value; return render();
    case "tx-type": state.tx.type = { Tous: "tous", Gains: "gain", Retraits: "retrait" }[value]; return render();
    case "period": state.period = parseInt(value, 10); return render();
    case "cl-chart": state.clChart = value; return render();
    case "cl-clips": state.clClips = value; return render();
    // Comptes sociaux (Profil) : code copié, vérification (« simulated » : plateforme sans identifiants sur le serveur,
    // bio non lue), retrait (direct pour un compte en attente, après confirmation pour un compte vérifié).
    case "cl-social-copy": return copy(value, t("Code {code} copié", { code: value }));
    // Académie : puce de catégorie (une puce déjà active revient à « Toutes »).
    case "cl-acad-cat": state.acad.category = state.acad.category === value ? "Toutes" : value; return render();
    case "cl-ref-copy": return copy(value, t("Lien de parrainage copié"));
    case "cl-social-verify": {
      const a = clSocial().find((x) => x.id === id);
      if (!a) return;
      return act("POST", `/api/social/${encodeURIComponent(id)}/verify`, null, (res) => (res && res.simulated
        ? t("Compte {platform} vérifié (mode simulé : la bio n'a pas été lue)", { platform: a.platform })
        : t("Compte {platform} vérifié", { platform: a.platform })));
    }
    case "cl-social-remove": {
      const a = clSocial().find((x) => x.id === id);
      if (!a) return;
      if (a.status === "verified") { state.modal = { type: "cl-social-remove", id }; return render(); }
      return act("DELETE", `/api/social/${encodeURIComponent(id)}`, null, t("Compte {platform} retiré", { platform: a.platform }));
    }
    case "cl-social-remove-confirm": {
      const a = clSocial().find((x) => x.id === id);
      if (!a) { state.modal = null; return render(); }
      return act("DELETE", `/api/social/${encodeURIComponent(id)}`, null, t("Compte {platform} retiré", { platform: a.platform }), () => { state.modal = null; });
    }
  }
  return false;
}

// Erreurs de saisie dans une modale : on garde les valeurs, on marque le champ et on y place le focus.
function clModalErrors(patch) {
  state.modal = { ...state.modal, ...patch };
  render();
  const el = root.querySelector('[aria-modal="true"] [aria-invalid="true"]');
  if (el) el.focus();
}

// Messages d'erreur et toasts : texte brut (clErr, field et toast les échappent), paramètres non échappés.
function handleClipperSubmit(form, data) {
  if (form === "submit") {
    // Mêmes contrôles que le serveur (lib/server/services/clips.ts), champ par champ, avant tout envoi.
    const c = clJoinedOpen().find((x) => x.id === data.campaign), errors = {};
    const title = String(data.title || "").trim();
    if (!c) errors.campaign = t("Cette campagne n'accepte plus de clips : choisissez-en une autre.");
    if (!title) errors.title = t("Donnez un titre à votre clip.");
    const plats = c ? PLATFORMS.filter((p) => c.platforms.includes(p)) : [], single = plats.length === 1;
    const mode = single ? "one" : data.mode, platform = single ? plats[0] : data.platform, verified = clVerifiedMap();
    if (c && !plats.some((p) => verified.has(p))) errors.campaign = t("Vérifiez d'abord l'un des comptes de cette campagne (Profil → Comptes sociaux).");
    else if (c && mode !== "all" && mode !== "one") errors.mode = t("Indiquez où vous avez publié ce clip.");
    else if (c && mode === "one" && !plats.includes(platform)) errors.platform = t("Choisissez la plateforme sur laquelle vous avez publié ce clip.");
    const targets = mode === "all" ? plats : plats.includes(platform) ? [platform] : [];
    const submitted = new Set(myPubs().map((p) => clUrlKey(p.url))), seen = new Set();
    const links = targets.map((p) => {
      const k = `url-${p}`, url = String(data[k] || "").trim(), key = clUrlKey(url);
      if (!url) errors[k] = t("Collez le lien {platform} de votre clip.", { platform: p });
      else if (!clUrlOk(p, url)) errors[k] = t("Le lien doit être un lien {platform} (https://…).", { platform: p });
      else if (!verified.has(p)) errors[k] = t("Vérifiez d'abord votre compte {platform} (Profil → Comptes sociaux).", { platform: p });
      else if (clUrlForeign(p, url, verified.get(p))) errors[k] = t("Ce lien ne vient pas de votre compte {platform} vérifié (@{handle}).", { platform: p, handle: verified.get(p) });
      else if (submitted.has(key)) errors[k] = t("Vous avez déjà soumis ce lien.");
      else if (seen.has(key)) errors[k] = t("Le même lien est indiqué deux fois.");
      seen.add(key);
      return { platform: p, url };
    });
    if (Object.keys(errors).length) return clModalErrors({ errors, errorValues: data, draft: { ...(state.modal && state.modal.draft), ...data } });
    const sent = links.length > 1 ? t("Clip envoyé pour validation sur {platforms}", { platforms: plural(links.length, "plateforme", "plateformes") }) : t("Clip envoyé pour validation");
    return act("POST", "/api/clips", { campaignId: c.id, title, links }, sent, (res) => {
      state.modal = null; state.pub.status = "Toutes";
      // Les publications s'ouvrent sur le nouveau clip (mis en évidence, voir applyRouteItem dans main.js).
      navigate(res && res.id ? `#/clipper/publications/${encodeURIComponent(res.id)}` : "#/clipper/publications");
    });
  }
  if (form === "cl-appeal") {
    // Mêmes contrôles que le serveur (appealSchema) : message de 20 caractères au moins, capture obligatoire.
    const formEl = root.querySelector('form[data-form="cl-appeal"]'), id = state.modal && state.modal.id;
    const message = String(data.message || "").trim(), proof = String(data.proof || "");
    if (message.length < 20) return markInvalid(formEl, "message", t("Expliquez votre contestation en 20 caractères au moins."));
    if (!proof) {
      markInvalid(formEl, "proof", t("Ajoutez une capture d'écran comme preuve."));
      const pick = formEl && formEl.querySelector('input[data-image-input="proof"]');
      if (pick) pick.focus();
      return;
    }
    return act("POST", `/api/clips/${encodeURIComponent(id)}/appeal`, { message, proof }, t("Contestation envoyée : l'équipe {brand} va revoir votre clip"), () => { state.modal = null; });
  }
  if (form === "cl-msg") {
    const c = campaignById(state.route.item || ""), body = String(data.body || "").trim();
    if (!c || !body) return;
    return act("POST", `/api/campaigns/${encodeURIComponent(c.id)}/messages`, { body });
  }
  if (form === "withdraw") {
    const amount = Math.floor(Number(String(data.amount || "").replace(/\D/g, ""))) || 0, min = db.settings.minWithdraw, bal = Math.floor(balance());
    const error = amount < min ? t("Le retrait minimum est de {amount}.", { amount: da(min) }) : amount > bal ? t("Montant supérieur à votre solde disponible ({amount}).", { amount: da(bal) }) : "";
    if (error) return clModalErrors({ amount: data.amount, speed: data.speed, error });
    return act("POST", "/api/withdrawals", { amount, instant: data.speed === "instant" }, t("Demande de retrait de {amount} envoyée", { amount: da(amount) }), () => { state.modal = null; });
  }
  if (form === "profile") {
    // avatar : data URL (nouvelle photo), adresse actuelle (inchangée) ou "" (retirée), voir imageField (ui.js).
    // Les « @compte » du profil suivent les comptes sociaux vérifiés (formulaire « social ») : ils ne sont plus envoyés ici.
    return act("PATCH", "/api/me", { name: data.name, country: data.country, bio: data.bio, avatar: data.avatar }, t("Profil mis à jour"));
  }
  if (form === "social") {
    const formEl = root.querySelector('form[data-form="social"]'), handle = String(data.handle || "").trim();
    if (!handle) return markInvalid(formEl, "handle", t("Indiquez l'identifiant du compte."));
    return act("POST", "/api/social", { platform: data.platform, handle }, t("Compte {platform} ajouté : collez maintenant son code dans sa bio", { platform: data.platform }));
  }
  if (form === "payout") {
    return act("PATCH", "/api/me", { payoutMethod: data.payoutMethod, payoutAccount: data.payoutAccount }, t("Moyen de retrait enregistré"));
  }
}
