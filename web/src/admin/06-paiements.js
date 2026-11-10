// Espace Admin (6/13) : retraits et recharges.
// Les fichiers de web/src/admin/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Paiements ----------

// Paiement en ligne (Chargily Pay) : pastille du moyen ; en cours, il attend la confirmation de Chargily (aucune action).
const admChargilyTag = () => badge("Chargily", "brand", { ic: "globe" });
const admOnlineWaiting = () => `<span title="${esc(t("Paiement en ligne : confirmé automatiquement par Chargily"))}">${badge(t("Paiement en ligne en attente"), "warning", { ic: "clock" })}</span>`;
// approveLabel : texte déjà traduit. Une recharge payée en ligne ne se valide ni ne se rejette à la main.
const admPayActions = (tx, size, approveLabel) => (tx.status === "En cours" && !admOnlinePay(tx)
  ? `<button type="button" data-action="adm-tx-reject" data-id="${tx.id}" class="${btn("dangerSoft", size)}">${t("Rejeter")}</button><button type="button" data-action="adm-tx-approve" data-id="${tx.id}" class="${btn("primary", size)}">${approveLabel}</button>`
  : "");
// Carte d'un paiement validé : son document PDF (reçu d'un retrait, facture d'une recharge) sur toute la largeur.
const admDocAction = (tx) => txDocBtn(tx, { size: "md", variant: "secondary", extra: "col-span-2 w-full" });
// Ligne mono + Copier (compte, référence) des cartes : valeur de gauche à droite, y compris en arabe.
const admMonoLine = (label, html, value, copyLabel, msg) =>
  `<div class="grid gap-0.5"><dt class="text-xs text-fg-subtle">${label}</dt><dd class="flex min-w-0 items-center justify-between gap-2"><span class="min-w-0 truncate font-mono text-sm text-fg" dir="ltr">${html}</span>${value ? admCopyBtn(value, copyLabel, msg) : ""}</dd></div>`;
const admMoneyRows = (rows) => `<dl class="grid gap-1.5 text-small">${rows.map(([l, v, strong]) => `<div class="flex items-baseline justify-between gap-4 ${strong ? "border-t border-line pt-2 font-semibold text-fg first:border-t-0 first:pt-0" : "text-fg-muted"}"><dt>${l}</dt><dd class="text-end">${v}</dd></div>`).join("")}</dl>`;
const admWhen = (tx) => `${date(tx.date)}${tx.time ? ` · <span dir="ltr">${esc(tx.time)}</span>` : ""}`;
// Carte d'une demande (sous la largeur du tableau) : identité et coordonnées en tête, argent et décision en bout dès sm.
const admPayItem = (u, sub, badgeHtml, details, moneyHtml, actions, id) => `<li data-row="${id}" class="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] sm:gap-x-8 sm:px-5">
    <div class="grid min-w-0 content-start gap-3">
      <div class="flex items-start gap-3">${avatar(u, "md")}<div class="min-w-0 flex-1"><p class="flex min-w-0 text-sm font-medium text-fg">${admUserLink(u)}</p><p class="truncate text-xs tabular-nums text-fg-subtle">${sub}</p></div>${badgeHtml}</div>
      <dl class="grid gap-2.5 rounded-tile bg-subtle p-3">${details}</dl>
    </div>
    <div class="grid content-start gap-3 sm:pt-1">${moneyHtml}${actions ? `<div class="grid grid-cols-2 gap-2 sm:flex sm:flex-col-reverse">${actions}</div>` : ""}</div>
  </li>`;
const admPayer = (u, tx) => `<div class="flex min-w-0 items-center gap-2.5">${avatar(u, "sm")}<div class="min-w-0"><p class="flex min-w-0 font-medium text-fg">${admUserLink(u)}</p><span class="${TBL.tdSub} tabular-nums">${admWhen(tx)}</span></div></div>`;
// Moyen d'une recharge : la carte (marque et 4 derniers chiffres) pour un paiement Visa / Mastercard, sinon le moyen.
const admRechargeMethod = (tx) => {
  const card_ = admCardOf(tx);
  if (card_) return `<span class="flex flex-wrap items-center gap-1.5">${badge(card_.brand, "idle", { ic: "card" })}${admCardNumber(card_)}</span>`;
  if (admOnlinePay(tx)) return `<span class="flex flex-wrap items-center gap-1.5">${tx.method ? badge(admMethod(tx.method), "idle") : ""}${admChargilyTag()}</span>`;
  return tx.method ? badge(admMethod(tx.method), "idle") : admDash;
};

