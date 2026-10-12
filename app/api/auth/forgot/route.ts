import { route, json, body, rateLimit, clientIp } from "@/lib/server/http";
import { requestPasswordReset } from "@/lib/server/services/accounts";
import { forgotSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60_000);
  const { email } = await body(req, forgotSchema);
  const { devCode } = await requestPasswordReset(email);
  return json({ ok: true, devCode });
});
