// Espace Admin (13/13) : actions des boutons et envoi des formulaires.
// Les fichiers de web/src/admin/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Actions ----------
// Messages de confirmation (toasts) : texte brut traduit, échappé par toast() ; les paramètres ne sont donc pas échappés.

function handleAdminAction(action, el) {
  const id = el.dataset.id, v = el.dataset.value;
  switch (action) {
    case "adm-user-status": state.adm.userStatus = v; return render();
    case "adm-user-role": state.adm.userRole = v; return render();
    case "adm-user-clear": Object.assign(state.adm, { userQ: "", userRole: "Tous les rôles", userStatus: "Tous" }); return render();
    case "adm-camp-status": state.adm.campStatus = v; return render();
    case "adm-camp-clear": Object.assign(state.adm, { campQ: "", campStatus: "Toutes" }); return render();
    case "adm-mod-status": state.adm.modStatus = v; return render();
    case "adm-msg-filter": state.adm.msgFilter = v; return render();
    case "adm-mod-sort": state.adm.modSort = v === "risk" ? "risk" : "recent"; return render();
    // Relevé des vues de tous les clips suivis, sans attendre le prochain passage automatique.
    case "adm-track-views": return act("POST", "/api/admin/track-views", null, (r) => (r.failed
      ? t("Relevé terminé : {clips} sur {total} mis à jour, {failed} en erreur.", { clips: plural(r.updated, "clip", "clips"), total: fmt(r.total), failed: fmt(r.failed) })
      : t("Relevé terminé : {clips} sur {total} mis à jour.", { clips: plural(r.updated, "clip", "clips"), total: fmt(r.total) })));
    case "adm-pay-tab": state.adm.payTab = v; return render();
    // Export CSV : la modale propose le type de l'onglet ouvert, modifiable, avec statut et période.
    case "adm-export": state.modal = { type: "adm-export", kind: state.adm.payTab === "recharges" ? "recharge" : "retrait" }; return render();
    case "adm-period": state.period = Number(v) === 7 ? 7 : 30; return render();
    // Carte « À traiter », lien vers Paiements : le lien ouvre la page (changement d'adresse), on y présélectionne la file.
    case "adm-focus":
      // Que des recours à examiner : la carte ouvre l'onglet « Recours ».
      if (v === "moderation") state.adm.modStatus = !pendingPubs().length && admPendingAppeals().length ? "Recours" : "En attente";
      if (v === "campagnes" && db.campaigns.some((c) => c.status === "En attente")) Object.assign(state.adm, { campQ: "", campStatus: "En attente" });
      if (v === "retraits") state.adm.payTab = pendingWithdrawals().length || !pendingRecharges().length ? "retraits" : "recharges";
      if (v === "recharges") state.adm.payTab = "recharges";
      return;
    case "adm-copy": return copy(v, el.dataset.msg || t("Copié"));
    case "adm-user-toggle": {
      const u = userById(id);
      if (!u) return;
      // La suspension demande une confirmation ; la réactivation est immédiate.
      if (u.status === "Actif" && !el.dataset.confirm) return admOpen({ type: "suspend", id });
      const next = u.status === "Actif" ? "Suspendu" : "Actif";
      return act("PATCH", `/api/admin/users/${id}`, { status: next }, next === "Suspendu" ? t("{name} : compte suspendu", { name: u.name }) : t("{name} : compte réactivé", { name: u.name }), () => admPop(["suspend"], id));
    }
    // Fiches d'examen, ouvertes sur place.
    case "adm-camp": return admOpenSheet("adm-camp", id);
    case "adm-clip": return admOpenSheet("adm-clip", id);
    // Recours : sa fiche, la preuve en grand et la décision (par-dessus la fiche).
    case "adm-appeal": return admOpenSheet("adm-appeal", id);
    case "adm-proof": return admOpen({ type: "adm-proof", id });
    case "adm-appeal-decide": return admOpen({ type: "adm-appeal-decide", id, decision: v === "approve" ? "approve" : "refuse" });
    // Décisions sur une campagne. L'approbation débite le crédit de l'agence (budget + commission) : le serveur la refuse
    // si le crédit ne suffit pas (message traduit par data.js) ; la fiche est refermée après une décision réussie.
    case "adm-camp-approve": {
      const c = campaignById(id);
      if (!c) return;
      return act("PATCH", `/api/campaigns/${id}`, { status: "Active" }, t("« {title} » est approuvée et en ligne", { title: c.title }), () => admPop(["adm-camp"], id));
    }
    case "adm-camp-resume": case "adm-camp-pause": {
      const c = campaignById(id), pause = action === "adm-camp-pause";
      if (!c) return;
      return act("PATCH", `/api/campaigns/${id}`, { status: pause ? "En pause" : "Active" }, pause ? t("« {title} » est en pause", { title: c.title }) : t("« {title} » est de nouveau active", { title: c.title }));
    }
    case "adm-camp-end": return admOpen({ type: "adm-end", id });
    case "adm-camp-end-confirm": {
      const c = campaignById(id);
      if (!c) return;
      return act("PATCH", `/api/campaigns/${id}`, { status: "Terminée" }, t("« {title} » est terminée", { title: c.title }), () => admPop(["adm-end"], id));
    }
    case "adm-camp-refuse": return admOpen({ type: "adm-refuse", id });
    case "adm-camp-top": {
      const c = campaignById(el.dataset.key);
      if (!c) return;
      return act("PATCH", `/api/campaigns/${c.id}`, { top: !c.top }, c.top ? t("« {title} » n'est plus mise en avant", { title: c.title }) : t("« {title} » est mise en avant en Top campagne", { title: c.title }));
    }
    // Motif fréquent : ajouté au motif saisi (sans doublon), dans la limite de 300 caractères ; le brouillon et le compteur suivent.
    case "adm-reason": {
      const area = root.querySelector('[aria-modal="true"] textarea[name="reason"]'), r = ADM_CAMP_REASONS[Number(v)];
      if (!area || !r) return;
      const cur = area.value.trim(), text = t(r[1]);
      const next = !cur ? text : cur.includes(text) ? cur : `${cur}${/[.!?…؟]$/.test(cur) ? "" : "."} ${text}`;
      area.value = next.slice(0, 300);
      area.dispatchEvent(new Event("input", { bubbles: true }));
      area.focus();
      try { area.setSelectionRange(area.value.length, area.value.length); } catch (e) {}
      return;
    }
    case "adm-new-campaign": state.modal = { type: "new-campaign" }; return render();
    // Décisions sur un clip (tableaux et fiche) : la fiche est refermée après une décision réussie.
    case "adm-validate": return act("POST", `/api/clips/${id}/review`, { approve: true }, t("Clip validé, gains crédités au clipper"), () => admPop(["adm-clip"], id));
    case "adm-reject": return admOpen({ type: "reject", id });
    case "adm-views": return admOpen({ type: "views", id });
    // Badge de vérification des agences.
    case "adm-verify-approve": {
      const u = userById(id);
      if (!u) return;
      return act("POST", `/api/admin/users/${id}/verification`, { decision: "approve" }, t("Badge de vérification accordé à {name}", { name: u.name }));
    }
    case "adm-verify": return admOpen({ type: "adm-verify", id, decision: v === "revoke" ? "revoke" : "reject" });
    case "adm-tx-approve": case "adm-tx-reject": {
      const tx = db.transactions.find((x) => x.id === id), approve = action === "adm-tx-approve";
      const msg = !tx ? (approve ? t("Opération validée") : t("Opération rejetée"))
        : tx.type === "retrait" ? (approve ? t("Virement de {amount} confirmé", { amount: da(admNet(tx)) }) : t("Retrait de {amount} rejeté", { amount: da(-tx.amount) }))
        : approve ? t("Recharge de {amount} créditée à l'agence", { amount: da(tx.amount) }) : t("Recharge de {amount} rejetée", { amount: da(tx.amount) });
      return act("POST", `/api/transactions/${id}/review`, { approve }, msg);
    }
    // Académie : éditeur (nouvelle leçon ou modification), onglet de langue, publication, ordre, suppression.
    case "adm-lesson-new": state.modal = { type: "adm-lesson", draft: {} }; return render();
    case "adm-lesson-edit": if (!admLessonById(id)) return; state.modal = { type: "adm-lesson", id }; return render();
    case "adm-lesson-tab": if (state.modal && state.modal.type === "adm-lesson") { state.modal.tab = v; render(); const b = root.querySelector(`#adm-lesson-tab-${v}`); if (b) b.focus(); } return;
    case "adm-lesson-publish": {
      const l = admLessonById(el.dataset.key);
      if (!l) return;
      const title = lsText(l.title);
      return act("PUT", `/api/lessons/${encodeURIComponent(l.id)}`, admLessonPayload(l, { published: !l.published }),
        l.published ? t("« {title} » est repassée en brouillon", { title }) : t("« {title} » est publiée dans l'Académie", { title }));
    }
    case "adm-lesson-move": return act("POST", `/api/lessons/${encodeURIComponent(id)}/move`, { direction: v === "up" ? "up" : "down" });
    case "adm-lesson-delete": return admOpen({ type: "adm-lesson-delete", id });
    case "adm-lesson-delete-confirm": {
      const l = admLessonById(id);
      if (!l) { state.modal = null; return render(); }
      return act("DELETE", `/api/lessons/${encodeURIComponent(id)}`, null, t("« {title} » est supprimée", { title: lsText(l.title) }), () => admPop(["adm-lesson-delete"], id));
    }
    case "adm-reset-demo": state.modal = { type: "reset-demo" }; return render();
    case "adm-reset-demo-confirm": return resetDemo();
    case "adm-setting": {
      const k = el.dataset.key, value = !db.settings[k];
      const labels = { maintenance: [t("Mode maintenance activé"), t("Mode maintenance désactivé")], signupsOpen: [t("Inscriptions ouvertes"), t("Inscriptions fermées")] };
      return act("PATCH", "/api/admin/settings", { [k]: value }, labels[k][value ? 0 : 1]);
    }
  }
  return false;
}

