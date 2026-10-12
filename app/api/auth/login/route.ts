import { route, json, body, rateLimit, clientIp } from "@/lib/server/http";
import { login } from "@/lib/server/services/accounts";
import { loginSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const { email, password } = await body(req, loginSchema);
  rateLimit(`login:${clientIp(req)}:${email}`, 10, 15 * 60_000);
  const user = await login(email, password);
  return json({ ok: true, role: user.role });
});
