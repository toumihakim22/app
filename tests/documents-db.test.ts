// Factures et reçus côté serveur, sur une base PGlite neuve dans un dossier temporaire : rattrapage de la migration 0007
// (documents des recharges et retraits déjà validés), numéros suivants à la validation (reviewTransaction,
// settleOnlinePayment), PDF du titulaire ou de l'équipe, export CSV filtré.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { getDb, schema } from "../lib/server/db";
import { exportTransactions, transactionDocument } from "../lib/server/services/documents";
import { settleOnlinePayment } from "../lib/server/services/payments";
import { reviewTransaction } from "../lib/server/services/wallet";

const dir = mkdtempSync(join(tmpdir(), "clipboost-documents-"));
process.env.PGLITE_DIR = join(dir, "db");
after(() => rmSync(dir, { recursive: true, force: true }));

const T = schema.transactions, D = schema.documents;
const user = (id: string, role: "clipper" | "agence" | "admin", locale: "fr" | "en" | "ar" = "fr") =>
  ({ id, role, email: `${id}@test.dz`, passwordHash: "", name: id === "admin" ? "Équipe" : `Compte ${id}`, locale });
const tx = (id: string, userId: string, type: "recharge" | "retrait" | "gain", amount: number, status: "Validé" | "En cours" | "Refusé", createdAt: string, extra: Partial<typeof T.$inferInsert> = {}) =>
  ({ id, ref: `T-${id.toUpperCase().padEnd(6, "0").slice(0, 6)}`, userId, type, amount, status, label: type === "retrait" ? "Retrait vers CCP" : "Recharge par virement bancaire", method: type === "retrait" ? "CCP" : "virement bancaire", createdAt: new Date(createdAt), ...extra });

