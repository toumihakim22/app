import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { markThreadRead } from "@/lib/server/services/messages";
import { readThreadSchema } from "@/lib/server/validation";

/** Conversation ouverte : { campaignId, clipperId } (clipperId pour l'agence ou l'équipe) ; messages reçus marqués comme lus. */
export const POST = route(async (req) => {
  const user = await requireUser("clipper", "agence", "admin");
  await markThreadRead(user, await body(req, readThreadSchema));
  return json({ ok: true });
});
