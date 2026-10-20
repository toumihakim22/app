// Relevé automatique des vues, toutes les 6 heures : Vercel Cron (GET /api/cron/views, vercel.json), ou une crontab
// système (npm run cron:views, scripts/track-views.mts), ou le bouton « Relever les vues maintenant » de la modération
// (POST /api/admin/track-views). Chaque clip suivi est lu par l'API officielle de sa plateforme (lib/server/platforms.ts) ;
// une plateforme sans ses clés est en mode simulé (simulatedStats, lib/server/rules.ts). Le relevé passe par
// recordViews (services/clips.ts) : historique du jour, score de risque, paiement des vues supplémentaires.
// La dernière exécution de chaque tâche est gardée dans job_runs (relevé des vues : « views »). Chaque relevé clôture
// aussi les semaines terminées du classement hebdomadaire (closeDueWeeks, services/leaderboard.ts).
import { and, eq, gt, inArray, or } from "drizzle-orm";
import { getDb, schema } from "../db";
import { fetchClipStats, PLATFORM_ENV, platformConfigured } from "../platforms";
import { simulatedStats } from "../rules";
import { getSettings } from "../settings";
import { recordViews } from "./clips";
import { closeDueWeeks } from "./leaderboard";

/** Nom de la tâche du relevé des vues dans job_runs, et intervalle entre deux relevés (heures). */
export const VIEWS_JOB = "views";
export const TRACK_EVERY_HOURS = 6;

/** Origine d'un relevé : tâche planifiée (Vercel Cron), script (crontab), bouton de l'admin ; « auto » : version autonome. */
export type TrackTrigger = "cron" | "script" | "admin" | "auto";
/** Bilan d'un relevé : clips suivis, relevés enregistrés (dont simulés), clips passés (API en erreur, vidéo introuvable). */
export type TrackSummary = { by: TrackTrigger; total: number; updated: number; simulated: number; failed: number };

/** Dernière exécution d'une tâche planifiée, null si elle n'a jamais tourné. */
export async function lastJobRun(name: string) {
  const db = await getDb();
  const [row] = await db.select().from(schema.jobRuns).where(eq(schema.jobRuns.name, name));
  return row ?? null;
}

/** Enregistre l'exécution d'une tâche planifiée (date et bilan). */
export async function saveJobRun(name: string, summary: Record<string, unknown>, at = new Date()) {
  const db = await getDb();
  await db.insert(schema.jobRuns).values({ name, lastRunAt: at, summary }).onConflictDoUpdate({ target: schema.jobRuns.name, set: { lastRunAt: at, summary } });
}

/** Plateformes sans leurs clés d'API : leurs vues sont simulées (aussi montré à l'équipe dans la modération). */
export const simulatedPlatforms = () => Object.keys(PLATFORM_ENV).filter((p) => !platformConfigured(p));

/**
 * Clips suivis : en attente, ou validés depuis moins de earningDays (ils rapportent encore), dont la campagne est active
 * ou en pause (une campagne terminée ne paie plus, ses clips en attente ne peuvent plus qu'être refusés).
 * Avec le compte vérifié du clipper sur la plateforme du clip (Instagram : la Business Discovery passe par ce compte).
 */
async function trackedClips() {
  const db = await getDb();
  const settings = await getSettings();
  const P = schema.publications, C = schema.campaigns, S = schema.socialAccounts;
  const since = new Date(Date.now() - settings.earningDays * 86_400_000);
  return db.select({ id: P.id, platform: P.platform, url: P.url, views: P.views, likes: P.likes, checkedAt: P.checkedAt, createdAt: P.createdAt, handle: S.handle })
    .from(P)
    .innerJoin(C, eq(C.id, P.campaignId))
    .leftJoin(S, and(eq(S.userId, P.userId), eq(S.platform, P.platform), eq(S.status, "verified")))
    .where(and(inArray(C.status, ["Active", "En pause"]), or(eq(P.status, "En attente"), and(eq(P.status, "Validée"), gt(P.approvedAt, since)))));
}

type Tracked = Awaited<ReturnType<typeof trackedClips>>[number];

/** Lecture d'un clip : par l'API de sa plateforme, ou simulée ; null si la vidéo est introuvable (rien n'est inventé). */
async function readClip(p: Tracked, now: number) {
  const stats = await fetchClipStats(p.platform, p.url, { handle: p.handle, submittedAt: p.createdAt });
  if (stats.status === "found") return { views: stats.views, likes: stats.likes, simulated: false };
  if (stats.status === "not_found") return null;
  const hours = (at: number) => (at - p.createdAt.getTime()) / 3_600_000;
  return { ...simulatedStats(p.id, hours(now), { views: p.views, likes: p.likes, lastAgeHours: p.checkedAt ? hours(p.checkedAt.getTime()) : null }), simulated: true };
}

/**
 * Relève les vues (et les likes) de chaque clip suivi. Les API sont interrogées 4 clips à la fois ; chaque relevé est
 * ensuite enregistré dans sa propre transaction (recordViews). Un clip dont l'API échoue ou dont la vidéo est
 * introuvable est passé pour ce tour (compté dans `failed`, détail dans les journaux du serveur) : aucune vue inventée.
 * Ensuite, les semaines terminées du classement sont clôturées (`closedWeeks`).
 */
export async function trackViews(by: TrackTrigger): Promise<TrackSummary & { at: string; closedWeeks: string[] }> {
  const clips = await trackedClips();
  const now = new Date();
  const summary: TrackSummary = { by, total: clips.length, updated: 0, simulated: 0, failed: 0 };
  for (let i = 0; i < clips.length; i += 4) {
    const batch = clips.slice(i, i + 4);
    const readings = await Promise.all(batch.map((p) => readClip(p, now.getTime()).catch((err: unknown) => {
      console.error(`[ClipBoost] Relevé des vues du clip ${p.id} (${p.platform}) : ${err instanceof Error ? err.message : String(err)}`);
      return null;
    })));
    for (const [j, reading] of readings.entries()) {
      if (!reading) {
        summary.failed++;
        continue;
      }
      try {
        await recordViews(batch[j].id, reading.views, reading.likes, { auto: true });
        summary.updated++;
        if (reading.simulated) summary.simulated++;
      } catch (err) {
        // Clip supprimé entre-temps (campagne supprimée) : passé.
        summary.failed++;
        console.error(`[ClipBoost] Relevé des vues du clip ${batch[j].id} non enregistré : ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  await saveJobRun(VIEWS_JOB, summary, now);
  // Classement : semaines terminées clôturées après le relevé (primes du top 10). Une erreur ne fait pas échouer le relevé :
  // la semaine reste à clôturer au relevé suivant.
  let closedWeeks: string[] = [];
  try {
    closedWeeks = await closeDueWeeks(now.getTime());
  } catch (err) {
    console.error(`[ClipBoost] Clôture du classement hebdomadaire : ${err instanceof Error ? err.message : String(err)}`);
  }
  return { ...summary, at: now.toISOString(), closedWeeks };
}
