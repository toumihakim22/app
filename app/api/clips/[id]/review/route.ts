import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { reviewClip } from "@/lib/server/services/clips";
import { reviewClipSchema } from "@/lib/server/validation";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const admin = await requireUser("admin");
  await reviewClip(admin, (await params).id, await body(req, reviewClipSchema));
  return json({ ok: true });
});
