// Paiement en ligne des recharges (carte Edahabia ou CIB), version autonome : la copie de lib/server/services/payments.ts,
// toujours en mode simulé (aucune clé Chargily, aucun réseau) : la page de paiement simulée de l'app (#/agence/paiement/<id>)
// remplace celle de Chargily et l'agence y choisit l'issue du paiement. Mêmes contrôles, mêmes messages, mêmes effets.
import { link } from "../../lib/server/links";
import { badRequest, insertTransaction, logActivity, newId, newRef, notFound, notify, notifyRole, type UserRow } from "./db";
import { validateRecharge, type Ctx } from "./services";

const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/\u202f|\xa0/g, " ")} DA`;

/** Début d'un paiement en ligne : recharge « En cours » (provider « chargily ») et adresse de la page de paiement simulée. */
export function startOnlineTopUp({ db }: Ctx, user: UserRow, amount: number, method: string) {
  const id = newId(), ref = newRef();
  insertTransaction(db, { id, ref, userId: user.id, type: "recharge", amount, status: "En cours", method, label: `Recharge par ${method}`, provider: "chargily" });
  return { id, ref, checkoutUrl: link.agencyPayment(id), simulated: true };
}

/**
 * Issue d'un paiement en ligne : seul endroit où une recharge payée en ligne est validée (validateRecharge) ou refusée,
 * avec les notifications et le journal. Idempotent : une recharge déjà traitée n'est pas modifiée (renvoie false).
 */
export function settleOnlinePayment({ db }: Ctx, txId: string, paid: boolean): boolean {
  const t = db.transactions.find((x) => x.id === txId);
  if (!t || t.provider !== "chargily" || t.type !== "recharge") throw notFound("Paiement introuvable");
  if (t.status !== "En cours") return false;
  const name = db.users.find((u) => u.id === t.userId)?.name ?? "", amount = fmt(t.amount);
  if (paid) {
    validateRecharge(db, t);
    // Même phrase qu'une confirmation par l'équipe : l'agence voit sa recharge validée.
    notify(db, t.userId, "✅", `Votre recharge de ${amount} a été validée.`, link.userTx(t.type, t.id));
    notifyRole(db, "admin", "💳", `${name} a payé en ligne une recharge de ${amount} par ${t.method} (réf. ${t.ref}).`, link.adminPayment(t.id));
    logActivity(db, "💳", `Recharge de ${amount} payée en ligne par ${name} (${t.method}, Chargily).`);
  } else {
    t.status = "Refusé";
    notify(db, t.userId, "⚠️", `Paiement en ligne annulé ou refusé : votre recharge de ${amount} n'a pas été créditée.`, link.userTx(t.type, t.id));
    logActivity(db, "🚫", `Paiement en ligne de ${amount} annulé ou refusé (${name}).`);
  }
  return true;
}

/** Recharge en ligne de l'agence connectée (404 pour celle d'un autre compte). */
function ownOnlineTopUp({ db }: Ctx, user: UserRow, id: string) {
  const t = db.transactions.find((x) => x.id === id);
  if (!t || t.userId !== user.id || t.provider !== "chargily") throw notFound("Paiement introuvable");
  return t;
}

/** Page de paiement simulée : l'agence choisit l'issue de son paiement (toujours permis hors ligne, sans clé Chargily). */
export function simulatePayment(ctx: Ctx, user: UserRow, id: string, paid: boolean) {
  const t = ownOnlineTopUp(ctx, user, id);
  if (t.status !== "En cours") throw badRequest("Ce paiement a déjà été traité");
  settleOnlinePayment(ctx, t.id, paid);
}

/** « Reprendre le paiement » d'une recharge en ligne : la page de paiement simulée tant qu'elle est en cours. */
export function resumeOnlineTopUp(ctx: Ctx, user: UserRow, id: string) {
  const t = ownOnlineTopUp(ctx, user, id);
  return { status: t.status, checkoutUrl: t.status === "En cours" ? link.agencyPayment(t.id) : null };
}
