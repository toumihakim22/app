import { requireUser } from "@/lib/server/auth";
import { route, json, body, forbidden } from "@/lib/server/http";
import { setCampaignStatus, setTop } from "@/lib/server/services/campaigns";
import { campaignStatusSchema } from "@/lib/server/validation";

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser("agence", "admin");
  const { id } = await params;
  const { status, top } = await body(req, campaignStatusSchema);
  if (top !== undefined) {
    if (user.role !== "admin") throw forbidden();
    await setTop(id, top);
  }
  if (status) await setCampaignStatus(user, id, status);
  return json({ ok: true });
});
