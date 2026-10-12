import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { changePassword } from "@/lib/server/services/accounts";
import { changePasswordSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const user = await requireUser();
  const { current, next } = await body(req, changePasswordSchema);
  await changePassword(user.id, current, next);
  return json({ ok: true });
});
