// Espace Agence (4/8) : paiement en ligne et budget.
// Les fichiers de web/src/agency/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Paiement en ligne (carte Edahabia ou CIB, Chargily Pay) ----------
// La recharge est créée « En cours » par POST /api/credit/checkout, puis l'agence paie sur la page de Chargily Pay et
// revient sur Budget (#/agence/budget/<id>) ; le webhook de Chargily valide la recharge. Sans clé Chargily (et toujours
// dans la version autonome), la page de paiement est simulée dans l'app : #/agence/paiement/<id> (gPaiement).

// Ouvre la page de paiement : adresse de Chargily (autre site) ou page simulée de l'app (« #/agence/paiement/<id> »).
const agGoPay = (url) => { if (!url) return; if (url.startsWith("#")) navigate(url); else location.assign(url); };
const agOnlineLabel = (x) => { const m = AG_METHODS.find(([v]) => v === x.method); return esc(m ? t(m[1]) : t("Paiement en ligne")); };

// Bandeau de Budget : paiements en ligne commencés mais pas encore confirmés (page de paiement quittée, webhook en route).
function agOnlineBanner() {
  const list = agPendingOnline();
  if (!list.length) return "";
  const simulated = !!(db.payments || {}).simulated;
  return `<div class="mt-6 grid gap-3">${list.map((x) => `<div data-row="pay-${x.id}" class="flex flex-col gap-3 rounded-card border border-warning-border bg-warning-bg px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div class="flex min-w-0 items-start gap-3">${icon("clock", "mt-0.5 size-5 shrink-0 text-warning-fg")}
        <div class="min-w-0"><p class="text-sm font-semibold text-warning-fg">${t("Paiement en ligne en attente")}</p>
          <p class="mt-0.5 text-small text-fg-muted">${t("{amount} par {method} · référence {ref}", { amount: `<span class="font-medium tabular-nums text-fg">${da(x.amount)}</span>`, method: esc(t(x.method || "")), ref: agRef(x.ref) })}</p>
          <p class="mt-0.5 text-xs text-fg-subtle">${t("Le crédit est ajouté dès que Chargily Pay confirme le paiement.")}</p></div></div>
      <div class="flex shrink-0 flex-wrap gap-2">${simulated ? `<button type="button" data-action="ag-pay-cancel" data-id="${x.id}" class="${btn("secondary", "sm")}">${t("Annuler")}</button>` : ""}
        <button type="button" data-action="ag-pay-resume" data-id="${x.id}" class="${btn("primary", "sm")}">${icon("lock")}${t("Reprendre le paiement")}</button></div>
    </div>`).join("")}</div>`;
}

// Retour de la page de paiement de Chargily : le webhook arrive en général en quelques secondes. Tant que la page Budget
// est affichée, l'état est relu toutes les 3 secondes (une minute au plus) ; l'issue est annoncée dès qu'elle est connue.
let agPayTimer = null;
function agWatchPayment(id) {
  clearTimeout(agPayTimer);
  if ((db.payments || {}).simulated) return;
  let tries = 0;
  const pending = () => { const x = myTx().find((y) => y.id === id); return x && x.status === "En cours" && agOnline(x) ? x : null; };
  const tick = async () => {
    if (!pending() || state.route.area !== "agence" || state.route.view !== "budget" || ++tries > 20) return;
    try { await refresh(); } catch (e) { return; }
    const x = myTx().find((y) => y.id === id);
    if (x && x.status !== "En cours") { render(); return agPayOutcome(x); }
    agPayTimer = setTimeout(tick, 3000);
  };
  if (pending()) agPayTimer = setTimeout(tick, 3000);
}
// Issue d'un paiement en ligne, annoncée à l'agence.
const agPayOutcome = (x) => (x.status === "Validé"
  ? toast(t("Paiement confirmé : {amount} ajoutés à votre crédit", { amount: da(x.amount) }))
  : toast(t("Paiement annulé ou refusé : la recharge n'a pas été créditée"), "danger"));

