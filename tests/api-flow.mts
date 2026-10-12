// Parcours complet de l'API contre un serveur lancé (BASE_URL, par défaut http://localhost:3100).
// Usage : npm run dev puis `npx tsx tests/api-flow.mts`. Nécessite les données d'exemple (npm run db:seed:demo).
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const ADMIN = { email: process.env.ADMIN_EMAIL ?? "admin@clipboost.dz", password: process.env.ADMIN_PASSWORD ?? "AdminClip2026" };

function client() {
  let cookie = "";
  return async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", cookie, origin: BASE }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = await res.json();
    return { status: res.status, data };
  };
}
const ok = (r: { status: number; data: { error?: string } }, label: string) => assert.ok(r.status < 300, `${label} : ${r.status} ${r.data.error ?? ""}`);
const step = (s: string) => console.log("✓", s);

const stamp = Date.now();

// 1. Inscription d'une agence avec code email.
const agency = client();
let r = await agency("POST", "/api/auth/signup", { role: "agence", name: `Atlas Média ${stamp}`, contact: "Sara B", email: `atlas${stamp}@test.dz`, country: "Algérie", password: "Atlas2026x", terms: true });
ok(r, "inscription"); assert.match(r.data.devCode, /^\d{6}$/);
assert.equal((await agency("POST", "/api/auth/verify", { email: `atlas${stamp}@test.dz`, code: "000000" === r.data.devCode ? "111111" : "000000" })).status, 400);
ok(await agency("POST", "/api/auth/verify", { email: `atlas${stamp}@test.dz`, code: r.data.devCode }), "vérification");
r = await agency("GET", "/api/state"); assert.equal(r.data.me.role, "agence"); step("inscription agence + code email");

// 2. Règles de campagne : plafond > seuil, budget minimum.
assert.equal((await agency("POST", "/api/campaigns", { title: "Test", category: "Sport", rate: 150, budget: 60000, minPayout: 300, maxPayout: 200, platforms: ["TikTok"], rules: [] })).status, 400);
assert.equal((await agency("POST", "/api/campaigns", { title: "Test", category: "Sport", rate: 150, budget: 1000, minPayout: 300, maxPayout: 600, platforms: ["TikTok"], rules: [] })).status, 400);
r = await agency("POST", "/api/campaigns", { title: "Défi Sahara", category: "Sport", rate: 200, budget: 100000, minPayout: 400, maxPayout: 20000, emoji: "🏜️", platforms: ["TikTok", "Instagram"], rules: ["Mentionner @atlas"] });
ok(r, "création campagne"); const campaignId = r.data.id; step("campagne créée (en attente), règles vérifiées");

// 3. Admin : approbation impossible sans crédit, puis recharge confirmée, puis approbation (budget + 15 %).
const admin = client();
ok(await admin("POST", "/api/auth/login", ADMIN), "connexion admin");
r = await admin("PATCH", `/api/campaigns/${campaignId}`, { status: "Active" });
assert.equal(r.status, 400); assert.match(r.data.error, /insuffisant/);
r = await agency("POST", "/api/credit", { amount: 120000, method: "virement bancaire" }); ok(r, "demande de recharge");
let st = await admin("GET", "/api/state");
const recharge = st.data.transactions.find((t: { ref: string }) => t.ref === r.data.ref);
ok(await admin("POST", `/api/transactions/${recharge.id}/review`, { approve: true }), "recharge confirmée");
ok(await admin("PATCH", `/api/campaigns/${campaignId}`, { status: "Active" }), "approbation");
r = await agency("GET", "/api/state"); assert.equal(r.data.me.credit, 120000 - 115000); step("recharge confirmée, campagne approuvée, 115 000 DA prélevés");

