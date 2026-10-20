// Factures et reçus des transactions (lib/server/documents.ts pour la mise en page) et export CSV pour l'équipe.
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { User } from "../auth";
import type { Tx } from "../events";
import { notFound } from "../http";
import { newId } from "../ids";
import {
  companyFrom, documentFilename, documentKindOf, documentNumber, documentPdf, documentSeq, exportRange, transactionsCsv, type ExportFilters,
} from "../documents";

const D = schema.documents, T = schema.transactions;
type Transaction = typeof T.$inferSelect;

/**
 * Facture (recharge) ou reçu (retrait) d'une transaction qui devient « Validé », dans la transaction SQL de l'appelant :
 * validateRecharge (services/wallet.ts) pour une recharge, reviewTransaction pour un retrait. Numéro suivant de la suite
 * du type et de l'année : un verrou de transaction PostgreSQL par suite évite que deux validations simultanées prennent
 * le même numéro (index unique en dernier recours). Sans effet si la transaction a déjà son document.
 */
export async function issueDocument(tx: Tx, t: Transaction) {
  const kind = documentKindOf(t.type);
  if (!kind) return null;
  const [existing] = await tx.select({ number: D.number }).from(D).where(eq(D.transactionId, t.id));
  if (existing) return existing.number;
  const now = new Date(), year = now.getUTCFullYear(), prefix = documentNumber(kind, year, 0).slice(0, -5);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clipboost-documents:${prefix}`}))`);
  const [last] = await tx.select({ number: D.number }).from(D).where(sql`${D.number} like ${`${prefix}%`}`).orderBy(desc(sql`length(${D.number})`), desc(D.number)).limit(1);
  const number = documentNumber(kind, year, documentSeq(last?.number ?? "") + 1);
  await tx.insert(D).values({ id: newId(), number, kind, transactionId: t.id, userId: t.userId, amount: Math.abs(t.amount), createdAt: now });
  return number;
}

/** Numéros des documents des transactions données (GET /api/state : bouton de téléchargement des lignes validées). */
export async function documentNumbers(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const db = await getDb();
  const rows = await db.select({ id: D.transactionId, number: D.number }).from(D).where(inArray(D.transactionId, ids));
  return new Map(rows.map((r) => [r.id, r.number]));
}

/**
 * PDF du document d'une transaction, pour son titulaire ou l'équipe (sinon 404, comme une transaction inconnue).
 * Le PDF est dans la langue du titulaire (français pour l'arabe) ; les mentions de l'émetteur viennent de COMPANY_*.
 */
export async function transactionDocument(user: User, txId: string) {
  const db = await getDb();
  const [row] = await db.select({ t: T, owner: schema.users }).from(T).innerJoin(schema.users, eq(T.userId, schema.users.id)).where(eq(T.id, txId));
  if (!row || (user.role !== "admin" && row.t.userId !== user.id)) throw notFound("Transaction introuvable");
  const [doc] = await db.select().from(D).where(eq(D.transactionId, txId));
  if (!doc) throw notFound("Aucun document pour cette transaction");
  const { t, owner } = row;
  const bytes = documentPdf({
    kind: doc.kind, number: doc.number, locale: owner.locale, issuedAt: doc.createdAt, company: companyFrom(process.env),
    customer: { name: owner.name, email: owner.email, contact: owner.role === "agence" ? owner.contact : null },
    transaction: { ref: t.ref, label: t.label, amount: t.amount, fee: t.fee, method: t.method, provider: t.provider, createdAt: t.createdAt },
  });
  return { bytes, filename: documentFilename(doc.number) };
}

/** Export CSV de toutes les transactions (gains compris) selon les filtres, de la plus ancienne à la plus récente. */
export async function exportTransactions(filters: ExportFilters) {
  const db = await getDb();
  const { from, to } = exportRange(filters);
  const where = and(
    filters.type ? eq(T.type, filters.type) : undefined,
    filters.status ? eq(T.status, filters.status) : undefined,
    from !== null ? gte(T.createdAt, new Date(from)) : undefined,
    to !== null ? lt(T.createdAt, new Date(to)) : undefined,
  );
  const rows = await db.select({ t: T, name: schema.users.name, email: schema.users.email, role: schema.users.role, document: D.number })
    .from(T).innerJoin(schema.users, eq(T.userId, schema.users.id)).leftJoin(D, eq(D.transactionId, T.id))
    .where(where).orderBy(asc(T.createdAt), asc(T.id));
  return transactionsCsv(rows.map(({ t, name, email, role, document }) => ({
    ref: t.ref, createdAt: t.createdAt, type: t.type, userName: name, email, role, label: t.label, amount: t.amount, fee: t.fee, status: t.status, method: t.method, document,
  })));
}
