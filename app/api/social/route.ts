import { route, json, body, rateLimit } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { addSocialAccount } from "@/lib/server/services/social";
import { socialAccountSchema } from "@/lib/server/validation";

/** Le clipper ajoute son compte d'une plateforme : `{ id, code }`, le code « CB-XXXX » à coller dans la bio du compte. */
export const POST = route(async (req) => {
  const user = await requireUser("clipper");
  rateLimit(`social:${user.id}`, 30, 60 * 60_000);
  const { id, code } = await addSocialAccount(user, await body(req, socialAccountSchema));
  return json({ ok: true, id, code }, { status: 201 });
});
