import { route, json } from "@/lib/server/http";
import { destroySession } from "@/lib/server/auth";

export const POST = route(async () => {
  await destroySession();
  return json({ ok: true });
});
