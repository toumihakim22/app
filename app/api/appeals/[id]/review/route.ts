import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { reviewAppeal } from "@/lib/server/services/appeals";
import { reviewAppealSchema } from "@/lib/server/validation";

/** Décision de l'équipe sur un recours : { approve, reason } (motif obligatoire ; acceptation : le clip est validé). */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const admin = await requireUser("admin");
  await reviewAppeal(admin, (await params).id, await body(req, reviewAppealSchema));
  return json({ ok: true });
});
