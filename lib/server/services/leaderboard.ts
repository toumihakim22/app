// Classement hebdomadaire des clippers : vues validées gagnées du lundi 00:00 au dimanche 24:00 (heure d'Alger), d'après
// l'historique des relevés (view_snapshots, services/tracking.ts). Chaque semaine terminée est clôturée une seule fois
// (closeWeek) : les 10 premiers reçoivent la prime de leur rang (réglage weeklyPrizes), payée par ClipBoost comme un gain
// (rétention de holdDays jours). La clôture est lancée par le relevé des vues (trackViews) : aucune tâche planifiée en plus.
// La dernière semaine clôturée est gardée dans job_runs (tâche « weekly »).
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { User } from "../auth";
import { logActivity, notify, type Tx } from "../events";
import { badRequest } from "../http";
import { newId, newRef } from "../ids";
import { link } from "../links";
import { PRIZE_RANKS, prizeLabel, prizeNotice, weekBounds, weekClosedText, weekGains, weekKey, weekNumber, weeklyRanking, weeksToClose, weekStart } from "../rules";
import { getSettings } from "../settings";

/** Nom de la tâche du classement dans job_runs : son bilan garde la dernière semaine clôturée (`week`). */
export const WEEKLY_JOB = "weekly";
/** Semaines clôturées montrées à l'équipe (historique des primes). */
const HISTORY_WEEKS = 12;

const P = schema.publications, V = schema.viewSnapshots, W = schema.weeklyAwards, U = schema.users;

/**
 * Classement d'une semaine [start, end[ (weeklyRanking, lib/server/rules.ts) : pour chaque clip validé, son dernier relevé
 * avant le début et son dernier relevé avant la fin suffisent (weekGains) ; clippers suspendus exclus.
 */
async function rankingOf(db: Tx, start: number, end: number, prizes: number[]) {
  const clips = await db.select({ id: P.id, userId: P.userId, status: P.status }).from(P).where(eq(P.status, "Validée"));
  if (!clips.length) return [];
  const lastBefore = (bound: number) => db.selectDistinctOn([V.publicationId], { publicationId: V.publicationId, views: V.views, at: V.recordedAt })
    .from(V).innerJoin(P, eq(P.id, V.publicationId)).where(and(eq(P.status, "Validée"), lt(V.recordedAt, new Date(bound)))).orderBy(V.publicationId, desc(V.recordedAt));
  const readings = [...(await lastBefore(start)), ...(await lastBefore(end))].map((r) => ({ publicationId: r.publicationId, views: r.views, at: r.at.getTime() }));
  const gains = weekGains(readings, start, end);
  const ids = [...new Set(clips.filter((c) => gains.get(c.id)).map((c) => c.userId))];
  const clippers = ids.length ? await db.select({ id: U.id, createdAt: U.createdAt, status: U.status }).from(U).where(and(inArray(U.id, ids), eq(U.role, "clipper"))) : [];
  return weeklyRanking(clips, gains, clippers.map((u) => ({ ...u, createdAt: u.createdAt.getTime() })), prizes);
}

/** Dernière semaine clôturée (bilan de la tâche « weekly »), null avant la première clôture. */
async function lastClosedWeek(db: Tx) {
  const [run] = await db.select().from(schema.jobRuns).where(eq(schema.jobRuns.name, WEEKLY_JOB));
  return typeof run?.summary.week === "string" ? run.summary.week : null;
}

export type CloseSummary = { week: string; closed: boolean; winners: number; paid: number };

/**
 * Clôture d'une semaine terminée (« 2026-W43 »), idempotente : une semaine déjà clôturée (primes enregistrées, ou semaine
 * antérieure ou égale à la dernière clôturée) ne change rien (closed: false). Sinon, dans une seule transaction (verrou
 * PostgreSQL : deux clôtures simultanées ne paient pas deux fois, la clé (week, rank) en dernier recours) : chaque rang
 * classé du top 10 est enregistré dans weekly_awards ; une prime non nulle est versée en gain (sans clip, retirable après
 * holdDays jours), avec la notification du gagnant ; une ligne au journal ; la semaine devient la dernière clôturée.
 */
