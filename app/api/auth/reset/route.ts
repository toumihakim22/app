import { route, json, body, rateLimit, clientIp } from "@/lib/server/http";
import { resetPassword } from "@/lib/server/services/accounts";
import { resetSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000);
  const { email, code, password } = await body(req, resetSchema);
  await resetPassword(email, code, password);
  return json({ ok: true });
});
