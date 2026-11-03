import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { reviewVerification } from "@/lib/server/services/verification";
import { verificationReviewSchema } from "@/lib/server/validation";

/** L'équipe accorde, refuse (motif obligatoire) ou retire le badge de vérification d'une agence. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const admin = await requireUser("admin");
  const { decision, reason } = await body(req, verificationReviewSchema);
  await reviewVerification(admin, (await params).id, decision, reason);
  return json({ ok: true });
});
