import { route, json, body } from "@/lib/server/http";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { markNotificationsRead } from "@/lib/server/services/profile";

export const POST = route(async (req) => {
  const user = await requireUser();
  const { ids } = await body(req, z.object({ ids: z.array(z.string()).optional() }));
  await markNotificationsRead(user.id, ids);
  return json({ ok: true });
});
