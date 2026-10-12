import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { setUserStatus } from "@/lib/server/services/profile";
import { userStatusSchema } from "@/lib/server/validation";

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const admin = await requireUser("admin");
  const { status } = await body(req, userStatusSchema);
  await setUserStatus(admin, (await params).id, status);
  return json({ ok: true });
});
