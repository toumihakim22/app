// Relevé des vues de la version autonome (copie de lib/server/services/tracking.ts) : toujours en mode simulé (aucune
// API appelée, simulatedStats de lib/server/rules.ts). Sans tâche planifiée dans un fichier HTML, le relevé est lancé
// à la demande : par le bouton de l'admin, et par GET /api/state dès que le dernier relevé a plus de 6 heures (runDueJobs).
import { PLATFORMS } from "../../lib/server/gradients";
import { simulatedStats } from "../../lib/server/rules";
import { getSettings, type JobRunRow, type Store } from "./db";
import { recordViews, type Ctx } from "./services";

/** Mêmes noms et intervalle que le serveur. */
export const VIEWS_JOB = "views";
export const TRACK_EVERY_HOURS = 6;
export type TrackTrigger = "cron" | "script" | "admin" | "auto";

export const lastJobRun = (db: Store, name: string) => db.jobRuns.find((j) => j.name === name) ?? null;

export function saveJobRun(db: Store, name: string, summary: Record<string, unknown>, at = Date.now()) {
  const row = lastJobRun(db, name);
  if (row) Object.assign(row, { lastRunAt: at, summary } satisfies Partial<JobRunRow>);
  else db.jobRuns.push({ name, lastRunAt: at, summary });
}

/** Hors ligne, toutes les plateformes sont simulées. */
export const simulatedPlatforms = () => [...PLATFORMS];

/** Clips suivis : en attente, ou validés depuis moins de earningDays, dont la campagne est active ou en pause. */
function trackedClips(db: Store) {
  const since = Date.now() - getSettings(db).earningDays * 86_400_000;
  const live = new Set(db.campaigns.filter((c) => c.status === "Active" || c.status === "En pause").map((c) => c.id));
  return db.publications.filter((p) => live.has(p.campaignId) && (p.status === "En attente" || (p.status === "Validée" && p.approvedAt !== null && p.approvedAt > since)));
}

/** Relève (en mode simulé) les vues de chaque clip suivi, comme le serveur ; bilan enregistré dans jobRuns. */
export function trackViews(ctx: Ctx, by: TrackTrigger) {
  const now = Date.now(), clips = trackedClips(ctx.db);
  const summary = { by, total: clips.length, updated: 0, simulated: 0, failed: 0 };
  const hours = (createdAt: number, at: number) => (at - createdAt) / 3_600_000;
  for (const p of clips) {
    const stats = simulatedStats(p.id, hours(p.createdAt, now), { views: p.views, likes: p.likes, lastAgeHours: p.checkedAt === null ? null : hours(p.createdAt, p.checkedAt) });
    recordViews(ctx, p.id, stats.views, stats.likes, { auto: true });
    summary.updated++;
    summary.simulated++;
  }
  saveJobRun(ctx.db, VIEWS_JOB, summary, now);
  return { ...summary, at: new Date(now).toISOString() };
}

/**
 * Tâches dues, lancées par GET /api/state : le relevé des vues si le dernier a plus de TRACK_EVERY_HOURS heures.
 * Renvoie true si la base a changé (l'appelant l'enregistre : une requête GET n'est pas enregistrée d'office).
 */
export function runDueJobs(ctx: Ctx) {
  const last = lastJobRun(ctx.db, VIEWS_JOB);
  if (last && Date.now() - last.lastRunAt < TRACK_EVERY_HOURS * 3_600_000) return false;
  trackViews(ctx, "auto");
  return true;
}
