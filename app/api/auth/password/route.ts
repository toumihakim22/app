import { route, json, body, rateLimit } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { changePassword } from "@/lib/server/services/accounts";
import { changePasswordSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const user = await requireUser();
  // Le mot de passe actuel ne se devine pas depuis une session ouverte : essais limités par compte.
  rateLimit(`password:${user.id}`, 10, 15 * 60_000);
  const { current, next } = await body(req, changePasswordSchema);
  await changePassword(user.id, current, next);
  return json({ ok: true });
});