// 4. Clipper : inscription, rejoindre, soumettre un clip (lien vérifié).
const clipper = client();
r = await clipper("POST", "/api/auth/signup", { role: "clipper", name: "Rayan Test", email: `rayan${stamp}@test.dz`, country: "Algérie", password: "Rayan2026x", terms: true });
ok(await clipper("POST", "/api/auth/verify", { email: `rayan${stamp}@test.dz`, code: r.data.devCode }), "vérif clipper");
assert.equal((await clipper("POST", "/api/clips", { campaignId, title: "Mon clip", platform: "TikTok", url: "https://www.tiktok.com/@r/video/1" })).status, 400);
ok(await clipper("POST", `/api/campaigns/${campaignId}/membership`, { joined: true }), "rejoindre");
assert.equal((await clipper("POST", "/api/clips", { campaignId, title: "Mon clip", platform: "TikTok", url: "https://evil.example/video" })).status, 400);
r = await clipper("POST", "/api/clips", { campaignId, title: "Mon clip", platform: "TikTok", url: `https://www.tiktok.com/@r/video/${stamp}` }); ok(r, "soumission");
const clipId = r.data.id; step("clipper inscrit, campagne rejointe, clip soumis (lien contrôlé)");

// 5. Seuil : refus de validation sous le seuil, puis vues relevées, validation, plafond.
await admin("POST", `/api/clips/${clipId}/views`, { views: 1500 });
r = await admin("POST", `/api/clips/${clipId}/review`, { approve: true }); assert.equal(r.status, 400); assert.match(r.data.error, /Seuil/);
ok(await admin("POST", `/api/clips/${clipId}/views`, { views: 50000 }), "vues");
ok(await admin("POST", `/api/clips/${clipId}/review`, { approve: true }), "validation");
r = await clipper("GET", "/api/state");
assert.equal(r.data.me.pending, 10000); assert.equal(r.data.me.available, 0);
ok(await admin("POST", `/api/clips/${clipId}/views`, { views: 400000 }), "vues +");
r = await clipper("GET", "/api/state"); assert.equal(r.data.me.pending, 20000);
step("seuil appliqué, 10 000 DA crédités, plafond de 20 000 DA respecté, gains en rétention");

// 6. Retrait impossible pendant la rétention et sans moyen de paiement.
r = await clipper("POST", "/api/withdrawals", { amount: 5000, instant: false }); assert.equal(r.status, 400); assert.match(r.data.error, /moyen de retrait/);
ok(await clipper("PATCH", "/api/me", { payoutMethod: "BaridiMob", payoutAccount: "00799999000000000001" }), "profil");
r = await clipper("POST", "/api/withdrawals", { amount: 5000, instant: false }); assert.equal(r.status, 400); assert.match(r.data.error, /insuffisant/);
step("retrait bloqué pendant la rétention");

// 7. Sécurité : rôles, CSRF, suspension.
assert.equal((await clipper("POST", `/api/clips/${clipId}/review`, { approve: true })).status, 403);
assert.equal((await agency("PATCH", "/api/admin/settings", { maintenance: true })).status, 403);
const csrf = await fetch(`${BASE}/api/campaigns`, { method: "POST", headers: { "Content-Type": "application/json", origin: "https://evil.example" }, body: "{}" });
assert.equal(csrf.status, 403);
st = await admin("GET", "/api/state");
const rayan = st.data.users.find((u: { email?: string }) => u.email === `rayan${stamp}@test.dz`);
ok(await admin("PATCH", `/api/admin/users/${rayan.id}`, { status: "Suspendu" }), "suspension");
r = await clipper("GET", "/api/state"); assert.equal(r.data.user, null);
step("rôles, protection CSRF et suspension vérifiés");

// 8. Fin de campagne : remboursement du budget non consommé.
const before = (await agency("GET", "/api/state")).data.me.credit;
ok(await admin("PATCH", `/api/campaigns/${campaignId}`, { status: "Terminée" }), "terminer");
const after = (await agency("GET", "/api/state")).data.me.credit;
assert.equal(after - before, Math.round(80000 * 1.15)); step("campagne terminée, 92 000 DA rendus à l'agence");

console.log("\nParcours API complet : OK");
