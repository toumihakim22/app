// Classement hebdomadaire des clippers, version autonome : la copie de lib/server/services/leaderboard.ts (mêmes règles,
// mêmes textes, mêmes effets). Sans tâche planifiée, les semaines terminées sont clôturées par GET /api/state (runDueJobs,
// tracking.ts) et à chaque relevé des vues.
import { link } from "../../lib/server/links";
import { PRIZE_RANKS, prizeLabel, prizeNotice, weekBounds, weekClosedText, weekGains, weekKey, weekNumber, weeklyRanking, weeksToClose, weekStart } from "../../lib/server/rules";
import { badRequest, getSettings, insertTransaction, logActivity, newId, newRef, notify, type Store, type UserRow, type WeeklyAwardRow } from "./db";
import type { Ctx } from "./services";

/** Mêmes noms que le serveur. */
export const WEEKLY_JOB = "weekly";
const HISTORY_WEEKS = 12;

/** Classement d'une semaine [start, end[ : relevés des clips validés (weekGains), clippers suspendus exclus. */
function rankingOf(db: Store, start: number, end: number, prizes: number[]) {
  const clips = db.publications.filter((p) => p.status === "Validée");
  const ids = new Set(clips.map((p) => p.id));
  const gains = weekGains(db.snapshots.filter((x) => ids.has(x.publicationId)).map((x) => ({ publicationId: x.publicationId, views: x.views, at: x.recordedAt })), start, end);
  return weeklyRanking(clips, gains, db.users.filter((u) => u.role === "clipper"), prizes);
}

/** Dernière semaine clôturée (bilan de la tâche « weekly »), null avant la première clôture. */
function lastClosedWeek(db: Store) {
  const week = db.jobRuns.find((j) => j.name === WEEKLY_JOB)?.summary.week;
  return typeof week === "string" ? week : null;
}

/**
 * Clôture d'une semaine terminée, idempotente (closeWeek du serveur) : rien si elle est déjà clôturée ; sinon les rangs
 * classés du top 10 enregistrés, les primes non nulles versées en gain avec la notification du gagnant, une ligne au journal.
 */
export function closeWeek({ db }: Ctx, week: string, now = Date.now()) {
  const bounds = weekBounds(week);
  if (!bounds) throw badRequest("Semaine invalide");
  if (now < bounds.end) throw badRequest("Cette semaine n'est pas encore terminée");
  const settings = getSettings(db), lastClosed = lastClosedWeek(db);
  if (db.weeklyAwards.some((a) => a.week === week) || (lastClosed && lastClosed >= week)) return { week, closed: false, winners: 0, paid: 0 };
  let winners = 0, paid = 0;
  for (const r of rankingOf(db, bounds.start, bounds.end, settings.weeklyPrizes).slice(0, PRIZE_RANKS)) {
    let transactionId: string | null = null;
    if (r.prize > 0) {
      transactionId = newId();
      insertTransaction(db, {
        id: transactionId, ref: newRef(), userId: r.userId, type: "gain", label: prizeLabel(week, r.rank), amount: r.prize, status: "Validé",
        availableAt: now + settings.holdDays * 86_400_000, publicationId: null, createdAt: now,
      });
      notify(db, r.userId, "🏆", prizeNotice(week, r.rank, r.prize), link.clipperTx(transactionId));
      winners++;
      paid += r.prize;
    }
    db.weeklyAwards.push({ week, rank: r.rank, userId: r.userId, views: r.views, amount: r.prize, transactionId, createdAt: now } satisfies WeeklyAwardRow);
  }
  logActivity(db, "🏆", weekClosedText(week, winners, paid));
  if (!lastClosed || week > lastClosed) {
    const summary = { week, winners, paid }, run = db.jobRuns.find((j) => j.name === WEEKLY_JOB);
    if (run) Object.assign(run, { lastRunAt: now, summary });
    else db.jobRuns.push({ name: WEEKLY_JOB, lastRunAt: now, summary });
  }
  return { week, closed: true, winners, paid };
}

/** Clôture les semaines terminées pas encore clôturées ; renvoie celles qui l'ont été. */
export function closeDueWeeks(ctx: Ctx, now = Date.now()) {
  return weeksToClose(lastClosedWeek(ctx.db), now).filter((week) => closeWeek(ctx, week, now).closed);
}

/** Classement de GET /api/state (même forme que leaderboardState du serveur). */
export function leaderboardState(db: Store, user: UserRow, prizes: number[]) {
  const now = Date.now(), start = weekStart(now), week = weekKey(now), end = weekBounds(week)!.end;
  const ranking = rankingOf(db, start, end, prizes), lastClosed = lastClosedWeek(db);
  const awardRows = lastClosed ? db.weeklyAwards.filter((a) => user.role === "admin" || a.week === lastClosed)
    .sort((a, b) => b.week.localeCompare(a.week) || a.rank - b.rank).slice(0, HISTORY_WEEKS * PRIZE_RANKS) : [];
  const person = (id: string) => { const u = db.users.find((x) => x.id === id); return { userId: id, name: u?.name ?? "", avatar: u?.avatar ?? null }; };
  const weeks = new Map<string, WeeklyAwardRow[]>();
  for (const a of awardRows) weeks.set(a.week, [...(weeks.get(a.week) ?? []), a]);
  const closedWeek = (key: string) => ({
    week: key, number: weekNumber(key), closedAt: weeks.get(key)?.[0] ? new Date(weeks.get(key)![0].createdAt).toISOString() : null,
    winners: (weeks.get(key) ?? []).map((a) => ({ rank: a.rank, ...person(a.userId), views: a.views, amount: a.amount })),
  });
  const mine = ranking.find((r) => r.userId === user.id);
  return {
    week, number: weekNumber(week), start: new Date(start).toISOString(), end: new Date(end).toISOString(), prizes, ranked: ranking.length,
    top: ranking.slice(0, PRIZE_RANKS).map((r) => ({ rank: r.rank, ...person(r.userId), views: r.views, prize: r.prize })),
    ...(user.role === "clipper" ? { me: { rank: mine?.rank ?? null, views: mine?.views ?? 0 } } : {}),
    last: lastClosed ? closedWeek(lastClosed) : null,
    ...(user.role === "admin" ? { history: [...weeks.keys()].map(closedWeek) } : {}),
  };
}
