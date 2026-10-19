import { count, eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { CampaignStatus } from "../db/schema";
import type { User } from "../auth";
import { logActivity, notify, notifyRole } from "../events";
import { badRequest, forbidden, notFound } from "../http";
import { newId } from "../ids";
import { link } from "../links";
import { deleteMedia, storeImage } from "../media";
import { fundingCost, sentence, validateCampaignNumbers } from "../rules";
import { getSettings } from "../settings";
import { GRADIENTS } from "../gradients";

export type CampaignInput = {
  title: string; brand?: string; category: string; rate: number; budget: number; minPayout: number; maxPayout: number;
  emoji: string; platforms: string[]; rules: string[];
  /** Photo de la campagne : data URL (nouvelle), adresse actuelle (inchangée), "" ou null (retirée), absente (inchangée). */
  image?: string | null;
};

const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/\u202f|\xa0/g, " ")} DA`;
/** Une campagne en attente de vérification ou refusée n'est pas encore financée : l'agence peut la modifier ou la retirer. */
const EDITABLE: CampaignStatus[] = ["En attente", "Refusée"];

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
  const isAdmin = user.role === "admin";
  if (isAdmin && !input.brand?.trim()) throw badRequest("Indiquez la marque");
  const db = await getDb();
  const id = newId(), title = input.title.trim();
  await db.transaction(async (tx) => {
    const [{ n }] = await tx.select({ n: count() }).from(schema.campaigns);
    // Photo rangée dans la même transaction : aucune image orpheline si la campagne n'est pas créée.
    const image = await storeImage(tx, user.id, input.image, null);
    await tx.insert(schema.campaigns).values({
      id, ownerId: isAdmin ? null : user.id, brand: isAdmin ? input.brand!.trim() : user.name,
      title, category: input.category, rate: input.rate, budget: input.budget,
      minPayout: input.minPayout, maxPayout: input.maxPayout, emoji: input.emoji,
      platforms: input.platforms, rules: input.rules, image, gradient: GRADIENTS[n % GRADIENTS.length],
      status: isAdmin ? "Active" : "En attente", commissionRate: isAdmin ? 0 : settings.commissionRate,
    });
    if (isAdmin) {
      await notifyRole(tx, "clipper", "🎯", `Nouvelle campagne : ${title} (${input.rate} DA /1K).`, link.clipperCampaign(id));
      await logActivity(tx, "🎯", `Campagne « ${title} » publiée.`);
    } else {
      await notify(tx, user.id, "⏳", `Votre campagne « ${title} » est en cours de vérification.`, link.agencyCampaign(id));
      await notifyRole(tx, "admin", "🏢", `${user.name} a soumis la campagne « ${title} ».`, link.adminCampaign(id));
      await logActivity(tx, "🏢", `${user.name} a soumis la campagne « ${title} ».`);
    }
  });
  return id;
}

/**
 * L'agence modifie une campagne pas encore financée : en attente de vérification, ou refusée par l'équipe.
 * Une campagne refusée est alors relancée (de nouveau en attente, motif du refus effacé).
 * La marque reste le nom de l'agence et le dégradé ne change pas.
 */
export async function updateCampaign(user: User, id: string, input: CampaignInput) {
  const settings = await getSettings();
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, id)).for("update");
    if (!c) throw notFound("Campagne introuvable");
    if (c.ownerId !== user.id) throw forbidden();
    // Jamais une campagne qui a été financée (prélèvement à l'approbation) : son budget est engagé.
    if (!EDITABLE.includes(c.status) || c.reserved !== 0 || c.spent !== 0) throw badRequest("Cette campagne ne peut plus être modifiée");
    const error = validateCampaignNumbers(input, settings.minBudget);
    if (error) throw badRequest(error);
    const relaunch = c.status === "Refusée", title = input.title.trim();
    await tx.update(schema.campaigns).set({
      title, category: input.category, rate: input.rate, budget: input.budget, minPayout: input.minPayout, maxPayout: input.maxPayout,
      emoji: input.emoji, platforms: input.platforms, rules: input.rules,
      image: await storeImage(tx, user.id, input.image, c.image),
      // Pas encore financée : la commission prélevée à l'approbation est celle affichée à l'agence dans le formulaire (réglage actuel).
      commissionRate: settings.commissionRate,
      updatedAt: new Date(),
      ...(relaunch ? { status: "En attente" as const, reviewNote: null } : {}),
    }).where(eq(schema.campaigns.id, id));
    if (relaunch) {
      await notify(tx, user.id, "⏳", `Votre campagne « ${title} » a été relancée : elle est en cours de vérification.`, link.agencyCampaign(id));
      await notifyRole(tx, "admin", "✏️", `${user.name} a modifié et relancé la campagne « ${title} ».`, link.adminCampaign(id));
      await logActivity(tx, "✏️", `${user.name} a modifié et relancé la campagne « ${title} ».`);
    } else {
      await notifyRole(tx, "admin", "✏️", `${user.name} a modifié la campagne « ${title} ».`, link.adminCampaign(id));
      await logActivity(tx, "✏️", `${user.name} a modifié la campagne « ${title} ».`);
    }
  });
}

/**
 * L'agence retire une campagne jamais financée : annulation avant la vérification (en attente) ou suppression après un refus.
 * Ses clips et adhésions éventuels disparaissent avec elle (clés étrangères en cascade), ainsi que sa photo.
 */
export async function deleteCampaign(user: User, id: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, id)).for("update");
    if (!c) throw notFound("Campagne introuvable");
    if (c.ownerId !== user.id) throw forbidden();
    if (!EDITABLE.includes(c.status) || c.reserved !== 0 || c.spent !== 0) throw badRequest("Cette campagne ne peut pas être supprimée");
    await tx.delete(schema.campaigns).where(eq(schema.campaigns.id, id));
    await deleteMedia(tx, user.id, c.image);
    // Les notifications déjà reçues sur cette campagne mènent désormais à la liste des campagnes.
    await tx.update(schema.notifications).set({ link: "#/agence/campagnes" }).where(eq(schema.notifications.link, link.agencyCampaign(id)));
    await tx.update(schema.notifications).set({ link: "#/admin/campagnes" }).where(eq(schema.notifications.link, link.adminCampaign(id)));
    if (c.status === "En attente") {
      const text = `${user.name} a annulé la campagne « ${c.title} » avant sa vérification.`;
      await notifyRole(tx, "admin", "🗑️", text, "#/admin/campagnes");
      await logActivity(tx, "🗑️", text);
    } else {
      await logActivity(tx, "🗑️", `${user.name} a supprimé la campagne refusée « ${c.title} ».`);
    }
  });
}

/**
 * Changements de statut.
 * - Admin : approuver (le budget + commission est prélevé sur le crédit de l'agence), refuser une campagne en attente
 *   (avec un motif transmis à l'agence, qui peut la modifier et la relancer), mettre en pause, reprendre, terminer.
 * - Agence : mettre en pause ou reprendre ses propres campagnes actives.
 * Terminer une campagne rend à l'agence le budget non consommé et la commission correspondante.
 */
export async function setCampaignStatus(user: User, id: string, next: CampaignStatus, reason?: string) {
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
    // Refus : seulement avant la mise en ligne. Une campagne active se « termine », ce qui rend son budget à l'agence.
    const note = reason?.trim() ?? "";
    if (next === "Refusée") {
      if (c.status !== "En attente") throw badRequest("Seule une campagne en attente peut être refusée");
      if (note.length < 3) throw badRequest("Indiquez le motif du refus");
    }
    if (c.status === "Terminée" || c.status === "Refusée") throw badRequest("Cette campagne est close");
    // Une campagne en attente est approuvée (et financée à ce moment-là) ou refusée : jamais mise en pause ou terminée,
    // sinon une reprise la mettrait en ligne sans prélever son budget sur le crédit de l'agence.
    if (c.status === "En attente" && next !== "Active" && next !== "Refusée") throw badRequest("Action impossible sur cette campagne");

    const patch: Partial<typeof c> = { status: next };
    if (next === "Refusée") Object.assign(patch, { reviewNote: note, updatedAt: new Date() });
    if (isAdmin && c.status === "En attente" && next === "Active") {
      patch.reviewNote = null;
      if (c.ownerId) {
        const cost = fundingCost(c.budget, c.commissionRate);
        const [owner] = await tx.select().from(schema.users).where(eq(schema.users.id, c.ownerId)).for("update");
        if (owner.credit < cost) throw badRequest(`Crédit de l'agence insuffisant : ${fmt(cost)} nécessaires (budget + ${c.commissionRate} % de commission), ${fmt(owner.credit)} disponibles`);
        await tx.update(schema.users).set({ credit: owner.credit - cost }).where(eq(schema.users.id, owner.id));
        patch.reserved = cost;
      }
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

    if (isAdmin) {
      const verb: Record<string, string> = { Active: c.status === "En attente" ? "a été approuvée et est en ligne" : "est de nouveau active", "En pause": "a été mise en pause", "Terminée": "est terminée" };
      const text = next === "Refusée" ? `Votre campagne « ${c.title} » a été refusée : ${sentence(note)}` : `Votre campagne « ${c.title} » ${verb[next] ?? "a changé de statut"}.`;
      await notify(tx, c.ownerId, next === "Active" ? "✅" : "⚠️", text, link.agencyCampaign(c.id));
    }
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
  await db.update(schema.campaigns).set({ top }).where(eq(schema.campaigns.id, id));
}
