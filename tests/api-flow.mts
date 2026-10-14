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
// Image PNG de 1 × 1 pixel (photo de profil, couverture).
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
// Lien de la notification la plus récente dont le texte correspond.
type Note = { text: string; link: string | null };
const linkOf = (r: { data: { notifications: Note[] } }, text: RegExp) => r.data.notifications.find((n) => text.test(n.text))?.link;

// 1. Inscription d'une agence avec code email.
const agency = client();
let r = await agency("POST", "/api/auth/signup", { role: "agence", name: `Atlas Média ${stamp}`, contact: "Sara B", email: `atlas${stamp}@test.dz`, country: "Algérie", password: "Atlas2026x", terms: true });
ok(r, "inscription"); assert.match(r.data.devCode, /^\d{6}$/);
assert.equal((await agency("POST", "/api/auth/verify", { email: `atlas${stamp}@test.dz`, code: "000000" === r.data.devCode ? "111111" : "000000" })).status, 400);
ok(await agency("POST", "/api/auth/verify", { email: `atlas${stamp}@test.dz`, code: r.data.devCode }), "vérification");
r = await agency("GET", "/api/state"); assert.equal(r.data.me.role, "agence"); step("inscription agence + code email");

// 1 bis. Présentation de l'agence (bio publique, 300 caractères au plus).
assert.equal((await agency("PATCH", "/api/me", { bio: "x".repeat(301) })).status, 400);
ok(await agency("PATCH", "/api/me", { bio: "Agence de contenus sportifs à Alger." }), "présentation de l'agence");
r = await agency("GET", "/api/state"); assert.equal(r.data.me.bio, "Agence de contenus sportifs à Alger."); assert.deepEqual(r.data.agencies, []);
assert.equal(r.data.me.hasPassword, true); assert.deepEqual(r.data.me.providers, []); assert.equal(r.data.me.emailVerified, true);
assert.equal(r.data.me.verification, "none"); assert.equal(r.data.me.verified, false); assert.equal(r.data.me.locale, "fr");
step("présentation de l'agence enregistrée");

// 1 ter. Photo de profil et couverture : contrôle du contenu, adresse /api/media/<id>, ancienne image supprimée ; langue.
assert.equal((await agency("PATCH", "/api/me", { avatar: `data:image/jpeg;base64,${PNG.split(",")[1]}` })).status, 400);
assert.equal((await agency("PATCH", "/api/me", { avatar: "/api/media/aaaaaaaaaaaaaaaa" })).status, 400);
ok(await agency("PATCH", "/api/me", { avatar: PNG, cover: PNG, locale: "en" }), "photo de profil et couverture");
r = await agency("GET", "/api/state");
const firstAvatar = r.data.me.avatar, cover = r.data.me.cover;
assert.match(firstAvatar, /^\/api\/media\/[a-z0-9]{16}$/); assert.match(cover, /^\/api\/media\/[a-z0-9]{16}$/); assert.equal(r.data.me.locale, "en");
const img = await fetch(BASE + firstAvatar);
assert.equal(img.status, 200); assert.equal(img.headers.get("content-type"), "image/png"); assert.match(img.headers.get("cache-control") ?? "", /immutable/);
ok(await agency("PATCH", "/api/me", { avatar: firstAvatar }), "photo inchangée");
ok(await agency("PATCH", "/api/me", { avatar: PNG, cover: "", locale: "fr" }), "nouvelle photo, couverture retirée");
r = await agency("GET", "/api/state");
const avatarUrl = r.data.me.avatar;
assert.notEqual(avatarUrl, firstAvatar); assert.equal(r.data.me.cover, null);
assert.equal((await fetch(BASE + firstAvatar)).status, 404); assert.equal((await fetch(BASE + cover)).status, 404);
assert.equal((await agency("POST", "/api/auth/password", { current: "Mauvais2026", next: "Atlas2027x" })).status, 400);
step("photo de profil enregistrée, images remplacées supprimées, langue mémorisée");

