import { and, count, desc, eq, gte, isNull, ne } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { User } from "../auth";
import { notify, notifyRole, type Tx } from "../events";
import { ApiError, badRequest, forbidden, notFound } from "../http";
import { newId } from "../ids";
import { link } from "../links";
import { ASKABLE_STATUSES, clipperMessageText, isTeamCampaign, MESSAGE_LIMIT, MESSAGE_WINDOW_MS, replyText } from "../rules";

type Campaign = typeof schema.campaigns.$inferSelect;
/** Conversation visée et qui y répond : team, campagne de ClipBoost (les admins répondent), sinon l'agence propriétaire. */
type Thread = { c: Campaign; clipperId: string; team: boolean };

/** Campagnes visibles par un clipper (stateFor) : une conversation n'est possible que sur l'une d'elles. */
const CLIPPER_VISIBLE = ["Active", "En pause", "Terminée"];

/**
 * Conversation (campagne × clipper) et droit d'y accéder. Un clipper : sa propre conversation, sur une campagne qu'il
 * voit (clipperId ignoré). L'agence : une campagne qui lui appartient. Un admin : une campagne de ClipBoost (une agence
 * répond seule à ses clippers). Pour l'agence et l'admin, clipperId désigne la conversation.
 */
async function threadFor(tx: Tx, user: User, campaignId: string, clipperId?: string): Promise<Thread> {
  const [c] = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId));
  if (!c) throw notFound("Campagne introuvable");
  const [owner] = c.ownerId ? await tx.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, c.ownerId)) : [];
  const team = isTeamCampaign(c.ownerId, owner?.role);
  if (user.role === "clipper") {
    if (!CLIPPER_VISIBLE.includes(c.status)) throw notFound("Campagne introuvable");
    return { c, clipperId: user.id, team };
  }
  if (user.role === "agence" && c.ownerId !== user.id) throw notFound("Campagne introuvable");
  if (user.role === "admin" && !team) throw forbidden("Cette campagne appartient à une agence : c'est elle qui répond à ses clippers");
  if (!clipperId) throw badRequest("Conversation introuvable");
  return { c, clipperId, team };
}

/** Lien de la conversation pour son lecteur (notifications à marquer comme lues). */
const threadLink = (user: User, t: Thread) =>
  user.role === "clipper" ? link.clipperThread(t.c.id) : user.role === "agence" ? link.agencyThread(t.c.id, t.clipperId) : link.adminThread(t.c.id, t.clipperId);

/** Les messages de l'autre côté sont lus, ainsi que les notifications de la conversation reçues par le lecteur. */
async function readThread(tx: Tx, user: User, t: Thread) {
  const M = schema.messages, N = schema.notifications;
  const fromOther = user.role === "clipper" ? ne(M.senderId, t.clipperId) : eq(M.senderId, t.clipperId);
  await tx.update(M).set({ readAt: new Date() }).where(and(eq(M.campaignId, t.c.id), eq(M.clipperId, t.clipperId), isNull(M.readAt), fromOther));
  await tx.update(N).set({ read: true }).where(and(eq(N.userId, user.id), eq(N.link, threadLink(user, t)), eq(N.read, false)));
}

/**
 * Nouveau message dans une conversation de campagne. Le clipper pose sa question sur une campagne active ou en pause
 * (rejointe ou non) ; l'agence propriétaire, ou l'équipe pour une campagne de ClipBoost, répond seulement dans une
 * conversation ouverte par le clipper (aucun premier message). Anti-spam : MESSAGE_LIMIT messages par MESSAGE_WINDOW_MS.
 * Répondre vaut lecture des messages reçus. L'autre côté est prévenu (extrait du message, lien vers la conversation).
 */
export async function sendMessage(user: User, campaignId: string, input: { body: string; clipperId?: string }) {
  const db = await getDb();
  const M = schema.messages, id = newId();
  await db.transaction(async (tx) => {
    const t = await threadFor(tx, user, campaignId, input.clipperId), c = t.c, fromClipper = user.role === "clipper";
    const [{ n }] = await tx.select({ n: count() }).from(M).where(and(eq(M.senderId, user.id), gte(M.createdAt, new Date(Date.now() - MESSAGE_WINDOW_MS))));
    if (n >= MESSAGE_LIMIT) throw new ApiError(429, "Trop de messages envoyés, réessayez dans quelques minutes");
    const [last] = await tx.select({ senderId: M.senderId }).from(M).where(and(eq(M.campaignId, c.id), eq(M.clipperId, t.clipperId))).orderBy(desc(M.createdAt)).limit(1);
    if (fromClipper && !(ASKABLE_STATUSES as readonly string[]).includes(c.status)) throw badRequest("Cette campagne est terminée : vous ne pouvez plus envoyer de message");
    if (!fromClipper && !last) throw badRequest("Vous pouvez seulement répondre à un clipper qui vous a écrit");
    const body = input.body.trim();
    await readThread(tx, user, t);
    await tx.insert(M).values({ id, campaignId: c.id, clipperId: t.clipperId, senderId: user.id, body });
    if (fromClipper) {
      const text = clipperMessageText(user.name, c.title, body, !last || last.senderId !== t.clipperId);
      if (t.team) await notifyRole(tx, "admin", "💬", text, link.adminThread(c.id, t.clipperId));
      else await notify(tx, c.ownerId, "💬", text, link.agencyThread(c.id, t.clipperId));
    } else {
      await notify(tx, t.clipperId, "💬", replyText(t.team ? null : user.name, c.title, body), link.clipperThread(c.id));
    }
  });
  return { id };
}

/** Conversation ouverte par son lecteur : messages de l'autre côté lus, notifications de la conversation aussi. */
export async function markThreadRead(user: User, input: { campaignId: string; clipperId?: string }) {
  const db = await getDb();
  await db.transaction(async (tx) => readThread(tx, user, await threadFor(tx, user, input.campaignId, input.clipperId)));
}
