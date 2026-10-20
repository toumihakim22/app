import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { csvFilename } from "@/lib/server/documents";
import { exportTransactions } from "@/lib/server/services/documents";
import { exportSchema } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

/** Export CSV des transactions pour l'équipe (Excel en français) ; filtres facultatifs : type, status, from, to. */
export const GET = route(async (req) => {
  await requireUser("admin");
  const q = req.nextUrl.searchParams;
  const filters = exportSchema.parse({ type: q.get("type"), status: q.get("status"), from: q.get("from"), to: q.get("to") });
  return new Response(await exportTransactions(filters), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename()}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
