import assert from "node:assert/strict";
import { test } from "node:test";
import { offlineApi } from "../web/offline/server";

// API simulée de la version autonome (web/offline/), exécutée dans Node avec un localStorage en mémoire.
const storage = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v), removeItem: (k: string) => void storage.delete(k) },
});

async function call(method: string, path: string, body?: unknown) {
  const res = await offlineApi.fetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
const login = (email: string, password = "Clipboost2026") => call("POST", "/api/auth/login", { email, password });

test("données d'exemple, connexion et contrôle d'accès", async () => {
  const anon = await call("GET", "/api/state");
  assert.equal(anon.data.user, null);
  assert.equal(anon.data.public.campaigns.length, 3);
  assert.equal((await call("POST", "/api/withdrawals", { amount: 2000 })).status, 401);
  assert.deepEqual(await login("yacine@clipboost.dz", "faux"), { status: 400, data: { error: "Email ou mot de passe incorrect" } });
  assert.equal((await login("yacine@clipboost.dz")).status, 200);
  const s = (await call("GET", "/api/state")).data;
  assert.deepEqual([s.me.available, s.me.pending, s.me.earned], [7078, 7230, 14308]);
  assert.equal((await call("PATCH", "/api/admin/settings", { maintenance: true })).status, 403);
  assert.ok(!JSON.stringify([...storage.values()]).includes("Clipboost2026"), "mot de passe en clair");
});

test("inscription avec code, campagne financée, clip payé et retrait instantané", async () => {
  await call("POST", "/api/auth/logout");
  const signup = await call("POST", "/api/auth/signup", { role: "agence", name: "Atlas Média", contact: "Sara", email: "atlas@test.dz", country: "Algérie", password: "Atlas2026x", terms: true });
  assert.match(signup.data.devCode, /^\d{6}$/);
  assert.deepEqual(await call("POST", "/api/auth/verify", { email: "atlas@test.dz", code: signup.data.devCode === "000000" ? "111111" : "000000" }), { status: 400, data: { error: "Code incorrect" } });
  assert.equal((await call("POST", "/api/auth/verify", { email: "atlas@test.dz", code: signup.data.devCode })).status, 200);
  const campaign = { title: "Défi Sahara", category: "Sport", rate: 150, budget: 200000, minPayout: 300, maxPayout: 20000, platforms: ["TikTok"], rules: [] };
  const { data: { id: campaignId } } = await call("POST", "/api/campaigns", campaign);
  const { data: { ref } } = await call("POST", "/api/credit", { amount: 250000, method: "carte CIB" });
  assert.match(ref, /^T-[0-9A-Z]{6}$/);

  await login("admin@clipboost.dz", "AdminClip2026");
  const recharge = (await call("GET", "/api/state")).data.transactions.find((t: { ref: string }) => t.ref === ref);
  await call("POST", `/api/transactions/${recharge.id}/review`, { approve: true });
  assert.equal((await call("PATCH", `/api/campaigns/${campaignId}`, { status: "Active" })).status, 200);
  const atlas = (await call("GET", "/api/state")).data.users.find((u: { email: string }) => u.email === "atlas@test.dz");
  assert.equal(atlas.credit, 250000 - 230000);

  await login("yacine@clipboost.dz");
  await call("POST", `/api/campaigns/${campaignId}/membership`, { joined: true });
  const { data: { id: clipId } } = await call("POST", "/api/clips", { campaignId, title: "Course dans les dunes", platform: "TikTok", url: "https://www.tiktok.com/@x/video/1" });
  assert.equal((await call("POST", "/api/withdrawals", { amount: 2000, instant: true })).status, 201);

  await login("admin@clipboost.dz", "AdminClip2026");
  await call("POST", `/api/clips/${clipId}/views`, { views: 45000 });
  await call("POST", `/api/clips/${clipId}/review`, { approve: true });
  const withdrawal = (await call("GET", "/api/state")).data.transactions.find((t: { type: string; fee: number }) => t.type === "retrait" && t.fee === 100);
  await call("POST", `/api/transactions/${withdrawal.id}/review`, { approve: true });

  await login("yacine@clipboost.dz");
  const s = (await call("GET", "/api/state")).data;
  assert.equal(s.publications.find((p: { id: string }) => p.id === clipId).paid, 6750);
  assert.deepEqual([s.me.available, s.me.pending, s.me.earned], [7078 - 2000, 7230 + 6750, 14308 + 6750]);
  assert.equal(s.notifications[0].text, "Votre retrait de 2 000 DA a été validé (1 900 DA versés après 100 DA de frais).");
});

test("réinitialisation : retour aux données d'exemple", async () => {
  await offlineApi.reset();
  assert.equal((await call("GET", "/api/state")).data.user, null);
  assert.equal((await login("atlas@test.dz", "Atlas2026x")).status, 400);
});
