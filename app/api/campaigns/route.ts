import { route, json, body } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { createCampaign } from "@/lib/server/services/campaigns";
import { campaignSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const user = await requireUser("agence", "admin");
  const id = await createCampaign(user, await body(req, campaignSchema));
  return json({ ok: true, id }, { status: 201 });
});
