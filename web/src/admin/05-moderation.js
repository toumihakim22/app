// Espace Admin (5/13) : score de risque, relevé des vues et modération des clips.
// Les fichiers de web/src/admin/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Risque de fraude et relevé automatique des vues ----------

// Score de 0 à 100 recalculé par le serveur à chaque relevé (fraudRisk, lib/server/rules.ts), envoyé à l'admin seulement
// (absent ailleurs) : moins de 30 faible, 30 à 59 moyen, 60 et plus élevé (riskLevel). Renvoie [ton, libellé traduit].
const admRiskLevel = (score) => (score >= 60 ? ["danger", t("Risque élevé")] : score >= 30 ? ["warning", t("Risque moyen")] : ["success", t("Risque faible")]);
const ADM_RISK_TAG = { success: "bg-success-bg text-success-fg ring-success-border", warning: "bg-warning-bg text-warning-fg ring-warning-border", danger: "bg-danger-bg text-danger-fg ring-danger-border" };
// Signaux du score (libellés français du serveur) : [libellé, ce qu'il mesure], traduits (mêmes seuils que fraudRisk).
const ADM_RISK_FLAGS = {
  "Pic de vues soudain": () => [t("Pic de vues soudain"), t("Un jour récent a gagné plus de 5 fois la moyenne des jours précédents (et plus de 5 000 vues), ou le clip a fait un bond énorme dès son premier jour.")],
  "Beaucoup de vues, peu de likes": () => [t("Beaucoup de vues, peu de likes"), t("Au moins 5 000 vues pour moins de 0,5 % de likes : des vues achetées ou des robots sont possibles.")],
  "Compte récent": () => [t("Compte récent"), t("Le compte du clipper, ou son compte vérifié sur cette plateforme, avait moins de 7 jours à l'envoi du clip.")],
};
const admRiskFlag = (f) => (ADM_RISK_FLAGS[f] ? ADM_RISK_FLAGS[f]() : [esc(f), ""]);
// Pastille de risque d'un clip dans les listes de l'admin : niveau et score, signaux en infobulle. Vide sans score.
function admRiskTag(p) {
  if (typeof p.riskScore !== "number") return "";
  const [tone, label] = admRiskLevel(p.riskScore);
  const tip = [t("Score de risque : {score} sur 100", { score: fmt(p.riskScore) }), ...(p.riskFlags || []).map((f) => admRiskFlag(f)[0])].join(" · ");
  return `<span class="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-[4px] px-1.5 text-micro font-semibold tabular-nums ring-1 ring-inset ${ADM_RISK_TAG[tone]}" title="${esc(tip)}">${icon(tone === "success" ? "shield" : "alert", "size-3")}${label}<span aria-hidden="true">·</span>${fmt(p.riskScore)}</span>`;
}
// Risque de fraude d'un clip (fiche d'examen ; réutilisable ailleurs chez l'admin) : niveau, score, likes et dernier
// relevé, signaux expliqués, puis l'historique jour par jour des 14 derniers jours (vues gagnées par jour en graphique,
// le détail vues, likes, gain du jour en tableau replié). Vide sans score (données réservées à l'admin).
function admRiskPanel(p) {
  if (typeof p.riskScore !== "number") return "";
  const [tone, label] = admRiskLevel(p.riskScore), flags = p.riskFlags || [], hist = p.history || [];
  const knownLikes = typeof p.likes === "number";
  // Part des likes : précise sous 1 % (« 0,07 % »), là où se joue le signal « peu de likes » (0,5 %).
  const share = knownLikes && p.views > 0 ? (p.likes / p.views) * 100 : null;
  const ratio = share === null ? "" : t("{pct} des vues", { pct: share >= 1 || share === 0 ? pct(share) : t("{n}\u00a0%", { n: String(Number(share.toPrecision(2))).replace(".", uiDecimal()) }) });
  const tiles = `<dl class="mt-2 grid grid-cols-3 gap-2">
      ${admTile(t("Score"), `<span dir="ltr">${fmt(p.riskScore)}<span class="font-normal text-fg-subtle">${NB}/${NB}100</span></span>`)}
      ${admTile(t("Likes"), knownLikes ? fmt(p.likes) : admDash, ratio)}
      ${admTile(t("Dernier relevé"), p.checkedAt ? ago(p.checkedAt) : admDash)}
    </dl>`;
  const signals = flags.length
    ? `<ul class="mt-3 grid gap-2">${flags.map((f) => {
        const [name, help] = admRiskFlag(f);
        return `<li class="flex items-start gap-2.5 rounded-tile border border-line p-3"><span class="grid size-7 shrink-0 place-items-center rounded-full ${tone === "danger" ? "bg-danger-bg text-danger-fg" : "bg-warning-bg text-warning-fg"}" aria-hidden="true">${icon("alert", "size-4")}</span>
          <span class="min-w-0"><span class="block text-sm font-medium text-fg">${name}</span>${help ? `<span class="mt-0.5 block text-xs text-fg-muted">${help}</span>` : ""}</span></li>`;
      }).join("")}</ul>`
    : `<p class="mt-3 flex items-center gap-2 text-small text-fg-muted">${icon("shield", "size-4 shrink-0 text-success-fg")}${t("Aucun signal suspect sur les derniers relevés.")}</p>`;
  // Jours UTC (comme les relevés) des 14 derniers jours, aujourd'hui en dernier ; un jour sans relevé ne gagne rien.
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10));
  const byDay = new Map(hist.map((h) => [h.day, h]));
  const gains = days.map((d) => Math.max(0, (byDay.get(d) || {}).gain || 0));
  const dayOf = (iso) => { const [y, m, d] = iso.split("-"); return dayLabel(new Date(+y, +m - 1, +d)); };
  const TH = "h-8 whitespace-nowrap px-3 text-xs font-medium text-fg-subtle", TD = "h-9 whitespace-nowrap px-3 tabular-nums";
  const history = hist.length
    ? `<div class="mt-3">${barChart(gains, { tone: "brand", unit: "vue", unitPlural: "vues", integer: true, h: "h-28", caption: t("Vues gagnées par jour") })}</div>
      <details class="group mt-3">
        <summary class="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm text-small font-medium text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden ${FOCUS}">${t("Détail jour par jour")}${icon("chevronDown", "size-4 shrink-0 transition-transform duration-150 group-open:rotate-180")}</summary>
        <div class="mt-2 overflow-x-auto rounded-tile border border-line"><table class="w-full border-collapse text-small">
          <thead><tr class="bg-subtle"><th scope="col" class="${TH} text-start">${t("Jour")}</th><th scope="col" class="${TH} text-end">${t("Vues")}</th><th scope="col" class="${TH} text-end">${t("Likes")}</th><th scope="col" class="${TH} text-end">${t("Gain du jour")}</th></tr></thead>
          <tbody>${[...hist].reverse().map((h) => `<tr class="border-t border-line"><td class="${TD} text-fg-muted">${dayOf(h.day)}</td><td class="${TD} text-end text-fg">${fmt(h.views)}</td><td class="${TD} text-end text-fg-muted">${typeof h.likes === "number" ? fmt(h.likes) : "—"}</td><td class="${TD} text-end font-medium text-fg">${typeof h.gain === "number" ? uiSigned("+", fmt(h.gain)) : "—"}</td></tr>`).join("")}</tbody>
        </table></div>
      </details>`
    : `<p class="mt-3 text-small text-fg-muted">${t("Aucun relevé sur les 14 derniers jours.")}</p>`;
  return `${admH3(t("Risque de fraude"), badge(label, tone, { dot: true }))}${tiles}${signals}
    <h4 class="mt-5 text-small font-medium text-fg">${t("Historique des vues (14 jours)")}</h4>${history}`;
}
// Relevé automatique des vues : intervalle, dernier passage et son bilan, plateformes simulées faute de clés d'API ;
// le bouton lance un relevé tout de suite (POST /api/admin/track-views). Vide sans ces données (réservées à l'admin).
function admTrackingCard() {
  const tr = db.tracking;
  if (!tr) return "";
  const s = tr.summary || {};
  const by = { cron: t("Tâche planifiée"), script: t("Crontab du serveur"), admin: t("Lancé par l'équipe"), auto: t("Automatique") }[s.by] || "";
  const button = `<button type="button" data-action="adm-track-views" class="${btn("secondary", "md", "w-full sm:w-auto")}">${icon("refresh")}${t("Relever les vues maintenant")}</button>`;
  const simulated = tr.simulated && tr.simulated.length
    ? `<p class="mt-3 flex items-start gap-2 text-xs text-fg-subtle">${icon("info", "mt-px size-3.5 shrink-0")}<span>${t("Mode simulé pour {platforms} : sans clés d'API, les vues sont estimées par une croissance réaliste.", { platforms: esc(listAnd(tr.simulated)) })}</span></p>` : "";
  return card(`<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex min-w-0 items-start gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-fg" aria-hidden="true">${icon("trend", "size-5")}</span>
        <div class="min-w-0"><h2 class="text-section text-fg">${t("Relevé automatique des vues")}</h2>
          <p class="mt-0.5 text-small text-fg-muted">${t("Toutes les {hours} h, par les API officielles des plateformes : historique du jour, score de risque et vues supplémentaires payées.", { hours: fmt(tr.everyHours || 6) })}</p></div></div>
      <div class="shrink-0">${button}</div>
    </div>
    <dl class="mt-4 grid grid-cols-3 gap-2">
      ${admTile(t("Dernier relevé"), tr.lastRunAt ? ago(tr.lastRunAt) : admDash, tr.lastRunAt ? by : "")}
      ${admTile(t("Clips relevés"), tr.lastRunAt ? `<span dir="ltr">${fmt(s.updated || 0)}${NB}/${NB}${fmt(s.total || 0)}</span>` : admDash)}
      ${admTile(t("Erreurs"), tr.lastRunAt ? fmt(s.failed || 0) : admDash, s.failed ? t("Réessayé au prochain relevé") : "")}
    </dl>${simulated}`, "p-4 sm:p-5");
}

