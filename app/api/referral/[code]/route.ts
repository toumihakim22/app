import { route, json, rateLimit, clientIp } from "@/lib/server/http";
import { lookupReferral } from "@/lib/server/services/referrals";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Code d'un lien de parrainage (public, sans connexion) : le prénom du parrain pour « Invité par … » sur l'écran
 * d'inscription ; 404 pour un code inconnu (l'inscription reste possible, le code est alors ignoré).
 */
export const GET = route<Ctx>(async (req, { params }) => {
  rateLimit(`referral:${clientIp(req)}`, 60, 15 * 60_000);
  const { code } = await params;
  return json(await lookupReferral(code));
});