// Version autonome : efface les données du navigateur ; les données d'exemple sont recréées au prochain appel.
async function resetDemo() {
  await window.__CLIPBOOST_OFFLINE__.reset();
  await refresh();
  state.modal = null;
  navigate("#/connexion");
  toast(t("Démo réinitialisée : données d'exemple recréées"));
}

// Message d'erreur d'un réglage numérique (phrase entière par cas : nombre entier ou décimal, borne basse ou intervalle).
function admLimitError(label, min, max, decimal) {
  const p = { label: t(label), min: fmt(min), max: fmt(max) };
  if (max !== Infinity) return decimal ? t("{label} : indiquez un nombre entre {min} et {max}.", p) : t("{label} : indiquez un nombre entier entre {min} et {max}.", p);
  if (min) return decimal ? t("{label} : indiquez un nombre d'au moins {min}.", p) : t("{label} : indiquez un nombre entier d'au moins {min}.", p);
  return decimal ? t("{label} : indiquez un nombre positif.", p) : t("{label} : indiquez un nombre entier positif.", p);
}

function handleAdminSubmit(form, data) {
  const m = state.modal;
  // Réponse de l'équipe dans la conversation ouverte (Messages).
  if (form === "adm-msg") {
    const x = msgThreads().find((y) => y.id === state.route.item), body = String(data.body || "").trim();
    if (!x || !body) return;
    return act("POST", `/api/campaigns/${encodeURIComponent(x.campaignId)}/messages`, { body, clipperId: x.clipperId });
  }
  // Export CSV : téléchargement (navigateur ou fichier HTML autonome), modale refermée une fois le fichier enregistré.
  if (form === "adm-export") {
    const from = String(data.from || ""), to = String(data.to || "");
    if (from && to && from > to) return admInvalid(form, "to", t("La date de fin doit suivre la date de début."));
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ type: data.type, status: data.status, from, to })) if (v) q.set(k, v);
    const query = q.toString();
    return downloadFile(`/api/admin/transactions/export${query ? `?${query}` : ""}`, "clipboost-transactions.csv").then((ok) => {
      if (!ok) return;
      state.modal = null;
      render();
      toast(t("Export CSV téléchargé"));
    });
  }
  if (form === "adm-reject") {
    return act("POST", `/api/clips/${m.id}/review`, { approve: false, reason: data.reason }, t("Clip refusé, le clipper est notifié"), () => admPop(["reject", "adm-clip"], m.id));
  }
  if (form === "adm-views") {
    const p = db.publications.find((x) => x.id === m.id), views = Math.floor(admParse(data.views));
    if (!Number.isFinite(views) || (p && views < p.views)) return admInvalid("adm-views", "views");
    // Likes : facultatifs (vide : les likes connus sont gardés), nombre entier positif.
    const likes = admParse(data.likes), noLikes = String(data.likes ?? "").trim() === "";
    if (!noLikes && (!Number.isInteger(likes) || likes < 0)) return admInvalid("adm-views", "likes", t("Indiquez un nombre entier de likes, ou laissez le champ vide."));
    return act("POST", `/api/clips/${m.id}/views`, noLikes ? { views } : { views, likes }, t("Vues enregistrées"), () => admPop(["views"], m.id));
  }
  // Décision sur un recours : motif obligatoire (3 à 300 caractères). Acceptation impossible (seuil, campagne
  // terminée) : l'erreur du serveur s'affiche et le recours reste en attente, modales ouvertes.
  if (form === "adm-appeal-decide") {
    const reason = String(data.reason || "").trim(), approve = m.decision === "approve";
    if (reason.length < 3) return admInvalid(form, "reason", t("Indiquez le motif de votre décision (3 caractères minimum)."));
    return act("POST", `/api/appeals/${encodeURIComponent(m.id)}/review`, { approve, reason },
      approve ? t("Recours accepté : clip validé, le clipper est prévenu") : t("Recours refusé, le clipper est prévenu"), () => admPop(["adm-appeal-decide", "adm-proof", "adm-appeal"], m.id));
  }
  // Refus d'une campagne : motif obligatoire (3 à 300 caractères), transmis à l'agence.
  if (form === "adm-refuse") {
    const reason = String(data.reason || "").trim(), c = campaignById(m.id);
    if (reason.length < 3) return admInvalid(form, "reason", t("Indiquez le motif du refus (3 caractères minimum)."));
    return act("PATCH", `/api/campaigns/${m.id}`, { status: "Refusée", reason }, c ? t("« {title} » est refusée : l'agence est prévenue", { title: c.title }) : t("La campagne est refusée : l'agence est prévenue"), () => admPop(["adm-refuse", "adm-camp"], m.id));
  }
  // Badge : refus (motif obligatoire) ou retrait (motif facultatif).
  if (form === "adm-verify") {
    const reason = String(data.reason || "").trim(), u = userById(m.id), reject = m.decision !== "revoke";
    if (reject && reason.length < 3) return admInvalid(form, "reason", t("Indiquez le motif du refus (3 caractères minimum)."));
    const msg = reject
      ? (u ? t("Demande de badge de {name} refusée", { name: u.name }) : t("Demande de badge refusée"))
      : (u ? t("Badge de vérification retiré à {name}", { name: u.name }) : t("Badge de vérification retiré"));
    return act("POST", `/api/admin/users/${m.id}/verification`, { decision: reject ? "reject" : "revoke", ...(reason ? { reason } : {}) }, msg, () => admPop(["adm-verify"], m.id));
  }
  // Leçon de l'Académie : mêmes contrôles que le serveur (lessonSchema), champ par champ ; un texte français manquant
  // ramène sur l'onglet « Français ».
  if (form === "adm-lesson") {
    const s = (k) => String(data[k] || "").trim(), minutes = admParse(data.minutes), video = s("videoUrl");
    if (!s("emoji")) return admInvalid(form, "emoji", t("Choisissez un emoji."));
    if (!s("category")) return admInvalid(form, "category", t("Indiquez la catégorie."));
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) return admInvalid(form, "minutes", t("Indiquez une durée entière entre 1 et 120 minutes."));
    let https = !video;
    try { https = https || new URL(video).protocol === "https:"; } catch (e) {}
    if (!https) return admInvalid(form, "videoUrl", t("Indiquez une adresse qui commence par https://, ou laissez le champ vide."));
    const missing = [["title_fr", t("Indiquez le titre en français.")], ["summary_fr", t("Indiquez le résumé en français.")], ["body_fr", t("Écrivez le contenu en français.")]].find(([k]) => !s(k));
    if (missing) {
      if (m.tab && m.tab !== "fr") { m.tab = "fr"; render(); }
      return admInvalid(form, ...missing);
    }
    const texts = (f) => ({ fr: s(`${f}_fr`), ...(s(`${f}_en`) ? { en: s(`${f}_en`) } : {}), ...(s(`${f}_ar`) ? { ar: s(`${f}_ar`) } : {}) });
    const payload = { category: s("category"), emoji: s("emoji"), minutes, videoUrl: video || null, title: texts("title"), summary: texts("summary"), body: texts("body"), published: data.published === "on" };
    return m.id
      ? act("PUT", `/api/lessons/${encodeURIComponent(m.id)}`, payload, t("Leçon enregistrée"), () => { state.modal = null; })
      : act("POST", "/api/lessons", payload, payload.published ? t("Leçon ajoutée à l'Académie") : t("Leçon ajoutée en brouillon"), () => { state.modal = null; });
  }
  if (form === "adm-campaign") {
    const err = !String(data.brand || "").trim() ? ["brand", t("Indiquez la marque.")] : agCampaignError(data);
    if (err) return admInvalid(form, ...err);
    return act("POST", "/api/campaigns", campaignPayload(data), t("Campagne publiée"), () => { state.modal = null; state.adm.campStatus = "Toutes"; });
  }
  // Mon compte : nom et photo (data URL nouvelle, adresse actuelle inchangée, "" retirée : voir imageField).
  if (form === "adm-account") {
    const name = String(data.name || "").trim();
    if (!name) return admInvalid(form, "name", t("Indiquez votre nom."));
    return act("PATCH", "/api/me", { name, avatar: data.avatar }, t("Compte mis à jour"));
  }
  if (form === "adm-settings") {
    const values = {};
    for (const [k, [label, min, max, decimal]] of Object.entries(ADM_LIMITS)) {
      const v = admParse(data[k]);
      if (!Number.isFinite(v) || v < min || v > max || (!decimal && !Number.isInteger(v))) return admInvalid("adm-settings", k, admLimitError(label, min, max, decimal));
      values[k] = v;
    }
    // Primes du classement : 10 nombres entiers de 0 à 1 000 000 DA (même règle que le serveur), du 1er au 10e.
    const weeklyPrizes = [];
    for (let i = 0; i < 10; i++) {
      const v = admParse(data[`prize-${i}`]);
      if (!Number.isInteger(v) || v < 0 || v > 1000000) return admInvalid("adm-settings", `prize-${i}`, t("Prime du {rank} : indiquez un nombre entier entre 0 et 1 000 000.", { rank: lbOrdinal(i + 1) }));
      weeklyPrizes.push(v);
    }
    return act("PATCH", "/api/admin/settings", { announcement: data.announcement.trim(), ...values, weeklyPrizes }, t("Réglages enregistrés"));
  }
}
