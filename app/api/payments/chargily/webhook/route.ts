import { route, json, readText } from "@/lib/server/http";
import { handleChargilyWebhook } from "@/lib/server/services/payments";

export const dynamic = "force-dynamic";

/**
 * Webhook de Chargily Pay (adresse à déclarer dans son tableau de bord : <APP_URL>/api/payments/chargily/webhook).
 * Appelé par les serveurs de Chargily, donc sans contrôle de l'origine : l'en-tête « signature » (HMAC-SHA256 du corps
 * brut avec CHARGILY_SECRET_KEY) est vérifié à la place, 401 s'il ne correspond pas. Paiement réussi : recharge validée et
 * crédit ajouté ; échec, annulation ou expiration : recharge refusée. Un événement déjà traité répond 200 sans rien changer.
 */
export const POST = route(async (req) => {
  const raw = await readText(req);
  return json({ ok: true, ...(await handleChargilyWebhook(raw, req.headers.get("signature"))) });
}, { crossSite: true });
