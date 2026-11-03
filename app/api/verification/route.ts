import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { requestVerification } from "@/lib/server/services/verification";
import { verificationRequestSchema } from "@/lib/server/validation";

/** L'agence demande le badge de vérification (message facultatif pour l'équipe). */
export const POST = route(async (req) => {
  const user = await requireUser("agence");
  const { message } = await body(req, verificationRequestSchema);
  await requestVerification(user, message);
  return json({ ok: true });
});
