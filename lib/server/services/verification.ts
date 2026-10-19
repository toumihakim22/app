// Badge de vérification des agences (badge bleu à côté de leur nom) : demande de l'agence, décision de l'équipe.
// Les contrôles de fond (registre du commerce, marque…) viendront plus tard ; pour l'instant l'équipe décide à la main.
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { Verification } from "../db/schema";
import type { User } from "../auth";
import { logActivity, notify, notifyRole } from "../events";
import { badRequest, notFound } from "../http";
import { link } from "../links";
import { sentence } from "../rules";

/** L'agence demande le badge (première demande, ou nouvelle demande après un refus), avec un message facultatif pour l'équipe. */
export async function requestVerification(user: User, message?: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [me] = await tx.select().from(schema.users).where(eq(schema.users.id, user.id)).for("update");
    if (me.verification === "pending") throw badRequest("Votre demande est déjà en cours d'examen");
    if (me.verification === "verified") throw badRequest("Votre agence est déjà vérifiée");
    await tx.update(schema.users).set({ verification: "pending", verificationNote: message?.trim() || null }).where(eq(schema.users.id, me.id));
    const text = `${me.name} demande le badge de vérification.`;
    await notifyRole(tx, "admin", "🛡️", text, link.adminUser(me.id));
    await logActivity(tx, "🛡️", text);
  });
}

/**
 * Décision de l'équipe :
 * - approve : accorde le badge (même sans demande, ou après un refus) ;
 * - reject : refuse une demande en cours, avec un motif transmis à l'agence (qui pourra redemander) ;
 * - revoke : retire le badge, avec un motif facultatif.
 */
export async function reviewVerification(admin: User, id: string, decision: "approve" | "reject" | "revoke", reason?: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, id)).for("update");
    if (!u) throw notFound("Utilisateur introuvable");
    if (u.role !== "agence") throw badRequest("Seules les agences peuvent être vérifiées");
    const note = reason?.trim() ?? "";
    const allowed: Record<typeof decision, Verification[]> = { approve: ["none", "pending", "rejected"], reject: ["pending"], revoke: ["verified"] };
    if (!allowed[decision].includes(u.verification)) throw badRequest("Action impossible pour ce compte");
    const set = (verification: Verification, verificationNote: string | null) =>
      tx.update(schema.users).set({ verification, verificationNote }).where(eq(schema.users.id, u.id));
    if (decision === "approve") {
      await set("verified", null);
      await notify(tx, u.id, "🛡️", "Votre agence est maintenant vérifiée : le badge bleu s'affiche à côté de son nom.", link.agencyProfile());
      await logActivity(tx, "🛡️", `Badge de vérification accordé à ${u.name} par ${admin.name}.`);
    } else if (decision === "reject") {
      if (note.length < 3) throw badRequest("Indiquez le motif du refus");
      await set("rejected", note);
      await notify(tx, u.id, "⚠️", `Votre demande de badge de vérification a été refusée : ${sentence(note)}`, link.agencyProfile());
      await logActivity(tx, "🛡️", `Demande de badge de ${u.name} refusée par ${admin.name}.`);
    } else {
      await set("none", note || null);
      await notify(tx, u.id, "⚠️", note ? `Le badge de vérification de votre agence a été retiré : ${sentence(note)}` : "Le badge de vérification de votre agence a été retiré.", link.agencyProfile());
      await logActivity(tx, "🛡️", `Badge de vérification retiré à ${u.name} par ${admin.name}.`);
    }
  });
}
