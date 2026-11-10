// Espace Admin (8/13) : classement hebdomadaire.
// Les fichiers de web/src/admin/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Classement hebdomadaire ----------
// Semaine en cours en direct (top 10, places primées libres), chiffres clés et historique des primes versées par semaine
// clôturée (db.leaderboard.history). Chaque nom mène à la fiche du clipper. La clôture est automatique (relevé des vues).
const admLbName = (r) => admUserLink(userById(r.userId) || { id: r.userId, name: r.name }, "text-fg");

function aClassement() {
  const lb = lbData();
  if (!lb) return pageHeader(t("Classement hebdomadaire"), "");
  const history = lb.history || [], paid = admSum(history, (w) => admSum(w.winners, (x) => x.amount));
  const atStake = admSum(lb.top, (r) => r.prize);
  const kpis = [
    kpi({ label: t("Clippers classés"), value: kpiValue(fmt(lb.ranked)), sub: t("Semaine {n}", { n: fmt(lb.number) }), ic: "users" }),
    kpi({ label: t("Primes en jeu"), value: bigMoney(atStake), sub: t("sur {amount} au total", { amount: da(admSum(lb.prizes, (x) => x)) }), ic: "trophy" }),
    kpi({ label: t("Fin de la semaine dans"), value: `<span class="text-base font-semibold tracking-tight text-fg tabular-nums sm:text-xl">${lbTimeLeft(lb.end)}</span>`, sub: t("Dimanche à minuit, heure d'Alger"), ic: "clock" }),
    kpi({ label: t("Primes versées"), value: bigMoney(paid), sub: t("sur {weeks}", { weeks: plural(history.length, "semaine clôturée", "semaines clôturées") }), ic: "wallet" }),
  ];
  const current = card(`${cardHeader(t("Semaine {n}", { n: fmt(lb.number) }), t("Vues validées gagnées depuis lundi 00:00 (heure d'Alger), en direct."), badge(t("En direct"), "success", { dot: true }))}
    ${lb.top.length ? "" : `<p class="mt-4 text-small text-fg-subtle">${t("Aucune vue validée cette semaine pour l'instant.")}</p>`}
    <div class="mt-2">${lbRows(lb.top, { name: admLbName, open: lbOpenRanks(lb) })}</div>`, "p-5");
  const past = card(`${cardHeader(t("Primes versées"), t("Semaines clôturées, la plus récente d'abord."))}
    ${history.length ? `<div class="mt-4 grid gap-6">${history.map((w) => `<section aria-label="${esc(t("Semaine {n}", { n: fmt(w.number) }))}">
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h3 class="text-sm font-semibold text-fg">${t("Semaine {n}", { n: fmt(w.number) })}</h3>
          <p class="text-xs tabular-nums text-fg-subtle">${w.closedAt ? `${date(w.closedAt)} · ` : ""}${da(admSum(w.winners, (x) => x.amount))}</p></div>
        ${lbRows(w.winners, { name: admLbName, amountKey: "amount" })}</section>`).join("")}</div>`
      : emptyState("trophy", t("Aucune semaine clôturée"), t("La semaine écoulée est clôturée au premier relevé des vues du lundi."), "", { inCard: true })}`, "p-5");
  return `${pageHeader(t("Classement hebdomadaire"), t("Les clippers classés par vues validées, du lundi au dimanche (heure d'Alger). Les 10 premiers reçoivent une prime à la clôture de la semaine, faite par le relevé des vues."),
      `<a href="#/admin/parametres" class="${btn("secondary")}">${icon("gear")}${t("Modifier les primes")}</a>`)}
    <div class="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">${kpis.join("")}</div>
    <div class="mt-4 grid items-start gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">${current}${past}</div>`;
}
