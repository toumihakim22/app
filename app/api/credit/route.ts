import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { requestCredit } from "@/lib/server/services/wallet";
import { creditSchema } from "@/lib/server/validation";

/** Demande de recharge du crédit d'une agence : en cours jusqu'à la confirmation de l'équipe, quel que soit le moyen de paiement. */
export const POST = route(async (req) => {
  const user = await requireUser("agence");
  const { amount, method, card } = await body(req, creditSchema);
  const ref = await requestCredit(user, amount, method, card);
  return json({ ok: true, ref }, { status: 201 });
});
