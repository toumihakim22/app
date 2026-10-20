// Parrainage des clippers : chaque clipper a un code (lien « /espace?ref=<code>#/inscription »). Un clipper inscrit avec
// ce code (email ou Google, Apple, Discord) devient son filleul ; quand le PREMIER retrait du filleul est validé par
// l'équipe (reviewTransaction, services/wallet.ts), le parrain reçoit la prime du réglage referralBonus, payée par
// ClipBoost comme un gain (rétention de holdDays jours), une seule fois par filleul (table referral_rewards).
// Pas de prime si le parrain est suspendu, ou si le filleul retire vers le même compte que lui (noté au journal).
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { User } from "../auth";
import { logActivity, notify, type Tx } from "../events";
import { notFound } from "../http";
import { newId, newRef } from "../ids";
import { link } from "../links";
import { acceptedReferrer, normalizeReferralCode, referralCode, referralDecision, referralFirstName, referralLabel, referralNotice, referralPaidText, referralRefusedText } from "../rules";
import type { Settings } from "../settings";

const U = schema.users, T = schema.transactions, R = schema.referralRewards;

/** Code de parrainage libre pour un nouveau clipper (tiré au hasard, redemandé dans le cas très rare où il existe déjà). */
export async function newReferralCode(db: Tx) {
  for (;;) {
    const code = referralCode(randomBytes(8));
    const [taken] = await db.select({ id: U.id }).from(U).where(eq(U.referralCode, code));
    if (!taken) return code;
  }
}

/** Clipper actif qui porte ce code (null : code mal formé, inconnu, ou compte qui ne peut pas parrainer). */
async function referrerByCode(db: Tx, value: unknown) {
  const code = normalizeReferralCode(value);
  if (!code) return null;
  const [row] = await db.select().from(U).where(eq(U.referralCode, code));
  return row && row.role === "clipper" && row.status === "Actif" ? row : null;
}

/**
 * Champs de parrainage d'un compte créé (inscription par email ou par un fournisseur) : un code pour un clipper, et son
 * parrain si le code reçu est celui d'un autre clipper actif (acceptedReferrer). Un code refusé est ignoré sans erreur.
 */
export async function referralFields(db: Tx, signup: { id: string; role: "clipper" | "agence" }, ref: unknown) {
  if (signup.role !== "clipper") return { referralCode: null, referredBy: null };
  const referrer = acceptedReferrer(await referrerByCode(db, ref), signup);
  return { referralCode: await newReferralCode(db), referredBy: referrer?.id ?? null };
}

/** Lien public d'un code (GET /api/referral/<code>) : le prénom du parrain seulement, pour « Invité par … ». */
export async function lookupReferral(value: string) {
  const referrer = await referrerByCode(await getDb(), value);
  if (!referrer) throw notFound("Code de parrainage inconnu");
  return { code: referrer.referralCode!, firstName: referralFirstName(referrer.name) };
}

type Transaction = typeof schema.transactions.$inferSelect;

/**
 * Prime de parrainage, dans la transaction SQL qui valide un retrait (t : le retrait, déjà « Validé »). Rien si le
 * clipper n'a pas de parrain, si ce n'est pas son premier retrait validé, ou si la prime a déjà été traitée. Sinon :
 * parrain suspendu ou même compte de retrait → aucune prime, une ligne au journal ; prime à 0 DA → enregistrée sans
 * versement ; sinon gain du parrain (retirable après holdDays jours), notification « 🎁 » et ligne au journal.
 */
export async function rewardReferral(tx: Tx, t: Transaction, settings: Settings) {
  if (t.type !== "retrait") return;
  const [referee] = await tx.select().from(U).where(eq(U.id, t.userId));
  if (!referee?.referredBy) return;
  const [earlier] = await tx.select({ id: T.id }).from(T).where(and(eq(T.userId, referee.id), eq(T.type, "retrait"), eq(T.status, "Validé"), ne(T.id, t.id))).limit(1);
  if (earlier) return;
  // Verrou sur le parrain : deux validations simultanées ne paient pas deux fois (la clé referee_id en dernier recours).
  const [referrer] = await tx.select().from(U).where(eq(U.id, referee.referredBy)).for("update");
  const [done] = await tx.select({ id: R.refereeId }).from(R).where(eq(R.refereeId, referee.id));
  if (!referrer || done) return;
  const decision = referralDecision(referrer, referee);
  if (decision !== "pay") return logActivity(tx, "🎁", referralRefusedText(referrer.name, referee.name, decision));
  const amount = settings.referralBonus, now = Date.now();
  let transactionId: string | null = null;
  if (amount > 0) {
    transactionId = newId();
    await tx.insert(T).values({
      id: transactionId, ref: newRef(), userId: referrer.id, type: "gain", label: referralLabel(referee.name), amount, status: "Validé",
      availableAt: new Date(now + settings.holdDays * 86_400_000), publicationId: null,
    });
    await notify(tx, referrer.id, "🎁", referralNotice(referee.name, amount), link.clipperTx(transactionId));
    await logActivity(tx, "🎁", referralPaidText(referrer.name, referee.name, amount));
  }
  await tx.insert(R).values({ refereeId: referee.id, referrerId: referrer.id, amount, transactionId });
}

/**
 * Parrainage pour GET /api/state (clipper) : son code, la prime en vigueur, ses filleuls du plus récent au plus ancien
 * (nom, date d'inscription, premier retrait fait ou non, prime reçue) et les totaux. Rien d'autre sur les filleuls.
 */
export async function referralState(user: User) {
  const db = await getDb();
  const referees = await db.select({ id: U.id, name: U.name, createdAt: U.createdAt }).from(U).where(eq(U.referredBy, user.id)).orderBy(desc(U.createdAt));
  const rewards = new Map((await db.select().from(R).where(eq(R.referrerId, user.id))).map((r) => [r.refereeId, r]));
  const ids = referees.map((r) => r.id);
  const withdrew = new Set(ids.length ? (await db.selectDistinct({ id: T.userId }).from(T).where(and(inArray(T.userId, ids), eq(T.type, "retrait"), eq(T.status, "Validé")))).map((r) => r.id) : []);
  const list = referees.map((r) => ({ name: r.name, joined: r.createdAt.toISOString().slice(0, 10), firstWithdrawal: withdrew.has(r.id), bonus: rewards.get(r.id)?.amount ?? 0 }));
  return {
    code: user.referralCode, referees: list,
    stats: { referees: list.length, firstWithdrawals: withdrew.size, bonus: [...rewards.values()].reduce((s, r) => s + r.amount, 0) },
  };
}
