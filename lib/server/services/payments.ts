// Paiement en ligne des recharges des agences (carte Edahabia ou CIB) via Chargily Pay (lib/server/chargily.ts).
// La recharge est créée « En cours » (provider « chargily »), l'agence paie sur la page de Chargily, puis le webhook
// la valide (crédit ajouté) ou la refuse. Sans CHARGILY_SECRET_KEY : mode simulé, une page de l'app (#/agence/paiement/<id>)
// remplace celle de Chargily et l'agence y choisit l'issue du paiement (refusé en production : voir simulatedMode).
// L'équipe ne traite pas ces recharges à la main.
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { User } from "../auth";
import { ChargilyError, chargilyConfigured, checkoutOutcome, createCheckout, getCheckout, parseEvent, verifySignature, type OnlineMethod } from "../chargily";
import { logActivity, notify, notifyRole } from "../events";
import { ApiError, badRequest, forbidden, notFound } from "../http";
import { newId, newRef } from "../ids";
import { link } from "../links";
import { validateRecharge } from "./wallet";

const T = schema.transactions;
const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/\u202f|\xa0/g, " ")} DA`;
const unavailable = () => new ApiError(502, "Paiement en ligne indisponible pour le moment : réessayez ou payez par virement bancaire");
/**
 * Mode simulé : sans clé Chargily, en développement seulement. En production, il permettrait à une agence de se créditer
 * sans payer : le paiement en ligne y est refusé tant que CHARGILY_SECRET_KEY n'est pas définie.
 */
function simulatedMode() {
  if (chargilyConfigured()) return false;
  if (process.env.NODE_ENV === "production") throw new ApiError(503, "Paiement en ligne non configuré");
  return true;
}

/**
 * Début d'un paiement en ligne : recharge « En cours » puis page de paiement de Chargily (retour sur la recharge dans
 * Budget, webhook sur /api/payments/chargily/webhook). Mode simulé : l'adresse est la page de paiement simulée de l'app.
 * Si Chargily refuse ou ne répond pas, la recharge est effacée (rien n'a été payé) et l'erreur est renvoyée.
 */
export async function startOnlineTopUp(user: User, amount: number, method: OnlineMethod, origin: string) {
  const simulated = simulatedMode();
  const db = await getDb();
  const id = newId(), ref = newRef();
  await db.insert(T).values({ id, ref, userId: user.id, type: "recharge", amount, status: "En cours", method, label: `Recharge par ${method}`, provider: "chargily" });
  if (simulated) return { id, ref, checkoutUrl: link.agencyPayment(id), simulated: true };
  try {
    const back = `${origin}/espace${link.agencyBudget(id)}`;
    const checkout = await createCheckout({
      amount, method, transactionId: id, description: `Recharge ClipBoost ${ref}`, locale: user.locale,
      successUrl: back, failureUrl: back, webhookUrl: `${origin}/api/payments/chargily/webhook`,
    });
    await db.update(T).set({ providerRef: checkout.id }).where(eq(T.id, id));
    return { id, ref, checkoutUrl: checkout.checkoutUrl, simulated: false };
  } catch (err) {
    console.error("[chargily]", err instanceof Error ? err.message : err);
    await db.delete(T).where(eq(T.id, id));
    throw unavailable();
  }
}

/**
 * Issue d'un paiement en ligne (webhook de Chargily, page simulée, ou état relu chez Chargily) : seul endroit où une recharge
 * payée en ligne est validée (validateRecharge : statut et crédit) ou refusée, avec les notifications et le journal.
 * Idempotent : une recharge déjà traitée n'est pas modifiée (renvoie false), un webhook reçu deux fois ne crédite qu'une fois.
 */
export async function settleOnlinePayment(txId: string, paid: boolean): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(T).where(eq(T.id, txId)).for("update");
    if (!t || t.provider !== "chargily" || t.type !== "recharge") throw notFound("Paiement introuvable");
    if (t.status !== "En cours") return false;
    const [owner] = await tx.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, t.userId));
    const name = owner?.name ?? "", amount = fmt(t.amount);
    if (paid) {
      await validateRecharge(tx, t);
      // Même phrase qu'une confirmation par l'équipe : l'agence voit sa recharge validée.
      await notify(tx, t.userId, "✅", `Votre recharge de ${amount} a été validée.`, link.userTx(t.type, t.id));
      await notifyRole(tx, "admin", "💳", `${name} a payé en ligne une recharge de ${amount} par ${t.method} (réf. ${t.ref}).`, link.adminPayment(t.id));
      await logActivity(tx, "💳", `Recharge de ${amount} payée en ligne par ${name} (${t.method}, Chargily).`);
    } else {
      await tx.update(T).set({ status: "Refusé" }).where(eq(T.id, t.id));
      await notify(tx, t.userId, "⚠️", `Paiement en ligne annulé ou refusé : votre recharge de ${amount} n'a pas été créditée.`, link.userTx(t.type, t.id));
      await logActivity(tx, "🚫", `Paiement en ligne de ${amount} annulé ou refusé (${name}).`);
    }
    return true;
  });
}

