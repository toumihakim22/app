import { eq, sql } from "drizzle-orm";
import { schema } from "../db";
import type { Tx } from "../events";

/** Soldes d'un clipper, en DA. */
export async function balances(db: Tx, userId: string) {
  const t = schema.transactions;
  const now = new Date();
  const [row] = await db
    .select({
      available: sql<number>`coalesce(sum(case when ${t.type} = 'gain' and ${t.status} = 'Validé' and ${t.availableAt} <= ${now} then ${t.amount} when ${t.type} = 'retrait' and ${t.status} <> 'Refusé' then ${t.amount} else 0 end), 0)`,
      pending: sql<number>`coalesce(sum(case when ${t.type} = 'gain' and ${t.status} = 'Validé' and ${t.availableAt} > ${now} then ${t.amount} else 0 end), 0)`,
      earned: sql<number>`coalesce(sum(case when ${t.type} = 'gain' and ${t.status} = 'Validé' then ${t.amount} else 0 end), 0)`,
    })
    .from(t)
    .where(eq(t.userId, userId));
  return { available: Number(row.available), pending: Number(row.pending), earned: Number(row.earned) };
}
