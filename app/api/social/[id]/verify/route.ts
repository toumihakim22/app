import { route, json, rateLimit } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { verifySocialAccount } from "@/lib/server/services/social";

/** Vérification du code dans la bio du compte (API de la plateforme) ; `simulated` : plateforme sans identifiants. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requireUser("clipper");
  // Chaque tentative interroge l'API de la plateforme (quotas) : 10 essais par quart d'heure.
  rateLimit(`social-verify:${user.id}`, 10, 15 * 60_000);
  const { simulated } = await verifySocialAccount(user, (await params).id);
  return json({ ok: true, simulated });
});
