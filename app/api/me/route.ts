import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { updateProfile } from "@/lib/server/services/profile";
import { profileSchema } from "@/lib/server/validation";

export const PATCH = route(async (req) => {
  const user = await requireUser();
  await updateProfile(user, await body(req, profileSchema));
  return json({ ok: true });
});
