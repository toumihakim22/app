import { route, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { removeSocialAccount } from "@/lib/server/services/social";

/** Le clipper retire l'un de ses comptes sociaux (en attente ou vérifié). */
export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requireUser("clipper");
  await removeSocialAccount(user, (await params).id);
  return json({ ok: true });
});
