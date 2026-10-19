import { route, json, rateLimit } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { logActivity } from "@/lib/server/events";
import { trackViews } from "@/lib/server/services/tracking";
import { viewsTrackedText } from "@/lib/server/rules";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Bouton « Relever les vues maintenant » de la modération : même relevé que la tâche planifiée, bilan renvoyé. */
export const POST = route(async () => {
  const admin = await requireUser("admin");
  // Chaque relevé interroge les API des plateformes pour tous les clips suivis (quotas) : 5 par quart d'heure.
  rateLimit(`track-views:${admin.id}`, 5, 15 * 60_000);
  const summary = await trackViews("admin");
  await logActivity(await getDb(), "📈", viewsTrackedText(admin.name, summary.updated, summary.failed));
  return json({ ok: true, ...summary });
});
