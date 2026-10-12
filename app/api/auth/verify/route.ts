import { route, json, body, rateLimit, clientIp } from "@/lib/server/http";
import { verifySignup } from "@/lib/server/services/accounts";
import { verifySchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  rateLimit(`verify:${clientIp(req)}`, 20, 15 * 60_000);
  const { email, code } = await body(req, verifySchema);
  await verifySignup(email, code);
  return json({ ok: true });
});
