import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { reviewTransaction } from "@/lib/server/services/wallet";
import { approveSchema } from "@/lib/server/validation";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const admin = await requireUser("admin");
  const { approve } = await body(req, approveSchema);
  await reviewTransaction(admin, (await params).id, approve);
  return json({ ok: true });
});
