import assert from "node:assert/strict";
import { test } from "node:test";
import { offlineApi } from "../web/offline/server";
import { load, save, STORAGE_FULL, STORAGE_KEY } from "../web/offline/db";
import { closeWeek } from "../web/offline/leaderboard";
import { weekClosedText, weekKey, weekNumber, weekStart } from "../lib/server/rules";
import { lessonBodyHtml, lessonText, movedOrder } from "../lib/server/academy";

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
// Primes du classement versées à un clipper (gains sans clip) : en rétention ou déjà retirables selon le jour de la semaine
// (la semaine écoulée des données d'exemple est clôturée le lundi, la rétention dure 3 jours).
type Gain = { type: string; label: string; amount: number; availableAt: string | null };
const prizeSplit = (s: { transactions: Gain[] }) => {
  const prizes = s.transactions.filter((t) => t.type === "gain" && /^Prime classement · semaine \d+ \(\d+(er|e)\)$/.test(t.label));
  const held = prizes.filter((t) => Date.parse(t.availableAt!) > Date.now()).reduce((n, t) => n + t.amount, 0);
  return { held, free: prizes.reduce((n, t) => n + t.amount, 0) - held };
};
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
  const prize = prizeSplit(s);
  // Prime de parrainage de 1 000 DA (premier retrait de Karim, il y a 2 jours) : encore en rétention.
  assert.deepEqual([s.me.available, s.me.pending, s.me.earned], [3078 + prize.free, 7230 + 1000 + prize.held, 14308 + 1000 + prize.free + prize.held]);
  // Notifications d'exemple : chacune mène à un élément de l'espace Clipper qui existe.
  type Note = { text: string; link: string | null };
  const ids = new Set([...s.campaigns, ...s.publications, ...s.transactions].map((x: { id: string }) => x.id));
  assert.ok(s.notifications.length > 0);
  for (const n of s.notifications as Note[]) {
    const m = n.link?.match(/^#\/clipper\/(decouvrir|publications|portefeuille|messages)\/([0-9a-z]+)$/);
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
  const { data: { ref } } = await call("POST", "/api/credit", { amount: 250000, method: "virement bancaire" });
  assert.match(ref, /^T-[0-9A-Z]{6}$/);

  await login("admin@clipboost.dz", "AdminClip2026");
  const recharge = (await call("GET", "/api/state")).data.transactions.find((t: { ref: string }) => t.ref === ref);
  await call("POST", `/api/transactions/${recharge.id}/review`, { approve: true });
  assert.equal((await call("PATCH", `/api/campaigns/${campaignId}`, { status: "Active" })).status, 200);
  const atlas = (await call("GET", "/api/state")).data.users.find((u: { email: string }) => u.email === "atlas@test.dz");
  assert.equal(atlas.credit, 250000 - 230000);

  await login("yacine@clipboost.dz");
  await call("POST", `/api/campaigns/${campaignId}/membership`, { joined: true });
  // Un lien TikTok qui nomme un autre compte que le compte vérifié du clipper est refusé.
  assert.deepEqual(await call("POST", "/api/clips", { campaignId, title: "Course dans les dunes", links: [{ platform: "TikTok", url: "https://www.tiktok.com/@x/video/1" }] }), { status: 400, data: { error: "Ce lien ne vient pas de votre compte TikTok vérifié (@yacine.clips)" } });
  const { data: { id: clipId } } = await call("POST", "/api/clips", { campaignId, title: "Course dans les dunes", links: [{ platform: "TikTok", url: "https://www.tiktok.com/@yacine.clips/video/1" }] });
  assert.equal((await call("POST", "/api/withdrawals", { amount: 2000, instant: true })).status, 201);

  await login("admin@clipboost.dz", "AdminClip2026");
  await call("POST", `/api/clips/${clipId}/views`, { views: 45000 });
  await call("POST", `/api/clips/${clipId}/review`, { approve: true });
  const withdrawal = (await call("GET", "/api/state")).data.transactions.find((t: { type: string; fee: number }) => t.type === "retrait" && t.fee === 100);
  await call("POST", `/api/transactions/${withdrawal.id}/review`, { approve: true });

  await login("yacine@clipboost.dz");
  const s = (await call("GET", "/api/state")).data;
  assert.equal(s.publications.find((p: { id: string }) => p.id === clipId).paid, 6750);
  const prize = prizeSplit(s);
  assert.deepEqual([s.me.available, s.me.pending, s.me.earned], [3078 - 2000 + prize.free, 7230 + 1000 + 6750 + prize.held, 14308 + 1000 + 6750 + prize.free + prize.held]);
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
  const { data: { id: refusedId } } = await call("POST", "/api/clips", { campaignId, title: "Hors sujet", links: [{ platform: "TikTok", url: "https://www.tiktok.com/@yacine.clips/video/2" }] });
  await login("admin@clipboost.dz", "AdminClip2026");
  await call("POST", `/api/clips/${refusedId}/review`, { approve: false, reason: "Hors sujet" });
  const yacine = (await call("GET", "/api/state")).data.users.find((u: { email: string }) => u.email === "yacine@clipboost.dz");
  assert.equal((await call("PATCH", `/api/admin/users/${yacine.id}`, { status: "Actif" })).status, 200);
  await login("yacine@clipboost.dz");
  const { data: { id: lateId } } = await call("POST", "/api/clips", { campaignId, title: "Dernier clip", links: [{ platform: "TikTok", url: "https://www.tiktok.com/@yacine.clips/video/3" }] });
  await login("admin@clipboost.dz", "AdminClip2026");
  assert.equal((await call("PATCH", `/api/campaigns/${campaignId}`, { status: "Terminée" })).status, 200);
  // Campagne terminée : budget restant rendu à l'agence, plus aucun clip ne peut être validé ni payé.
  await call("POST", `/api/clips/${lateId}/views`, { views: 90000 });
  assert.deepEqual(await call("POST", `/api/clips/${lateId}/review`, { approve: true }), { status: 400, data: { error: "Cette campagne est terminée : ce clip ne peut plus être validé" } });
  await call("POST", `/api/clips/${clipId}/views`, { views: 200000 });
  await login("yacine@clipboost.dz");
  assert.equal((await state()).publications.find((p: { id: string }) => p.id === clipId).paid, 6750);
  notes = (await call("GET", "/api/state")).data.notifications;
  assert.deepEqual(notes.slice(0, 2).map((n: { link: string }) => n.link), ["#/clipper/accueil", `#/clipper/publications/${refusedId}`]);

  await login("atlas@test.dz", "Atlas2026x");
  notes = (await call("GET", "/api/state")).data.notifications;
  assert.equal(linkOf(notes, /en cours de vérification/), `#/agence/campagnes/${campaignId}`);
  assert.equal(linkOf(notes, /^Votre recharge de 250 000 DA a été validée\.$/), `#/agence/budget/${recharge.id}`);
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
  // Les demandes de badge, les recours, les paiements en ligne, les messages, les primes du classement et du parrainage sont postérieurs
  // aux liens : une ancienne copie n'en contient pas.
  for (const n of store.notifications) if (!/badge de vérification| conteste le refus du clip | a payé en ligne une recharge |^(Nouvelle question|Nouveau message|Réponse) de |^L'équipe ClipBoost a répondu |^Vous êtes \d+(er|e) du classement | a fait son premier retrait : /.test(n.text)) delete n.link;
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
  // Une campagne en attente est approuvée (et financée) ou refusée, jamais mise en pause : une reprise la mettrait en ligne sans financement.
  assert.deepEqual(await call("PATCH", `/api/campaigns/${refused.id}`, { status: "En pause" }), { status: 400, data: { error: "Action impossible sur cette campagne" } });
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
  // Yacine n'a pas de compte Facebook vérifié : il l'ajoute, puis le vérifie (code dans la bio, vérification simulée hors ligne).
  assert.deepEqual(await call("POST", "/api/clips", { campaignId: festival.id, title: "Le court de clôture", links }), { status: 400, data: { error: "Vérifiez d'abord votre compte Facebook (Profil → Comptes sociaux)" } });
  const fb = await call("POST", "/api/social", { platform: "Facebook", handle: "@Yacine.Clips" });
  assert.equal(fb.status, 201);
  assert.equal((await call("POST", `/api/social/${fb.data.id}/verify`)).status, 200);
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
  delete store.social;
  for (const u of store.users) for (const k of ["avatar", "cover", "verification", "verificationNote", "locale"]) delete u[k];
  for (const c of store.campaigns) for (const k of ["image", "reviewNote", "updatedAt"]) delete c[k];
  for (const p of store.publications) for (const k of ["batch", "likes", "checkedAt", "riskScore", "riskFlags"]) delete p[k];
  for (const t of store.transactions) for (const k of ["provider", "providerRef"]) delete t[k];
  delete store.snapshots;
  delete store.jobRuns;
  delete store.appeals;
  delete store.messages;
  storage.set(STORAGE_KEY, JSON.stringify(store));
  await login("agence@clipboost.dz");
  const s = await state();
  assert.deepEqual([s.me.avatar, s.me.verification, s.me.locale, s.me.providers], [null, "none", "fr", []]);
  assert.ok(s.transactions.every((t: { provider: string | null }) => t.provider === null));
  await login("yacine@clipboost.dz");
  assert.deepEqual([(await state()).me.socialAccounts, (await state()).appeals], [[], []]);
  await login("agence@clipboost.dz");
  assert.ok(s.campaigns.every((c: { updatedAt: string; createdAt: string }) => c.updatedAt.startsWith(c.createdAt)));
  // Sans historique ni dernier relevé : le relevé des vues a été lancé au premier chargement, l'historique commence.
  await login("admin@clipboost.dz", "AdminClip2026");
  const adm = await state();
  assert.equal(adm.tracking.summary.by, "auto");
  assert.ok(adm.publications.every((p: { riskScore: number; riskFlags: string[]; history: unknown[] }) => typeof p.riskScore === "number" && Array.isArray(p.riskFlags) && Array.isArray(p.history)));
  assert.ok(adm.publications.some((p: { history: unknown[] }) => p.history.length === 1));
  await login("agence@clipboost.dz");

  const saved = storage.get(STORAGE_KEY)!;
  quota = saved.length + 100;
  // Image valide (signature PNG) mais trop lourde pour la place restante.
  assert.deepEqual(await call("PATCH", "/api/me", { avatar: PNG.slice(0, -2) + "A".repeat(400) }), { status: 413, data: { error: STORAGE_FULL } });
  assert.equal(storage.get(STORAGE_KEY), saved);
  quota = Infinity;
  assert.equal((await state()).me.avatar, null);
});

test("comptes sociaux : code dans la bio, vérification, un compte par clipper ; clips seulement depuis un compte vérifié", async () => {
  type Social = { id: string; platform: string; handle: string; code: string; status: string; verifiedAt: string | null };
  await offlineApi.reset();
  // Données d'exemple : comptes vérifiés sur les plateformes des clips ; Amira a un compte TikTok en attente.
  await login("amira@clipboost.dz");
  let s = await state();
  assert.deepEqual(s.me.socialAccounts.map((a: Social) => [a.platform, a.handle, a.status]), [["TikTok", "amira.style", "pending"], ["Instagram", "amira.style", "verified"]]);
  const pending: Social = s.me.socialAccounts[0];
  assert.match(pending.code, /^CB-[A-HJ-NP-Z2-9]{4}$/);
  assert.deepEqual(s.me.handles, { instagram: "@amira.style" });
  const derby = s.campaigns.find((c: { title: string }) => c.title === "Derby Algérois");
  const clip = (url: string) => call("POST", "/api/clips", { campaignId: derby.id, title: "Tribunes en folie", links: [{ platform: "TikTok", url }] });
  assert.deepEqual(await clip("https://www.tiktok.com/@amira.style/video/77"), { status: 400, data: { error: "Vérifiez d'abord votre compte TikTok (Profil → Comptes sociaux)" } });

  // Ajout : identifiant ou adresse du profil ; un compte en attente change d'identifiant et garde son code.
  assert.deepEqual(await call("POST", "/api/social", { platform: "TikTok", handle: "amira style" }), { status: 400, data: { error: "Identifiant invalide : lettres, chiffres, points, tirets ou tirets bas (60 signes au plus)" } });
  assert.deepEqual(await call("POST", "/api/social", { platform: "Snapchat", handle: "amira" }), { status: 400, data: { error: "Plateforme inconnue" } });
  assert.deepEqual(await call("POST", "/api/social", { platform: "TikTok", handle: " " }), { status: 400, data: { error: "Identifiant obligatoire" } });
  assert.deepEqual(await call("POST", "/api/social", { platform: "TikTok", handle: "https://www.tiktok.com/@Amira.Oran" }), { status: 201, data: { ok: true, id: pending.id, code: pending.code } });
  assert.deepEqual(await call("POST", "/api/social", { platform: "Instagram", handle: "amira2" }), { status: 400, data: { error: "Vous avez déjà un compte Instagram vérifié : retirez-le d'abord pour en changer" } });

  // Vérification (simulée hors ligne) : compte vérifié, « @compte » dans le profil, ligne d'activité pour l'équipe.
  assert.deepEqual(await call("POST", `/api/social/${pending.id}/verify`), { status: 200, data: { ok: true, simulated: true } });
  assert.deepEqual(await call("POST", `/api/social/${pending.id}/verify`), { status: 400, data: { error: "Ce compte est déjà vérifié" } });
  s = await state();
  assert.deepEqual([s.me.socialAccounts[0].handle, s.me.socialAccounts[0].status, s.me.handles], ["amira.oran", "verified", { instagram: "@amira.style", tiktok: "@amira.oran" }]);
  assert.match(s.me.socialAccounts[0].verifiedAt, /^\d{4}-\d{2}-\d{2}T/);
  // Le lien TikTok nomme le compte : celui d'un autre est refusé, le sien accepté (casse indifférente).
  assert.deepEqual(await clip("https://www.tiktok.com/@amira.style/video/77"), { status: 400, data: { error: "Ce lien ne vient pas de votre compte TikTok vérifié (@amira.oran)" } });
  assert.equal((await clip("https://www.tiktok.com/@Amira.Oran/video/77")).status, 201);

  // Un compte vérifié par un clipper ne peut pas l'être par un autre (à l'ajout comme à la vérification).
  await login("lina@clipboost.dz");
  assert.deepEqual(await call("POST", "/api/social", { platform: "Instagram", handle: "@amira.style" }), { status: 400, data: { error: "Ce compte est déjà vérifié par un autre clipper" } });
  const linaFb = await call("POST", "/api/social", { platform: "Facebook", handle: "facebook.com/DzSketchs" });
  assert.equal(linaFb.status, 201);
  assert.notEqual(linaFb.data.code, pending.code);
  await login("amira@clipboost.dz");
  const amiraFb = await call("POST", "/api/social", { platform: "Facebook", handle: "dzsketchs" });
  assert.equal((await call("POST", `/api/social/${amiraFb.data.id}/verify`)).status, 200);
  await login("lina@clipboost.dz");
  assert.deepEqual(await call("POST", `/api/social/${linaFb.data.id}/verify`), { status: 400, data: { error: "Ce compte est déjà vérifié par un autre clipper" } });
  // Le compte d'un autre clipper reste introuvable (vérification, retrait).
  assert.deepEqual(await call("POST", `/api/social/${amiraFb.data.id}/verify`), { status: 404, data: { error: "Compte introuvable" } });
  assert.deepEqual(await call("DELETE", `/api/social/${amiraFb.data.id}`), { status: 404, data: { error: "Compte introuvable" } });

  // Retrait : un compte en attente disparaît ; un compte vérifié aussi, avec son « @compte », et ses clips sont refusés.
  assert.equal((await call("DELETE", `/api/social/${linaFb.data.id}`)).status, 200);
  await login("amira@clipboost.dz");
  assert.equal((await call("DELETE", `/api/social/${pending.id}`)).status, 200);
  s = await state();
  assert.deepEqual([s.me.socialAccounts.map((a: Social) => a.platform), s.me.handles], [["Instagram", "Facebook"], { instagram: "@amira.style", facebook: "@dzsketchs" }]);
  assert.deepEqual(await clip("https://www.tiktok.com/@amira.oran/video/78"), { status: 400, data: { error: "Vérifiez d'abord votre compte TikTok (Profil → Comptes sociaux)" } });
  // Le profil ne modifie plus les comptes (ils suivent les comptes vérifiés).
  assert.equal((await call("PATCH", "/api/me", { handles: { tiktok: "@nimporte" } })).status, 200);
  assert.deepEqual((await state()).me.handles, { instagram: "@amira.style", facebook: "@dzsketchs" });

  // L'admin voit les comptes de chaque clipper et l'activité ; une agence ne peut pas en ajouter.
  await login("admin@clipboost.dz", "AdminClip2026");
  s = await state();
  const amira = s.users.find((u: { email: string }) => u.email === "amira@clipboost.dz");
  assert.deepEqual(amira.socialAccounts.map((a: Social) => `${a.platform} @${a.handle} ${a.status}`), ["Instagram @amira.style verified", "Facebook @dzsketchs verified"]);
  assert.ok(s.users.filter((u: { role: string }) => u.role !== "clipper").every((u: { socialAccounts?: unknown }) => u.socialAccounts === undefined));
  assert.deepEqual(s.activity.slice(0, 3).map((a: { text: string }) => a.text), [
    "Amira Khelifi a retiré son compte TikTok @amira.oran.", "Amira Khelifi a vérifié son compte Facebook @dzsketchs.", "Amira Khelifi a soumis le clip « Tribunes en folie » (Derby Algérois).",
  ]);
  assert.equal((await call("POST", "/api/social", { platform: "TikTok", handle: "equipe" })).status, 403);
  await login("agence@clipboost.dz");
  assert.equal((await call("POST", "/api/social", { platform: "TikTok", handle: "tassili" })).status, 403);
  // Une agence ne reçoit pas les comptes sociaux (ni les codes) des auteurs de ses clips.
  assert.ok(!JSON.stringify(await state()).includes("socialAccounts"));
});

test("relevé des vues : bouton de l'admin, relevé dû toutes les 6 heures, historique et risque réservés à l'admin", async () => {
  type Day = { day: string; views: number; likes: number | null; gain: number | null };
  type Pub = { id: string; title: string; platform: string; status: string; views: number; likes: number | null; paid: number; checkedAt: string | null; riskScore?: number; riskFlags?: string[]; history?: Day[] };
  await offlineApi.reset();
  await login("admin@clipboost.dz", "AdminClip2026");
  const s0 = await state();
  // Données d'exemple : dernier relevé il y a 2 heures (pas de relevé à l'ouverture), 11 clips suivis, tout est simulé.
  assert.deepEqual([s0.tracking.everyHours, s0.tracking.simulated, s0.tracking.summary], [6, ["TikTok", "Instagram", "YouTube", "Facebook"], { by: "cron", total: 11, updated: 11, simulated: 11, failed: 0 }]);
  assert.ok(Math.abs(Date.now() - 2 * 3_600_000 - Date.parse(s0.tracking.lastRunAt)) < 60_000);
  const byTitle = (list: Pub[], title: string, platform?: string) => list.find((p) => p.title === title && (!platform || p.platform === platform))!;
  const pubs0: Pub[] = s0.publications;
  // Clip suspect : pic de vues soudain et très peu de likes (80) ; l'Instagram du but de la 89e : peu de likes (35).
  const suspect = byTitle(pubs0, "Quand ta mère trouve ton bulletin");
  assert.deepEqual([suspect.riskScore, suspect.riskFlags], [80, ["Pic de vues soudain", "Beaucoup de vues, peu de likes"]]);
  assert.deepEqual([byTitle(pubs0, "But de la 89e en slow-motion", "Instagram").riskScore, byTitle(pubs0, "Ambiance des tribunes").riskScore], [35, 0]);
  // Historique jour par jour (14 jours au plus) : le dernier jour porte le dernier relevé, le pic y est visible.
  assert.ok(pubs0.every((p) => p.history!.length <= 14 && new Set(p.history!.map((h) => h.day)).size === p.history!.length));
  assert.equal(suspect.history!.at(-1)!.views, suspect.views);
  assert.ok(suspect.history!.at(-1)!.gain! > 5000 && suspect.likes! < suspect.views * 0.005);

  // Bouton de l'admin : seuls les clips suivis (en attente, ou validés depuis moins de 7 jours) sont relevés.
  const run = await call("POST", "/api/admin/track-views");
  assert.equal(run.status, 200);
  // La semaine écoulée est déjà clôturée (données d'exemple) : aucune clôture du classement.
  assert.deepEqual({ ...run.data, at: undefined }, { ok: true, by: "admin", total: 11, updated: 11, simulated: 11, failed: 0, at: undefined, closedWeeks: [] });
  const s1 = await state(), pubs1: Pub[] = s1.publications, today = new Date().toISOString().slice(0, 10);
  for (const p of pubs1) {
    const before = pubs0.find((x) => x.id === p.id)!;
    const tracked = p.status === "En attente" || ["But de la 89e en slow-motion", "Mon café du matin à Alger", "Brunch à Oran", "Les plus beaux arrêts du gardien", "Café et croissant au ralenti", "Le prof de maths le jour du bac", "Le chant des supporters en 4K"].includes(p.title);
    if (tracked) {
      assert.ok(p.views >= before.views && Date.now() - Date.parse(p.checkedAt!) < 60_000, p.title);
      assert.deepEqual(p.history!.at(-1), { ...p.history!.at(-1)!, day: today, views: p.views, likes: p.likes });
    } else assert.deepEqual([p.views, p.checkedAt], [before.views, before.checkedAt], p.title);
  }
  assert.ok(pubs1.reduce((n, p) => n + p.views, 0) > pubs0.reduce((n, p) => n + p.views, 0));
  assert.equal(byTitle(pubs1, "Le taxi clandestin").views, byTitle(pubs0, "Le taxi clandestin").views);
  // Clip validé encore dans sa fenêtre de gains : ses vues supplémentaires sont payées.
  assert.ok(byTitle(pubs1, "But de la 89e en slow-motion", "TikTok").paid > byTitle(pubs0, "But de la 89e en slow-motion", "TikTok").paid);
  assert.match(s1.activity[0].text, /^Vues relevées par Équipe ClipBoost : 11 clips mis à jour\.$/);
  assert.equal(s1.tracking.summary.by, "admin");

  // Saisie de l'équipe avec les likes : le score est recalculé (le pic reste, les likes ne sont plus suspects).
  const s = byTitle(pubs1, "Quand ta mère trouve ton bulletin");
  assert.deepEqual(await call("POST", `/api/clips/${s.id}/views`, { views: s.views + 100, likes: 4000 }), { status: 200, data: { ok: true } });
  let after = byTitle((await state()).publications, s.title);
  assert.deepEqual([after.views, after.likes, after.riskScore, after.riskFlags], [s.views + 100, 4000, 45, ["Pic de vues soudain"]]);
  assert.equal(after.history!.filter((h: Day) => h.day === today).length, 1);
  // Sans likes : ceux connus sont gardés. Vues en baisse ou likes invalides : refusés.
  assert.equal((await call("POST", `/api/clips/${s.id}/views`, { views: s.views + 200 })).status, 200);
  after = byTitle((await state()).publications, s.title);
  assert.deepEqual([after.views, after.likes], [s.views + 200, 4000]);
  assert.deepEqual(await call("POST", `/api/clips/${s.id}/views`, { views: 10 }), { status: 400, data: { error: "Le nombre de vues ne peut pas diminuer" } });
  assert.equal((await call("POST", `/api/clips/${s.id}/views`, { views: s.views + 300, likes: -1 })).status, 400);

  // Clipper et agence : ni score, ni signaux, ni historique, ni relevé ; le bouton leur est refusé.
  for (const [email, password] of [["lina@clipboost.dz", undefined], ["agence@clipboost.dz", undefined]] as const) {
    await login(email, password);
    const other = await state();
    assert.ok(other.publications.length > 0 && other.publications.every((p: Pub) => !("riskScore" in p) && !("riskFlags" in p) && !("history" in p) && "likes" in p && "checkedAt" in p));
    assert.equal(other.tracking, undefined);
    assert.equal((await call("POST", "/api/admin/track-views")).status, 403);
  }

  // Version autonome sans tâche planifiée : à l'ouverture, le relevé est lancé si le dernier a plus de 6 heures, puis enregistré.
  const store = JSON.parse(storage.get(STORAGE_KEY)!);
  store.jobRuns[0].lastRunAt = Date.now() - 7 * 3_600_000;
  storage.set(STORAGE_KEY, JSON.stringify(store));
  const lina = await state();
  assert.ok(lina.publications.some((p: Pub) => Date.now() - Date.parse(p.checkedAt!) < 60_000));
  const saved = JSON.parse(storage.get(STORAGE_KEY)!).jobRuns[0];
  assert.deepEqual([saved.summary.by, saved.summary.total], ["auto", 11]);
  assert.ok(Date.now() - saved.lastRunAt < 60_000);
  // Relevé récent : rien n'est relancé au chargement suivant.
  await state();
  assert.equal(JSON.parse(storage.get(STORAGE_KEY)!).jobRuns[0].lastRunAt, saved.lastRunAt);
  // Adresse de la tâche planifiée du serveur, ouverte hors ligne.
  const cron = await call("GET", "/api/cron/views");
  assert.deepEqual([cron.status, cron.data.by, cron.data.total], [200, "cron", 11]);
  assert.equal(JSON.parse(storage.get(STORAGE_KEY)!).jobRuns[0].summary.by, "cron");
});

test("recours : un clip refusé contesté une seule fois, accepté (clip validé et payé) ou refusé avec un motif", async () => {
  type Appeal = { id: string; publicationId: string; userId: string; message: string; proof: string; status: string; decisionNote: string | null; decidedAt: string | null; decidedBy?: string | null };
  type Pub = { id: string; title: string; status: string; paid: number; campaign: string };
  type Note = { text: string; link: string | null };
  await offlineApi.reset();
  // Données d'exemple : Lina conteste le refus de « Sketch du marché » (capture d'écran jointe), en attente de l'équipe.
  await login("lina@clipboost.dz");
  let s = await state();
  const sketch: Pub = s.publications.find((p: Pub) => p.title === "Sketch du marché");
  const rire = s.campaigns.find((c: { title: string }) => c.title === "Les Sketchs du Bled");
  assert.equal(sketch.status, "Refusée");
  const seeded: Appeal = s.appeals[0];
  assert.deepEqual([s.appeals.length, seeded.publicationId, seeded.status, seeded.decisionNote, "decidedBy" in seeded], [1, sketch.id, "En attente", null, false]);
  assert.match(seeded.proof, /^data:image\/jpeg;base64,\/9j\//);
  assert.match(seeded.message, /^La musique de ce sketch vient de la bibliothèque audio/);
  // Une seule contestation par clip.
  assert.deepEqual(await call("POST", `/api/clips/${sketch.id}/appeal`, { message: "Une deuxième contestation du même clip.", proof: PNG }), { status: 400, data: { error: "Vous avez déjà contesté ce clip" } });

  // L'équipe est prévenue (lien vers le recours dans la modération) ; motif obligatoire pour décider.
  await login("admin@clipboost.dz", "AdminClip2026");
  s = await state();
  const adminId = s.me.id, spent = s.campaigns.find((c: { id: string }) => c.id === rire.id).spent;
  assert.equal(s.notifications.find((n: Note) => n.text === "Lina Mansouri conteste le refus du clip « Sketch du marché ».").link, `#/admin/moderation/${seeded.id}`);
  assert.deepEqual([s.appeals.length, s.appeals[0].decidedBy], [1, null]);
  assert.deepEqual(await call("POST", `/api/appeals/${seeded.id}/review`, { approve: true, reason: " ok " }), { status: 400, data: { error: "Indiquez le motif de votre décision (3 caractères minimum)" } });
  assert.deepEqual(await call("POST", `/api/appeals/${seeded.id}/review`, { approve: true }), { status: 400, data: { error: "Motif manquant" } });
  assert.deepEqual(await call("POST", "/api/appeals/inconnu/review", { approve: true, reason: "Preuve vérifiée" }), { status: 404, data: { error: "Recours introuvable" } });

  // Accepté : le clip est validé et payé comme à une validation normale (4 100 vues à 125 DA les 1 000 : 512 DA).
  const reason = "Musique libre de droits : la licence a été vérifiée";
  assert.deepEqual(await call("POST", `/api/appeals/${seeded.id}/review`, { approve: true, reason }), { status: 200, data: { ok: true } });
  s = await state();
  const validated: Pub = s.publications.find((p: Pub) => p.id === sketch.id);
  assert.deepEqual([validated.status, validated.paid, s.campaigns.find((c: { id: string }) => c.id === rire.id).spent - spent], ["Validée", 512, 512]);
  assert.deepEqual([s.appeals[0].status, s.appeals[0].decisionNote, s.appeals[0].decidedBy], ["Acceptée", reason, adminId]);
  assert.match(s.appeals[0].decidedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(s.activity[0].text, "Recours de Lina Mansouri sur « Sketch du marché » accepté par Équipe ClipBoost : clip validé (512 DA).");
  assert.deepEqual(await call("POST", `/api/appeals/${seeded.id}/review`, { approve: false, reason: "Changement d'avis" }), { status: 400, data: { error: "Ce recours a déjà été traité" } });
  // Le clipper reçoit la décision et son motif (lien vers le clip) et le gain, retirable après la rétention.
  await login("lina@clipboost.dz");
  s = await state();
  const notes = s.notifications.slice(0, 2).map((n: Note) => [n.text, n.link]);
  assert.deepEqual(notes.find(([text]: string[]) => text.startsWith("Recours")), [`Recours accepté pour « Sketch du marché » : le clip est validé. ${reason}.`, `#/clipper/publications/${sketch.id}`]);
  assert.ok(notes.some(([text]: string[]) => text === "+512 DA pour « Sketch du marché ». Retirable dans 3 jours."));
  assert.deepEqual([s.transactions[0].type, s.transactions[0].amount, s.transactions[0].label], ["gain", 512, "Les Sketchs du Bled"]);
  assert.deepEqual([s.appeals[0].status, s.appeals[0].decisionNote], ["Acceptée", reason]);
  assert.deepEqual(await call("POST", `/api/clips/${sketch.id}/appeal`, { message: "Je conteste encore une fois ce clip.", proof: PNG }), { status: 400, data: { error: "Seul un clip refusé peut être contesté" } });

  // Nouveau clip refusé : contrôles de la contestation, puis refus du recours (définitif).
  const sent = await call("POST", "/api/clips", { campaignId: rire.id, title: "Le prof de maths", links: [{ platform: "TikTok", url: "https://www.tiktok.com/@lina.lol/video/9001" }] });
  assert.equal(sent.status, 201);
  const clipId: string = sent.data.id, appeal = (body: unknown) => call("POST", `/api/clips/${clipId}/appeal`, body);
  const message = "Mes vues viennent d'un partage par une page d'humour, pas d'un achat.";
  assert.deepEqual(await appeal({ message, proof: PNG }), { status: 400, data: { error: "Seul un clip refusé peut être contesté" } });
  await login("admin@clipboost.dz", "AdminClip2026");
  assert.equal((await call("POST", `/api/clips/${clipId}/review`, { approve: false, reason: "Vues suspectes ou achetées" })).status, 200);
  await login("lina@clipboost.dz");
  assert.deepEqual(await appeal({ message: "Pas d'accord.", proof: PNG }), { status: 400, data: { error: "Expliquez votre contestation en 20 caractères au moins" } });
  assert.deepEqual(await appeal({ message: "x".repeat(1001), proof: PNG }), { status: 400, data: { error: "Message trop long (1 000 caractères maximum)" } });
  assert.deepEqual(await appeal({ message }), { status: 400, data: { error: "Ajoutez une capture d'écran comme preuve" } });
  assert.deepEqual(await appeal({ message, proof: "" }), { status: 400, data: { error: "Ajoutez une capture d'écran comme preuve" } });
  assert.deepEqual(await appeal({ message, proof: "data:image/png;base64,AAAAAAAAAAAAAAAA" }), { status: 400, data: { error: "Image invalide (JPEG, PNG ou WebP)" } });
  await login("yacine@clipboost.dz");
  assert.deepEqual(await appeal({ message, proof: PNG }), { status: 404, data: { error: "Clip introuvable" } });
  await login("agence@clipboost.dz");
  assert.equal((await appeal({ message, proof: PNG })).status, 403);
  await login("lina@clipboost.dz");
  const created = await appeal({ message: `  ${message}  `, proof: PNG });
  assert.equal(created.status, 201);
  assert.deepEqual(await appeal({ message, proof: PNG }), { status: 400, data: { error: "Vous avez déjà contesté ce clip" } });
  s = await state();
  assert.deepEqual([s.appeals[0].id, s.appeals[0].message, s.appeals[0].proof, s.appeals[0].status], [created.data.id, message, PNG, "En attente"]);
  // Seule l'équipe décide.
  assert.equal((await call("POST", `/api/appeals/${created.data.id}/review`, { approve: true, reason: "Je valide moi-même" })).status, 403);
  await login("admin@clipboost.dz", "AdminClip2026");
  assert.equal((await state()).notifications[0].link, `#/admin/moderation/${created.data.id}`);
  // Acceptation impossible (seuil non atteint : aucune vue) : l'erreur est renvoyée et le recours reste en attente.
  const refused = await call("POST", `/api/appeals/${created.data.id}/review`, { approve: true, reason: "Partage vérifié" });
  assert.equal(refused.status, 400);
  assert.match(refused.data.error, /^Seuil non atteint : 2\s000 vues minimum$/);
  assert.equal((await state()).appeals.find((a: Appeal) => a.id === created.data.id).status, "En attente");
  const no = "Les vues achetées restent visibles sur la courbe du clip";
  assert.deepEqual(await call("POST", `/api/appeals/${created.data.id}/review`, { approve: false, reason: no }), { status: 200, data: { ok: true } });
  s = await state();
  assert.deepEqual([s.publications.find((p: Pub) => p.id === clipId).status, s.appeals[0].status, s.appeals[0].decisionNote], ["Refusée", "Refusée", no]);
  assert.equal(s.activity[0].text, "Recours de Lina Mansouri sur « Le prof de maths » refusé par Équipe ClipBoost.");
  await login("lina@clipboost.dz");
  s = await state();
  assert.deepEqual([s.notifications[0].text, s.notifications[0].link], [`Recours refusé pour « Le prof de maths » : ${no}.`, `#/clipper/publications/${clipId}`]);
  // Définitif : le clip ne peut plus être contesté.
  assert.deepEqual(await appeal({ message, proof: PNG }), { status: 400, data: { error: "Vous avez déjà contesté ce clip" } });

  // Une agence ne voit aucun recours (ni message, ni preuve) ; un autre clipper ne voit pas ceux de Lina.
  await login("agence@clipboost.dz");
  assert.deepEqual((await state()).appeals, []);
  await login("yacine@clipboost.dz");
  assert.deepEqual((await state()).appeals, []);
});

test("paiement en ligne Edahabia / CIB (simulé) : crédit ajouté au paiement, annulation, pas de confirmation manuelle", async () => {
  type Tx = { id: string; ref: string; type: string; status: string; method: string; label: string; provider: string | null; providerRef?: string | null; amount: number };
  await login("agence@clipboost.dz");
  let s = await state();
  const credit = s.me.credit;
  assert.deepEqual(s.payments, { simulated: true });
  // Recharge en ligne d'exemple : payée par carte Edahabia, validée par Chargily.
  assert.ok(s.transactions.some((t: Tx) => t.provider === "chargily" && t.status === "Validé" && t.method === "carte Edahabia"));
  // Edahabia et CIB ne s'annoncent plus à la main ; le paiement en ligne n'accepte qu'elles.
  assert.deepEqual(await call("POST", "/api/credit", { amount: 50000, method: "carte CIB" }), { status: 400, data: { error: "Carte Edahabia ou CIB : utilisez le paiement en ligne" } });
  assert.deepEqual(await call("POST", "/api/credit/checkout", { amount: 50000, method: "virement bancaire" }), { status: 400, data: { error: "Paiement en ligne : carte Edahabia ou CIB" } });
  assert.deepEqual(await call("POST", "/api/credit/checkout", { amount: 5000, method: "carte CIB" }), { status: 400, data: { error: "Recharge minimum : 10 000 DA" } });

  // 1. Paiement accepté : la recharge est créée en cours, la page simulée la valide et crédite l'agence.
  const paid = await call("POST", "/api/credit/checkout", { amount: 120000, method: "carte CIB" });
  assert.equal(paid.status, 201);
  assert.equal(paid.data.checkoutUrl, `#/agence/paiement/${paid.data.id}`);
  assert.equal(paid.data.simulated, true);
  s = await state();
  let tx = s.transactions.find((t: Tx) => t.id === paid.data.id);
  assert.deepEqual([tx.status, tx.provider, tx.label, tx.ref, s.me.credit], ["En cours", "chargily", "Recharge par carte CIB", paid.data.ref, credit]);
  assert.equal("providerRef" in tx, false);
  assert.deepEqual(await call("POST", `/api/credit/checkout/${paid.data.id}`), { status: 200, data: { ok: true, status: "En cours", checkoutUrl: `#/agence/paiement/${paid.data.id}` } });
  // Seule l'agence propriétaire paie sa recharge.
  await login("djurdjura@clipboost.dz");
  assert.deepEqual(await call("POST", `/api/payments/simulate/${paid.data.id}`, { paid: true }), { status: 404, data: { error: "Paiement introuvable" } });
  await login("agence@clipboost.dz");
  assert.deepEqual(await call("POST", `/api/payments/simulate/${paid.data.id}`, { paid: true }), { status: 200, data: { ok: true } });
  s = await state();
  tx = s.transactions.find((t: Tx) => t.id === paid.data.id);
  assert.deepEqual([tx.status, s.me.credit], ["Validé", credit + 120000]);
  assert.deepEqual([s.notifications[0].text, s.notifications[0].link], ["Votre recharge de 120 000 DA a été validée.", `#/agence/budget/${paid.data.id}`]);
  // Déjà payée : ni deuxième paiement, ni deuxième crédit.
  assert.deepEqual(await call("POST", `/api/payments/simulate/${paid.data.id}`, { paid: true }), { status: 400, data: { error: "Ce paiement a déjà été traité" } });
  assert.deepEqual(await call("POST", `/api/credit/checkout/${paid.data.id}`), { status: 200, data: { ok: true, status: "Validé", checkoutUrl: null } });
  assert.equal((await state()).me.credit, credit + 120000);

  // 2. Paiement annulé : recharge refusée, aucun crédit.
  const canceled = await call("POST", "/api/credit/checkout", { amount: 80000, method: "carte Edahabia" });
  assert.deepEqual(await call("POST", `/api/payments/simulate/${canceled.data.id}`, { paid: false }), { status: 200, data: { ok: true } });
  s = await state();
  assert.deepEqual([s.transactions.find((t: Tx) => t.id === canceled.data.id).status, s.me.credit], ["Refusé", credit + 120000]);
  assert.equal(s.notifications[0].text, "Paiement en ligne annulé ou refusé : votre recharge de 80 000 DA n'a pas été créditée.");
  assert.deepEqual(await call("POST", `/api/payments/simulate/${canceled.data.id}`, { paid: true }), { status: 400, data: { error: "Ce paiement a déjà été traité" } });
  // Le webhook n'existe pas sans clé Chargily (toujours le cas hors ligne).
  assert.deepEqual(await call("POST", "/api/payments/chargily/webhook", { type: "checkout.paid" }), { status: 503, data: { error: "Paiement en ligne non configuré" } });

  // 3. L'équipe : un paiement en ligne en cours ne se confirme ni ne se refuse à la main ; un virement, si.
  const pending = await call("POST", "/api/credit/checkout", { amount: 60000, method: "carte CIB" });
  const transfer = await call("POST", "/api/credit", { amount: 70000, method: "virement bancaire" });
  await login("admin@clipboost.dz", "AdminClip2026");
  s = await state();
  assert.deepEqual(s.payments, { simulated: true });
  assert.equal(s.transactions.find((t: Tx) => t.id === pending.data.id).providerRef, null);
  assert.ok(s.notifications.some((n: { text: string; link: string }) => n.text === `Tassili Sport a payé en ligne une recharge de 120 000 DA par carte CIB (réf. ${paid.data.ref}).` && n.link === `#/admin/retraits/${paid.data.id}`));
  assert.ok(s.activity.some((a: { text: string }) => a.text === "Recharge de 120 000 DA payée en ligne par Tassili Sport (carte CIB, Chargily)."));
  for (const approve of [true, false]) {
    assert.deepEqual(await call("POST", `/api/transactions/${pending.data.id}/review`, { approve }), { status: 400, data: { error: "Paiement en ligne : confirmé automatiquement par Chargily" } });
  }
  assert.equal((await call("POST", `/api/payments/simulate/${pending.data.id}`, { paid: true })).status, 403);
  const manual = s.transactions.find((t: Tx) => t.ref === transfer.data.ref);
  assert.deepEqual(await call("POST", `/api/transactions/${manual.id}/review`, { approve: true }), { status: 200, data: { ok: true } });
  await login("agence@clipboost.dz");
  s = await state();
  assert.deepEqual([s.transactions.find((t: Tx) => t.id === pending.data.id).status, s.transactions.find((t: Tx) => t.id === manual.id).status, s.me.credit], ["En cours", "Validé", credit + 120000 + 70000]);
});

test("factures et reçus PDF, export CSV des transactions", async () => {
  type Tx = { id: string; ref: string; type: string; status: string; amount: number; document: string | null };
  const raw = async (path: string) => {
    const res = await offlineApi.fetch(path, { method: "GET" });
    return { status: res.status, type: res.headers.get("Content-Type"), disposition: res.headers.get("Content-Disposition"), bytes: new Uint8Array(await res.arrayBuffer()) };
  };
  const latin1 = (b: Uint8Array) => Array.from(b, (x) => String.fromCharCode(x)).join("");
  // Données d'exemple : la recharge Edahabia de Tassili a sa facture, le retrait versé de Yacine son reçu.
  await login("agence@clipboost.dz");
  let s = await state();
  const online = s.transactions.find((t: Tx) => t.type === "recharge" && t.status === "Validé" && t.amount === 300000);
  assert.match(online.document, /^FAC-\d{4}-\d{5}$/);
  assert.ok(s.transactions.filter((t: Tx) => t.status !== "Validé").every((t: Tx) => t.document === null));
  const pdf = await raw(`/api/transactions/${online.id}/document`);
  assert.deepEqual([pdf.status, pdf.type, pdf.disposition], [200, "application/pdf", `attachment; filename="${online.document}.pdf"`]);
  const text = latin1(pdf.bytes);
  assert.ok(text.startsWith("%PDF-1.4") && text.endsWith("%%EOF\n"));
  // Une transaction sans document (en cours), ou celle d'un autre compte : 404.
  const pending = await call("POST", "/api/credit", { amount: 50000, method: "virement bancaire" });
  const pendingTx = (await state()).transactions.find((t: Tx) => t.ref === pending.data.ref);
  assert.deepEqual(await call("GET", `/api/transactions/${pendingTx.id}/document`), { status: 404, data: { error: "Aucun document pour cette transaction" } });
  await login("yacine@clipboost.dz");
  s = await state();
  const payout = s.transactions.find((t: Tx) => t.type === "retrait" && t.status === "Validé");
  assert.match(payout.document, /^REC-\d{4}-00001$/);
  assert.equal((await raw(`/api/transactions/${payout.id}/document`)).status, 200);
  assert.deepEqual(await call("GET", `/api/transactions/${online.id}/document`), { status: 404, data: { error: "Transaction introuvable" } });
  assert.equal((await call("GET", "/api/admin/transactions/export")).status, 403);
  await call("POST", "/api/auth/logout");
  assert.equal((await call("GET", `/api/transactions/${payout.id}/document`)).status, 401);

  // L'équipe : validation d'une recharge (facture) et d'un retrait (reçu), numéros suivants ; rien pour un refus.
  await login("yacine@clipboost.dz");
  await call("POST", "/api/withdrawals", { amount: 2000 });
  await login("admin@clipboost.dz", "AdminClip2026");
  s = await state();
  const yacineId = s.users.find((u: { email: string }) => u.email === "yacine@clipboost.dz").id;
  const wd = s.transactions.find((t: Tx & { userId: string }) => t.type === "retrait" && t.status === "En cours" && t.userId === yacineId);
  const before = s.transactions.filter((t: Tx) => t.document?.startsWith("FAC-")).length;
  // Reçus déjà émis cette année : celui de Yacine et celui du premier retrait de Karim (filleul de Yacine).
  const receipts = s.transactions.filter((t: Tx) => t.document?.startsWith(`REC-${new Date().getUTCFullYear()}-`)).length;
  assert.equal((await call("POST", `/api/transactions/${pendingTx.id}/review`, { approve: true })).status, 200);
  assert.equal((await call("POST", `/api/transactions/${wd.id}/review`, { approve: true })).status, 200);
  s = await state();
  const year = new Date().getUTCFullYear();
  assert.equal(s.transactions.find((t: Tx) => t.id === pendingTx.id).document, `FAC-${year}-${String(before + 1).padStart(5, "0")}`);
  assert.equal(s.transactions.find((t: Tx) => t.id === wd.id).document, `REC-${year}-${String(receipts + 1).padStart(5, "0")}`);
  // L'équipe télécharge le document de n'importe quel compte.
  assert.equal((await raw(`/api/transactions/${wd.id}/document`)).status, 200);

  // Export CSV : BOM, « ; », gains compris, filtres.
  const csv = await offlineApi.fetch("/api/admin/transactions/export", { method: "GET" });
  assert.equal(csv.headers.get("Content-Type"), "text/csv; charset=utf-8");
  assert.match(csv.headers.get("Content-Disposition") ?? "", /^attachment; filename="clipboost-transactions-\d{4}-\d{2}-\d{2}\.csv"$/);
  const body = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await csv.arrayBuffer());
  assert.ok(body.startsWith("\ufeffRéférence;Date;Heure;Type;Utilisateur;Email;Rôle;Libellé;Montant (DA);Frais (DA);Statut;Moyen;Document\r\n"));
  const rows = body.trim().split("\r\n").slice(1).map((l) => l.split(";"));
  assert.ok(rows.some((r) => r[3] === "Gain"));
  assert.ok(rows.some((r) => r[0] === online.ref && r[12] === online.document && r[8] === "300000"));
  const filtered = await offlineApi.fetch(`/api/admin/transactions/export?type=retrait&status=Valid%C3%A9&from=2000-01-01&to=${new Date().toISOString().slice(0, 10)}`, { method: "GET" });
  const only = (await filtered.text()).trim().split("\r\n").slice(1).map((l) => l.split(";"));
  assert.ok(only.length >= 2 && only.every((r) => r[3] === "Retrait" && r[10] === "Validé" && /^REC-/.test(r[12])));
  assert.equal((await (await offlineApi.fetch("/api/admin/transactions/export?from=2999-01-01", { method: "GET" })).text()).trim().split("\r\n").length, 1);
  assert.deepEqual(await call("GET", "/api/admin/transactions/export?type=bonus"), { status: 400, data: { error: "Type de transaction invalide" } });
  assert.deepEqual(await call("GET", "/api/admin/transactions/export?from=2026-13-45"), { status: 400, data: { error: "Date de début invalide (AAAA-MM-JJ)" } });
  assert.deepEqual(await call("GET", "/api/admin/transactions/export?from=2026-10-02&to=2026-10-01"), { status: 400, data: { error: "La date de début doit précéder la date de fin" } });
});

test("messagerie par campagne : question du clipper, réponse de l'agence ou de l'équipe, lecture et accès", async () => {
  type Thread = { id: string; campaignId: string; clipperId: string; unread: number; awaiting: boolean; messages: { senderId: string; fromClipper: boolean; body: string; read: boolean }[] };
  type Note = { text: string; link: string | null; unread: boolean };
  await offlineApi.reset();
  // Données d'exemple : réponse de Tassili Sport pas encore lue par Yacine (et sa notification).
  await login("yacine@clipboost.dz");
  let s = await state();
  const yacine = s.me.id, camp = (title: string) => s.campaigns.find((c: { title: string }) => c.title === title);
  const derby = camp("Derby Algérois"), kahwa = camp("Kahwa du matin"), maillot = camp("Nouveau maillot 2027"), festival = camp("Festival du court-métrage");
  assert.deepEqual(s.threads.map((t: Thread) => [t.campaignId, t.unread, t.awaiting]), [[derby.id, 1, false], [kahwa.id, 0, false]]);
  assert.ok(s.notifications.some((n: Note) => n.unread && n.link === `#/clipper/messages/${derby.id}` && n.text.startsWith("Réponse de Tassili Sport sur « Derby Algérois » : « Bonjour Yacine")));
  // Conversation ouverte : la réponse et sa notification sont lues.
  assert.deepEqual(await call("POST", "/api/messages/read", { campaignId: derby.id }), { status: 200, data: { ok: true } });
  s = await state();
  assert.equal(s.threads.find((t: Thread) => t.campaignId === derby.id).unread, 0);
  assert.ok(!s.notifications.some((n: Note) => n.unread && n.link === `#/clipper/messages/${derby.id}`));

  // Question sur une campagne en pause, non rejointe, d'une agence : l'agence est prévenue (extrait, lien vers la conversation).
  assert.deepEqual(await call("POST", `/api/campaigns/${festival.id}/messages`, { body: "   " }), { status: 400, data: { error: "Écrivez votre message" } });
  assert.deepEqual(await call("POST", `/api/campaigns/${festival.id}/messages`, { body: "x".repeat(1001) }), { status: 400, data: { error: "Message trop long (1 000 caractères maximum)" } });
  const question = "Bonjour, le festival accepte-t-il des extraits sous-titrés en arabe et en français pour la même vidéo publiée sur YouTube ?";
  assert.equal((await call("POST", `/api/campaigns/${maillot.id}/messages`, { body: "Le maillot existe-t-il en taille enfant ?" })).status, 201);
  assert.equal((await call("POST", `/api/campaigns/${festival.id}/messages`, { body: question })).status, 201);
  assert.equal((await call("POST", `/api/campaigns/${festival.id}/messages`, { body: "Merci d'avance !" })).status, 201);
  s = await state();
  const mine: Thread = s.threads[0];
  assert.deepEqual([mine.id, mine.awaiting, mine.messages.length, mine.messages[0].fromClipper], [`${festival.id}~${yacine}`, true, 2, true]);

  await login("djurdjura@clipboost.dz");
  s = await state();
  const notes = s.notifications.filter((n: Note) => n.link === `#/agence/messages/${festival.id}~${yacine}`);
  assert.deepEqual(notes.map((n: Note) => n.text), [
    "Nouveau message de Yacine Benali sur « Festival du court-métrage » : « Merci d'avance ! »",
    "Nouvelle question de Yacine Benali sur « Festival du court-métrage » : « Bonjour, le festival accepte-t-il des extraits sous-titrés… »",
  ]);
  assert.deepEqual([s.threads.length, s.threads[0].unread], [1, 2]);
  // Les clippers des conversations sont visibles par l'agence (profil public seulement).
  const author = s.users.find((u: { id: string }) => u.id === yacine);
  assert.deepEqual([author.name, author.handle, "email" in author], ["Yacine Benali", "@yacine.clips", false]);
  // Pas de premier message de l'agence : seulement une réponse à un clipper qui lui a écrit.
  const amira = (await (async () => { await login("amira@clipboost.dz"); return (await state()).me.id; })());
  await login("djurdjura@clipboost.dz");
  assert.deepEqual(await call("POST", `/api/campaigns/${festival.id}/messages`, { body: "Rejoignez notre festival !", clipperId: amira }), { status: 400, data: { error: "Vous pouvez seulement répondre à un clipper qui vous a écrit" } });
  assert.deepEqual(await call("POST", `/api/campaigns/${festival.id}/messages`, { body: "Bonjour" }), { status: 400, data: { error: "Conversation introuvable" } });
  // Accès : la conversation d'une autre agence, ou d'une campagne de ClipBoost, n'existe pas pour elle.
  assert.deepEqual(await call("POST", `/api/campaigns/${derby.id}/messages`, { body: "Bonjour", clipperId: yacine }), { status: 404, data: { error: "Campagne introuvable" } });
  assert.deepEqual(await call("POST", "/api/messages/read", { campaignId: kahwa.id, clipperId: yacine }), { status: 404, data: { error: "Campagne introuvable" } });
  // Réponse : vaut lecture ; le clipper est prévenu.
  assert.equal((await call("POST", `/api/campaigns/${festival.id}/messages`, { body: "Oui, les sous-titres dans les deux langues sont bienvenus.", clipperId: yacine })).status, 201);
  s = await state();
  assert.deepEqual([s.threads[0].unread, s.threads[0].awaiting], [0, false]);
  assert.ok(s.notifications.every((n: Note) => n.link !== `#/agence/messages/${festival.id}~${yacine}` || !n.unread));

  await login("yacine@clipboost.dz");
  s = await state();
  assert.equal(s.notifications[0].text, "Réponse de Djurdjura Médias sur « Festival du court-métrage » : « Oui, les sous-titres dans les deux langues sont bienvenus. »");
  assert.equal(s.notifications[0].link, `#/clipper/messages/${festival.id}`);
  assert.deepEqual([s.threads[0].unread, s.threads[0].messages.map((m: { read: boolean }) => m.read)], [1, [true, true, false]]);
  // Le clipper ne lit ni n'écrit pour un autre : clipperId ignoré, sa propre conversation.
  assert.equal((await call("POST", `/api/campaigns/${festival.id}/messages`, { body: "Parfait, merci !", clipperId: amira })).status, 201);
  assert.equal((await state()).threads[0].messages.length, 4);

  // Campagne de ClipBoost : l'équipe répond (notification commune) ; l'admin n'écrit pas sur la campagne d'une agence.
  await login("admin@clipboost.dz", "AdminClip2026");
  s = await state();
  assert.deepEqual(s.threads.map((t: Thread) => t.campaignId).sort(), [kahwa.id, camp("Les Sketchs du Bled").id].sort());
  const lina: Thread = s.threads.find((t: Thread) => t.awaiting);
  assert.equal(lina.unread, 1);
  assert.deepEqual(await call("POST", `/api/campaigns/${festival.id}/messages`, { body: "Bonjour", clipperId: yacine }), { status: 403, data: { error: "Cette campagne appartient à une agence : c'est elle qui répond à ses clippers" } });
  assert.equal((await call("POST", `/api/campaigns/${lina.campaignId}/messages`, { body: "Publiez-le en vidéo classique, c'est accepté.", clipperId: lina.clipperId })).status, 201);
  await login("lina@clipboost.dz");
  assert.equal((await state()).notifications[0].text, "L'équipe ClipBoost a répondu sur « Les Sketchs du Bled » : « Publiez-le en vidéo classique, c'est accepté. »");

  // Agence : aucune conversation sur une campagne qui ne lui appartient pas ; non connecté : 401.
  await login("hoggar@clipboost.dz");
  assert.deepEqual((await state()).threads, []);
  await call("POST", "/api/auth/logout", {});
  assert.equal((await call("POST", `/api/campaigns/${festival.id}/messages`, { body: "Bonjour" })).status, 401);

  // Anti-spam : 30 messages par 10 minutes.
  await login("amira@clipboost.dz");
  for (let i = 0; i < 30; i++) assert.equal((await call("POST", `/api/campaigns/${kahwa.id}/messages`, { body: `Question ${i}` })).status, 201);
  assert.deepEqual(await call("POST", `/api/campaigns/${kahwa.id}/messages`, { body: "Encore une" }), { status: 429, data: { error: "Trop de messages envoyés, réessayez dans quelques minutes" } });
});

test("classement hebdomadaire : semaine écoulée clôturée une seule fois, primes du réglage, notifications", async () => {
  type Row = { rank: number; userId: string; name: string; views: number; prize?: number; amount?: number };
  type Tx = { id: string; type: string; label: string; amount: number; availableAt: string | null; userId: string };
  await offlineApi.reset();
  const lastWeek = weekKey(weekStart(Date.now()) - 1), n = weekNumber(lastWeek);
  // Données d'exemple : la semaine écoulée est déjà clôturée et payée ; la semaine en cours est classée en direct.
  assert.equal((await login("yacine@clipboost.dz")).status, 200);
  let s = await state();
  assert.equal(s.leaderboard.week, weekKey(Date.now()));
  assert.ok(s.leaderboard.top.length >= 3 && s.leaderboard.top.every((r: Row, i: number) => r.rank === i + 1 && r.views > 0 && (i === 0 || r.views <= s.leaderboard.top[i - 1].views)));
  for (const r of s.leaderboard.top) assert.deepEqual(Object.keys(r).sort(), ["avatar", "name", "prize", "rank", "userId", "views"]);
  assert.equal(s.leaderboard.me.rank, s.leaderboard.top.find((r: Row) => r.userId === s.me.id)?.rank ?? null);
  assert.equal(s.leaderboard.last.week, lastWeek);
  assert.ok(s.leaderboard.last.winners.length >= 3);
  assert.equal(s.leaderboard.history, undefined, "historique réservé à l'équipe");
  assert.ok(!JSON.stringify(s.leaderboard).includes("@clipboost.dz"), "aucune donnée privée des autres clippers");
  assert.equal((await login("agence@clipboost.dz")).status, 200);
  assert.equal((await state()).leaderboard, undefined);

  // L'équipe change les primes (10 montants exactement) et suspend un clipper : la clôture suivante en tient compte.
  await login("admin@clipboost.dz", "AdminClip2026");
  assert.deepEqual(await call("PATCH", "/api/admin/settings", { weeklyPrizes: [1, 2, 3] }), { status: 400, data: { error: "Indiquez les 10 primes du classement" } });
  assert.equal((await call("PATCH", "/api/admin/settings", { weeklyPrizes: [100, -1, 0, 0, 0, 0, 0, 0, 0, 0] })).status, 400);
  const prizes = [12345, 0, 6000, 4000, 3000, 2500, 2000, 1500, 1000, 1000];
  assert.equal((await call("PATCH", "/api/admin/settings", { weeklyPrizes: prizes })).status, 200);
  let admin = await state();
  assert.deepEqual([admin.settings.weeklyPrizes, admin.leaderboard.prizes, admin.leaderboard.history.length], [prizes, prizes, 1]);
  const before = admin.leaderboard.last.winners as Row[];
  const suspended = before[0].userId;
  assert.equal((await call("PATCH", `/api/admin/users/${suspended}`, { status: "Suspendu" })).status, 200);
  // Copie du navigateur où la semaine écoulée n'est pas encore clôturée : primes, notifications et tâche « weekly » retirées.
  const store = JSON.parse(storage.get(STORAGE_KEY)!);
  const oldPrizes = new Set(store.weeklyAwards.map((a: { transactionId: string | null }) => a.transactionId));
  store.transactions = store.transactions.filter((t: { id: string }) => !oldPrizes.has(t.id));
  store.notifications = store.notifications.filter((x: { text: string }) => !x.text.startsWith("Vous êtes "));
  store.weeklyAwards = [];
  store.jobRuns = store.jobRuns.filter((j: { name: string }) => j.name !== "weekly");
  storage.set(STORAGE_KEY, JSON.stringify(store));

  // Ouverture de l'app : la semaine écoulée est clôturée (GET /api/state), avec les primes du réglage, sans le clipper suspendu.
  admin = await state();
  const winners = admin.leaderboard.last.winners as Row[];
  assert.equal(admin.leaderboard.last.week, lastWeek);
  assert.ok(winners.length >= 2 && !winners.some((w) => w.userId === suspended));
  assert.deepEqual(winners.map((w) => w.userId), before.filter((w) => w.userId !== suspended).map((w) => w.userId));
  assert.deepEqual(winners.map((w) => w.amount), prizes.slice(0, winners.length));
  const paid = winners.filter((w) => w.amount! > 0);
  const total = paid.reduce((t, w) => t + w.amount!, 0);
  assert.equal(admin.activity[0].text, weekClosedText(lastWeek, paid.length, total));
  let saved = JSON.parse(storage.get(STORAGE_KEY)!);
  const prizeTx = () => (JSON.parse(storage.get(STORAGE_KEY)!).transactions as Tx[]).filter((t) => t.type === "gain" && t.label.startsWith("Prime classement"));
  assert.equal(prizeTx().length, paid.length, "une prime de 0 DA ne crée aucun gain");
  assert.deepEqual(saved.jobRuns.find((j: { name: string }) => j.name === "weekly").summary, { week: lastWeek, winners: paid.length, paid: total });
  // 2e : prime de 0 DA (rang enregistré, aucune transaction).
  assert.equal(saved.weeklyAwards.find((a: { rank: number }) => a.rank === 2).transactionId, null);

  // Clôturée deux fois (relevé des vues, ouverture suivante, appel direct) : rien n'est payé de plus.
  assert.deepEqual((await call("POST", "/api/admin/track-views")).data.closedWeeks, []);
  assert.deepEqual((await call("GET", "/api/cron/views")).data.closedWeeks, []);
  await state();
  const db = await load();
  assert.deepEqual(closeWeek({ db, commit: () => save(db) }, lastWeek), { week: lastWeek, closed: false, winners: 0, paid: 0 });
  assert.equal(prizeTx().length, paid.length);
  assert.equal(JSON.parse(storage.get(STORAGE_KEY)!).weeklyAwards.length, winners.length);
  // Semaine en cours : pas encore terminée.
  assert.throws(() => closeWeek({ db, commit: () => save(db) }, weekKey(Date.now())), /pas encore terminée/);

  // Le gagnant : notification avec le lien vers sa prime (en rétention 3 jours), libellé de la transaction.
  const first = winners[0], user = admin.users.find((u: { id: string }) => u.id === first.userId);
  assert.equal((await login(user.email)).status, 200);
  s = await state();
  const tx = (s.transactions as Tx[]).find((t) => t.label === `Prime classement · semaine ${n} (1er)`)!;
  assert.deepEqual([tx.amount, tx.type], [12345, "gain"]);
  assert.ok(Math.abs(Date.parse(tx.availableAt!) - Date.now() - 3 * 86_400_000) < 60_000);
  const note = s.notifications.find((x: { text: string }) => x.text === `Vous êtes 1er du classement de la semaine ${n} : +12 345 DA`);
  assert.deepEqual([note?.link, note?.unread], [`#/clipper/portefeuille/${tx.id}`, true]);
  assert.equal(s.leaderboard.last.winners[0].userId, first.userId);
});

test("parrainage : lien, inscription avec code, prime au premier retrait seulement, même compte de retrait", async () => {
  type User = { id: string; email: string; referralCode: string | null; referredBy: string | null };
  type Tx = { id: string; type: string; label: string; amount: number; status: string; userId: string; availableAt: string | null };
  await offlineApi.reset();
  await call("GET", "/api/state");
  // Lien public : prénom du parrain seulement ; code en minuscules accepté ; code inconnu : 404.
  assert.deepEqual(await call("GET", "/api/referral/yacine26"), { status: 200, data: { code: "YACINE26", firstName: "Yacine" } });
  assert.deepEqual(await call("GET", "/api/referral/ZZZZ9999"), { status: 404, data: { error: "Code de parrainage inconnu" } });
  assert.equal((await call("GET", "/api/referral/agence")).status, 404);

  // Inscription d'un clipper avec le code (email + code) : filleul de Yacine, avec son propre code.
  const signup = async (email: string, ref: unknown, role = "clipper") => {
    await call("POST", "/api/auth/logout");
    const res = await call("POST", "/api/auth/signup", { role, name: `Test ${email.split("@")[0]}`, contact: role === "agence" ? "Sara" : undefined, email, country: "Algérie", password: "Filleul2026", terms: true, ref });
    assert.equal(res.status, 200, `${email} : ${JSON.stringify(res.data)}`);
    assert.equal((await call("POST", "/api/auth/verify", { email, code: res.data.devCode })).status, 200);
    return (await state()).me as User;
  };
  await login("admin@clipboost.dz", "AdminClip2026");
  let adm = await state();
  const yacine = (adm.users as User[]).find((u) => u.email === "yacine@clipboost.dz")!;
  assert.equal(yacine.referralCode, "YACINE26");
  assert.deepEqual((adm.users as User[]).filter((u) => u.referredBy === yacine.id).map((u) => u.email).sort(), ["amira@clipboost.dz", "karim@clipboost.dz", "lina@clipboost.dz"]);
  const sami = await signup("sami@test.dz", "yacine26");
  assert.equal(sami.referredBy, yacine.id);
  assert.match(sami.referralCode!, /^[A-Z2-9]{8}$/);
  // Un code invalide, inconnu ou d'un autre format n'empêche jamais l'inscription : il est ignoré.
  for (const [email, ref] of [["nadia@test.dz", "ZZZZ9999"], ["omar@test.dz", "!!pas un code!!"], ["rym@test.dz", 42], ["walid@test.dz", "x".repeat(500)]] as const) {
    assert.equal((await signup(email, ref)).referredBy, null, email);
  }
  // Une agence n'est jamais filleule (ni n'a de code) ; le code d'un filleul fonctionne aussi.
  assert.deepEqual(await signup("studio@test.dz", "YACINE26", "agence").then((u) => [u.referredBy, u.referralCode]), [null, null]);
  assert.equal((await signup("ines@test.dz", sami.referralCode)).referredBy, sami.id);
  // Connexion Google simulée : même règle, le code passe par la connexion simulée.
  await call("POST", "/api/auth/logout");
  assert.equal((await call("POST", "/api/auth/oauth/demo", { provider: "google", name: "Amine Bensalem", email: "amine@gmail.com", role: "clipper", mode: "signup", ref: "YACINE26" })).status, 200);
  assert.equal((await state()).me.referredBy, yacine.id);

  // Prime du réglage (modifiée par l'équipe) au premier retrait validé d'Amira, en attente dans les données d'exemple.
  await login("admin@clipboost.dz", "AdminClip2026");
  assert.deepEqual(await call("PATCH", "/api/admin/settings", { referralBonus: -5 }), { status: 400, data: { error: "Prime de parrainage invalide" } });
  assert.equal((await call("PATCH", "/api/admin/settings", { referralBonus: 1500, holdDays: 0 })).status, 200);
  adm = await state();
  assert.equal(adm.settings.referralBonus, 1500);
  const amira = (adm.users as User[]).find((u) => u.email === "amira@clipboost.dz")!;
  const amiraWd = (adm.transactions as Tx[]).find((t) => t.userId === amira.id && t.type === "retrait" && t.status === "En cours")!;
  assert.equal((await call("POST", `/api/transactions/${amiraWd.id}/review`, { approve: true })).status, 200);
  adm = await state();
  assert.ok(adm.activity.some((a: { text: string }) => a.text === "Prime de parrainage de 1 500 DA versée à Yacine Benali (premier retrait de Amira Khelifi)."));
  const bonuses = async () => {
    await login("yacine@clipboost.dz");
    const st = await state();
    return { st, list: (st.transactions as Tx[]).filter((t) => t.type === "gain" && t.label.startsWith("Parrainage · premier retrait de ")) };
  };
  let { st, list } = await bonuses();
  const amiraBonus = list.find((t) => t.label === "Parrainage · premier retrait de Amira Khelifi")!;
  assert.deepEqual([amiraBonus.amount, amiraBonus.status], [1500, "Validé"]);
  assert.ok(Math.abs(Date.parse(amiraBonus.availableAt!) - Date.now()) < 60_000);
  const note = st.notifications[0];
  assert.deepEqual([note.text, note.link], ["Amira Khelifi a fait son premier retrait : +1 500 DA de parrainage", `#/clipper/portefeuille/${amiraBonus.id}`]);
  assert.deepEqual(st.referral.stats, { referees: 5, firstWithdrawals: 2, bonus: 2500 });
  assert.equal(st.referral.code, "YACINE26");
  const amiraRow = st.referral.referees.find((r: { name: string }) => r.name === "Amira Khelifi");
  assert.deepEqual(amiraRow, { name: "Amira Khelifi", joined: amiraRow.joined, firstWithdrawal: true, bonus: 1500 });
  for (const r of st.referral.referees) assert.deepEqual(Object.keys(r).sort(), ["bonus", "firstWithdrawal", "joined", "name"]);

  // Deuxième retrait d'Amira validé (après la validation de son clip en attente) : aucune nouvelle prime.
  await login("admin@clipboost.dz", "AdminClip2026");
  const amiraClip = (await state()).publications.find((p: { userId: string; status: string }) => p.userId === amira.id && p.status === "En attente");
  assert.equal((await call("POST", `/api/clips/${amiraClip.id}/review`, { approve: true })).status, 200);
  await login("amira@clipboost.dz");
  assert.equal((await call("POST", "/api/withdrawals", { amount: 2000 })).status, 201);
  await login("admin@clipboost.dz", "AdminClip2026");
  const second = ((await state()).transactions as Tx[]).find((t) => t.userId === amira.id && t.status === "En cours")!;
  assert.equal((await call("POST", `/api/transactions/${second.id}/review`, { approve: true })).status, 200);
  ({ st, list } = await bonuses());
  assert.equal(list.filter((t) => t.label === "Parrainage · premier retrait de Amira Khelifi").length, 1);
  assert.equal(st.referral.stats.bonus, 2500);

  // Même compte de retrait que le parrain (écrit autrement) : premier retrait de Lina validé, aucune prime, noté au journal.
  await login("lina@clipboost.dz");
  assert.equal((await call("PATCH", "/api/me", { payoutMethod: "CCP", payoutAccount: "0021234567 CLÉ 89" })).status, 200);
  await login("admin@clipboost.dz", "AdminClip2026");
  adm = await state();
  const lina = (adm.users as User[]).find((u) => u.email === "lina@clipboost.dz")!;
  const clip = adm.publications.find((p: { userId: string; status: string }) => p.userId === lina.id && p.status === "En attente");
  assert.equal((await call("POST", `/api/clips/${clip.id}/review`, { approve: true })).status, 200);
  await login("lina@clipboost.dz");
  assert.equal((await call("POST", "/api/withdrawals", { amount: 2000 })).status, 201);
  await login("admin@clipboost.dz", "AdminClip2026");
  const linaWd = ((await state()).transactions as Tx[]).find((t) => t.userId === lina.id && t.status === "En cours")!;
  assert.equal((await call("POST", `/api/transactions/${linaWd.id}/review`, { approve: true })).status, 200);
  assert.ok((await state()).activity.some((a: { text: string }) => a.text === "Prime de parrainage non versée : Lina Mansouri retire vers le même compte que son parrain Yacine Benali."));
  ({ st, list } = await bonuses());
  assert.ok(!list.some((t) => t.label.endsWith("Lina Mansouri")));
  assert.deepEqual(st.referral.stats, { referees: 5, firstWithdrawals: 3, bonus: 2500 });
  // Un autre rôle ne reçoit pas de parrainage dans son état.
  await login("agence@clipboost.dz");
  assert.equal((await state()).referral, undefined);
});

test("académie : leçons publiées pour les clippers, création, modification, ordre et suppression par l'admin", async () => {
  type Lesson = { id: string; category: string; title: { fr: string; en?: string; ar?: string }; summary: { fr: string }; body?: { fr: string; en?: string }; html: { fr: string; en?: string; ar?: string }; position: number; published: boolean; videoUrl: string | null };
  const lessons = async () => (await state()).lessons as Lesson[];
  // Clipper : les cinq leçons de départ publiées, traduites, dans l'ordre ; le brouillon d'exemple est caché.
  assert.equal((await login("yacine@clipboost.dz")).status, 200);
  let seen = await lessons();
  assert.deepEqual(seen.map((l) => l.id), ["capcut-10-minutes", "accroche-3-secondes", "formats-qui-marchent", "sous-titres-texte", "regles-campagne"]);
  assert.ok(seen.every((l) => l.published && l.title.en && l.title.ar && l.html.en && l.html.ar && l.body === undefined));
  assert.match(seen[0].html.fr, /^<p>Un bon clip .*<\/p><ol><li>Ouvrez CapCut/);
  const draft = { category: "Formats", emoji: "🎯", minutes: 2, videoUrl: "", title: { fr: "Brouillon secret", en: "" }, summary: { fr: "Résumé" }, body: { fr: "Texte" }, published: false };
  assert.equal((await call("POST", "/api/lessons", draft)).status, 403);
  // Agence : pas d'Académie, pas d'écriture.
  assert.equal((await login("agence@clipboost.dz")).status, 200);
  assert.deepEqual((await state()).lessons, undefined);
  assert.equal((await call("PUT", "/api/lessons/capcut-10-minutes", draft)).status, 403);

  // Admin : toutes les leçons, brouillon d'exemple compris (en dernier, français seul : l'interface affiche le français).
  assert.equal((await login("admin@clipboost.dz", "AdminClip2026")).status, 200);
  let all = await lessons();
  assert.equal(all.length, 6);
  const demo = all[5];
  assert.deepEqual([demo.published, demo.title.en, demo.html.en, typeof demo.body?.fr], [false, undefined, undefined, "string"]);
  // Contrôles : français obligatoire, lien https seulement, durée entière.
  const bad = async (patch: object) => (await call("POST", "/api/lessons", { ...draft, ...patch })).data.error;
  assert.equal(await bad({ title: { fr: "  " } }), "Titre en français obligatoire");
  assert.equal(await bad({ body: { en: "Only English" } }), "Contenu en français manquant");
  assert.equal(await bad({ videoUrl: "javascript:alert(1)" }), "Le lien de la vidéo doit être une adresse https://");
  assert.equal(await bad({ minutes: 2.5 }), "Durée invalide");

  // Création : rangée en dernier, brouillon invisible des clippers, traduction vide non enregistrée, corps échappé.
  const created = await call("POST", "/api/lessons", { ...draft, body: { fr: "<script>alert(1)</script>\n- <b>gras</b> & \"cité\"\n\n1. Étape <img src=x onerror=alert(1)>", en: "Hello <i>there</i>" } });
  assert.equal(created.status, 201);
  const id = created.data.id as string;
  all = await lessons();
  let mine = all.find((l) => l.id === id)!;
  assert.deepEqual([all.at(-1)!.id, mine.position, mine.published, mine.title.en, mine.videoUrl], [id, 7, false, undefined, null]);
  assert.equal(mine.html.fr, "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p><ul><li>&lt;b&gt;gras&lt;/b&gt; &amp; &quot;cité&quot;</li></ul><ol><li>Étape &lt;img src=x onerror=alert(1)&gt;</li></ol>");
  assert.equal(mine.html.en, "<p>Hello &lt;i&gt;there&lt;/i&gt;</p>");
  assert.equal(mine.html.ar, undefined);
  assert.ok(!/<(script|b|img|i)[\s>]/.test(mine.html.fr + mine.html.en));
  assert.equal((await login("yacine@clipboost.dz")).status, 200);
  assert.ok(!(await lessons()).some((l) => l.id === id || l.title.fr === "Brouillon secret"));

  // Modification et publication : visible des clippers, avec le français pour la langue non traduite.
  assert.equal((await login("admin@clipboost.dz", "AdminClip2026")).status, 200);
  assert.equal((await call("PUT", `/api/lessons/${id}`, { ...draft, title: { fr: "Leçon publiée", ar: "درس منشور" }, body: { fr: "Bonjour" }, videoUrl: "https://www.youtube.com/watch?v=abc", published: true })).status, 200);
  assert.equal((await call("PUT", "/api/lessons/inconnue", draft)).data.error, "Leçon introuvable");
  assert.equal((await login("yacine@clipboost.dz")).status, 200);
  seen = await lessons();
  mine = seen.find((l) => l.id === id)!;
  assert.deepEqual([mine.title, mine.html, mine.videoUrl], [{ fr: "Leçon publiée", ar: "درس منشور" }, { fr: "<p>Bonjour</p>" }, "https://www.youtube.com/watch?v=abc"]);
  assert.equal(lessonText(mine.title, "en"), "Leçon publiée");
  assert.equal(lessonText(mine.title, "ar"), "درس منشور");
  assert.equal(lessonText({ fr: "Titre", en: "  " }, "en"), "Titre");

  // Ordre : monter deux fois, descendre une fois ; aux extrémités, rien ne change.
  assert.equal((await login("admin@clipboost.dz", "AdminClip2026")).status, 200);
  const order = async () => (await lessons()).map((l) => l.id);
  const move = (lessonId: string, direction: string) => call("POST", `/api/lessons/${lessonId}/move`, { direction });
  await move(id, "up");
  await move(id, "up");
  assert.deepEqual((await order()).slice(-3), [id, "regles-campagne", "demo-plusieurs-plateformes"]);
  await move(id, "down");
  assert.deepEqual((await order()).slice(-3), ["regles-campagne", id, "demo-plusieurs-plateformes"]);
  assert.equal((await move("capcut-10-minutes", "up")).status, 200);
  assert.equal((await order())[0], "capcut-10-minutes");
  assert.deepEqual((await lessons()).map((l) => l.position), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal((await move(id, "sideways")).data.error, "Sens de déplacement invalide");

  // Suppression : la leçon disparaît pour tous ; journal d'activité en français (traduit par l'interface).
  assert.equal((await call("DELETE", `/api/lessons/${id}`)).status, 200);
  assert.equal((await call("DELETE", `/api/lessons/${id}`)).data.error, "Leçon introuvable");
  const s = await state();
  assert.ok(!s.lessons.some((l: Lesson) => l.id === id));
  const log = s.activity.map((a: { text: string }) => a.text);
  for (const line of ["Leçon « Brouillon secret » ajoutée en brouillon par Équipe ClipBoost.", "Leçon « Leçon publiée » publiée dans l'Académie par Équipe ClipBoost.", "Leçon « Leçon publiée » supprimée par Équipe ClipBoost."]) assert.ok(log.includes(line), line);
});

test("académie : rendu du corps des leçons (paragraphes, puces, étapes, échappement)", () => {
  assert.equal(lessonBodyHtml("Ligne 1\nLigne 2\n\n\nAutre paragraphe"), "<p>Ligne 1<br>Ligne 2</p><p>Autre paragraphe</p>");
  assert.equal(lessonBodyHtml("Intro :\n- un\n- deux\n3. trois\n4) quatre\nFin"), "<p>Intro :</p><ul><li>un</li><li>deux</li></ul><ol start=\"3\"><li>trois</li><li>quatre</li></ol><p>Fin</p>");
  assert.equal(lessonBodyHtml("<a href=\"javascript:x\">lien</a> 'ok'"), "<p>&lt;a href=&quot;javascript:x&quot;&gt;lien&lt;/a&gt; &#39;ok&#39;</p>");
  assert.equal(lessonBodyHtml("-sans espace\n1.5 kg"), "<p>-sans espace<br>1.5 kg</p>");
  assert.equal(lessonBodyHtml(""), "");
  assert.deepEqual(movedOrder([{ id: "a" }, { id: "b" }], "a", "up"), null);
  assert.deepEqual(movedOrder([{ id: "a" }, { id: "b" }], "a", "down"), ["b", "a"]);
});

test("réinitialisation : retour aux données d'exemple", async () => {
  await offlineApi.reset();
  assert.equal((await call("GET", "/api/state")).data.user, null);
  assert.equal((await login("atlas@test.dz", "Atlas2026x")).status, 400);
});