export async function closeWeek(week: string, now = Date.now()): Promise<CloseSummary> {
  const bounds = weekBounds(week);
  if (!bounds) throw badRequest("Semaine invalide");
  if (now < bounds.end) throw badRequest("Cette semaine n'est pas encore terminée");
  const db = await getDb();
  const settings = await getSettings();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('clipboost-weekly-leaderboard'))`);
    const lastClosed = await lastClosedWeek(tx);
    const [done] = await tx.select({ rank: W.rank }).from(W).where(eq(W.week, week)).limit(1);
    if (done || (lastClosed && lastClosed >= week)) return { week, closed: false, winners: 0, paid: 0 };
    const at = new Date(now), top = (await rankingOf(tx, bounds.start, bounds.end, settings.weeklyPrizes)).slice(0, PRIZE_RANKS);
    let winners = 0, paid = 0;
    for (const r of top) {
      let transactionId: string | null = null;
      if (r.prize > 0) {
        transactionId = newId();
        await tx.insert(schema.transactions).values({
          id: transactionId, ref: newRef(), userId: r.userId, type: "gain", label: prizeLabel(week, r.rank), amount: r.prize, status: "Validé",
          availableAt: new Date(now + settings.holdDays * 86_400_000), publicationId: null, createdAt: at,
        });
        await notify(tx, r.userId, "🏆", prizeNotice(week, r.rank, r.prize), link.clipperTx(transactionId));
        winners++;
        paid += r.prize;
      }
      await tx.insert(W).values({ week, rank: r.rank, userId: r.userId, views: r.views, amount: r.prize, transactionId, createdAt: at });
    }
    await logActivity(tx, "🏆", weekClosedText(week, winners, paid));
    // Semaine clôturée hors de l'ordre (plus ancienne que la dernière) : la dernière clôturée reste la plus récente.
    if (!lastClosed || week > lastClosed) {
      const summary = { week, winners, paid };
      await tx.insert(schema.jobRuns).values({ name: WEEKLY_JOB, lastRunAt: at, summary }).onConflictDoUpdate({ target: schema.jobRuns.name, set: { lastRunAt: at, summary } });
    }
    return { week, closed: true, winners, paid };
  });
}

/**
 * Clôture les semaines terminées pas encore clôturées (weeksToClose : la semaine écoulée, et celles manquées si le relevé
 * s'est arrêté). Appelée à chaque relevé des vues (trackViews) ; renvoie les semaines clôturées.
 */
export async function closeDueWeeks(now = Date.now()) {
  const closed: string[] = [];
  for (const week of weeksToClose(await lastClosedWeek(await getDb()), now)) if ((await closeWeek(week, now)).closed) closed.push(week);
  return closed;
}

/**
 * Classement pour GET /api/state (clippers et admin) : semaine en cours (clé, numéro, fin), top 10 en direct avec la prime
 * de chaque rang et les seules données publiques des clippers (nom, photo), sa propre place (clipper : rang, ou null s'il
 * n'a pas encore de vue validée cette semaine), primes du réglage, gagnants de la dernière semaine clôturée ; l'équipe
 * reçoit en plus l'historique des primes (HISTORY_WEEKS dernières semaines clôturées).
 */
export async function leaderboardState(user: User, prizes: number[]) {
  const db = await getDb();
  const now = Date.now(), start = weekStart(now), week = weekKey(now), end = weekBounds(week)!.end;
  const ranking = await rankingOf(db, start, end, prizes);
  const lastClosed = await lastClosedWeek(db);
  const awardRows = lastClosed ? await db.select().from(W).where(user.role === "admin" ? undefined : eq(W.week, lastClosed)).orderBy(desc(W.week), W.rank).limit(HISTORY_WEEKS * PRIZE_RANKS) : [];
  const userIds = [...new Set([...ranking.slice(0, PRIZE_RANKS).map((r) => r.userId), ...awardRows.map((a) => a.userId)])];
  const people = new Map((userIds.length ? await db.select({ id: U.id, name: U.name, avatar: U.avatar }).from(U).where(inArray(U.id, userIds)) : []).map((u) => [u.id, u]));
  const person = (id: string) => ({ userId: id, name: people.get(id)?.name ?? "", avatar: people.get(id)?.avatar ?? null });
  const weeks = new Map<string, typeof awardRows>();
  for (const a of awardRows) weeks.set(a.week, [...(weeks.get(a.week) ?? []), a]);
  const closedWeek = (key: string) => ({
    week: key, number: weekNumber(key), closedAt: weeks.get(key)?.[0]?.createdAt.toISOString() ?? null,
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