/**
 * Webhook de Chargily Pay : signature vérifiée sur le corps brut (401 sinon), puis « checkout.paid » valide la recharge,
 * « checkout.failed », « checkout.canceled » et « checkout.expired » la refusent ; les autres événements sont ignorés.
 * La recharge est retrouvée par l'identifiant du checkout (provider_ref), ou par la transaction de ses métadonnées.
 * Renvoie handled: false pour un événement ignoré ou déjà traité (deuxième envoi du même webhook).
 */
export async function handleChargilyWebhook(raw: string, signature: string | null) {
  if (!chargilyConfigured()) throw new ApiError(503, "Paiement en ligne non configuré");
  if (!verifySignature(raw, signature)) throw new ApiError(401, "Signature invalide");
  const event = parseEvent(raw);
  if (!event) throw badRequest("Événement invalide");
  if (event.paid === null) return { handled: false };
  const db = await getDb();
  let [t] = await db.select().from(T).where(eq(T.providerRef, event.checkoutId));
  if (!t && event.transactionId) {
    // Checkout créé mais son identifiant pas encore enregistré : la transaction de ses métadonnées, si elle l'attend.
    const [m] = await db.select().from(T).where(eq(T.id, event.transactionId));
    if (m && m.provider === "chargily" && m.providerRef === null) {
      await db.update(T).set({ providerRef: event.checkoutId }).where(eq(T.id, m.id));
      t = m;
    }
  }
  if (!t || t.provider !== "chargily") throw notFound("Paiement introuvable");
  if (event.paid && event.amount !== null && event.amount !== t.amount) {
    console.error(`[chargily] checkout ${event.checkoutId} : ${event.amount} DA payés pour une recharge de ${t.amount} DA (réf. ${t.ref})`);
    throw badRequest("Montant du paiement inattendu");
  }
  return { handled: await settleOnlinePayment(t.id, event.paid) };
}

/** Recharge en ligne de l'agence connectée (404 pour celle d'un autre compte). */
async function ownOnlineTopUp(user: User, id: string) {
  const db = await getDb();
  const [t] = await db.select().from(T).where(eq(T.id, id));
  if (!t || t.userId !== user.id || t.provider !== "chargily") throw notFound("Paiement introuvable");
  return t;
}

/** Mode simulé seulement (aucune clé Chargily, hors production) : l'agence choisit l'issue de son paiement sur la page simulée. */
export async function simulatePayment(user: User, id: string, paid: boolean) {
  if (chargilyConfigured()) throw forbidden("Paiement simulé indisponible : le paiement en ligne est configuré");
  simulatedMode();
  const t = await ownOnlineTopUp(user, id);
  if (t.status !== "En cours") throw badRequest("Ce paiement a déjà été traité");
  await settleOnlinePayment(t.id, paid);
}

/**
 * « Reprendre le paiement » d'une recharge en ligne encore en cours : l'état du checkout est relu chez Chargily (un webhook
 * perdu est ainsi rattrapé) ; payé, annulé ou expiré, la recharge est réglée ; sinon l'adresse de sa page de paiement.
 * Mode simulé : la page de paiement simulée. Renvoie le statut de la recharge et l'adresse à ouvrir (null si réglée).
 */
export async function resumeOnlineTopUp(user: User, id: string): Promise<{ status: string; checkoutUrl: string | null }> {
  const t = await ownOnlineTopUp(user, id);
  if (t.status !== "En cours") return { status: t.status, checkoutUrl: null };
  if (simulatedMode()) return { status: t.status, checkoutUrl: link.agencyPayment(t.id) };
  // Recharge commencée en mode simulé, avant que la clé soit définie : aucun paiement chez Chargily.
  if (!t.providerRef) {
    await settleOnlinePayment(t.id, false);
    return { status: "Refusé", checkoutUrl: null };
  }
  let checkout;
  try {
    checkout = await getCheckout(t.providerRef);
  } catch (err) {
    console.error("[chargily]", err instanceof ChargilyError ? err.message : err);
    throw unavailable();
  }
  const outcome = checkoutOutcome(checkout.status);
  if (outcome !== null) {
    if (outcome && checkout.amount !== null && checkout.amount !== t.amount) throw badRequest("Montant du paiement inattendu");
    await settleOnlinePayment(t.id, outcome);
    return { status: outcome ? "Validé" : "Refusé", checkoutUrl: null };
  }
  if (!checkout.checkoutUrl) throw unavailable();
  return { status: t.status, checkoutUrl: checkout.checkoutUrl };
}
