import { and, count, eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { CampaignStatus } from "../db/schema";
import type { User } from "../auth";
import { logActivity, notify, notifyRole } from "../events";
import { badRequest, forbidden, notFound } from "../http";
import { newId } from "../ids";
import { link } from "../links";
import { fundingCost, validateCampaignNumbers } from "../rules";
import { getSettings } from "../settings";
import { GRADIENTS } from "../gradients";

export type CampaignInput = {
  title: string; brand?: string; category: string; rate: number; budget: number; minPayout: number; maxPayout: number;
  emoji: string; platforms: string[]; rules: string[];
};

const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/ | /g, " ")} DA`;

export async function getCampaign(id: string) {
  const db = await getDb();
  const [c] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, id));
  if (!c) throw notFound("Campagne introuvable");
  return c;
}

/** Une agence crée une campagne : elle attend la validation de l'équipe. L'admin peut publier directement. */
export async function createCampaign(user: User, input: CampaignInput) {
  const settings = await getSettings();
  const error = validateCampaignNumbers(input, settings.minBudget);
  if (error) throw badRequest(error);
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(schema.campaigns);
  const isAdmin = user.role === "admin";
  if (isAdmin && !input.brand?.trim()) throw badRequest("Indiquez la marque");
  const id = newId();
  await db.insert(schema.campaigns).values({
    id, ownerId: isAdmin ? null : user.id, brand: isAdmin ? input.brand!.trim() : user.name,
    title: input.title.trim(), category: input.category, rate: input.rate, budget: input.budget,
    minPayout: input.minPayout, maxPayout: input.maxPayout, emoji: input.emoji,
    platforms: input.platforms, rules: input.rules, gradient: GRADIENTS[n % GRADIENTS.length],
    status: isAdmin ? "Active" : "En attente", commissionRate: isAdmin ? 0 : settings.commissionRate,
  });
  if (isAdmin) {
    await notifyRole(db, "clipper", "🎯", `Nouvelle campagne : ${input.title.trim()} (${input.rate} DA /1K).`, link.clipperCampaign(id));
    await logActivity(db, "🎯", `Campagne « ${input.title.trim()} » publiée.`);
  } else {
    await notify(db, user.id, "⏳", `Votre campagne « ${input.title.trim()} » est en cours de vérification.`, link.agencyCampaign(id));
    await notifyRole(db, "admin", "🏢", `${user.name} a soumis la campagne « ${input.title.trim()} ».`, link.adminCampaign(id));
    await logActivity(db, "🏢", `${user.name} a soumis la campagne « ${input.title.trim()} ».`);
  }
  return id;
}

/**
 * Changements de statut.
 * - Admin : approuver (le budget + commission est prélevé sur le crédit de l'agence), refuser, mettre en pause, reprendre, terminer.
 * - Agence : mettre en pause ou reprendre ses propres campagnes actives.
 * Terminer une campagne rend à l'agence le budget non consommé et la commission correspondante.
 */
export async function setCampaignStatus(user: User, id: string, next: CampaignStatus) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, id)).for("update");
    if (!c) throw notFound("Campagne introuvable");
    const isAdmin = user.role === "admin";
    if (!isAdmin) {
      if (c.ownerId !== user.id) throw forbidden();
      const allowed = (c.status === "Active" && next === "En pause") || (c.status === "En pause" && next === "Active");
      if (!allowed) throw badRequest("Action impossible sur cette campagne");
    }
    if (c.status === next) return;
    if (c.status === "Terminée" || c.status === "Refusée") throw badRequest("Cette campagne est close");

    const patch: Partial<typeof c> = { status: next };
    if (isAdmin && c.status === "En attente" && next === "Active" && c.ownerId) {
      const cost = fundingCost(c.budget, c.commissionRate);
      const [owner] = await tx.select().from(schema.users).where(eq(schema.users.id, c.ownerId)).for("update");
      if (owner.credit < cost) throw badRequest(`Crédit de l'agence insuffisant : ${fmt(cost)} nécessaires (budget + ${c.commissionRate} % de commission), ${fmt(owner.credit)} disponibles`);
      await tx.update(schema.users).set({ credit: owner.credit - cost }).where(eq(schema.users.id, owner.id));
      patch.reserved = cost;
    }
    if (next === "Terminée" && c.ownerId && c.reserved > 0) {
      const unspent = Math.max(0, c.budget - c.spent);
      const refund = fundingCost(unspent, c.commissionRate);
      if (refund > 0) {
        await tx.update(schema.users).set({ credit: sql`${schema.users.credit} + ${refund}` }).where(eq(schema.users.id, c.ownerId));
        patch.reserved = c.reserved - refund;
        await notify(tx, c.ownerId, "💰", `${fmt(refund)} non consommés sur « ${c.title} » ont été rendus à votre crédit.`, link.agencyBudget(c.id));
      }
    }
    await tx.update(schema.campaigns).set(patch).where(eq(schema.campaigns.id, id));

    const verb: Record<string, string> = { Active: c.status === "En attente" ? "a été approuvée et est en ligne" : "est de nouveau active", "En pause": "a été mise en pause", "Terminée": "est terminée", "Refusée": "a été refusée" };
    if (isAdmin) await notify(tx, c.ownerId, next === "Active" ? "✅" : "⚠️", `Votre campagne « ${c.title} » ${verb[next] ?? "a changé de statut"}.`, link.agencyCampaign(c.id));
    if (c.status === "En attente" && next === "Active") await notifyRole(tx, "clipper", "🎯", `Nouvelle campagne : ${c.title} (${c.rate} DA /1K).`, link.clipperCampaign(c.id));
    await logActivity(tx, "🎯", `Campagne « ${c.title} » : ${c.status} → ${next}.`);
  });
}

