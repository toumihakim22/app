// Recours des clippers contre un clip refusé, version autonome : la copie de lib/server/services/appeals.ts (mêmes
// contrôles, mêmes messages, mêmes effets). La preuve (capture d'écran) est gardée en data URL dans la base du navigateur.
import { link } from "../../lib/server/links";
import { sentence } from "../../lib/server/rules";
import { badRequest, getSettings, logActivity, newId, notFound, notify, notifyRole, type AppealRow, type UserRow } from "./db";
import { storeImage, validateClip, type Ctx } from "./services";

const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/\u202f|\xa0/g, " ")} DA`;

/** Recours sur un clip refusé du clipper, une seule fois par clip (même après un recours refusé) ; les admins sont prévenus. */
export function submitAppeal({ db }: Ctx, user: UserRow, publicationId: string, input: { message: string; proof: string }) {
  const p = db.publications.find((x) => x.id === publicationId);
  if (!p || p.userId !== user.id) throw notFound("Clip introuvable");
  if (p.status !== "Refusée") throw badRequest("Seul un clip refusé peut être contesté");
  if (db.appeals.some((a) => a.publicationId === p.id)) throw badRequest("Vous avez déjà contesté ce clip");
  const proof = storeImage(input.proof, null);
  if (!proof) throw badRequest("Ajoutez une capture d'écran comme preuve");
  const id = newId();
  db.appeals.push({
    id, publicationId: p.id, userId: user.id, message: input.message.trim(), proof, status: "En attente",
    decisionNote: null, decidedBy: null, decidedAt: null, createdAt: Date.now(),
  });
  notifyRole(db, "admin", "⚖️", `${user.name} conteste le refus du clip « ${p.title} ».`, link.adminAppeal(id));
  logActivity(db, "⚖️", `${user.name} a contesté le refus du clip « ${p.title} ».`);
  return id;
}

/**
 * Décision de l'équipe, motif obligatoire. Accepté : le clip est validé comme à une validation normale (validateClip) ;
 * si c'est impossible, l'erreur est renvoyée et rien n'est enregistré (le recours reste en attente). Refusé : définitif.
 */
export function reviewAppeal({ db }: Ctx, admin: UserRow, id: string, input: { approve: boolean; reason: string }) {
  const a = db.appeals.find((x) => x.id === id);
  if (!a) throw notFound("Recours introuvable");
  if (a.status !== "En attente") throw badRequest("Ce recours a déjà été traité");
  const p = db.publications.find((x) => x.id === a.publicationId)!;
  const reason = input.reason.trim(), who = db.users.find((u) => u.id === a.userId)?.name ?? "";
  if (input.approve) {
    const amount = validateClip(db, p, getSettings(db).holdDays);
    Object.assign(a, { status: "Acceptée", decisionNote: reason, decidedBy: admin.id, decidedAt: Date.now() } satisfies Partial<AppealRow>);
    notify(db, p.userId, "✅", `Recours accepté pour « ${p.title} » : le clip est validé. ${sentence(reason)}`, link.clip(p.id));
    logActivity(db, "✅", `Recours de ${who} sur « ${p.title} » accepté par ${admin.name} : clip validé (${fmt(amount)}).`);
  } else {
    Object.assign(a, { status: "Refusée", decisionNote: reason, decidedBy: admin.id, decidedAt: Date.now() } satisfies Partial<AppealRow>);
    notify(db, p.userId, "⚠️", `Recours refusé pour « ${p.title} » : ${sentence(reason)}`, link.clip(p.id));
    logActivity(db, "🚫", `Recours de ${who} sur « ${p.title} » refusé par ${admin.name}.`);
  }
}
