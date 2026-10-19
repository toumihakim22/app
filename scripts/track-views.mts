// Relevé des vues pour une crontab système (hors Vercel), toutes les 6 heures :
//   0 */6 * * *  cd /chemin/vers/clipboost && npm run cron:views >> /var/log/clipboost-views.log 2>&1
// Même relevé que GET /api/cron/views (lib/server/services/tracking.ts), sur la base de DATABASE_URL (PGlite sans elle :
// arrêtez alors `npm run dev`, PGlite n'accepte qu'un processus à la fois).
import { trackViews } from "../lib/server/services/tracking";

try {
  const s = await trackViews("script");
  console.log(`${s.at} : ${s.updated}/${s.total} clips relevés (${s.simulated} en mode simulé), ${s.failed} en erreur.`);
  process.exit(0);
} catch (err) {
  console.error("Relevé des vues impossible :", err);
  process.exit(1);
}