// 2. Règles de campagne : plafond > seuil, budget minimum.
assert.equal((await agency("POST", "/api/campaigns", { title: "Test", category: "Sport", rate: 150, budget: 60000, minPayout: 300, maxPayout: 200, platforms: ["TikTok"], rules: [] })).status, 400);
assert.equal((await agency("POST", "/api/campaigns", { title: "Test", category: "Sport", rate: 150, budget: 1000, minPayout: 300, maxPayout: 600, platforms: ["TikTok"], rules: [] })).status, 400);
r = await agency("POST", "/api/campaigns", { title: "Défi Sahara", category: "Sport", rate: 200, budget: 100000, minPayout: 400, maxPayout: 20000, emoji: "🏜️", platforms: ["TikTok", "Instagram"], rules: ["Mentionner @atlas"] });
ok(r, "création campagne"); const campaignId = r.data.id;
assert.equal(linkOf(await agency("GET", "/api/state"), /en cours de vérification/), `#/agence/campagnes/${campaignId}`);
step("campagne créée (en attente), règles vérifiées");

// 3. Admin : approbation impossible sans crédit, puis recharge confirmée, puis approbation (budget + 15 %).
const admin = client();
ok(await admin("POST", "/api/auth/login", ADMIN), "connexion admin");
r = await admin("PATCH", `/api/campaigns/${campaignId}`, { status: "Active" });
assert.equal(r.status, 400); assert.match(r.data.error, /insuffisant/);
r = await agency("POST", "/api/credit", { amount: 120000, method: "virement bancaire" }); ok(r, "demande de recharge");
let st = await admin("GET", "/api/state");
const recharge = st.data.transactions.find((t: { ref: string }) => t.ref === r.data.ref);
assert.equal(linkOf(st, new RegExp(`^Atlas Média ${stamp} a soumis la campagne`)), `#/admin/campagnes/${campaignId}`);
assert.equal(linkOf(st, new RegExp(`^Atlas Média ${stamp} annonce une recharge`)), `#/admin/retraits/${recharge.id}`);
ok(await admin("POST", `/api/transactions/${recharge.id}/review`, { approve: true }), "recharge confirmée");
ok(await admin("PATCH", `/api/campaigns/${campaignId}`, { status: "Active" }), "approbation");
r = await agency("GET", "/api/state"); assert.equal(r.data.me.credit, 120000 - 115000);
assert.equal(linkOf(r, /^Votre recharge de 120 000 DA a été validé/), `#/agence/budget/${recharge.id}`);
assert.equal(linkOf(r, /a été approuvée et est en ligne/), `#/agence/campagnes/${campaignId}`);
assert.equal(r.data.campaigns.find((c: { id: string }) => c.id === campaignId).reviewNote, null);
step("recharge confirmée, campagne approuvée, 115 000 DA prélevés, notifications liées");

// 3 bis. Recharge par carte Visa / Mastercard : carte obligatoire, ajoutée au libellé, en cours jusqu'à la confirmation.
assert.equal((await agency("POST", "/api/credit", { amount: 50000, method: "carte Visa / Mastercard" })).status, 400);
r = await agency("POST", "/api/credit", { amount: 50000, method: "carte Visa / Mastercard", card: { brand: "Visa", last4: "4242" } }); ok(r, "recharge par carte");
const cardTx = (await agency("GET", "/api/state")).data.transactions.find((t: { ref: string }) => t.ref === r.data.ref);
assert.equal(cardTx.status, "En cours"); assert.equal(cardTx.method, "carte Visa / Mastercard"); assert.equal(cardTx.label, "Recharge par carte Visa / Mastercard · Visa •••• 4242");
ok(await admin("POST", `/api/transactions/${cardTx.id}/review`, { approve: false }), "recharge par carte refusée");
assert.equal((await agency("GET", "/api/state")).data.me.credit, 5000);
step("recharge par carte en attente de confirmation");

