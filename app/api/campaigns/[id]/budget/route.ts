import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { addBudget } from "@/lib/server/services/campaigns";
import { amountSchema } from "@/lib/server/validation";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser("agence");
  const { amount } = await body(req, amountSchema);
  await addBudget(user, (await params).id, amount);
  return json({ ok: true });
});
