import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { Handles } from "../db/schema";
import type { User } from "../auth";
import { logActivity, notify } from "../events";
import { badRequest, notFound } from "../http";

export async function updateProfile(user: User, input: { name?: string; contact?: string; country?: string; bio?: string; handles?: Handles; payoutMethod?: string; payoutAccount?: string }) {
  const db = await getDb();
  const patch: Partial<typeof schema.users.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.country !== undefined) patch.country = input.country;
  if (user.role === "agence" && input.contact !== undefined) patch.contact = input.contact.trim();
  if (user.role === "clipper") {
    if (input.bio !== undefined) patch.bio = input.bio.trim();
    if (input.handles !== undefined) patch.handles = input.handles;
    if (input.payoutMethod !== undefined) patch.payoutMethod = input.payoutMethod;
    if (input.payoutAccount !== undefined) patch.payoutAccount = input.payoutAccount.trim();
  }
  if (patch.name === "") throw badRequest("Le nom est obligatoire");
  await db.update(schema.users).set(patch).where(eq(schema.users.id, user.id));
  if (user.role === "agence" && patch.name && patch.name !== user.name) {
    await db.update(schema.campaigns).set({ brand: patch.name }).where(eq(schema.campaigns.ownerId, user.id));
  }
}

export async function setUserStatus(admin: User, id: string, status: "Actif" | "Suspendu") {
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!u) throw notFound("Utilisateur introuvable");
  if (u.role === "admin") throw badRequest("Un administrateur ne peut pas être suspendu");
  await db.update(schema.users).set({ status }).where(eq(schema.users.id, id));
  if (status === "Suspendu") await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
  await notify(db, id, status === "Actif" ? "✅" : "⛔", status === "Actif" ? "Votre compte a été réactivé." : "Votre compte a été suspendu.");
  await logActivity(db, status === "Actif" ? "✅" : "⛔", `${u.name} a été ${status === "Actif" ? "réactivé" : "suspendu"} par ${admin.name}.`);
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  const db = await getDb();
  const mine = eq(schema.notifications.userId, userId);
  await db.update(schema.notifications).set({ read: true }).where(ids?.length ? and(mine, inArray(schema.notifications.id, ids)) : mine);
}
