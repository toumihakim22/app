import { route, json, body, rateLimit, clientIp } from "@/lib/server/http";
import { requestSignup } from "@/lib/server/services/accounts";
import { signupSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  rateLimit(`signup:${clientIp(req)}`, 10, 15 * 60_000);
  const data = await body(req, signupSchema);
  const { email, devCode } = await requestSignup(data);
  return json({ ok: true, email, devCode });
});
