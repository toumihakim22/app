import { route, json, body, rateLimit } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { appOrigin } from "@/lib/server/oauth";
import { startOnlineTopUp } from "@/lib/server/services/payments";
import { checkoutSchema } from "@/lib/server/validation";

/**
 * Paiement en ligne d'une recharge (carte Edahabia ou CIB) : recharge « En cours » et adresse de la page de paiement de
 * Chargily Pay → { id, ref, checkoutUrl, simulated }. Mode simulé (sans CHARGILY_SECRET_KEY) : checkoutUrl est la page de
 * paiement simulée de l'app (« #/agence/paiement/<id> »). Le crédit arrive avec la confirmation de Chargily (webhook).
 */
export const POST = route(async (req) => {
  const user = await requireUser("agence");
  // Chaque essai crée un paiement chez Chargily : 10 par quart d'heure.
  rateLimit(`checkout:${user.id}`, 10, 15 * 60_000);
  const { amount, method } = await body(req, checkoutSchema);
  return json({ ok: true, ...(await startOnlineTopUp(user, amount, method, appOrigin(req))) }, { status: 201 });
});
