import { requireUser } from "@/lib/server/auth";
import { route, json, body, forbidden } from "@/lib/server/http";
import { deleteCampaign, setCampaignStatus, setTop, updateCampaign } from "@/lib/server/services/campaigns";
import { campaignSchema, campaignStatusSchema } from "@/lib/server/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Statut (admin : approuver, refuser avec motif, mettre en pause, terminer ; agence : pause et reprise) et mise en avant (admin). */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser("agence", "admin");
  const { id } = await params;
  const { status, top, reason } = await body(req, campaignStatusSchema);
  if (top !== undefined) {
    if (user.role !== "admin") throw forbidden();
    await setTop(id, top);
  }
  if (status) await setCampaignStatus(user, id, status, reason);
  return json({ ok: true });
});

/** L'agence modifie sa campagne en attente de vérification, ou modifie et relance sa campagne refusée. */
export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireUser("agence");
  const { id } = await params;
  await updateCampaign(user, id, await body(req, campaignSchema));
  return json({ ok: true });
});

/** L'agence annule sa campagne avant la vérification, ou supprime sa campagne refusée. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser("agence");
  await deleteCampaign(user, (await params).id);
  return json({ ok: true });
});