// 3 ter. Campagne modifiée avant vérification, refusée avec motif, modifiée et relancée, puis supprimée ; annulation avant vérification.
const draft = { title: "Nuit du Sahara", category: "Événementiel", rate: 180, budget: 80000, minPayout: 360, maxPayout: 18000, emoji: "🌙", platforms: ["TikTok", "Facebook"], rules: ["Montrer le coucher du soleil"] };
assert.equal((await agency("POST", "/api/campaigns", { ...draft, category: "Autre" })).status, 400);
r = await agency("POST", "/api/campaigns", draft); ok(r, "seconde campagne"); const nightId = r.data.id;
const edited = { ...draft, title: "Nuits du Sahara", category: "Astronomie" };
ok(await agency("PUT", `/api/campaigns/${nightId}`, edited), "modification avant vérification");
st = await admin("GET", "/api/state");
assert.equal(linkOf(st, new RegExp(`^Atlas Média ${stamp} a modifié la campagne « Nuits du Sahara »`)), `#/admin/campagnes/${nightId}`);
r = await admin("PATCH", `/api/campaigns/${nightId}`, { status: "Refusée" }); assert.equal(r.status, 400); assert.match(r.data.error, /motif/);
ok(await admin("PATCH", `/api/campaigns/${nightId}`, { status: "Refusée", reason: "Précisez les dates de l'événement" }), "refus avec motif");
type Camp = { id: string; status: string; reviewNote: string | null; category: string; title: string };
r = await agency("GET", "/api/state");
let night: Camp = r.data.campaigns.find((c: Camp) => c.id === nightId);
assert.equal(night.status, "Refusée"); assert.equal(night.reviewNote, "Précisez les dates de l'événement");
assert.equal(linkOf(r, /« Nuits du Sahara » a été refusée : Précisez les dates de l'événement\.$/), `#/agence/campagnes/${nightId}`);
ok(await agency("PUT", `/api/campaigns/${nightId}`, { ...edited, rules: [...edited.rules, "Du 12 au 14 mars"] }), "modification et relance");
r = await agency("GET", "/api/state"); night = r.data.campaigns.find((c: Camp) => c.id === nightId);
assert.equal(night.status, "En attente"); assert.equal(night.reviewNote, null); assert.equal(night.category, "Astronomie");
assert.equal(linkOf(await admin("GET", "/api/state"), /a modifié et relancé la campagne « Nuits du Sahara »/), `#/admin/campagnes/${nightId}`);
ok(await admin("PATCH", `/api/campaigns/${nightId}`, { status: "Refusée", reason: "Dates toujours absentes." }), "second refus");
assert.equal(linkOf(await agency("GET", "/api/state"), /a été refusée : Dates toujours absentes\.$/), `#/agence/campagnes/${nightId}`);
ok(await agency("DELETE", `/api/campaigns/${nightId}`), "suppression de la campagne refusée");
r = await agency("GET", "/api/state"); assert.ok(!r.data.campaigns.some((c: Camp) => c.id === nightId));
// Une campagne en ligne ne peut être ni refusée (elle se termine), ni modifiée, ni supprimée.
assert.equal((await admin("PATCH", `/api/campaigns/${campaignId}`, { status: "Refusée", reason: "Trop tard" })).status, 400);
assert.equal((await agency("PUT", `/api/campaigns/${campaignId}`, draft)).status, 400);
assert.equal((await agency("DELETE", `/api/campaigns/${campaignId}`)).status, 400);
r = await agency("POST", "/api/campaigns", draft); ok(r, "troisième campagne");
ok(await agency("DELETE", `/api/campaigns/${r.data.id}`), "annulation avant vérification");
st = await admin("GET", "/api/state");
assert.ok(st.data.notifications.some((n: Note) => n.text === `Atlas Média ${stamp} a annulé la campagne « Nuit du Sahara » avant sa vérification.`));
step("campagne modifiée, refusée avec motif, relancée puis supprimée ; annulation avant vérification");

// 4. Clipper : inscription, rejoindre, soumettre un clip (lien vérifié).
const clipper = client();
r = await clipper("POST", "/api/auth/signup", { role: "clipper", name: "Rayan Test", email: `rayan${stamp}@test.dz`, country: "Algérie", password: "Rayan2026x", terms: true });
ok(await clipper("POST", "/api/auth/verify", { email: `rayan${stamp}@test.dz`, code: r.data.devCode }), "vérif clipper");
const clip = (links: { platform: string; url: string }[]) => clipper("POST", "/api/clips", { campaignId, title: "Mon clip", links });
assert.equal((await clip([{ platform: "TikTok", url: "https://www.tiktok.com/@r/video/1" }])).status, 400);
ok(await clipper("POST", `/api/campaigns/${campaignId}/membership`, { joined: true }), "rejoindre");
assert.equal((await clip([{ platform: "TikTok", url: "https://evil.example/video" }])).status, 400);
r = await clip([{ platform: "Facebook", url: `https://www.facebook.com/reel/${stamp}` }]); assert.equal(r.status, 400); assert.match(r.data.error, /n'accepte pas Facebook/);
// Le même clip sur TikTok et Instagram : un envoi, deux publications du même lot.
r = await clip([{ platform: "TikTok", url: `https://www.tiktok.com/@r/video/${stamp}` }, { platform: "Instagram", url: `https://www.instagram.com/reel/${stamp}` }]); ok(r, "soumission");
const clipId = r.data.id; assert.equal(r.data.ids.length, 2); assert.equal(r.data.ids[0], clipId);
r = await clip([{ platform: "TikTok", url: `https://www.tiktok.com/@r/video/${stamp}` }]); assert.equal(r.status, 400); assert.match(r.data.error, /déjà été soumis/);
const mine = (await clipper("GET", "/api/state")).data.publications as { id: string; platform: string; batch: string | null }[];
assert.equal(mine.length, 2); assert.ok(mine[0].batch && mine[0].batch === mine[1].batch);
step("clipper inscrit, campagne rejointe, clip soumis sur deux plateformes (liens contrôlés)");

// 4 bis. Le clipper voit l'agence de la campagne : profil public seulement (aucun email, contact ni crédit).
r = await clipper("GET", "/api/state");
const atlas = r.data.agencies.find((a: { id: string }) => a.id === r.data.campaigns.find((c: { id: string }) => c.id === campaignId).ownerId);
assert.deepEqual(atlas, { id: atlas.id, name: `Atlas Média ${stamp}`, country: "Algérie", bio: "Agence de contenus sportifs à Alger.", joined: atlas.joined, avatar: avatarUrl, cover: null, verified: false });
assert.match(atlas.joined, /^\d{4}-\d{2}-\d{2}$/);
for (const a of r.data.agencies) assert.deepEqual(Object.keys(a).sort(), ["avatar", "bio", "country", "cover", "id", "joined", "name", "verified"]);
step("agences visibles par le clipper : profil public uniquement");

// 4 ter. Badge de vérification : demande de l'agence, refus motivé, nouvelle demande, badge accordé, visible des clippers.
const verify = (id: string, body: object) => admin("POST", `/api/admin/users/${id}/verification`, body);
assert.equal((await clipper("POST", "/api/verification", {})).status, 403);
ok(await agency("POST", "/api/verification", { message: "Agence enregistrée à Alger." }), "demande de badge");
assert.equal((await agency("POST", "/api/verification", {})).status, 400);
st = await admin("GET", "/api/state");
const atlasUser = st.data.users.find((u: { email?: string }) => u.email === `atlas${stamp}@test.dz`);
assert.equal(atlasUser.verification, "pending"); assert.equal(atlasUser.verificationNote, "Agence enregistrée à Alger.");
assert.equal(linkOf(st, new RegExp(`^Atlas Média ${stamp} demande le badge de vérification\\.$`)), `#/admin/utilisateur/${atlasUser.id}`);
assert.equal((await verify(atlasUser.id, { decision: "reject" })).status, 400);
assert.equal((await verify(atlasUser.id, { decision: "revoke" })).status, 400);
assert.equal((await verify((await clipper("GET", "/api/state")).data.me.id, { decision: "approve" })).status, 400);
ok(await verify(atlasUser.id, { decision: "reject", reason: "Justificatif manquant" }), "badge refusé");
r = await agency("GET", "/api/state"); assert.equal(r.data.me.verification, "rejected"); assert.equal(r.data.me.verificationNote, "Justificatif manquant");
assert.equal(linkOf(r, /badge de vérification a été refusée : Justificatif manquant\.$/), "#/agence/profil");
ok(await agency("POST", "/api/verification", {}), "nouvelle demande de badge");
ok(await verify(atlasUser.id, { decision: "approve" }), "badge accordé");
r = await agency("GET", "/api/state"); assert.equal(r.data.me.verification, "verified"); assert.equal(r.data.me.verified, true); assert.equal(r.data.me.verificationNote, null);
assert.equal((await agency("POST", "/api/verification", {})).status, 400);
r = await clipper("GET", "/api/state"); assert.equal(r.data.agencies.find((a: { id: string }) => a.id === atlasUser.id).verified, true);
step("badge de vérification demandé, refusé avec motif, redemandé puis accordé");

// 5. Seuil : refus de validation sous le seuil, puis vues relevées, validation, plafond.
await admin("POST", `/api/clips/${clipId}/views`, { views: 1500 });
r = await admin("POST", `/api/clips/${clipId}/review`, { approve: true }); assert.equal(r.status, 400); assert.match(r.data.error, /Seuil/);
ok(await admin("POST", `/api/clips/${clipId}/views`, { views: 50000 }), "vues");
ok(await admin("POST", `/api/clips/${clipId}/review`, { approve: true }), "validation");
r = await clipper("GET", "/api/state");
assert.equal(r.data.me.pending, 10000); assert.equal(r.data.me.available, 0);
const gain = r.data.transactions.find((t: { type: string }) => t.type === "gain");
assert.equal(r.data.notifications[0].link, `#/clipper/portefeuille/${gain.id}`);
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
assert.equal(after - before, Math.round(80000 * 1.15));
r = await agency("GET", "/api/state");
assert.equal(linkOf(r, /non consommés sur/), `#/agence/budget/${campaignId}`);
assert.equal(linkOf(r, /est terminée\.$/), `#/agence/campagnes/${campaignId}`);
step("campagne terminée, 92 000 DA rendus à l'agence");

// 9. Clip refusé : la notification mène au clip ; données d'exemple : chaque notification a son lien.
const yacine = client();
ok(await yacine("POST", "/api/auth/login", { email: "yacine@clipboost.dz", password: "Clipboost2026" }), "connexion yacine");
const derby = (await yacine("GET", "/api/state")).data.campaigns.find((c: { title: string; status: string }) => c.title === "Derby Algérois" && c.status === "Active");
r = await yacine("POST", "/api/clips", { campaignId: derby.id, title: "Hors sujet", links: [{ platform: "TikTok", url: `https://www.tiktok.com/@y/video/${stamp}` }] }); ok(r, "soumission yacine");
const refusedId = r.data.id;
ok(await admin("POST", `/api/clips/${refusedId}/review`, { approve: false, reason: "Hors sujet" }), "refus");
r = await yacine("GET", "/api/state");
assert.equal(r.data.notifications[0].link, `#/clipper/publications/${refusedId}`);
assert.ok(r.data.notifications.every((n: Note) => /^#\/clipper\/(decouvrir|publications|portefeuille|accueil)(\/[0-9a-z]+)?$/.test(n.link ?? "")), "notifications sans lien");
step("notifications liées : clip refusé, données d'exemple");

console.log("\nParcours API complet : OK");