// Page de paiement simulée (mode simulé) : rôle de la page de Chargily Pay, l'agence choisit l'issue du paiement.
function gPaiement() {
  const id = state.route.item || "", x = myTx().find((y) => y.id === id && y.type === "recharge" && agOnline(y));
  const back = `<a href="#/agence/budget" class="${HIT} inline-flex items-center gap-1 rounded-sm text-small font-medium text-fg-muted transition-colors duration-150 hover:text-fg ${FOCUS}">${icon("arrowLeft", "size-4 rtl:-scale-x-100")}${t("Budget")}</a>`;
  const head = `<nav aria-label="${esc(t("Fil d'Ariane"))}">${back}</nav><div class="mt-3">${pageHeader(t("Paiement en ligne"), t("Recharge du crédit de votre agence par carte Edahabia ou CIB."))}</div>`;
  if (!x) return `${head}<div class="mt-6">${emptyState("card", t("Paiement introuvable"), t("Ce paiement n'existe pas ou ne concerne pas votre agence."), `<a href="#/agence/budget" class="${btn("secondary")}">${t("Retour au budget")}</a>`)}</div>`;
  const simulated = !!(db.payments || {}).simulated, open = x.status === "En cours";
  const mark = x.method === "carte CIB" ? "CIB" : "Edahabia";
  const rows = [
    [t("Marchand"), `<span class="font-medium text-fg">${esc(BRAND)}</span>`],
    [t("Moyen de paiement"), `<span class="inline-flex items-center gap-2"><span class="hidden sm:inline-flex">${agBrandMark(mark)}</span><span class="whitespace-nowrap">${agOnlineLabel(x)}</span></span>`],
    [t("Référence"), `<span class="inline-flex items-center gap-1 text-fg">${agRef(x.ref)}${agCopyBtn(x.ref)}</span>`],
    [t("Date"), `<span class="tabular-nums">${date(x.date)}</span>`],
  ];
  // Payée : sa facture PDF à côté du retour au budget.
  const actions = !open
    ? `<div class="grid gap-3">${alertBox(x.status === "Validé" ? "success" : "danger", x.status === "Validé" ? t("Paiement reçu : le montant a été ajouté à votre crédit.") : t("Paiement annulé ou refusé : la recharge n'a pas été créditée."))}
        <div class="grid gap-2 ${x.document ? "sm:grid-cols-2" : ""}">${txDocBtn(x, { size: "md", variant: "primary", extra: "w-full" })}<a href="#/agence/budget" class="${btn("secondary", "md", "w-full")}">${t("Retour au budget")}</a></div></div>`
    : simulated
      ? `<div class="flex flex-col-reverse gap-2 sm:grid sm:grid-cols-[auto_minmax(0,1fr)]"><button type="button" data-action="ag-pay-sim" data-id="${x.id}" data-value="cancel" class="${btn("secondary", "lg", "w-full")}">${t("Annuler")}</button>
          <button type="button" data-action="ag-pay-sim" data-id="${x.id}" data-value="pay" class="${btn("primary", "lg", "w-full")}">${icon("lock")}${t("Payer {amount}", { amount: da(x.amount) })}</button></div>`
      : `<button type="button" data-action="ag-pay-resume" data-id="${x.id}" class="${btn("primary", "lg", "w-full")}">${icon("lock")}${t("Reprendre le paiement")}</button>`;
  const body = `<div class="flex items-center justify-between gap-3">
      <p class="flex items-center gap-2 text-sm font-semibold text-fg">${icon("lock", "size-4 text-fg-subtle")}Chargily Pay</p>
      ${open ? (simulated ? badge(t("Mode simulé"), "warning", { ic: "alert" }) : badge(t("En attente"), "warning", { dot: true })) : statusBadge(x.status)}</div>
    <div class="mt-5 text-center"><p class="text-small text-fg-muted">${t("Montant à payer")}</p><p class="mt-1">${bigMoney(x.amount, "money")}</p></div>
    <dl class="mt-5 grid gap-2.5 rounded-tile bg-subtle p-4 text-sm">${rows.map(([l, v]) => `<div class="flex items-center justify-between gap-4"><dt class="shrink-0 text-fg-muted">${l}</dt><dd class="min-w-0 text-end">${v}</dd></div>`).join("")}</dl>
    ${open && simulated ? `<div class="mt-4">${alertBox("warning", `<strong class="font-semibold">${t("Mode simulé")}</strong> · ${t("Aucune carte n'est débitée. Choisissez « Payer » pour simuler un paiement accepté (le crédit est ajouté), ou « Annuler » pour un paiement abandonné.")}`)}</div>` : ""}
    <div class="mt-5">${actions}</div>
    <p class="mt-4 flex items-start justify-center gap-1.5 text-center text-xs text-fg-subtle">${icon("shield", "mt-px size-3.5 shrink-0")}<span>${simulated
      ? t("Sans clé Chargily, cette page remplace la page de paiement sécurisée de Chargily Pay.")
      : t("Le paiement se fait sur la page sécurisée de Chargily Pay.")}</span></p>`;
  return `${head}<div class="mx-auto mt-6 max-w-md">${card(body, "p-5 sm:p-6")}</div>`;
}

