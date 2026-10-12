import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { logActivity } from "@/lib/server/events";
import { getDb } from "@/lib/server/db";
import { saveSettings } from "@/lib/server/settings";
import { settingsSchema } from "@/lib/server/validation";

export const PATCH = route(async (req) => {
  const admin = await requireUser("admin");
  const patch = await body(req, settingsSchema);
  await saveSettings(patch);
  await logActivity(await getDb(), "⚙️", `Réglages modifiés par ${admin.name} : ${Object.keys(patch).join(", ")}.`);
  return json({ ok: true });
});
