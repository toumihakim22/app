import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { Handles, Locale } from "../db/schema";
import type { User } from "../auth";
import { logActivity, notify } from "../events";
import { badRequest, notFound } from "../http";
import { link } from "../links";
import { storeImage } from "../media";

export type ProfileInput = {
  name?: string; contact?: string; country?: string; bio?: string; handles?: Handles; payoutMethod?: string; payoutAccount?: string;
  avatar?: string | null; cover?: string | null; locale?: Locale;
};

/**
 * Profil du compte connecté. Tous les comptes (admin compris) : nom, pays, photo de profil, langue de l'interface.
 * Agence : contact, présentation, photo de couverture. Clipper : présentation, comptes sociaux, moyen de retrait.
 */
export async function updateProfile(user: User, input: ProfileInput) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    // Ligne relue sous verrou : l'image remplacée est bien la dernière enregistrée (et supprimée).
    const [me] = await tx.select().from(schema.users).where(eq(schema.users.id, user.id)).for("update");
    const patch: Partial<typeof schema.users.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.country !== undefined) patch.country = input.country;
    if (input.locale !== undefined) patch.locale = input.locale;
    if (input.avatar !== undefined) patch.avatar = await storeImage(tx, me.id, input.avatar, me.avatar);
    if (me.role === "agence") {
      if (input.contact !== undefined) patch.contact = input.contact.trim();
      if (input.cover !== undefined) patch.cover = await storeImage(tx, me.id, input.cover, me.cover);
    }
    // Bio : présentation du clipper (vue par les marques) ou de l'agence (vue par les clippers sur sa page).
    if (input.bio !== undefined && (me.role === "clipper" || me.role === "agence")) patch.bio = input.bio.trim();
    if (me.role === "clipper") {
      if (input.handles !== undefined) patch.handles = input.handles;
      if (input.payoutMethod !== undefined) patch.payoutMethod = input.payoutMethod;
      if (input.payoutAccount !== undefined) patch.payoutAccount = input.payoutAccount.trim();
    }
    if (patch.name === "") throw badRequest("Le nom est obligatoire");
    if (!Object.keys(patch).length) return;
    await tx.update(schema.users).set(patch).where(eq(schema.users.id, me.id));
    // Les campagnes d'une agence portent son nom (marque affichée aux clippers).
    if (me.role === "agence" && patch.name && patch.name !== me.name) {
      await tx.update(schema.campaigns).set({ brand: patch.name }).where(eq(schema.campaigns.ownerId, me.id));
    }
  });
}

export async function setUserStatus(admin: User, id: string, status: "Actif" | "Suspendu") {
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!u) throw notFound("Utilisateur introuvable");
  if (u.role === "admin") throw badRequest("Un administrateur ne peut pas être suspendu");
  await db.update(schema.users).set({ status }).where(eq(schema.users.id, id));
  if (status === "Suspendu") await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
  await notify(db, id, status === "Actif" ? "✅" : "⛔", status === "Actif" ? "Votre compte a été réactivé." : "Votre compte a été suspendu.", link.home(u.role));
  await logActivity(db, status === "Actif" ? "✅" : "⛔", `${u.name} a été ${status === "Actif" ? "réactivé" : "suspendu"} par ${admin.name}.`);
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  const db = await getDb();
  const mine = eq(schema.notifications.userId, userId);
  await db.update(schema.notifications).set({ read: true }).where(ids?.length ? and(mine, inArray(schema.notifications.id, ids)) : mine);
}