// Retraits : tableau à partir de 1 400 px (7 colonnes), cartes en dessous. La date de la demande est sous le nom.
function admWithdrawals(list) {
  const rows = list.map((tx) => {
    const u = admUser(tx.userId), acc = admAccountValue(u.payoutAccount), method = tx.method || u.payoutMethod || "", pending = tx.status === "En cours";
    const fee = tx.fee ? admMuted(tx.fee) : admDash, noAccount = t("Aucun compte enregistré");
    return {
      tr: `<tr data-row="${tx.id}" class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}">${admPayer(u, tx)}</td>
        <td class="${TBL.td}"><div class="flex items-center gap-1.5"><div class="grid justify-items-start gap-1">${method ? badge(esc(t(method)), "idle") : ""}${acc ? `<span class="whitespace-nowrap font-mono text-small text-fg" dir="ltr">${admAccount(acc)}</span>` : `<span class="text-xs text-fg-subtle">${noAccount}</span>`}</div>${acc ? admCopyBtn(acc, t("Copier le numéro"), t("Numéro copié")) : ""}</div></td>
        <td class="${TBL.td}"><span class="whitespace-nowrap text-small text-fg">${code(tx.ref)}</span></td>
        <td class="${TBL.td} ${TBL.tdNum}">${money(-tx.amount)}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${fee}</td>
        <td class="${TBL.td} ${TBL.tdNum}">${money(admNet(tx), { cls: "font-semibold" })}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admPayActions(tx, "sm", t("Virement effectué")) || `${statusBadge(tx.status)}${txDocBtn(tx, { compact: true })}`}</div></td>
      </tr>`,
      li: admPayItem(u, t("Demandé le {date}", { date: admWhen(tx) }), pending ? badge(t("À virer"), "info", { dot: true }) : statusBadge(tx.status),
        admMonoLine(method ? t("Compte {method}", { method: esc(t(method)) }) : t("Compte"), acc ? admAccount(acc) : `<span class="font-sans text-small text-fg-subtle" dir="auto">${noAccount}</span>`, acc, t("Copier le numéro"), t("Numéro copié"))
        + admMonoLine(t("Référence"), esc(tx.ref), tx.ref, t("Copier la référence"), t("Référence copiée")),
        admMoneyRows([[t("Montant demandé"), money(-tx.amount)], [t("Frais"), fee], [t("Net à virer"), money(admNet(tx)), true]]),
        admPayActions(tx, "md", t("Virement effectué")) || admDocAction(tx), tx.id),
    };
  });
  return admTable("wide", `<th scope="col" class="${TBL.th}">${t("Bénéficiaire")}</th><th scope="col" class="${TBL.th}">${t("Moyen et compte")}</th><th scope="col" class="${TBL.th}">${t("Référence")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Montant")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Frais")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Net à virer")}</th>${admThActions()}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));
}

// Recharges : tableau à partir de xl (5 colonnes), cartes en dessous. Carte Visa / Mastercard : marque et •••• 4242.
function admRecharges(list) {
  const rows = list.map((tx) => {
    const u = admUser(tx.userId), pending = tx.status === "En cours", card_ = admCardOf(tx), online = admOnlinePay(tx);
    const how = card_ ? `<span dir="ltr">${card_.brand} •••• ${card_.last4}</span>` : admMethod(tx.method);
    return {
      tr: `<tr data-row="${tx.id}" class="${TBL.tr}">
        <td class="${ADM_TD_MAIN}">${admPayer(u, tx)}</td>
        <td class="${TBL.td}">${admRechargeMethod(tx)}</td>
        <td class="${TBL.td}"><span class="flex items-center gap-0.5"><span class="whitespace-nowrap text-small text-fg">${code(tx.ref)}</span>${admCopyBtn(tx.ref, t("Copier la référence"), t("Référence copiée"))}</span></td>
        <td class="${TBL.td} ${TBL.tdNum}">${money(tx.amount, { cls: "font-semibold" })}</td>
        <td class="${TBL.td} ${TBL.tdActions}"><div class="flex items-center justify-end gap-2">${admPayActions(tx, "sm", t("Paiement reçu")) || (pending && online ? admOnlineWaiting() : `${statusBadge(tx.status)}${txDocBtn(tx, { compact: true })}`)}</div></td>
      </tr>`,
      li: admPayItem(u, `${how || t("Recharge")} · ${admWhen(tx)}`, pending ? (online ? admOnlineWaiting() : badge(t("À confirmer"), "info", { dot: true })) : statusBadge(tx.status),
        (card_ ? `<div class="grid gap-0.5"><dt class="text-xs text-fg-subtle">${t("Carte")}</dt><dd class="flex items-center gap-1.5">${badge(card_.brand, "idle", { ic: "card" })}${admCardNumber(card_)}</dd></div>` : "")
        + (online ? `<div class="grid gap-0.5"><dt class="text-xs text-fg-subtle">${t("Paiement en ligne")}</dt><dd class="flex flex-wrap items-center gap-1.5">${admChargilyTag()}<span class="text-xs text-fg-muted">${t("Confirmé automatiquement par Chargily.")}</span></dd></div>` : "")
        + admMonoLine(t("Référence du paiement"), esc(tx.ref), tx.ref, t("Copier la référence"), t("Référence copiée"))
        + (online && tx.providerRef ? admMonoLine(t("Identifiant Chargily"), esc(tx.providerRef), tx.providerRef, t("Copier l'identifiant"), t("Identifiant copié")) : ""),
        admMoneyRows([[online ? t("Montant payé en ligne") : t("Montant annoncé"), money(tx.amount), true]]),
        admPayActions(tx, "md", t("Paiement reçu")) || admDocAction(tx), tx.id),
    };
  });
  return admTable("xl", `<th scope="col" class="${TBL.th}">${t("Agence")}</th><th scope="col" class="${TBL.th}">${t("Moyen")}</th><th scope="col" class="${TBL.th}">${t("Référence")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Montant")}</th>${admThActions()}`,
    rows.map((r) => r.tr).join(""), rows.map((r) => r.li).join(""));
}

function aRetraits() {
  const tab = state.adm.payTab === "recharges" ? "recharges" : "retraits";
  // Les demandes à traiter d'abord, puis l'historique (ordre du serveur conservé).
  const byType = (type) => db.transactions.filter((tx) => tx.type === type).sort((a, b) => (b.status === "En cours") - (a.status === "En cours"));
  const pw = pendingWithdrawals(), pr = pendingRecharges();
  const tabs = [["retraits", t("Retraits"), t("Retraits des clippers"), pw.length], ["recharges", t("Recharges"), t("Recharges des agences"), pr.length]];
  const tablist = `<div class="${TABLIST}" role="tablist" aria-label="${esc(t("Type de paiement"))}">${tabs.map(([v, short, long, n]) =>
    `<button type="button" role="tab" id="adm-tab-${v}" aria-controls="adm-pay-panel" aria-selected="${tab === v}" data-action="adm-pay-tab" data-value="${v}" class="${TAB}"><span class="sm:hidden">${short}</span><span class="hidden sm:inline">${long}</span>${n ? countBadge(n, "queue") : ""}</button>`).join("")}</div>`;
  const list = byType(tab === "retraits" ? "retrait" : "recharge");
  const intro = tab === "retraits"
    ? [t("Approuvez après avoir effectué le virement vers le compte indiqué."), pw.length ? t("{count} · {amount} à virer", { count: plural(pw.length, "demande", "demandes"), amount: da(admSum(pw, admNet)) }) : ""]
    : [t("Confirmez à réception du paiement (virement, carte Visa ou Mastercard) : le montant est alors ajouté au crédit de l'agence. Les paiements en ligne par carte Edahabia ou CIB sont confirmés automatiquement par Chargily."), pr.length ? t("{count} · {amount} annoncés", { count: plural(pr.length, "recharge", "recharges"), amount: da(admSum(pr, (tx) => tx.amount)) }) : ""];
  const body = list.length
    ? (tab === "retraits" ? admWithdrawals(list) : admRecharges(list))
    : tab === "retraits"
      ? emptyState("wallet", t("Aucune demande de retrait"), t("Les demandes des clippers apparaîtront ici."))
      : emptyState("bank", t("Aucune recharge"), t("Les recharges annoncées par les agences apparaîtront ici."));
  const exportBtn = `<button type="button" data-action="adm-export" class="${btn("secondary")}">${icon("download")}${t("Exporter en CSV")}</button>`;
  return `${pageHeader(t("Paiements"), t("Retraits des clippers (minimum {amount}) et recharges de crédit des agences.", { amount: da(db.settings.minWithdraw) }), exportBtn)}
    <div class="mt-6">${tablist}</div>
    <div id="adm-pay-panel" role="tabpanel" aria-labelledby="adm-tab-${tab}">
      <div class="mt-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"><p class="text-small text-fg-muted">${intro[0]}</p>${intro[1] ? `<p class="shrink-0 text-small font-medium tabular-nums text-fg">${intro[1]}</p>` : ""}</div>
      <div class="mt-4">${body}</div>
    </div>`;
}

// Export CSV des transactions (Excel en français : « ; », UTF-8) : type (gains compris), statut et période facultatifs.
function admExportModal(m) {
  const sel = (name, value, options) => `<span class="relative block"><select name="${name}" class="${selectCls}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>${CHEVRON}</span>`;
  const day = (name) => `<input type="date" name="${name}" class="${inputCls} tabular-nums" dir="ltr" max="9999-12-31"/>`;
  return modalShell({
    title: t("Exporter les transactions"), description: t("Fichier CSV pour Excel ou un tableur : une ligne par transaction, avec son document."), form: "adm-export",
    body: `<div class="grid gap-4">
        <div class="grid gap-4 sm:grid-cols-2">
          ${field(t("Type"), sel("type", m.kind || "", [["", t("Toutes les transactions")], ["gain", t("Gains")], ["retrait", t("Retraits")], ["recharge", t("Recharges")]]))}
          ${field(t("Statut"), sel("status", "", [["", t("Tous les statuts")], ["Validé", t("Validé")], ["En cours", t("En cours")], ["Refusé", t("Refusé")]]))}
          ${field(`${t("Du")} ${OPTIONAL}`, day("from"))}
          ${field(`${t("Au")} ${OPTIONAL}`, day("to"))}
        </div>
        ${alertBox("info", t("Colonnes : référence, date et heure (UTC), type, utilisateur, email, rôle, libellé, montant, frais, statut, moyen et numéro de facture ou de reçu."))}
      </div>`,
    footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><button type="submit" class="${btn("primary")}">${icon("download")}${t("Exporter en CSV")}</button>`,
  });
}
