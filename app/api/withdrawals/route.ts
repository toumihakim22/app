import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { requestWithdrawal } from "@/lib/server/services/wallet";
import { withdrawSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const user = await requireUser("clipper");
  const { amount, instant } = await body(req, withdrawSchema);
  await requestWithdrawal(user, amount, instant);
  return json({ ok: true }, { status: 201 });
});
