import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { simulatePayment } from "@/lib/server/services/payments";
import { simulatePaymentSchema } from "@/lib/server/validation";

/** Mode simulé (aucune clé Chargily) : issue du paiement choisie par l'agence sur la page simulée, { paid }. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser("agence");
  const { paid } = await body(req, simulatePaymentSchema);
  await simulatePayment(user, (await params).id, paid);
  return json({ ok: true });
});
