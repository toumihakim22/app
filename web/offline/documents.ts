// Factures, reçus et export CSV, version autonome : la copie de lib/server/services/documents.ts sur la base locale,
// avec le même module de mise en page (lib/server/documents.ts) et le même générateur de PDF (lib/server/pdf.ts).
// Pas de variables d'environnement hors ligne : les mentions COMPANY_* de l'émetteur sont omises.
import {
  companyFrom, documentFilename, documentKindOf, documentNumber, documentPdf, documentSeq, exportRange, transactionsCsv, type ExportFilters,
} from "../../lib/server/documents";
import { newId, notFound, type Store, type TxRow, type UserRow } from "./db";

/**
 * Facture (recharge) ou reçu (retrait) d'une transaction qui devient « Validé » : numéro suivant de la suite du type et de
 * l'année. Les requêtes hors ligne passent l'une après l'autre (server.ts) : pas de numéro pris deux fois.
 */
export function issueDocument(db: Store, t: TxRow) {
  const kind = documentKindOf(t.type);
  if (!kind) return null;
  const existing = db.documents.find((d) => d.transactionId === t.id);
  if (existing) return existing.number;
  const now = Date.now(), year = new Date(now).getUTCFullYear(), prefix = documentNumber(kind, year, 0).slice(0, -5);
  const last = db.documents.filter((d) => d.number.startsWith(prefix)).reduce((m, d) => Math.max(m, documentSeq(d.number)), 0);
  const number = documentNumber(kind, year, last + 1);
  db.documents.push({ id: newId(), number, kind, transactionId: t.id, userId: t.userId, amount: Math.abs(t.amount), createdAt: now });
  return number;
}

/** PDF du document d'une transaction, pour son titulaire ou l'équipe (sinon 404). */
export function transactionDocument(db: Store, user: UserRow, txId: string) {
  const t = db.transactions.find((x) => x.id === txId);
  if (!t || (user.role !== "admin" && t.userId !== user.id)) throw notFound("Transaction introuvable");
  const doc = db.documents.find((d) => d.transactionId === txId);
  const owner = db.users.find((u) => u.id === t.userId);
  if (!doc || !owner) throw notFound("Aucun document pour cette transaction");
  const bytes = documentPdf({
    kind: doc.kind, number: doc.number, locale: owner.locale, issuedAt: new Date(doc.createdAt), company: companyFrom({}),
    customer: { name: owner.name, email: owner.email, contact: owner.role === "agence" ? owner.contact : null },
    transaction: { ref: t.ref, label: t.label, amount: t.amount, fee: t.fee, method: t.method, provider: t.provider, createdAt: new Date(t.createdAt) },
  });
  return { bytes, filename: documentFilename(doc.number) };
}

/** Export CSV de toutes les transactions (gains compris) selon les filtres, de la plus ancienne à la plus récente. */
export function exportTransactions(db: Store, filters: ExportFilters) {
  const { from, to } = exportRange(filters);
  const rows = db.transactions
    .filter((t) => (!filters.type || t.type === filters.type) && (!filters.status || t.status === filters.status) && (from === null || t.createdAt >= from) && (to === null || t.createdAt < to))
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return transactionsCsv(rows.flatMap((t) => {
    const u = db.users.find((x) => x.id === t.userId);
    if (!u) return [];
    return [{
      ref: t.ref, createdAt: new Date(t.createdAt), type: t.type, userName: u.name, email: u.email, role: u.role, label: t.label, amount: t.amount, fee: t.fee,
      status: t.status, method: t.method, document: db.documents.find((d) => d.transactionId === t.id)?.number ?? null,
    }];
  }));
}
