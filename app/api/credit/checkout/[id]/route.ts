import { route, json, rateLimit } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { resumeOnlineTopUp } from "@/lib/server/services/payments";

/**
 * « Reprendre le paiement » d'une recharge en ligne en cours → { status, checkoutUrl } : l'état est relu chez Chargily
 * (payée, annulée ou expirée : la recharge est réglée et checkoutUrl vaut null), sinon l'adresse de sa page de paiement.
 */
export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requireUser("agence");
  rateLimit(`checkout:${user.id}`, 10, 15 * 60_000);
  return json({ ok: true, ...(await resumeOnlineTopUp(user, (await params).id)) });
});
