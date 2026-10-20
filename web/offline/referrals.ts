// Parrainage des clippers, version autonome : la copie de lib/server/services/referrals.ts (mêmes règles, mêmes textes,
// mêmes effets). Le code d'un clipper est créé avec son compte (insertUser, db.ts).
import { link } from "../../lib/server/links";
import { acceptedReferrer, normalizeReferralCode, referralDecision, referralFirstName, referralLabel, referralNotice, referralPaidText, referralRefusedText } from "../../lib/server/rules";
import type { Settings } from "../../lib/server/settings";
import { insertTransaction, logActivity, newId, newRef, notFound, notify, newestFirst, type Store, type TxRow, type UserRow } from "./db";

/** Clipper actif qui porte ce code (null : code mal formé, inconnu, ou compte qui ne peut pas parrainer). */
function referrerByCode(db: Store, value: unknown) {
  const code = normalizeReferralCode(value);
  const row = code ? db.users.find((u) => u.referralCode === code) : undefined;
  return row && row.role === "clipper" && row.status === "Actif" ? row : null;
}

/** Parrain d'un compte créé (inscription par email ou connexion simulée) : null si le code n'est pas valable (ignoré). */
export function referrerFor(db: Store, signup: { id: string; role: "clipper" | "agence" }, ref: unknown) {
  return signup.role === "clipper" ? acceptedReferrer(referrerByCode(db, ref), signup)?.id ?? null : null;
}

/** GET /api/referral/<code> : le prénom du parrain seulement. */
export function lookupReferral(db: Store, value: string) {
  const referrer = referrerByCode(db, value);
  if (!referrer) throw notFound("Code de parrainage inconnu");
  return { code: referrer.referralCode!, firstName: referralFirstName(referrer.name) };
}

/**
 * Prime de parrainage au premier retrait validé d'un filleul (t : le retrait, déjà « Validé »), comme rewardReferral du
 * serveur : rien sans parrain, si ce n'est pas le premier retrait validé ou si la prime est déjà traitée ; parrain
 * suspendu ou même compte de retrait : une ligne au journal ; sinon gain du parrain, notification et journal.
 */
export function rewardReferral(db: Store, t: TxRow, settings: Settings) {
  if (t.type !== "retrait") return;
  const referee = db.users.find((u) => u.id === t.userId);
  if (!referee?.referredBy) return;
  if (db.transactions.some((x) => x.userId === referee.id && x.type === "retrait" && x.status === "Validé" && x.id !== t.id)) return;
  const referrer = db.users.find((u) => u.id === referee.referredBy);
  if (!referrer || db.referralRewards.some((r) => r.refereeId === referee.id)) return;
  const decision = referralDecision(referrer, referee);
  if (decision !== "pay") return logActivity(db, "🎁", referralRefusedText(referrer.name, referee.name, decision));
  const amount = settings.referralBonus, now = Date.now();
  let transactionId: string | null = null;
  if (amount > 0) {
    transactionId = newId();
    insertTransaction(db, {
      id: transactionId, ref: newRef(), userId: referrer.id, type: "gain", label: referralLabel(referee.name), amount, status: "Validé",
      availableAt: now + settings.holdDays * 86_400_000, publicationId: null, createdAt: now,
    });
    notify(db, referrer.id, "🎁", referralNotice(referee.name, amount), link.clipperTx(transactionId));
    logActivity(db, "🎁", referralPaidText(referrer.name, referee.name, amount));
  }
  db.referralRewards.push({ refereeId: referee.id, referrerId: referrer.id, amount, transactionId, createdAt: now });
}

/** Parrainage de GET /api/state (clipper), même forme que referralState du serveur. */
export function referralState(db: Store, user: UserRow) {
  const referees = newestFirst(db.users.filter((u) => u.referredBy === user.id));
  const rewards = new Map(db.referralRewards.filter((r) => r.referrerId === user.id).map((r) => [r.refereeId, r]));
  const withdrew = new Set(db.transactions.filter((x) => x.type === "retrait" && x.status === "Validé").map((x) => x.userId));
  const list = referees.map((r) => ({ name: r.name, joined: new Date(r.createdAt).toISOString().slice(0, 10), firstWithdrawal: withdrew.has(r.id), bonus: rewards.get(r.id)?.amount ?? 0 }));
  return {
    code: user.referralCode, referees: list,
    stats: { referees: list.length, firstWithdrawals: list.filter((r) => r.firstWithdrawal).length, bonus: [...rewards.values()].reduce((s, r) => s + r.amount, 0) },
  };
}
