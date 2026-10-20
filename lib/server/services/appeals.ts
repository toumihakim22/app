import { eq } from "drizzle-orm";
import { getDb, isUniqueViolation, schema } from "../db";
import type { User } from "../auth";
import { logActivity, notify, notifyRole } from "../events";
import { badRequest, notFound } from "../http";
import { newId } from "../ids";
import { link } from "../links";
import { storeImage } from "../media";
import { sentence } from "../rules";
import { getSettings } from "../settings";
import { validateClip } from "./clips";

const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/\u202f|\xa0/g, " ")} DA`;

/**
 * Recours d'un clipper contre le refus de son clip : seulement sur un clip refusé, et une seule fois (« Vous avez déjà
 * contesté ce clip », même après un recours refusé ; index unique sur le clip). La preuve (capture d'écran) est rangée
 * dans la table media comme les autres images. Les admins sont prévenus, avec un lien vers le recours.
 */
export async function submitAppeal(user: User, publicationId: string, input: { message: string; proof: string }) {
  const db = await getDb();
  const id = newId(), A = schema.appeals, P = schema.publications;
  try {
    await db.transaction(async (tx) => {
      const [p] = await tx.select().from(P).where(eq(P.id, publicationId)).for("update");
      if (!p || p.userId !== user.id) throw notFound("Clip introuvable");
      if (p.status !== "Refusée") throw badRequest("Seul un clip refusé peut être contesté");
      const [previous] = await tx.select({ id: A.id }).from(A).where(eq(A.publicationId, p.id));
      if (previous) throw badRequest("Vous avez déjà contesté ce clip");
      const proof = await storeImage(tx, user.id, input.proof, null);
      if (!proof) throw badRequest("Ajoutez une capture d'écran comme preuve");
      await tx.insert(A).values({ id, publicationId: p.id, userId: user.id, message: input.message.trim(), proof });
      await notifyRole(tx, "admin", "⚖️", `${user.name} conteste le refus du clip « ${p.title} ».`, link.adminAppeal(id));
      await logActivity(tx, "⚖️", `${user.name} a contesté le refus du clip « ${p.title} ».`);
    });
  } catch (err) {
    // Deux envois simultanés du même recours : le second bute sur l'index unique du clip.
    if (isUniqueViolation(err)) throw badRequest("Vous avez déjà contesté ce clip");
    throw err;
  }
  return { id };
}

/**
 * Décision de l'équipe sur un recours en attente, motif obligatoire. Accepté : le clip est validé par la même règle
 * qu'une validation normale (validateClip : campagne qui paie encore, seuil atteint, gain crédité) ; si c'est
 * impossible, l'erreur est renvoyée et le recours reste en attente (l'équipe peut alors le refuser). Refusé : le clip
 * reste refusé, définitivement. Le clipper reçoit la décision et son motif (lien vers le clip).
 */
export async function reviewAppeal(admin: User, id: string, input: { approve: boolean; reason: string }) {
  const db = await getDb();
  const settings = await getSettings();
  const A = schema.appeals, P = schema.publications;
  await db.transaction(async (tx) => {
    const [a] = await tx.select().from(A).where(eq(A.id, id)).for("update");
    if (!a) throw notFound("Recours introuvable");
    if (a.status !== "En attente") throw badRequest("Ce recours a déjà été traité");
    const [p] = await tx.select().from(P).where(eq(P.id, a.publicationId)).for("update");
    const [u] = await tx.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, a.userId));
    const reason = input.reason.trim(), who = u?.name ?? "";
    if (input.approve) {
      const amount = await validateClip(tx, p, settings.holdDays);
      await tx.update(A).set({ status: "Acceptée", decisionNote: reason, decidedBy: admin.id, decidedAt: new Date() }).where(eq(A.id, id));
      await notify(tx, p.userId, "✅", `Recours accepté pour « ${p.title} » : le clip est validé. ${sentence(reason)}`, link.clip(p.id));
      await logActivity(tx, "✅", `Recours de ${who} sur « ${p.title} » accepté par ${admin.name} : clip validé (${fmt(amount)}).`);
    } else {
      await tx.update(A).set({ status: "Refusée", decisionNote: reason, decidedBy: admin.id, decidedAt: new Date() }).where(eq(A.id, id));
      await notify(tx, p.userId, "⚠️", `Recours refusé pour « ${p.title} » : ${sentence(reason)}`, link.clip(p.id));
      await logActivity(tx, "🚫", `Recours de ${who} sur « ${p.title} » refusé par ${admin.name}.`);
    }
  });
}