// ---------- Budget ----------

function gBudget() {
  const u = me(), list = myCampaigns(), tot = agTotals(list), pending = agPendingCredit();
  const recharges = myTx().filter((x) => x.type === "recharge");
  const stat = (label, value, sub) => `<div class="flex items-start justify-between gap-4 sm:block sm:px-5 sm:first:ps-0 sm:last:pe-0">
      <dt class="text-small font-medium text-fg-muted">${label}</dt>
      <dd class="text-end sm:mt-1.5 sm:text-start">${bigMoney(value)}<span class="mt-0.5 block text-xs text-fg-subtle">${sub}</span></dd></div>`;
  const summaryCard = card(`<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between xl:flex-col xl:items-start">
        <div><p class="text-small font-medium text-fg-muted">${t("Crédit disponible")}</p><p class="mt-1">${bigMoney(u.credit, "money")}</p>
          ${pending ? `<p class="mt-1 text-xs tabular-nums text-fg-subtle">${t("{amount} en attente de confirmation", { amount: da(pending) })}</p>` : ""}</div>
        <button type="button" data-action="ag-credit" class="${btn("primary")}">${icon("plus")}${t("Recharger le crédit")}</button>
      </div>
      <dl class="grid gap-3 border-t border-line pt-5 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-line xl:border-s xl:border-t-0 xl:ps-6 xl:pt-0">
        ${stat(t("Engagé"), tot.engaged, tot.awaiting ? t("dont {amount} en attente d'approbation", { amount: da(tot.awaiting) }) : t("sur {campaigns}", { campaigns: plural(tot.count, "campagne", "campagnes") }))}
        ${stat(t("Consommé"), tot.spent, tot.engaged ? t("{pct} du budget engagé", { pct: pct((tot.spent / tot.engaged) * 100) }) : t("Aucune dépense"))}
        ${stat(t("Restant"), tot.left, t("sur les campagnes en cours"))}
      </dl></div>`);

  // Action d'une campagne : ajout de budget ; refusée : la relancer ; terminée : archivée.
  const action = (c, mobile) => c.status === "Terminée" ? `<span class="text-xs text-fg-subtle">${t("Archivée")}</span>`
    : c.status === "Refusée" ? agEditBtn(c, mobile ? "md" : "sm", mobile ? "w-full sm:w-auto" : "", mobile ? "secondary" : "ghost")
    : `<button type="button" data-action="ag-topup" data-id="${c.id}" class="${mobile ? btn("secondary", "md", "w-full sm:w-auto") : btn("ghost", "sm")}">${icon("plus")}${t("Ajouter du budget")}</button>`;
  const remaining = (c) => (agClosed(c) ? `<span class="text-fg-subtle">—</span>` : money(Math.max(0, c.budget - c.spent)));
  // 5 colonnes (environ 880 px) : le tableau à partir de xl, la liste en dessous.
  const perCampaign = list.length ? `<div class="${TBL.wrap}">
      <table class="${TBL.table.replace("md:table", "xl:table")}">
        <thead><tr class="${TBL.headRow}"><th scope="col" class="${TBL.th}">${t("Campagne")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Tarif")}</th><th scope="col" class="${TBL.th}">${t("Consommé")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Restant")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}"><span class="sr-only">${t("Action")}</span></th></tr></thead>
        <tbody>${list.map((c) => `<tr data-row="${c.id}" class="${TBL.tr}">
          <td class="${TBL.td}"><div class="flex min-w-0 items-center gap-3">${coverThumb(c, "sm")}<div class="min-w-0"><p class="max-w-56 truncate font-medium text-fg">${esc(c.title)}</p><div class="mt-1">${statusBadge(c.status)}</div></div></div></td>
          <td class="${TBL.td} ${TBL.tdNum}">${money(c.rate)}<span class="${TBL.tdSub} font-normal">${t("pour 1 000 vues")}</span></td>
          <td class="${TBL.td}">${c.status === "Refusée" ? `<span class="text-fg-subtle">—</span>` : `<div class="min-w-48 max-w-64">${progress(c.spent, c.budget, { aria: t("Budget consommé de {title}", { title: c.title }) })}</div>`}</td>
          <td class="${TBL.td} ${TBL.tdNum}">${remaining(c)}</td>
          <td class="${TBL.td} ${TBL.tdActions}">${action(c, false)}</td></tr>`).join("")}</tbody>
      </table>
      <ul class="${TBL.list.replace("md:hidden", "xl:hidden")}">${list.map((c) => `<li data-row="${c.id}" class="${TBL.item}">
        <div class="flex items-start gap-3">${coverThumb(c, "sm")}<div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(c.title)}</p><p class="truncate text-xs text-fg-subtle">${rate(c.rate)}</p></div>${statusBadge(c.status)}</div>
        ${c.status === "Refusée" ? "" : progress(c.spent, c.budget, { aria: t("Budget consommé de {title}", { title: c.title }) })}
        ${c.status === "Terminée" ? `<p class="text-xs text-fg-subtle">${t("Archivée")}</p>`
          : `${c.status === "Refusée" ? "" : `<div class="flex items-center justify-between text-small"><span class="text-fg-subtle">${t("Restant")}</span><span class="font-medium">${remaining(c)}</span></div>`}<div class="sm:flex sm:justify-end">${action(c, true)}</div>`}
      </li>`).join("")}</ul>
    </div>` : emptyState("wallet", t("Aucune campagne pour l'instant"), t("Le budget de chaque campagne s'affichera ici dès sa création."), agNewBtn());

  const history = `<div class="${TBL.wrap}">
      <table class="${TBL.table}">
        <thead><tr class="${TBL.headRow}"><th scope="col" class="${TBL.th}">${t("Date")}</th><th scope="col" class="${TBL.th}">${t("Moyen")}</th><th scope="col" class="${TBL.th}">${t("Référence")}</th><th scope="col" class="${TBL.th}">${t("Statut")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Montant")}</th><th scope="col" class="${TBL.th} ${TBL.thNum}">${t("Facture")}</th></tr></thead>
        <tbody>${recharges.map((x) => `<tr data-row="${x.id}" class="${TBL.tr}">
          <td class="${TBL.td} whitespace-nowrap tabular-nums">${date(x.date)}<span class="${TBL.tdSub}" dir="ltr">${esc(x.time || "")}</span></td>
          <td class="${TBL.td}">${agMethod(x)}${agOnline(x) ? `<span class="${TBL.tdSub}">${t("Paiement en ligne")}</span>` : ""}</td>
          <td class="${TBL.td}"><span class="inline-flex items-center gap-1 text-fg">${agRef(x.ref)}${agCopyBtn(x.ref)}</span></td>
          <td class="${TBL.td}">${agRechargeStatus(x)}</td>
          <td class="${TBL.td} ${TBL.tdNum}">${agRechargeAmount(x)}</td>
          <td class="${TBL.td} ${TBL.tdActions}">${txDocBtn(x) || `<span class="text-fg-subtle">—</span>`}</td></tr>`).join("")}</tbody>
      </table>
      <ul class="${TBL.list}">${recharges.map((x) => `<li data-row="${x.id}" class="flex items-center gap-3 px-4 py-3">
        <span class="grid size-8 shrink-0 place-items-center rounded-full ${x.status === "Validé" ? "bg-income-soft text-income" : "bg-muted text-fg-muted"}" aria-hidden="true">${icon(x.method === AG_CARD || agOnline(x) ? "card" : "arrowDownLeft", "size-4")}</span>
        <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${agMethod(x)}</p><p class="flex items-center gap-1 truncate text-xs text-fg-subtle">${date(x.date)} · ${agRef(x.ref)}</p></div>
        <div class="shrink-0 text-end"><p class="text-sm font-medium">${agRechargeAmount(x)}</p>${x.status === "Validé" ? "" : `<div class="mt-1 flex justify-end">${agRechargeStatus(x, true)}</div>`}</div>
        ${txDocBtn(x, { compact: true })}${agCopyBtn(x.ref)}
      </li>`).join("")}</ul>
    </div>`;

  return `${pageHeader(t("Budget"), t("Suivez la consommation de vos campagnes et rechargez votre crédit."))}
    ${agOnlineBanner()}
    <div class="mt-6">${summaryCard}</div>
    ${sectionHeader(t("Par campagne"))}
    ${perCampaign}
    ${recharges.length ? `${sectionHeader(t("Recharges"))}${history}
      <p class="mt-3 text-xs text-fg-subtle">${t("Carte Edahabia ou CIB : le crédit est ajouté dès que le paiement en ligne est confirmé. Virement ou carte Visa / Mastercard : dès que l'équipe {brand} confirme la réception de votre paiement.")}</p>` : ""}`;
}
