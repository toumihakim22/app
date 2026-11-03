import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { requestCredit } from "@/lib/server/services/wallet";
import { creditSchema } from "@/lib/server/validation";

/**
 * Recharge annoncée par une agence (virement bancaire ou carte Visa / Mastercard) : en cours jusqu'à la confirmation de
 * l'équipe. Carte Edahabia ou CIB : paiement en ligne (POST /api/credit/checkout), refusé ici.
 */
export const POST = route(async (req) => {
  const user = await requireUser("agence");
  const { amount, method, card } = await body(req, creditSchema);
  const ref = await requestCredit(user, amount, method, card);
  return json({ ok: true, ref }, { status: 201 });
});
