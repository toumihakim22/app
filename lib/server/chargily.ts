// Paiement en ligne des recharges par carte Edahabia ou CIB via Chargily Pay (API v2, sans SDK : fetch et JSON).
// Clé secrète dans CHARGILY_SECRET_KEY : « test_sk_… » (mode test de Chargily, aucune carte débitée) ou « live_sk_… ».
// Sans clé, le paiement en ligne est en « mode simulé » : aucune requête, une page de l'app joue le rôle de la page de
// paiement (services/payments.ts). La même clé signe les webhooks (en-tête « signature », HMAC-SHA256 du corps brut).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { ONLINE_CREDIT_METHODS } from "./validation";

const TIMEOUT_MS = 15_000;

/** Moyen de paiement de Chargily pour chaque moyen de recharge payable en ligne (valeurs de CREDIT_METHODS). */
export type OnlineMethod = (typeof ONLINE_CREDIT_METHODS)[number];
export const CHARGILY_METHODS: Record<OnlineMethod, "edahabia" | "cib"> = { "carte Edahabia": "edahabia", "carte CIB": "cib" };

/** Clé secrète de Chargily Pay, "" si elle n'est pas définie (mode simulé). */
export const chargilyKey = () => process.env.CHARGILY_SECRET_KEY?.trim() ?? "";
export const chargilyConfigured = () => chargilyKey() !== "";

/** Adresse de l'API : mode test pour une clé « test_sk_… », sinon mode réel. */
export const chargilyApi = (key = chargilyKey()) => (key.startsWith("test_") ? "https://pay.chargily.net/test/api/v2" : "https://pay.chargily.net/api/v2");

/** Échec d'un appel à Chargily (réseau, délai, clé refusée, données refusées) ; le détail va dans les journaux. */
export class ChargilyError extends Error {}

/** État d'un paiement chez Chargily (checkout). */
export type Checkout = { id: string; status: string; amount: number | null; checkoutUrl: string | null };

async function call(method: "GET" | "POST", path: string, payload?: unknown): Promise<Checkout> {
  const key = chargilyKey();
  if (!key) throw new ChargilyError("CHARGILY_SECRET_KEY absente");
  let res: Response;
  try {
    res = await fetch(`${chargilyApi(key)}${path}`, {
      method, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json", ...(payload ? { "Content-Type": "application/json" } : {}) },
      body: payload ? JSON.stringify(payload) : undefined,
    });
  } catch (err) {
    throw new ChargilyError(`pay.chargily.net : ${(err as Error).message}`);
  }
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // Corps vide ou non JSON.
  }
  if (!res.ok || typeof data.id !== "string") throw new ChargilyError(`Chargily ${method} ${path} : ${res.status} ${typeof data.message === "string" ? data.message : ""}`.trim());
  return {
    id: data.id, status: String(data.status ?? ""), amount: typeof data.amount === "number" ? data.amount : null,
    checkoutUrl: typeof data.checkout_url === "string" ? data.checkout_url : null,
  };
}

export type CheckoutInput = {
  amount: number; method: OnlineMethod; transactionId: string; description: string; locale: string;
  successUrl: string; failureUrl: string; webhookUrl: string;
};

/** Crée la page de paiement (POST /checkouts) ; la transaction ClipBoost est rappelée dans les métadonnées. */
export async function createCheckout(input: CheckoutInput): Promise<{ id: string; checkoutUrl: string }> {
  const c = await call("POST", "/checkouts", {
    amount: input.amount, currency: "dzd", payment_method: CHARGILY_METHODS[input.method],
    success_url: input.successUrl, failure_url: input.failureUrl, webhook_endpoint: input.webhookUrl,
    locale: ["fr", "en", "ar"].includes(input.locale) ? input.locale : "fr", description: input.description,
    metadata: { transaction_id: input.transactionId },
  });
  if (!c.checkoutUrl) throw new ChargilyError("Chargily POST /checkouts : checkout_url absente");
  return { id: c.id, checkoutUrl: c.checkoutUrl };
}

/** État d'un paiement (GET /checkouts/<id>) : « pending », « processing », « paid », « failed », « canceled », « expired ». */
export const getCheckout = (id: string) => call("GET", `/checkouts/${encodeURIComponent(id)}`);

/** Issue d'un état de paiement : true payé, false annulé, refusé ou expiré, null encore en cours. */
export function checkoutOutcome(status: string): boolean | null {
  if (status === "paid") return true;
  if (["failed", "canceled", "expired"].includes(status)) return false;
  return null;
}

/**
 * Signature d'un webhook : en-tête « signature » = HMAC-SHA256 (hexadécimal) du corps brut, avec la clé secrète.
 * Comparaison à temps constant ; une signature absente ou mal formée est refusée.
 */
export function verifySignature(raw: string, signature: string | null | undefined, key = chargilyKey()): boolean {
  if (!key || !signature || !/^[0-9a-f]{64}$/i.test(signature.trim())) return false;
  const expected = createHmac("sha256", key).update(raw, "utf8").digest();
  return timingSafeEqual(expected, Buffer.from(signature.trim(), "hex"));
}

/** Signature d'un corps (tests, essais avec une clé de test). */
export const signPayload = (raw: string, key = chargilyKey()) => createHmac("sha256", key).update(raw, "utf8").digest("hex");

/** Événement d'un webhook utile à ClipBoost : paiement (checkout), son issue, son montant et la transaction des métadonnées. */
export type ChargilyEvent = { type: string; checkoutId: string; paid: boolean | null; amount: number | null; transactionId: string | null };

/**
 * Lecture d'un webhook (corps déjà vérifié) : « checkout.paid » → payé ; « checkout.failed », « checkout.canceled »,
 * « checkout.expired » → non payé ; autre type → paid null (ignoré). null si le corps n'est pas un événement de paiement.
 */
export function parseEvent(raw: string): ChargilyEvent | null {
  let e: { type?: unknown; data?: { id?: unknown; amount?: unknown; metadata?: unknown } };
  try {
    e = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!e || typeof e.type !== "string" || !e.data || typeof e.data.id !== "string") return null;
  const paid = e.type === "checkout.paid" ? true : ["checkout.failed", "checkout.canceled", "checkout.expired"].includes(e.type) ? false : null;
  const meta = e.data.metadata as { transaction_id?: unknown } | null | undefined;
  return {
    type: e.type, checkoutId: e.data.id, paid, amount: typeof e.data.amount === "number" ? e.data.amount : null,
    transactionId: meta && typeof meta === "object" && typeof meta.transaction_id === "string" ? meta.transaction_id : null,
  };
}
