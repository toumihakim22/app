import { route, json, body, rateLimit } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { submitAppeal } from "@/lib/server/services/appeals";
import { appealSchema } from "@/lib/server/validation";

/** Recours du clipper contre le refus de son clip (une seule fois par clip) : message et capture d'écran. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser("clipper");
  rateLimit(`appeal:${user.id}`, 10, 60 * 60_000);
  const { id } = await submitAppeal(user, (await params).id, await body(req, appealSchema));
  return json({ ok: true, id }, { status: 201 });
});
