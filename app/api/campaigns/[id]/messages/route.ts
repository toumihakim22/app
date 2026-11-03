import { route, json, body, rateLimit } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { sendMessage } from "@/lib/server/services/messages";
import { messageSchema } from "@/lib/server/validation";

/**
 * Message d'une conversation de campagne : question du clipper (sa conversation), réponse de l'agence propriétaire ou,
 * pour une campagne de ClipBoost, de l'équipe ({ body, clipperId }). Le service limite à 30 messages par 10 minutes ;
 * la limite ci-dessous compte aussi les envois refusés.
 */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser("clipper", "agence", "admin");
  rateLimit(`message:${user.id}`, 60, 10 * 60_000);
  const { id } = await sendMessage(user, (await params).id, await body(req, messageSchema));
  return json({ ok: true, id }, { status: 201 });
});
