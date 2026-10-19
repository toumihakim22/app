import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { User } from "../auth";
import { logActivity, notify, notifyRole, type Tx } from "../events";
import { badRequest, notFound } from "../http";
import { newId, newRef } from "../ids";
import { link } from "../links";
import { instantFee } from "../rules";
import { getSettings } from "../settings";
import { issueDocument } from "./documents";
import { balances } from "./money";

const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/ | /g, " ")} DA`;

/** Demande de retrait d'un clipper vers son moyen de paiement enregistré. */
export async function requestWithdrawal(user: User, amount: number, instant: boolean) {
  const settings = await getSettings();
  if (!user.payoutMethod || !user.payoutAccount) throw badRequest("Ajoutez d'abord un moyen de retrait (BaridiMob, CCP ou RIB) dans votre profil");
  if (amount < settings.minWithdraw) throw badRequest(`Le retrait minimum est de ${fmt(settings.minWithdraw)}`);
  const fee = instant ? instantFee(amount, settings.instantFeePercent, settings.instantMinFee) : 0;
  const db = await getDb();
  await db.transaction(async (tx) => {
    // Verrou sur l'utilisateur pour éviter deux retraits simultanés du même solde.
    await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, user.id)).for("update");
    const { available } = await balances(tx, user.id);
    if (amount > available) throw badRequest(`Solde disponible insuffisant (${fmt(available)})`);
    const id = newId();
    await tx.insert(schema.transactions).values({
      id, ref: newRef(), userId: user.id, type: "retrait", amount: -amount, fee, status: "En cours",
      method: user.payoutMethod, label: `Retrait ${instant ? "instantané " : ""}vers ${user.payoutMethod}`,
    });
    await notifyRole(tx, "admin", "💸", `${user.name} demande un retrait de ${fmt(amount)}${instant ? " (instantané)" : ""}.`, link.adminPayment(id));
    await logActivity(tx, "💸", `${user.name} a demandé un retrait de ${fmt(amount)}.`);
  });
}

export type CardInfo = { brand: "Visa" | "Mastercard"; last4: string };

/**
 * Une agence annonce une recharge de son crédit (virement ou carte Visa / Mastercard ; Edahabia et CIB se paient en ligne,
 * services/payments.ts). Le crédit est ajouté quand l'équipe confirme la réception.
 * Carte Visa / Mastercard : seules la marque et les 4 derniers chiffres sont connus, ajoutés au libellé (« … · Visa •••• 4242 »).
 */
export async function requestCredit(user: User, amount: number, method: string, card?: CardInfo) {
  const db = await getDb();
  const id = newId(), ref = newRef();
  const label = `Recharge par ${method}${card && method === "carte Visa / Mastercard" ? ` · ${card.brand} •••• ${card.last4}` : ""}`;
  await db.transaction(async (tx) => {
    await tx.insert(schema.transactions).values({ id, ref, userId: user.id, type: "recharge", amount, status: "En cours", method, label });
    await notifyRole(tx, "admin", "🏦", `${user.name} annonce une recharge de ${fmt(amount)} par ${method} (réf. ${ref}).`, link.adminPayment(id));
  });
  return ref;
}

type Transaction = typeof schema.transactions.$inferSelect;

/**
 * Validation d'une recharge, dans la transaction de l'appelant (ligne déjà verrouillée, encore « En cours ») : seul endroit
 * où une recharge devient « Validé » et où le crédit de l'agence augmente, que la confirmation vienne de l'équipe
 * (reviewTransaction) ou de Chargily Pay (settleOnlinePayment, services/payments.ts). La facture de la recharge est créée
 * ici (services/documents.ts). Les notifications restent à l'appelant.
 */
export async function validateRecharge(tx: Tx, t: Transaction) {
  await tx.update(schema.transactions).set({ status: "Validé" }).where(eq(schema.transactions.id, t.id));
  await tx.update(schema.users).set({ credit: sql`${schema.users.credit} + ${t.amount}` }).where(eq(schema.users.id, t.userId));
  await issueDocument(tx, t);
}

/**
 * L'équipe traite un retrait (validé : reçu créé) ou confirme une recharge annoncée (virement, carte Visa / Mastercard). Une recharge payée en
 * ligne ne se traite pas à la main : Chargily la confirme (webhook), ce qui évite de créditer deux fois le même paiement.
 */
export async function reviewTransaction(admin: User, id: string, approve: boolean) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(schema.transactions).where(eq(schema.transactions.id, id)).for("update");
    if (!t) throw notFound("Transaction introuvable");
    if (t.status !== "En cours" || t.type === "gain") throw badRequest("Cette transaction a déjà été traitée");
    if (t.provider === "chargily") throw badRequest("Paiement en ligne : confirmé automatiquement par Chargily");
    if (t.type === "recharge" && approve) await validateRecharge(tx, t);
    else {
      await tx.update(schema.transactions).set({ status: approve ? "Validé" : "Refusé" }).where(eq(schema.transactions.id, id));
      // Retrait versé : son reçu, dans la même transaction.
      if (approve) await issueDocument(tx, t);
    }
    const what = t.type === "retrait" ? `retrait de ${fmt(-t.amount)}` : `recharge de ${fmt(t.amount)}`;
    // Accord du participe : « le retrait » est validé, « la recharge » est validée.
    const done = `${approve ? "validé" : "refusé"}${t.type === "recharge" ? "e" : ""}`;
    const net = t.type === "retrait" && approve && t.fee ? ` (${fmt(-t.amount - t.fee)} versés après ${fmt(t.fee)} de frais)` : "";
    await notify(tx, t.userId, approve ? "✅" : "⚠️", `Votre ${what} a été ${done}${net}.`, link.userTx(t.type, t.id));
    await logActivity(tx, approve ? "✅" : "🚫", `${what[0].toUpperCase()}${what.slice(1)} ${done} par ${admin.name}.`);
  });
}
