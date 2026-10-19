import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { transactionDocument } from "@/lib/server/services/documents";

export const dynamic = "force-dynamic";

/** Facture (recharge) ou reçu (retrait) d'une transaction validée, en PDF : pour son titulaire ou l'équipe. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requireUser();
  const { bytes, filename } = await transactionDocument(user, (await params).id);
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
