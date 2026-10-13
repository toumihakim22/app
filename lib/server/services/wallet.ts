import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { User } from "../auth";
import { logActivity, notify, notifyRole } from "../events";
import { badRequest, notFound } from "../http";
import { newId, newRef } from "../ids";
import { link } from "../links";
import { instantFee } from "../rules";
import { getSettings } from "../settings";
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

/** Une agence demande à recharger son crédit (virement ou carte). Le crédit est ajouté quand l'équipe confirme la réception. */
export async function requestCredit(user: User, amount: number, method: string) {
  const db = await getDb();
  const id = newId(), ref = newRef();
  await db.insert(schema.transactions).values({ id, ref, userId: user.id, type: "recharge", amount, status: "En cours", method, label: `Recharge par ${method}` });
  await notifyRole(db, "admin", "🏦", `${user.name} annonce une recharge de ${fmt(amount)} par ${method} (réf. ${ref}).`, link.adminPayment(id));
  return ref;
}

/** L'équipe traite un retrait ou confirme une recharge. */
export async function reviewTransaction(admin: User, id: string, approve: boolean) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(schema.transactions).where(eq(schema.transactions.id, id)).for("update");
    if (!t) throw notFound("Transaction introuvable");
    if (t.status !== "En cours" || t.type === "gain") throw badRequest("Cette transaction a déjà été traitée");
    await tx.update(schema.transactions).set({ status: approve ? "Validé" : "Refusé" }).where(eq(schema.transactions.id, id));
    if (t.type === "recharge" && approve) {
      await tx.update(schema.users).set({ credit: sql`${schema.users.credit} + ${t.amount}` }).where(eq(schema.users.id, t.userId));
    }
    const what = t.type === "retrait" ? `retrait de ${fmt(-t.amount)}` : `recharge de ${fmt(t.amount)}`;
    const net = t.type === "retrait" && approve && t.fee ? ` (${fmt(-t.amount - t.fee)} versés après ${fmt(t.fee)} de frais)` : "";
    await notify(tx, t.userId, approve ? "✅" : "⚠️", `Votre ${what} a été ${approve ? "validé" : "refusé"}${net}.`, link.userTx(t.type, t.id));
    await logActivity(tx, approve ? "✅" : "🚫", `${what[0].toUpperCase()}${what.slice(1)} ${approve ? "validé" : "refusé"} par ${admin.name}.`);
  });
}
