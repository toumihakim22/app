import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { User } from "../auth";
import { logActivity, notify } from "../events";
import { badRequest, notFound } from "../http";
import { newId, newRef } from "../ids";
import { link } from "../links";
import { belowMin, payoutDelta, viewsFor } from "../rules";
import { getSettings } from "../settings";

const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/ | /g, " ")} DA`;

// Le lien doit pointer vers la plateforme déclarée.
const HOSTS: Record<string, RegExp> = {
  TikTok: /(^|\.)tiktok\.com$/,
  Instagram: /(^|\.)instagram\.com$/,
  YouTube: /(^|\.)(youtube\.com|youtu\.be)$/,
};

export async function submitClip(user: User, input: { campaignId: string; title: string; platform: string; url: string }) {
  const db = await getDb();
  const [c] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, input.campaignId));
  if (!c) throw notFound("Campagne introuvable");
  if (c.status !== "Active") throw badRequest("Cette campagne n'accepte plus de clips");
  if (!c.platforms.includes(input.platform)) throw badRequest(`Cette campagne n'accepte pas ${input.platform}`);
  const [member] = await db.select().from(schema.campaignMembers)
    .where(and(eq(schema.campaignMembers.campaignId, c.id), eq(schema.campaignMembers.userId, user.id), eq(schema.campaignMembers.joined, true)));
  if (!member) throw badRequest("Rejoignez la campagne avant de soumettre un clip");
  let url: URL;
  try {
    url = new URL(input.url.trim());
  } catch {
    throw badRequest("Lien invalide");
  }
  if (url.protocol !== "https:" || !HOSTS[input.platform]?.test(url.hostname)) throw badRequest(`Le lien doit être un lien ${input.platform} (https://…)`);
  const [dup] = await db.select({ id: schema.publications.id }).from(schema.publications).where(eq(schema.publications.url, url.toString()));
  if (dup) throw badRequest("Ce clip a déjà été soumis");
  const id = newId();
  await db.insert(schema.publications).values({ id, userId: user.id, campaignId: c.id, title: input.title.trim(), platform: input.platform, url: url.toString() });
  await logActivity(db, "🎬", `${user.name} a soumis le clip « ${input.title.trim()} » (${c.title}).`);
  return id;
}

/**
 * Relevé des vues d'un clip (par l'équipe, ou plus tard par une tâche planifiée branchée sur les API des plateformes).
 * Pendant la fenêtre de gains, un clip validé est payé pour ses vues supplémentaires.
 */
export async function recordViews(id: string, views: number) {
  const db = await getDb();
  const settings = await getSettings();
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.publications).where(eq(schema.publications.id, id)).for("update");
    if (!p) throw notFound("Clip introuvable");
    if (views < p.views) throw badRequest("Le nombre de vues ne peut pas diminuer");
    await tx.update(schema.publications).set({ views }).where(eq(schema.publications.id, id));
    if (p.status !== "Validée" || !p.approvedAt) return;
    if (Date.now() - p.approvedAt.getTime() > settings.earningDays * 86_400_000) return;
    const [c] = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, p.campaignId)).for("update");
    const extra = payoutDelta(views, c, p.paid);
    if (!extra) return;
    await credit(tx, p, c, extra, `${c.title} · vues supplémentaires`, settings.holdDays);
  });
}

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];
type Pub = typeof schema.publications.$inferSelect;
type Camp = typeof schema.campaigns.$inferSelect;

async function credit(tx: Tx, p: Pub, c: Camp, amount: number, label: string, holdDays: number) {
  const spent = c.spent + amount;
  await tx.update(schema.publications).set({ paid: p.paid + amount }).where(eq(schema.publications.id, p.id));
  await tx.update(schema.campaigns).set({ spent, ...(spent >= c.budget ? { status: "Terminée" as const } : {}) }).where(eq(schema.campaigns.id, c.id));
  const txId = newId();
  await tx.insert(schema.transactions).values({
    id: txId, ref: newRef(), userId: p.userId, type: "gain", label, amount, status: "Validé",
    availableAt: new Date(Date.now() + holdDays * 86_400_000), publicationId: p.id,
  });
  await notify(tx, p.userId, "💸", `+${fmt(amount)} pour « ${p.title} ». Retirable dans ${holdDays} jours.`, link.clipperTx(txId));
  if (spent >= c.budget) {
    await notify(tx, c.ownerId, "🏁", `Le budget de « ${c.title} » est entièrement consommé : la campagne est terminée.`, link.agencyCampaign(c.id));
    await logActivity(tx, "🏁", `Campagne « ${c.title} » terminée (budget consommé).`);
  }
}

export async function reviewClip(admin: User, id: string, decision: { approve: true } | { approve: false; reason: string }) {
  const db = await getDb();
  const settings = await getSettings();
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.publications).where(eq(schema.publications.id, id)).for("update");
    if (!p) throw notFound("Clip introuvable");
    if (p.status !== "En attente") throw badRequest("Ce clip a déjà été traité");
    if (!decision.approve) {
      await tx.update(schema.publications).set({ status: "Refusée", reason: decision.reason }).where(eq(schema.publications.id, id));
      await notify(tx, p.userId, "⚠️", `Clip « ${p.title} » refusé : ${decision.reason}.`, link.clip(p.id));
      await logActivity(tx, "🚫", `Clip « ${p.title} » refusé par ${admin.name}.`);
      return;
    }
    const [c] = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, p.campaignId)).for("update");
    if (belowMin(p.views, c)) throw badRequest(`Seuil non atteint : ${viewsFor(c.minPayout, c.rate).toLocaleString("fr-FR")} vues minimum`);
    const now = new Date();
    await tx.update(schema.publications).set({ status: "Validée", approvedAt: now }).where(eq(schema.publications.id, id));
    const amount = payoutDelta(p.views, c, 0);
    if (amount > 0) await credit(tx, { ...p, status: "Validée", approvedAt: now }, c, amount, c.title, settings.holdDays);
    else await notify(tx, p.userId, "✅", `Votre clip « ${p.title} » a été validé.`, link.clip(p.id));
    await logActivity(tx, "✅", `Clip « ${p.title} » validé (${fmt(amount)}).`);
  });
}

export async function clipsCountByCampaign() {
  const db = await getDb();
  return db.select({ campaignId: schema.publications.campaignId, n: sql<number>`count(*)` }).from(schema.publications).groupBy(schema.publications.campaignId);
}
