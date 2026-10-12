import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { recordViews } from "@/lib/server/services/clips";
import { viewsSchema } from "@/lib/server/validation";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireUser("admin");
  const { views } = await body(req, viewsSchema);
  await recordViews((await params).id, views);
  return json({ ok: true });
});
