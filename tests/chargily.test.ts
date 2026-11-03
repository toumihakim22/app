// Paiement en ligne Chargily Pay côté serveur, sans réseau : signature des webhooks (lib/server/chargily.ts), route du webhook
// et règlement des recharges (lib/server/services/payments.ts) sur une base PGlite neuve dans un dossier temporaire ;
// l'API de Chargily est remplacée par des réponses types (fetch simulé).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { chargilyApi, createCheckout, parseEvent, signPayload, verifySignature } from "../lib/server/chargily";
import { getDb, schema } from "../lib/server/db";
import { resumeOnlineTopUp, startOnlineTopUp } from "../lib/server/services/payments";
import { POST as webhook } from "../app/api/payments/chargily/webhook/route";

const KEY = "test_sk_clipboost_unit_0123456789";
const dir = mkdtempSync(join(tmpdir(), "clipboost-chargily-"));
process.env.PGLITE_DIR = dir;
process.env.CHARGILY_SECRET_KEY = KEY;

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
after(() => rmSync(dir, { recursive: true, force: true }));

/** fetch simulé : chaque appel est noté, la réponse vient de `reply(url, init)` ([statut, corps JSON]). */
function mockFetch(reply: (url: string, init?: RequestInit) => [number, unknown]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const [status, body] = reply(String(input), init);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

const T = schema.transactions;
let agency: typeof schema.users.$inferSelect;

before(async () => {
  const db = await getDb();
  [agency] = await db.insert(schema.users).values({ id: "agence-test", role: "agence", email: "agence@test.dz", passwordHash: "x", name: "Agence Test", credit: 1000 }).returning();
  await db.insert(schema.users).values({ id: "admin-test", role: "admin", email: "admin@test.dz", passwordHash: "x", name: "Admin Test" });
});

/** Recharge en ligne en cours, payée chez Chargily par le checkout `checkoutId`. */
async function onlineTopUp(id: string, checkoutId: string | null, amount = 50000) {
  const db = await getDb();
  await db.insert(T).values({ id, ref: `T-${id.toUpperCase()}`, userId: agency.id, type: "recharge", label: "Recharge par carte CIB", amount, status: "En cours", method: "carte CIB", provider: "chargily", providerRef: checkoutId });
}
const event = (type: string, checkoutId: string, amount: number, transactionId?: string) =>
  JSON.stringify({ id: `evt_${checkoutId}_${type}`, entity: "event", livemode: "false", type, data: { id: checkoutId, entity: "checkout", status: type.split(".")[1], amount, currency: "dzd", metadata: transactionId ? { transaction_id: transactionId } : [] } });
/** Webhook reçu par la route (corps brut et en-tête « signature »), comme depuis les serveurs de Chargily. */
async function deliver(raw: string, signature: string | null = signPayload(raw, KEY)) {
  const req = new NextRequest("http://localhost:3000/api/payments/chargily/webhook", {
    method: "POST", body: raw, headers: { "Content-Type": "application/json", ...(signature === null ? {} : { signature }) },
  });
  const res = await webhook(req, undefined);
  return { status: res.status, data: await res.json() };
}
const creditOf = async () => (await (await getDb()).select({ credit: schema.users.credit }).from(schema.users).where(eq(schema.users.id, agency.id)))[0].credit;
const statusOf = async (id: string) => (await (await getDb()).select({ status: T.status }).from(T).where(eq(T.id, id)))[0].status;

test("signature : HMAC-SHA256 hexadécimal du corps brut, avec la clé secrète", () => {
  const raw = event("checkout.paid", "chk_sig", 50000);
  const sig = signPayload(raw, KEY);
  assert.match(sig, /^[0-9a-f]{64}$/);
  assert.equal(verifySignature(raw, sig, KEY), true);
  assert.equal(verifySignature(raw, sig.toUpperCase(), KEY), true);
  assert.equal(verifySignature(raw, signPayload(raw, "test_sk_autre_cle"), KEY), false);
  assert.equal(verifySignature(raw.replace("50000", "500000"), sig, KEY), false);
  for (const bad of [null, "", "abc", `${sig}00`, "z".repeat(64)]) assert.equal(verifySignature(raw, bad, KEY), false);
  assert.equal(verifySignature(raw, sig, ""), false);
  assert.equal(chargilyApi("test_sk_x"), "https://pay.chargily.net/test/api/v2");
  assert.equal(chargilyApi("live_sk_x"), "https://pay.chargily.net/api/v2");
  assert.deepEqual(parseEvent(event("checkout.canceled", "chk_1", 10000, "tx1")), { type: "checkout.canceled", checkoutId: "chk_1", paid: false, amount: 10000, transactionId: "tx1" });
  assert.equal(parseEvent("pas du json"), null);
});

test("webhook : signature invalide refusée, paiement crédité une seule fois, échec refusé", async () => {
  await onlineTopUp("tx-paid", "chk_paid");
  const before = await creditOf();
  const raw = event("checkout.paid", "chk_paid", 50000);
  // Signature absente, fausse ou d'un autre corps : 401, rien ne change.
  assert.deepEqual(await deliver(raw, null), { status: 401, data: { error: "Signature invalide" } });
  assert.deepEqual(await deliver(raw, signPayload(raw, "test_sk_pirate")), { status: 401, data: { error: "Signature invalide" } });
  assert.deepEqual(await deliver(raw, signPayload(event("checkout.paid", "chk_paid", 1), KEY)), { status: 401, data: { error: "Signature invalide" } });
  assert.deepEqual([await statusOf("tx-paid"), await creditOf()], ["En cours", before]);
  // Première livraison : recharge validée et crédit ajouté, agence et équipe prévenues.
  assert.deepEqual(await deliver(raw), { status: 200, data: { ok: true, handled: true } });
  assert.deepEqual([await statusOf("tx-paid"), await creditOf()], ["Validé", before + 50000]);
  const db = await getDb();
  const notes = await db.select().from(schema.notifications);
  assert.ok(notes.some((n) => n.userId === agency.id && n.text === "Votre recharge de 50 000 DA a été validée." && n.link === "#/agence/budget/tx-paid"));
  assert.ok(notes.some((n) => n.userId === "admin-test" && n.text === "Agence Test a payé en ligne une recharge de 50 000 DA par carte CIB (réf. T-TX-PAID)."));
  // Deuxième livraison du même webhook (Chargily réessaie) : 200, aucun second crédit.
  assert.deepEqual(await deliver(raw), { status: 200, data: { ok: true, handled: false } });
  assert.equal(await creditOf(), before + 50000);
  // Un échec arrivé après le paiement ne le défait pas.
  assert.deepEqual(await deliver(event("checkout.failed", "chk_paid", 50000)), { status: 200, data: { ok: true, handled: false } });
  assert.equal(await statusOf("tx-paid"), "Validé");

  // Paiement annulé : recharge refusée, sans crédit ; retrouvée par ses métadonnées si son checkout n'est pas encore enregistré.
  await onlineTopUp("tx-canceled", null, 30000);
  assert.deepEqual(await deliver(event("checkout.canceled", "chk_canceled", 30000, "tx-canceled")), { status: 200, data: { ok: true, handled: true } });
  assert.deepEqual([await statusOf("tx-canceled"), await creditOf()], ["Refusé", before + 50000]);
  // Montant différent, checkout inconnu, événement sans intérêt.
  await onlineTopUp("tx-amount", "chk_amount");
  assert.deepEqual(await deliver(event("checkout.paid", "chk_amount", 10)), { status: 400, data: { error: "Montant du paiement inattendu" } });
  assert.equal(await statusOf("tx-amount"), "En cours");
  assert.deepEqual(await deliver(event("checkout.paid", "chk_inconnu", 50000)), { status: 404, data: { error: "Paiement introuvable" } });
  assert.deepEqual(await deliver(event("checkout.pending", "chk_amount", 50000)), { status: 200, data: { ok: true, handled: false } });
});

test("création du paiement chez Chargily, reprise : état relu et réglé", async () => {
  const calls = mockFetch((url, init) => (init?.method === "POST"
    ? [200, { id: "chk_new", entity: "checkout", status: "pending", amount: 75000, checkout_url: "https://pay.chargily.net/test/checkout/chk_new" }]
    : [200, { id: "chk_new", entity: "checkout", status: url.endsWith("chk_new") ? "paid" : "pending", amount: 75000, checkout_url: "https://pay.chargily.net/test/checkout/chk_new" }]));
  const before = await creditOf();
  const started = await startOnlineTopUp(agency, 75000, "carte Edahabia", "https://clipboost.example");
  assert.deepEqual([started.checkoutUrl, started.simulated], ["https://pay.chargily.net/test/checkout/chk_new", false]);
  assert.equal(calls[0].url, "https://pay.chargily.net/test/api/v2/checkouts");
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, `Bearer ${KEY}`);
  const sent = JSON.parse(String(calls[0].init?.body));
  assert.deepEqual(sent, {
    amount: 75000, currency: "dzd", payment_method: "edahabia", success_url: `https://clipboost.example/espace#/agence/budget/${started.id}`,
    failure_url: `https://clipboost.example/espace#/agence/budget/${started.id}`, webhook_endpoint: "https://clipboost.example/api/payments/chargily/webhook",
    locale: "fr", description: `Recharge ClipBoost ${started.ref}`, metadata: { transaction_id: started.id },
  });
  // Webhook perdu : « Reprendre le paiement » relit l'état chez Chargily, payé, la recharge est validée.
  assert.deepEqual(await resumeOnlineTopUp(agency, started.id), { status: "Validé", checkoutUrl: null });
  assert.match(calls[1].url, /\/test\/api\/v2\/checkouts\/chk_new$/);
  assert.deepEqual([await statusOf(started.id), await creditOf()], ["Validé", before + 75000]);

  // Chargily refuse la création : la recharge est effacée (rien n'a été payé), l'erreur renvoyée, rien n'est crédité.
  const rows = async () => (await (await getDb()).select().from(T).where(eq(T.userId, agency.id))).length;
  const count = await rows();
  mockFetch(() => [422, { message: "The amount must be at least 50." }]);
  await assert.rejects(startOnlineTopUp(agency, 75000, "carte CIB", "https://clipboost.example"), (e: Error & { status?: number }) => e.status === 502);
  assert.deepEqual([await rows(), await creditOf()], [count, before + 75000]);
});
