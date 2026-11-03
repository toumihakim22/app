import { route, json, body, rateLimit } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { submitClip } from "@/lib/server/services/clips";
import { clipSchema } from "@/lib/server/validation";

/** Un clip et ses liens (une ou plusieurs plateformes) : `id` est la première publication créée, `ids` toutes celles du lot. */
export const POST = route(async (req) => {
  const user = await requireUser("clipper");
  rateLimit(`clip:${user.id}`, 30, 60 * 60_000);
  const { id, ids } = await submitClip(user, await body(req, clipSchema));
  return json({ ok: true, id, ids }, { status: 201 });
});