test("migration 0007 : documents des recharges et retraits déjà validés, par type et par année", async () => {
  // Base au schéma d'avant (migrations 0000 à 0006), avec des transactions déjà traitées.
  const old = join(dir, "drizzle-0006");
  cpSync("drizzle", old, { recursive: true });
  const journal = JSON.parse(readFileSync(join(old, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.filter((e: { idx: number }) => e.idx <= 6);
  writeFileSync(join(old, "meta/_journal.json"), JSON.stringify(journal));
  const client = new PGlite(process.env.PGLITE_DIR);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: old });
  // Comptes écrits en SQL : la table users du schéma actuel a des colonnes plus récentes que la migration 0006 (parrainage).
  for (const u of [user("ag", "agence", "en"), user("cl", "clipper"), user("admin", "admin")]) {
    await client.query(`insert into users (id, role, email, password_hash, name, locale) values ($1, $2, $3, $4, $5, $6)`, [u.id, u.role, u.email, u.passwordHash, u.name, u.locale]);
  }
  await db.insert(T).values([
    tx("r1", "ag", "recharge", 100000, "Validé", "2025-12-30T10:00:00Z"),
    tx("r2", "ag", "recharge", 200000, "Validé", "2026-01-05T10:00:00Z"),
    tx("r3", "ag", "recharge", 300000, "Validé", "2026-02-05T10:00:00Z"),
    tx("r4", "ag", "recharge", 50000, "Refusé", "2026-02-06T10:00:00Z"),
    tx("w1", "cl", "retrait", -3000, "Validé", "2026-03-01T10:00:00Z", { fee: 100 }),
    tx("g1", "cl", "gain", 5000, "Validé", "2026-02-20T10:00:00Z", { label: "Derby", method: null }),
  ]);
  await migrate(db, { migrationsFolder: "drizzle" });
  const docs = await db.select().from(D).orderBy(D.number);
  assert.deepEqual(docs.map((d) => [d.transactionId, d.number, d.kind, d.amount]), [
    ["r1", "FAC-2025-00001", "facture", 100000], ["r2", "FAC-2026-00001", "facture", 200000], ["r3", "FAC-2026-00002", "facture", 300000], ["w1", "REC-2026-00001", "recu", 3000],
  ]);
  assert.deepEqual(docs.map((d) => d.createdAt.toISOString().slice(0, 10)), ["2025-12-30", "2026-01-05", "2026-02-05", "2026-03-01"]);
  // Migration 0010 : code de parrainage des clippers déjà inscrits (empreinte md5 de l'identifiant), aucun pour les autres.
  const codes = Object.fromEntries((await db.select({ id: schema.users.id, code: schema.users.referralCode }).from(schema.users)).map((u) => [u.id, u.code]));
  assert.match(codes.cl ?? "", /^[0-9A-F]{8}$/);
  assert.deepEqual([codes.ag, codes.admin], [null, null]);
  await client.close();
});

test("validation : facture ou reçu au numéro suivant, PDF du titulaire ou de l'équipe, export CSV", async () => {
  const db = await getDb();
  const year = new Date().getUTCFullYear();
  const [admin] = await db.select().from(schema.users).where(eq(schema.users.id, "admin"));
  const [agency] = await db.select().from(schema.users).where(eq(schema.users.id, "ag"));
  const [clipper] = await db.select().from(schema.users).where(eq(schema.users.id, "cl"));
  const now = new Date().toISOString();
  await db.insert(T).values([
    tx("r5", "ag", "recharge", 70000, "En cours", now), tx("r6", "ag", "recharge", 80000, "En cours", now),
    tx("r7", "ag", "recharge", 90000, "En cours", now, { provider: "chargily", label: "Recharge par carte CIB", method: "carte CIB" }),
    tx("w2", "cl", "retrait", -2000, "En cours", now), tx("w3", "cl", "retrait", -2500, "En cours", now),
  ]);
  // Deux validations simultanées : deux numéros distincts qui se suivent.
  await Promise.all([reviewTransaction(admin, "r5", true), reviewTransaction(admin, "r6", true)]);
  assert.equal(await settleOnlinePayment("r7", true), true);
  await reviewTransaction(admin, "w2", true);
  await reviewTransaction(admin, "w3", false);
  const numberOf = async (id: string) => (await db.select({ n: D.number }).from(D).where(eq(D.transactionId, id)))[0]?.n ?? null;
  const base = year === 2026 ? 2 : 0;
  assert.deepEqual((await Promise.all(["r5", "r6"].map(numberOf))).sort(), [`FAC-${year}-${String(base + 1).padStart(5, "0")}`, `FAC-${year}-${String(base + 2).padStart(5, "0")}`]);
  assert.equal(await numberOf("r7"), `FAC-${year}-${String(base + 3).padStart(5, "0")}`);
  assert.equal(await numberOf("w2"), `REC-${year}-${String((year === 2026 ? 1 : 0) + 1).padStart(5, "0")}`);
  assert.equal(await numberOf("w3"), null);
  // Le crédit de l'agence suit les recharges validées (validateRecharge).
  assert.equal((await db.select().from(schema.users).where(eq(schema.users.id, "ag")))[0].credit, 70000 + 80000 + 90000);

  // PDF : titulaire (agence en anglais) ou équipe ; un autre compte, ou une transaction sans document : 404.
  const pdf = await transactionDocument(agency, "r7");
  assert.equal(pdf.filename, `${await numberOf("r7")}.pdf`);
  const text = Buffer.from(pdf.bytes).toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4") && text.endsWith("%%EOF\n"));
  assert.ok(text.includes(Buffer.from("INVOICE", "latin1").toString("hex")), "PDF en anglais (langue du compte)");
  assert.equal((await transactionDocument(admin, "w2")).filename, `${await numberOf("w2")}.pdf`);
  await assert.rejects(transactionDocument(clipper, "r7"), { message: "Transaction introuvable" });
  await assert.rejects(transactionDocument(clipper, "w3"), { message: "Aucun document pour cette transaction" });

  // Export : tout (gains compris), puis filtré.
  const all = (await exportTransactions({})).slice(1).trim().split("\r\n");
  assert.equal(all.length, 1 + 11);
  assert.ok(all.some((l) => l.startsWith("T-G10000;20/02/2026;10:00;Gain;Compte cl;cl@test.dz;Clipper;Derby;5000;0;Validé;;")));
  const fac = (await exportTransactions({ type: "recharge", status: "Validé", from: "2026-01-01", to: "2026-02-28" })).slice(1).trim().split("\r\n").slice(1);
  assert.deepEqual(fac.map((l) => l.split(";")[12]), ["FAC-2026-00001", "FAC-2026-00002"]);
});
