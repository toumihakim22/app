import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError, json, route } from "@/lib/server/http";
import { trackViews } from "@/lib/server/services/tracking";

export const dynamic = "force-dynamic";
// Le relevé interroge les API des plateformes clip par clip : jusqu'à 5 minutes (plafond des offres Vercel payantes).
export const maxDuration = 300;

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * Relevé automatique des vues, toutes les 6 heures (vercel.json : Vercel Cron appelle cette adresse en GET avec
 * « Authorization: Bearer <CRON_SECRET> »). Sans CRON_SECRET, la route est refusée en production et ouverte en développement.
 */
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new ApiError(503, "Relevé planifié désactivé : définissez CRON_SECRET");
  } else if (!timingSafeEqual(digest(req.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`))) {
    throw new ApiError(401, "Accès refusé");
  }
  return json({ ok: true, ...(await trackViews("cron")) });
});
