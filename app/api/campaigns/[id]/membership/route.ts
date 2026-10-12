import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { setMembership } from "@/lib/server/services/campaigns";
import { membershipSchema } from "@/lib/server/validation";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser("clipper");
  await setMembership(user.id, (await params).id, await body(req, membershipSchema));
  return json({ ok: true });
});
