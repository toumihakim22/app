// Messagerie par campagne, version autonome : la copie de lib/server/services/messages.ts (mêmes contrôles, mêmes
// messages, mêmes notifications). La conversation est la paire campagne × clipper.
import { link } from "../../lib/server/links";
import { ASKABLE_STATUSES, clipperMessageText, isTeamCampaign, MESSAGE_LIMIT, MESSAGE_WINDOW_MS, replyText } from "../../lib/server/rules";
import { ApiError, badRequest, forbidden, newId, notFound, notify, notifyRole, type CampaignRow, type Store, type UserRow } from "./db";
import type { Ctx } from "./services";

type Thread = { c: CampaignRow; clipperId: string; team: boolean };
const CLIPPER_VISIBLE = ["Active", "En pause", "Terminée"];

/** Conversation visée et droit d'y accéder (clipper : la sienne ; agence : ses campagnes ; admin : campagnes de ClipBoost). */
function threadFor(db: Store, user: UserRow, campaignId: string, clipperId?: string): Thread {
  const c = db.campaigns.find((x) => x.id === campaignId);
  if (!c) throw notFound("Campagne introuvable");
  const owner = c.ownerId ? db.users.find((u) => u.id === c.ownerId) : undefined;
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

const threadLink = (user: UserRow, t: Thread) =>
  user.role === "clipper" ? link.clipperThread(t.c.id) : user.role === "agence" ? link.agencyThread(t.c.id, t.clipperId) : link.adminThread(t.c.id, t.clipperId);

/** Messages de l'autre côté lus, et notifications de la conversation reçues par le lecteur. */
function readThread(db: Store, user: UserRow, t: Thread) {
  const now = Date.now(), href = threadLink(user, t);
  for (const m of db.messages) {
    if (m.campaignId !== t.c.id || m.clipperId !== t.clipperId || m.readAt !== null) continue;
    if (user.role === "clipper" ? m.senderId !== t.clipperId : m.senderId === t.clipperId) m.readAt = now;
  }
  for (const n of db.notifications) if (n.userId === user.id && n.link === href) n.read = true;
}

/** Nouveau message : question du clipper, ou réponse dans une conversation ouverte par lui ; l'autre côté est prévenu. */
export function sendMessage({ db }: Ctx, user: UserRow, campaignId: string, input: { body: string; clipperId?: string }) {
  const t = threadFor(db, user, campaignId, input.clipperId), c = t.c, fromClipper = user.role === "clipper";
  const since = Date.now() - MESSAGE_WINDOW_MS;
  if (db.messages.filter((m) => m.senderId === user.id && m.createdAt >= since).length >= MESSAGE_LIMIT) throw new ApiError(429, "Trop de messages envoyés, réessayez dans quelques minutes");
  const thread = db.messages.filter((m) => m.campaignId === c.id && m.clipperId === t.clipperId), last = thread[thread.length - 1];
  if (fromClipper && !(ASKABLE_STATUSES as readonly string[]).includes(c.status)) throw badRequest("Cette campagne est terminée : vous ne pouvez plus envoyer de message");
  if (!fromClipper && !last) throw badRequest("Vous pouvez seulement répondre à un clipper qui vous a écrit");
  const body = input.body.trim(), id = newId();
  readThread(db, user, t);
  db.messages.push({ id, campaignId: c.id, clipperId: t.clipperId, senderId: user.id, body, readAt: null, createdAt: Date.now() });
  if (fromClipper) {
    const text = clipperMessageText(user.name, c.title, body, !last || last.senderId !== t.clipperId);
    if (t.team) notifyRole(db, "admin", "💬", text, link.adminThread(c.id, t.clipperId));
    else notify(db, c.ownerId, "💬", text, link.agencyThread(c.id, t.clipperId));
  } else {
    notify(db, t.clipperId, "💬", replyText(t.team ? null : user.name, c.title, body), link.clipperThread(c.id));
  }
  return id;
}

/** Conversation ouverte : messages reçus et notifications de la conversation marqués comme lus. */
export function markThreadRead({ db }: Ctx, user: UserRow, input: { campaignId: string; clipperId?: string }) {
  readThread(db, user, threadFor(db, user, input.campaignId, input.clipperId));
}
