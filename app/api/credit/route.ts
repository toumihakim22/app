import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { requestCredit } from "@/lib/server/services/wallet";
import { creditSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const user = await requireUser("agence");
  const { amount, method } = await body(req, creditSchema);
  const ref = await requestCredit(user, amount, method);
  return json({ ok: true, ref }, { status: 201 });
});