// ---------- Modération ----------

// Liste des recours (onglet « Recours » de la modération) : clip contesté (ouvre la fiche du recours), clippeur, envoi,
// statut ; « Examiner » pour un recours en attente, « Voir » ensuite. Tableau dès xl, liste en dessous.
function admAppealTable(list) {
  const pubOf = (a) => db.publications.find((x) => x.id === a.publicationId);
  const rows = list.map((a) => {
    const p = pubOf(a), c = p && campaignById(p.campaign), u = admUser(a.userId), pending = a.status === "En attente";
    const title = p ? p.title : t("Clip supprimé");
    const open = (cls = "") => `<button type="button" data-action="adm-appeal" data-id="${a.id}" class="${ADM_ROW_LINK} ${cls}" title="${esc(t("Examiner le recours"))}"><span class="block truncate">${esc(title)}</span></button>`;
    const sub = `<p class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-subtle">${c ? `<span class="min-w-0 truncate">${esc(c.title)}</span><span class="shrink-0" aria-hidden="true">·</span>` : ""}<span class="shrink-0 whitespace-nowrap">${t("Envoyé le {date}", { date: date(a.createdAt) })}</span></p>`;
    const msg = `<p class="mt-0.5 truncate text-xs text-fg-muted" dir="auto">${esc(a.message)}</p>`;
    const action = (size) => `<button type="button" data-action="adm-appeal" data-id="${a.id}" class="${btn(pending ? "primary" : "ghost", size)}">${pending ? t("Examiner") : t("Voir")}</button>`;
    const thumb = c ? `<span class="shrink-0">${coverThumb(c, "sm")}</span>` : "";
    return {
      tr: `<tr data-row="${a.id}" class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}"><div class="flex min-w-0 items-center gap-3">${thumb}<div class="min-w-0 flex-1">${open()}${sub}${msg}</div></div></td>
        <td class="${TBL.td}"><div class="flex min-w-0 max-w-48 items-center gap-2 text-small">${avatar(u, "xs")}${admUserLink(u, "text-fg")}</div></td>
        <td class="${TBL.td} ${TBL.tdNum}">${p ? fmt(p.views) : admDash}${p && p.platform ? `<span class="${TBL.tdSub} font-normal">${esc(p.platform)}</span>` : ""}</td>
        <td class="${TBL.td}">${appealBadge(a.status)}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${action("sm")}</div></td>
      </tr>`,
      li: `<li data-row="${a.id}" class="${TBL.item}">
        <div class="flex items-start gap-3">${thumb}<div class="min-w-0 flex-1">${open("text-sm")}${sub}${msg}</div>${appealBadge(a.status)}</div>
        <div class="flex items-center justify-between gap-3 text-small"><span class="flex min-w-0 items-center gap-2">${avatar(u, "xs")}${admUserLink(u, "text-fg-muted")}</span>
          <span class="shrink-0 text-fg-subtle">${p ? `${esc(p.platform)} · ${plural(p.views, "vue", "vues")}` : ""}</span></div>
        <div class="grid sm:flex sm:justify-end">${action("md")}</div>
      </li>`,
    };
  });
  return admTable("xl", `<th scope="col" class="${TBL.th}">${t("Clip contesté")}</th><th scope="col" class="${TBL.th}">${t("Clippeur")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Vues")}</th><th scope="col" class="${TBL.th}">${t("Statut")}</th>${admThActions()}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));
}

function aModeration() {
  const f = state.adm, s = db.settings, all = db.publications;
  const n = (st) => all.filter((p) => p.status === st).length;
  const appealTab = f.modStatus === "Recours", pendingAppeals = admPendingAppeals().length;
  const filtered = all.filter((p) => f.modStatus === "Toutes" || p.status === f.modStatus);
  // Tri par risque : score décroissant, l'ordre d'arrivée départage (tri stable).
  const list = f.modSort === "risk" ? [...filtered].sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0)) : filtered;
  // Règles longues repliées : un résumé d'une ligne, le détail au clic.
  const rules = alertBox("info", `<details class="group">
      <summary class="flex cursor-pointer list-none items-center gap-1.5 font-medium [&::-webkit-details-marker]:hidden">${t("Gains crédités : seuil, plafond et rétention")}${icon("chevronDown", "size-4 shrink-0 transition-transform duration-150 group-open:rotate-180")}</summary>
      <p class="mt-1.5">${t("Les gains d'un clip validé sont crédités au clipper, seuil et plafond appliqués, et restent {hold} en rétention. Pendant {window} après la validation, chaque nouveau relevé paie les vues supplémentaires.", { hold: plural(s.holdDays, "jour", "jours"), window: plural(s.earningDays, "jour", "jours") })}</p>
    </details>`);
  // Recours : en attente d'abord (le plus ancien en premier, comme une file), puis les décidés du plus récent au plus ancien ;
  // tri par risque : score du clip contesté décroissant, à l'intérieur de chaque groupe.
  const riskOf = (a) => (db.publications.find((p) => p.id === a.publicationId) || {}).riskScore || 0;
  const done = (a) => (a.status === "En attente" ? 0 : 1);
  const appealList = [...admAppeals()].sort((a, b) => done(a) - done(b)
    || (f.modSort === "risk" ? riskOf(b) - riskOf(a) : 0)
    || (done(a) ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
  const appealsBody = appealList.length ? admAppealTable(appealList)
    : emptyState("flag", t("Aucun recours"), t("Les contestations des clippers sur un clip refusé apparaîtront ici."));
  const empty = f.modStatus === "En attente"
    ? emptyState("check", t("Tout est à jour"), t("Aucun clip en attente de modération."))
    : emptyState("film", t("Aucun clip dans cette catégorie"), t("Changez de filtre pour voir les autres clips."));
  // amountLabel : texte source français, traduit par publicationsTable.
  return `${pageHeader(t("Modération des clips"), t("Ouvrez chaque clip pour vérifier sa vidéo et ses vues, puis validez ceux qui respectent les règles de la campagne."))}
    <div class="mt-6">${rules}</div>
    ${db.tracking ? `<div class="mt-4">${admTrackingCard()}</div>` : ""}
    ${admToolbar(`<div class="min-w-0">${segmented("adm-mod-status", f.modStatus, [["En attente", t("En attente"), n("En attente")], ["Validée", t("Validées"), n("Validée")], ["Refusée", t("Refusées"), n("Refusée")], ["Recours", t("Recours"), pendingAppeals], ["Toutes", t("Toutes"), all.length]], t("Statut"), { scroll: true })}</div>`,
      `<div class="shrink-0">${segmented("adm-mod-sort", f.modSort === "risk" ? "risk" : "recent", [["recent", t("Plus récents")], ["risk", t("Risque le plus élevé")]], t("Trier les clips"))}</div>`)}
    <div class="mt-4">${appealTab ? appealsBody : list.length ? admPubTable(publicationsTable(list, { showUser: true, actions: true, amountLabel: f.modStatus === "En attente" ? "Gain estimé" : "Gain", tag: admRiskTag })) : empty}</div>`;
}
