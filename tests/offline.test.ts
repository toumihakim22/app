import assert from "node:assert/strict";
import { test } from "node:test";
import { offlineApi } from "../web/offline/server";
import { STORAGE_FULL, STORAGE_KEY } from "../web/offline/db";

// API simulée de la version autonome (web/offline/), exécutée dans Node avec un localStorage en mémoire.
// quota : taille maximale d'une valeur enregistrée (simule un stockage plein), sans limite par défaut.
const storage = new Map<string, string>();
let quota = Infinity;
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > quota) throw new DOMException("Quota dépassé", "QuotaExceededError");
      storage.set(k, v);
    },
    removeItem: (k: string) => void storage.delete(k),
  },
});

async function call(method: string, path: string, body?: unknown) {
  const res = await offlineApi.fetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
const login = (email: string, password = "Clipboost2026") => call("POST", "/api/auth/login", { email, password });
const state = async () => (await call("GET", "/api/state")).data;
// Image PNG de 1 × 1 pixel (data URL valide, signature PNG).
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

test("données d'exemple, connexion et contrôle d'accès", async () => {
  const anon = await call("GET", "/api/state");
  assert.equal(anon.data.user, null);
  assert.equal(anon.data.public.campaigns.length, 4);
  assert.deepEqual(anon.data.public.oauth, ["google", "apple", "discord"]);
  assert.equal((await call("POST", "/api/withdrawals", { amount: 2000 })).status, 401);
  assert.deepEqual(await login("yacine@clipboost.dz", "faux"), { status: 400, data: { error: "Email ou mot de passe incorrect" } });
  assert.equal((await login("yacine@clipboost.dz")).status, 200);
  const s = (await call("GET", "/api/state")).data;
  assert.deepEqual([s.me.available, s.me.pending, s.me.earned], [7078, 7230, 14308]);
  // Notifications d'exemple : chacune mène à un élément de l'espace Clipper qui existe.
  type Note = { text: string; link: string | null };
  const ids = new Set([...s.campaigns, ...s.publications, ...s.transactions].map((x: { id: string }) => x.id));
  assert.ok(s.notifications.length > 0);
  for (const n of s.notifications as Note[]) {
    const m = n.link?.match(/^#\/clipper\/(decouvrir|publications|portefeuille)\/([0-9a-z]+)$/);
    assert.ok(m && ids.has(m[2]), `lien de « ${n.text} » : ${n.link}`);
  }
  // Nouveaux champs : badge, photos, langue, lot de publications.
  assert.equal(s.me.emailVerified, true);
  assert.deepEqual([s.me.verified, s.me.avatar, s.me.locale, s.me.hasPassword, s.me.providers], [false, null, "fr", true, []]);
  const goal = s.publications.filter((p: { title: string }) => p.title === "But de la 89e en slow-motion");
  assert.deepEqual(goal.map((p: { platform: string }) => p.platform).sort(), ["Instagram", "TikTok"]);
  assert.ok(goal[0].batch && goal[0].batch === goal[1].batch);
  assert.match(s.campaigns[0].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal((await call("PATCH", "/api/admin/settings", { maintenance: true })).status, 403);
  assert.ok(!JSON.stringify([...storage.values()]).includes("Clipboost2026"), "mot de passe en clair");
});

test("agences des campagnes : profil public pour les clippers, présentation modifiable par l'agence", async () => {
  type Agency = { id: string; name: string; bio: string };
  assert.equal((await login("yacine@clipboost.dz")).status, 200);
  let s = (await call("GET", "/api/state")).data;
  // Seules les agences des campagnes visibles (Hoggar Boissons n'a qu'une campagne en attente) ; aucune donnée privée.
  assert.deepEqual(s.agencies.map((a: Agency) => a.name), ["Djurdjura Médias", "Tassili Sport"]);
  for (const a of s.agencies) assert.deepEqual(Object.keys(a).sort(), ["avatar", "bio", "country", "cover", "id", "joined", "name", "verified"]);
  assert.deepEqual(s.agencies.map((a: { verified: boolean }) => a.verified), [true, false]);
  const tassili = s.agencies.find((a: Agency) => a.name === "Tassili Sport");
  assert.match(tassili.bio, /^Équipementier sportif algérien/);
  assert.ok(s.campaigns.filter((c: { ownerId: string | null }) => c.ownerId === tassili.id).length >= 2);
  assert.ok(s.campaigns.some((c: { ownerId: string | null }) => c.ownerId === null), "campagnes gérées par ClipBoost (organisateur : la marque)");
  assert.ok(!/agence@clipboost\.dz|Nassim|400000/.test(JSON.stringify(s.agencies)));

  const bio = "Équipementier sportif algérien. Nouveaux défis chaque semaine !";
  assert.equal((await login("agence@clipboost.dz")).status, 200);
  assert.equal((await call("PATCH", "/api/me", { bio: "x".repeat(301) })).status, 400);
  assert.equal((await call("PATCH", "/api/me", { bio: `  ${bio}  ` })).status, 200);
  const agency = (await call("GET", "/api/state")).data;
  assert.equal(agency.me.bio, bio);
  assert.deepEqual(agency.agencies, []);
  assert.equal((await login("yacine@clipboost.dz")).status, 200);
  s = (await call("GET", "/api/state")).data;
  assert.equal(s.agencies.find((a: Agency) => a.id === tassili.id).bio, bio);
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
  const { data: { id: clipId } } = await call("POST", "/api/clips", { campaignId, title: "Course dans les dunes", links: [{ platform: "TikTok", url: "https://www.tiktok.com/@x/video/1" }] });
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

  // Liens des notifications : chaque événement mène à l'élément concerné.
  const gain = s.transactions.find((t: { type: string; amount: number }) => t.type === "gain" && t.amount === 6750);
  assert.deepEqual(s.notifications.slice(0, 3).map((n: { link: string }) => n.link), [`#/clipper/portefeuille/${withdrawal.id}`, `#/clipper/portefeuille/${gain.id}`, `#/clipper/decouvrir/${campaignId}`]);
  const linkOf = (list: { text: string; link: string }[], text: RegExp) => list.find((n) => text.test(n.text))?.link;

  await login("admin@clipboost.dz", "AdminClip2026");
  let notes = (await call("GET", "/api/state")).data.notifications;
  assert.equal(linkOf(notes, /^Atlas Média a soumis la campagne/), `#/admin/campagnes/${campaignId}`);
  assert.equal(linkOf(notes, /^Atlas Média annonce une recharge/), `#/admin/retraits/${recharge.id}`);
  assert.equal(linkOf(notes, /^Yacine Benali demande un retrait/), `#/admin/retraits/${withdrawal.id}`);
  // Clip refusé, compte réactivé, fin de campagne (budget rendu).
  await login("yacine@clipboost.dz");
  const { data: { id: refusedId } } = await call("POST", "/api/clips", { campaignId, title: "Hors sujet", links: [{ platform: "TikTok", url: "https://www.tiktok.com/@x/video/2" }] });
  await login("admin@clipboost.dz", "AdminClip2026");
  await call("POST", `/api/clips/${refusedId}/review`, { approve: false, reason: "Hors sujet" });
  const yacine = (await call("GET", "/api/state")).data.users.find((u: { email: string }) => u.email === "yacine@clipboost.dz");
  assert.equal((await call("PATCH", `/api/admin/users/${yacine.id}`, { status: "Actif" })).status, 200);
  assert.equal((await call("PATCH", `/api/campaigns/${campaignId}`, { status: "Terminée" })).status, 200);
  await login("yacine@clipboost.dz");
  notes = (await call("GET", "/api/state")).data.notifications;
  assert.deepEqual(notes.slice(0, 2).map((n: { link: string }) => n.link), ["#/clipper/accueil", `#/clipper/publications/${refusedId}`]);

  await login("atlas@test.dz", "Atlas2026x");
  notes = (await call("GET", "/api/state")).data.notifications;
  assert.equal(linkOf(notes, /en cours de vérification/), `#/agence/campagnes/${campaignId}`);
  assert.equal(linkOf(notes, /^Votre recharge de 250 000 DA a été validé/), `#/agence/budget/${recharge.id}`);
  assert.equal(linkOf(notes, /a été approuvée et est en ligne/), `#/agence/campagnes/${campaignId}`);
  assert.equal(linkOf(notes, /est terminée\.$/), `#/agence/campagnes/${campaignId}`);
  assert.equal(linkOf(notes, /non consommés sur/), `#/agence/budget/${campaignId}`);
});

test("anciennes notifications sans lien : lien déduit du texte", async () => {
  // Copie du navigateur antérieure aux liens : la propriété link n'existe pas dans les notifications enregistrées.
  const accounts: [string, string?][] = [["yacine@clipboost.dz"], ["lina@clipboost.dz"], ["agence@clipboost.dz"], ["atlas@test.dz", "Atlas2026x"], ["admin@clipboost.dz", "AdminClip2026"]];
  const linksOf = async () => {
    const out: Record<string, string | null>[] = [];
    for (const [email, pwd] of accounts) {
      assert.equal((await login(email, pwd)).status, 200, email);
      out.push(Object.fromEntries((await call("GET", "/api/state")).data.notifications.map((n: { id: string; link: string | null }) => [n.id, n.link])));
    }
    return out;
  };
  const before = await linksOf();
  const store = JSON.parse(storage.get(STORAGE_KEY)!);
  // Les demandes de badge sont postérieures aux liens : une ancienne copie n'en contient pas.
  for (const n of store.notifications) if (!/badge de vérification/.test(n.text)) delete n.link;
  storage.set(STORAGE_KEY, JSON.stringify(store));
  const after = await linksOf();
  let exact = 0, total = 0;
  for (const [i, links] of after.entries()) {
    for (const [id, inferred] of Object.entries(links)) {
      const original = before[i][id]!;
      total++;
      if (inferred === original) exact++;
      // Sinon la page de l'élément (demande de retrait, retrait ou recharge traités).
      else assert.ok(inferred && original.startsWith(`${inferred}/`), `${accounts[i][0]} : ${original} -> ${inferred}`);
    }
  }
  assert.ok(total > 20 && exact / total > 0.7, `${exact}/${total} liens exacts`);
});

test("campagne refusée : modification, relance, refus motivé, annulation et suppression", async () => {
  type Campaign = { id: string; title: string; status: string; reviewNote: string | null; updatedAt: string; image: string | null };
  await offlineApi.reset();
  assert.equal((await login("agence@clipboost.dz")).status, 200);
  let s = await state();
  const refused = s.campaigns.find((c: Campaign) => c.status === "Refusée");
  assert.match(refused.reviewNote, /^Les règles doivent préciser/);
  const derby = s.campaigns.find((c: Campaign) => c.title === "Derby Algérois");
  const input = { title: "Coupe d'Algérie 2027", category: "Football de quartier", rate: 130, budget: 250000, minPayout: 260, maxPayout: 26000, emoji: "🏆", platforms: ["TikTok", "Facebook"], rules: ["Finale du 1er mai", "Logo officiel visible"], image: PNG };
  assert.deepEqual(await call("PUT", `/api/campaigns/${derby.id}`, input), { status: 400, data: { error: "Cette campagne ne peut plus être modifiée" } });
  assert.equal((await call("PUT", `/api/campaigns/${refused.id}`, { ...input, category: "Autre" })).status, 400);
  assert.deepEqual(await call("PUT", `/api/campaigns/${refused.id}`, { ...input, image: "/api/media/abcdefghij123456" }), { status: 400, data: { error: "Image invalide" } });
  assert.equal((await call("PUT", `/api/campaigns/${refused.id}`, input)).status, 200);
  s = await state();
  const relaunched = s.campaigns.find((c: Campaign) => c.id === refused.id);
  assert.deepEqual([relaunched.status, relaunched.reviewNote, relaunched.title, relaunched.image], ["En attente", null, "Coupe d'Algérie 2027", PNG]);
  assert.equal(s.notifications[0].text, "Votre campagne « Coupe d'Algérie 2027 » a été relancée : elle est en cours de vérification.");
  // Modification d'une campagne en attente : l'image actuelle est gardée telle quelle.
  assert.equal((await call("PUT", `/api/campaigns/${refused.id}`, { ...input, budget: 260000 })).status, 200);

  await login("admin@clipboost.dz", "AdminClip2026");
  let notes = (await state()).notifications;
  assert.equal(notes[0].text, "Tassili Sport a modifié la campagne « Coupe d'Algérie 2027 ».");
  assert.equal(notes[1].link, `#/admin/campagnes/${refused.id}`);
  assert.equal((await call("PUT", `/api/campaigns/${refused.id}`, input)).status, 403);
  assert.deepEqual(await call("PATCH", `/api/campaigns/${refused.id}`, { status: "Refusée" }), { status: 400, data: { error: "Indiquez le motif du refus" } });
  assert.deepEqual(await call("PATCH", `/api/campaigns/${derby.id}`, { status: "Refusée", reason: "Hors charte" }), { status: 400, data: { error: "Seule une campagne en attente peut être refusée" } });
  assert.equal((await call("PATCH", `/api/campaigns/${refused.id}`, { status: "Refusée", reason: "Logo officiel manquant." })).status, 200);

  await login("agence@clipboost.dz");
  s = await state();
  assert.equal(s.campaigns.find((c: Campaign) => c.id === refused.id).reviewNote, "Logo officiel manquant.");
  assert.equal(s.notifications[0].text, "Votre campagne « Coupe d'Algérie 2027 » a été refusée : Logo officiel manquant.");
  assert.deepEqual(await call("DELETE", `/api/campaigns/${derby.id}`), { status: 400, data: { error: "Cette campagne ne peut pas être supprimée" } });
  assert.equal((await call("DELETE", `/api/campaigns/${refused.id}`)).status, 200);
  assert.ok(!(await state()).campaigns.some((c: Campaign) => c.id === refused.id));

  // Annulation d'une campagne en attente, avant sa vérification.
  assert.equal((await login("hoggar@clipboost.dz")).status, 200);
  const pending = (await state()).campaigns.find((c: Campaign) => c.status === "En attente");
  assert.equal((await call("DELETE", `/api/campaigns/${pending.id}`)).status, 200);
  await login("admin@clipboost.dz", "AdminClip2026");
  notes = (await state()).notifications;
  assert.deepEqual([notes[0].text, notes[0].link], ["Hoggar Boissons a annulé la campagne « Spécial Soirées d'Été » avant sa vérification.", "#/admin/campagnes"]);
});

test("clip publié sur plusieurs plateformes : un lien par plateforme, un seul lot", async () => {
  type Pub = { id: string; batch: string | null; platform: string };
  await login("yacine@clipboost.dz");
  const festival = (await state()).campaigns.find((c: { title: string }) => c.title === "Festival du court-métrage");
  const links = [{ platform: "YouTube", url: "https://youtube.com/shorts/festival1" }, { platform: "Facebook", url: "https://www.facebook.com/reel/festival1" }];
  assert.deepEqual(await call("POST", "/api/clips", { campaignId: festival.id, title: "Le court de clôture", links }), { status: 400, data: { error: "Rejoignez la campagne avant de soumettre un clip" } });
  await call("POST", `/api/campaigns/${festival.id}/membership`, { joined: true });
  assert.deepEqual(await call("POST", "/api/clips", { campaignId: festival.id, title: "Le court", links: [{ platform: "TikTok", url: "https://www.tiktok.com/@x/video/9" }] }), { status: 400, data: { error: "Cette campagne n'accepte pas TikTok" } });
  assert.deepEqual(await call("POST", "/api/clips", { campaignId: festival.id, title: "Le court", links: [{ platform: "Facebook", url: "https://www.instagram.com/reel/9" }] }), { status: 400, data: { error: "Le lien doit être un lien Facebook (https://…)" } });
  const res = await call("POST", "/api/clips", { campaignId: festival.id, title: "Le court de clôture", links });
  assert.equal(res.status, 201);
  assert.equal(res.data.ids.length, 2);
  assert.equal(res.data.id, res.data.ids[0]);
  const pubs = (await state()).publications.filter((p: Pub) => res.data.ids.includes(p.id));
  assert.deepEqual(pubs.map((p: Pub) => p.platform).sort(), ["Facebook", "YouTube"]);
  assert.ok(pubs[0].batch && pubs[0].batch === pubs[1].batch);
  const again = await call("POST", "/api/clips", { campaignId: festival.id, title: "Doublon", links: [links[1]] });
  assert.deepEqual(again, { status: 400, data: { error: "Ce lien a déjà été soumis : https://www.facebook.com/reel/festival1" } });
});

test("badge de vérification : demande de l'agence, décision de l'équipe", async () => {
  await login("agence@clipboost.dz");
  assert.equal((await call("POST", "/api/verification", { message: "Marque déposée." })).status, 200);
  assert.deepEqual(await call("POST", "/api/verification", {}), { status: 400, data: { error: "Votre demande est déjà en cours d'examen" } });
  const tassili = (await state()).me;
  assert.deepEqual([tassili.verification, tassili.verificationNote, tassili.verified], ["pending", "Marque déposée.", false]);

  await login("admin@clipboost.dz", "AdminClip2026");
  const s = await state();
  assert.deepEqual([s.notifications[0].text, s.notifications[0].link], ["Tassili Sport demande le badge de vérification.", `#/admin/utilisateur/${tassili.id}`]);
  const yacine = s.users.find((u: { email: string }) => u.email === "yacine@clipboost.dz");
  assert.deepEqual(await call("POST", `/api/admin/users/${yacine.id}/verification`, { decision: "approve" }), { status: 400, data: { error: "Seules les agences peuvent être vérifiées" } });
  assert.deepEqual(await call("POST", `/api/admin/users/${tassili.id}/verification`, { decision: "reject" }), { status: 400, data: { error: "Indiquez le motif du refus" } });
  assert.deepEqual(await call("POST", `/api/admin/users/${tassili.id}/verification`, { decision: "revoke" }), { status: 400, data: { error: "Action impossible pour ce compte" } });
  assert.equal((await call("POST", `/api/admin/users/${tassili.id}/verification`, { decision: "approve" })).status, 200);

  await login("yacine@clipboost.dz");
  assert.equal((await state()).agencies.find((a: { id: string }) => a.id === tassili.id).verified, true);
  await login("agence@clipboost.dz");
  assert.deepEqual(await call("POST", "/api/verification", {}), { status: 400, data: { error: "Votre agence est déjà vérifiée" } });
  assert.equal((await state()).notifications[0].link, "#/agence/profil");
});

test("profil : photo, couverture, langue ; recharge par carte Visa / Mastercard", async () => {
  await login("agence@clipboost.dz");
  assert.equal((await call("PATCH", "/api/me", { avatar: PNG, cover: PNG, locale: "ar" })).status, 200);
  let me = (await state()).me;
  assert.deepEqual([me.avatar, me.cover, me.locale], [PNG, PNG, "ar"]);
  assert.deepEqual(await call("PATCH", "/api/me", { avatar: PNG.replace("iVBORw0KGgo", "AAAAAAAAAAA") }), { status: 400, data: { error: "Image invalide (JPEG, PNG ou WebP)" } });
  assert.equal((await call("PATCH", "/api/me", { avatar: "", cover: null })).status, 200);
  me = (await state()).me;
  assert.deepEqual([me.avatar, me.cover], [null, null]);
  // Couverture réservée aux agences : ignorée pour un clipper.
  await login("lina@clipboost.dz");
  assert.equal((await call("PATCH", "/api/me", { avatar: PNG, cover: PNG })).status, 200);
  me = (await state()).me;
  assert.deepEqual([me.avatar, me.cover], [PNG, null]);

  await login("djurdjura@clipboost.dz");
  assert.equal((await call("POST", "/api/credit", { amount: 50000, method: "carte Visa / Mastercard" })).status, 400);
  const { data: { ref } } = await call("POST", "/api/credit", { amount: 50000, method: "carte Visa / Mastercard", card: { brand: "Visa", last4: "4242" } });
  const tx = (await state()).transactions.find((t: { ref: string }) => t.ref === ref);
  assert.deepEqual([tx.label, tx.method, tx.status], ["Recharge par carte Visa / Mastercard · Visa •••• 4242", "carte Visa / Mastercard", "En cours"]);
});

test("connexion Google, Apple ou Discord simulée et mot de passe défini ensuite", async () => {
  await call("POST", "/api/auth/logout");
  const google = { provider: "google", name: "Sofiane Haddad", email: "Sofiane@Gmail.com" };
  assert.deepEqual(await call("POST", "/api/auth/oauth/demo", { ...google, mode: "login" }), { status: 400, data: { error: "Aucun compte ClipBoost n'est associé à cette adresse. Inscrivez-vous d'abord." } });
  assert.deepEqual(await call("POST", "/api/auth/oauth/demo", { ...google, email: "admin@clipboost.dz" }), { status: 403, data: { error: "Les comptes administrateurs se connectent avec leur mot de passe." } });
  assert.deepEqual(await call("POST", "/api/auth/oauth/demo", { ...google, role: "agence" }), { status: 200, data: { ok: true, role: "agence" } });
  let me = (await state()).me;
  assert.deepEqual([me.email, me.name, me.hasPassword, me.providers, me.country], ["sofiane@gmail.com", "Sofiane Haddad", false, ["google"], "Algérie"]);
  // Sans mot de passe : la connexion par mot de passe échoue proprement, puis il en définit un sans l'ancien.
  assert.deepEqual(await login("sofiane@gmail.com", ""), { status: 400, data: { error: "Mot de passe obligatoire" } });
  assert.deepEqual(await login("sofiane@gmail.com", "Nimporte1"), { status: 400, data: { error: "Email ou mot de passe incorrect" } });
  await call("POST", "/api/auth/oauth/demo", { ...google, mode: "login" });
  assert.equal((await call("POST", "/api/auth/password", { next: "Sofiane2026" })).status, 200);
  assert.equal((await state()).me.hasPassword, true);
  assert.deepEqual(await call("POST", "/api/auth/password", { next: "Sofiane2027" }), { status: 400, data: { error: "Mot de passe actuel incorrect" } });
  assert.equal((await login("sofiane@gmail.com", "Sofiane2026")).status, 200);
  // Un compte existant avec cet email est relié au fournisseur, quel que soit le mode.
  assert.deepEqual(await call("POST", "/api/auth/oauth/demo", { provider: "discord", name: "Yacine", email: "yacine@clipboost.dz", mode: "login" }), { status: 200, data: { ok: true, role: "clipper" } });
  me = (await state()).me;
  assert.deepEqual([me.name, me.providers, me.hasPassword], ["Yacine Benali", ["discord"], true]);
});

test("ancienne copie du navigateur : colonnes ajoutées complétées ; stockage plein : requête annulée", async () => {
  // Copie enregistrée par la version précédente du fichier : sans les nouvelles colonnes ni la table oauth.
  const store = JSON.parse(storage.get(STORAGE_KEY)!);
  delete store.oauth;
  for (const u of store.users) for (const k of ["avatar", "cover", "verification", "verificationNote", "locale"]) delete u[k];
  for (const c of store.campaigns) for (const k of ["image", "reviewNote", "updatedAt"]) delete c[k];
  for (const p of store.publications) delete p.batch;
  storage.set(STORAGE_KEY, JSON.stringify(store));
  await login("agence@clipboost.dz");
  const s = await state();
  assert.deepEqual([s.me.avatar, s.me.verification, s.me.locale, s.me.providers], [null, "none", "fr", []]);
  assert.ok(s.campaigns.every((c: { updatedAt: string; createdAt: string }) => c.updatedAt.startsWith(c.createdAt)));

  const saved = storage.get(STORAGE_KEY)!;
  quota = saved.length + 100;
  // Image valide (signature PNG) mais trop lourde pour la place restante.
  assert.deepEqual(await call("PATCH", "/api/me", { avatar: PNG.slice(0, -2) + "A".repeat(400) }), { status: 413, data: { error: STORAGE_FULL } });
  assert.equal(storage.get(STORAGE_KEY), saved);
  quota = Infinity;
  assert.equal((await state()).me.avatar, null);
});

test("réinitialisation : retour aux données d'exemple", async () => {
  await offlineApi.reset();
  assert.equal((await call("GET", "/api/state")).data.user, null);
  assert.equal((await login("atlas@test.dz", "Atlas2026x")).status, 400);
});
