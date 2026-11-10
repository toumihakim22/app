// Espace Clipper (5/9) : classement de la semaine.
// Les fichiers de web/src/clipper/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Classement ----------
// Semaine en cours (du lundi 00:00 au dimanche 24:00, heure d'Alger) : podium et top 10 en direct avec la prime de chaque
// rang (places libres comprises), sa propre position, fin de la semaine, gagnants de la semaine écoulée et règles
// (db.leaderboard, helpers lb… de ui.js). Seules les vues des clips validés comptent.

// Jour à Alger (UTC+1) d'un instant ISO, au format ISO lu par date() ; back : ms retranchées (fin exclue de la semaine).
const clAlgiersDay = (iso, back = 0) => new Date(new Date(iso).getTime() + 3_600_000 - back).toISOString();

// Marche du podium : 1er au centre et plus haut (ordre 2-1-3, en miroir en arabe), photo, nom, vues, prime.
function clPodiumStep(r, meId) {
  const first = r.rank === 1;
  return `<li class="flex min-w-0 flex-col items-center rounded-tile px-2 text-center ${first ? "bg-warning-bg pb-4 pt-5 ring-1 ring-inset ring-warning-border" : "bg-subtle pb-3 pt-3"}">
    <span class="relative">${avatar(lbPerson(r), first ? "lg" : "size-12 text-base")}<span class="absolute -bottom-1 -end-1">${lbRankChip(r.rank, "size-6")}</span></span>
    <p class="mt-2.5 w-full truncate text-sm font-semibold text-fg">${esc(r.name)}</p>
    <p class="w-full truncate text-xs tabular-nums text-fg-subtle">${plural(r.views, "vue", "vues")}</p>
    <p class="mt-1.5">${lbPrize(r.prize)}</p>
    ${r.userId === meId ? `<p class="mt-1.5">${badge(t("Vous"), "brand")}</p>` : ""}
  </li>`;
}