/** L'agence ajoute du budget à une campagne. Si la campagne est déjà financée, le montant (+ commission) est prélevé sur son crédit. */
export async function addBudget(user: User, id: string, amount: number) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, id)).for("update");
    if (!c) throw notFound("Campagne introuvable");
    if (c.ownerId !== user.id) throw forbidden();
    if (c.status === "Terminée" || c.status === "Refusée") throw badRequest("Cette campagne est close");
    if (c.status === "En attente") {
      await tx.update(schema.campaigns).set({ budget: c.budget + amount }).where(eq(schema.campaigns.id, id));
      return;
    }
    const cost = fundingCost(amount, c.commissionRate);
    const [owner] = await tx.select().from(schema.users).where(eq(schema.users.id, user.id)).for("update");
    if (owner.credit < cost) throw badRequest(`Crédit insuffisant : ${fmt(cost)} nécessaires (commission incluse)`);
    await tx.update(schema.users).set({ credit: owner.credit - cost }).where(eq(schema.users.id, user.id));
    await tx.update(schema.campaigns).set({ budget: c.budget + amount, reserved: c.reserved + cost }).where(eq(schema.campaigns.id, id));
    await logActivity(tx, "💰", `${user.name} a ajouté ${fmt(amount)} au budget de « ${c.title} ».`);
  });
}

export async function setMembership(userId: string, campaignId: string, patch: { joined?: boolean; favorite?: boolean }) {
  const db = await getDb();
  const c = await getCampaign(campaignId);
  if (patch.joined && c.status !== "Active") throw badRequest("Cette campagne n'accepte pas de nouveaux clippers");
  await db.insert(schema.campaignMembers).values({ campaignId, userId, joined: patch.joined ?? false, favorite: patch.favorite ?? false })
    .onConflictDoUpdate({ target: [schema.campaignMembers.campaignId, schema.campaignMembers.userId], set: patch });
}

export async function setTop(id: string, top: boolean) {
  const db = await getDb();
  await db.update(schema.campaigns).set({ top }).where(and(eq(schema.campaigns.id, id)));
}