function cClassement() {
  const lb = lbData(), u = me();
  if (!lb) return `${pageHeader(t("Classement"), "")}<div class="mt-6">${emptyState("trophy", t("Classement indisponible"), t("Rechargez la page pour afficher le classement de la semaine."))}</div>`;
  const mine = lb.me || { rank: null, views: 0 }, hold = db.settings.holdDays, podium = lb.top.slice(0, 3);
  const range = t("Du {from} au {to}, heure d'Alger", { from: date(clAlgiersDay(lb.start)), to: date(clAlgiersDay(lb.end, 1)) });

  // Semaine en cours : podium, rangs 4 à 10, places primées encore libres.
  const board = lb.top.length
    ? `<ol class="mt-5 grid grid-cols-3 items-end gap-2 sm:gap-3" aria-label="${esc(t("Podium"))}">${[1, 0, 2].map((i) => (podium[i] ? clPodiumStep(podium[i], u.id) : "<li></li>")).join("")}</ol>
      ${lb.top.length > 3 || lbOpenRanks(lb).length ? `<div class="mt-3">${lbRows(lb.top.slice(3), { meId: u.id, open: lbOpenRanks(lb) })}</div>` : ""}`
    : `${emptyState("trophy", t("Aucune vue validée cette semaine pour l'instant"), t("Le classement se remplit à chaque relevé des vues des clips validés. Les 10 premiers de la semaine gagnent une prime."), "", { inCard: true })}
      <div class="mt-1">${lbRows([], { open: lbOpenRanks(lb) })}</div>`;
  const weekCard = card(`${cardHeader(t("Semaine {n}", { n: fmt(lb.number) }), range, badge(t("En direct"), "success", { dot: true }))}${board}`, "p-5");

  // Sa position : rang et vues de la semaine, prime en jeu ou vues qui manquent pour entrer dans le top 10.
  const tenth = lb.top[9];
  const gap = mine.rank && mine.rank > 10 && tenth ? Math.max(1, tenth.views - mine.views + 1) : 0;
  const prize = mine.rank && mine.rank <= 10 ? lb.prizes[mine.rank - 1] || 0 : 0;
  const position = card(`<p class="text-small font-medium text-fg-muted">${t("Votre position")}</p>
    ${mine.rank
      ? `<p class="mt-1 flex flex-wrap items-baseline gap-x-2"><span class="text-[1.875rem] font-semibold leading-9 tracking-tight text-fg">${lbOrdinal(mine.rank)}</span><span class="text-small text-fg-subtle">${t("sur {count}", { count: plural(lb.ranked, "clipper classé", "clippers classés") })}</span></p>
        <p class="mt-2 text-sm text-fg-muted">${t("Vous êtes {rank} avec {views} cette semaine.", { rank: lbOrdinal(mine.rank), views: `<strong class="font-semibold text-fg">${plural(mine.views, "vue validée", "vues validées")}</strong>` })}</p>
        <div class="mt-4">${prize ? alertBox("success", t("Prime en jeu : {amount} si vous gardez cette place jusqu'à dimanche minuit.", { amount: `<strong class="font-semibold">${da(prize)}</strong>` }))
          : gap ? alertBox("info", t("Encore {views} pour entrer dans le top 10.", { views: `<strong class="font-semibold">${plural(gap, "vue", "vues")}</strong>` })) : ""}</div>`
      : `<p class="mt-1 text-base font-semibold text-fg">${t("Vous n'êtes pas encore au classement")}</p>
        <p class="mt-1 text-sm text-fg-muted">${t("Les vues gagnées cette semaine par vos clips validés vous y font entrer.")}</p>
        <div class="mt-4 flex flex-wrap gap-2"><button type="button" data-action="submit-clip" class="${btn("primary", "sm")}">${icon("plus")}${t("Soumettre un clip")}</button><a href="#/clipper/decouvrir" class="${btn("secondary", "sm")}">${t("Découvrir les campagnes")}</a></div>`}`, "p-5");
  const ends = card(`<div class="flex items-start gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-tile bg-subtle text-fg-muted" aria-hidden="true">${icon("clock", "size-5")}</span>
    <div class="min-w-0"><p class="text-small font-medium text-fg-muted">${t("Fin de la semaine dans")}</p><p class="mt-0.5 text-base font-semibold tabular-nums text-fg">${lbTimeLeft(lb.end)}</p>
      <p class="mt-1 text-xs text-fg-subtle">${t("Dimanche à minuit, heure d'Alger. Les primes sont versées lundi.")}</p></div></div>`, "p-5");

  // Semaine écoulée : ses gagnants et la prime versée à chacun.
  const last = lb.last;
  const lastCard = last ? card(`${cardHeader(t("Gagnants de la semaine {n}", { n: fmt(last.number) }), last.closedAt ? t("Primes versées le {date}", { date: date(last.closedAt) }) : "")}
    ${last.winners.length ? `<div class="mt-2">${lbRows(last.winners, { meId: u.id, amountKey: "amount" })}</div>` : emptyState("trophy", t("Aucun gagnant cette semaine-là"), "", "", { inCard: true })}`, "p-5") : "";

  const rules = [
    t("Seules les vues validées comptent : les vues gagnées pendant la semaine par vos clips validés, du lundi 00:00 au dimanche 24:00 (heure d'Alger)."),
    t("Les 10 premiers de la semaine gagnent une prime, versée lundi dans votre portefeuille."),
    t("Comme vos autres gains, une prime reste en rétention {days} avant d'être retirable.", { days: plural(hold, "jour", "jours") }),
    t("À égalité de vues, le clipper inscrit le plus tôt passe devant."),
  ];
  const rulesCard = card(`${cardHeader(t("Règles du classement"))}<ul class="mt-3 grid gap-2.5">${rules.map((r) => `<li class="flex gap-2.5 text-small text-fg-muted">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span>${r}</span></li>`).join("")}</ul>`, "p-5");

  return `${pageHeader(t("Classement"), t("Les clippers qui gagnent le plus de vues validées cette semaine. Les 10 premiers remportent une prime."))}
    <div class="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
      <div class="grid content-start gap-4 lg:col-start-2 lg:row-start-1 lg:gap-5">${position}${ends}</div>
      <div class="grid min-w-0 content-start gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:gap-5">${weekCard}${lastCard}</div>
      <div class="lg:col-start-2 lg:row-start-2">${rulesCard}</div>
    </div>`;
}
