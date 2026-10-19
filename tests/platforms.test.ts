// Lecture de la bio et des statistiques d'un clip par les API des plateformes (lib/server/platforms.ts), sans réseau : fetch est remplacé par des
// réponses types de chaque API (forme des corps JSON et codes d'erreur documentés par TikTok, Meta et Google).
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchClipStats, fetchProfileBio, PLATFORM_ENV, PlatformError, platformConfigured, videoIdOf } from "../lib/server/platforms";

const realFetch = globalThis.fetch;
const KEYS = Object.values(PLATFORM_ENV).flat();
const setKeys = () => KEYS.forEach((k) => { process.env[k] = `test-${k.toLowerCase()}`; });
afterEach(() => { globalThis.fetch = realFetch; KEYS.forEach((k) => { delete process.env[k]; }); });

/** fetch simulé : chaque appel est noté, la réponse vient de `reply(url, init)` ([statut, corps JSON]). */
function mockFetch(reply: (url: string, init?: RequestInit) => [number, unknown]) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const [status, body] = reply(url, init);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

test("sans identifiants, la plateforme est simulée : aucun appel", async () => {
  const calls = mockFetch(() => [500, {}]);
  for (const p of ["TikTok", "Instagram", "YouTube", "Facebook"]) {
    assert.equal(platformConfigured(p), false);
    assert.deepEqual(await fetchProfileBio(p, "compte"), { status: "simulated" });
  }
  // Une partie seulement des identifiants (Instagram sans INSTAGRAM_BUSINESS_ID) : toujours simulé.
  process.env.INSTAGRAM_ACCESS_TOKEN = "jeton";
  assert.deepEqual(await fetchProfileBio("Instagram", "compte"), { status: "simulated" });
  assert.equal(calls.length, 0);
});

test("YouTube, Instagram, Facebook : bio lue, compte introuvable, erreur de l'API", async () => {
  setKeys();
  const calls = mockFetch((url) => {
    if (url.includes("googleapis.com")) return url.includes("forHandle=%40inconnu") ? [200, { items: [] }] : url.includes("quota") ? [403, { error: { code: 403, message: "quotaExceeded" } }] : [200, { items: [{ snippet: { description: "Clips foot · CB-7F3K" } }] }];
    if (url.includes("business_discovery")) return decodeURIComponent(url).includes("username(perso)") ? [400, { error: { code: 110, error_subcode: 2207013, message: "Cannot find User" } }] : [200, { business_discovery: { biography: "Mode à Oran cb-7f3k" } }];
    if (url.includes("graph.facebook.com/v21.0/inconnue")) return [404, { error: { code: 803, message: "Some of the aliases you requested do not exist" } }];
    if (url.includes("graph.facebook.com/v21.0/panne")) return [500, { error: { code: 1, message: "An unknown error occurred" } }];
    return [200, { about: "Sketchs", description: "Code : CB-7F3K" }];
  });
  assert.deepEqual(await fetchProfileBio("YouTube", "yacineclips"), { status: "found", bio: "Clips foot · CB-7F3K" });
  assert.match(calls[0], /youtube\/v3\/channels\?part=snippet&forHandle=%40yacineclips&key=test-youtube_api_key$/);
  assert.deepEqual(await fetchProfileBio("YouTube", "inconnu"), { status: "not_found" });
  await assert.rejects(fetchProfileBio("YouTube", "quota"), (e) => e instanceof PlatformError && /YouTube : 403 quotaExceeded/.test(e.message));
  assert.deepEqual(await fetchProfileBio("Instagram", "amira.style"), { status: "found", bio: "Mode à Oran cb-7f3k" });
  assert.match(decodeURIComponent(calls.at(-1)!), /v21\.0\/test-instagram_business_id\?fields=business_discovery\.username\(amira\.style\)\{biography\}&access_token=test-instagram_access_token$/);
  assert.deepEqual(await fetchProfileBio("Instagram", "perso"), { status: "not_found" });
  assert.deepEqual(await fetchProfileBio("Facebook", "dzsketchs"), { status: "found", bio: "Sketchs\nCode : CB-7F3K" });
  assert.deepEqual(await fetchProfileBio("Facebook", "inconnue"), { status: "not_found" });
  await assert.rejects(fetchProfileBio("Facebook", "panne"), PlatformError);
});

test("TikTok : jeton d'application réutilisé, bio lue, compte inexistant, jeton refusé", async () => {
  setKeys();
  let tokens = 0;
  const calls = mockFetch((url, init) => {
    if (url.endsWith("/oauth/token/")) { tokens++; return [200, { access_token: `jeton-${tokens}`, expires_in: 7200, token_type: "Bearer" }]; }
    const { username } = JSON.parse(String(init?.body));
    if (username === "absent") return [400, { data: {}, error: { code: "invalid_params", message: "The user does not exist or is private" } }];
    if (username === "expire") return [401, { error: { code: "access_token_invalid", message: "The access token is invalid" } }];
    return [200, { data: { bio_description: "Clips · CB-7F3K" }, error: { code: "ok", message: "" } }];
  });
  assert.deepEqual(await fetchProfileBio("TikTok", "yacine.clips"), { status: "found", bio: "Clips · CB-7F3K" });
  assert.match(calls[1], /research\/user\/info\/\?fields=bio_description$/);
  assert.deepEqual(await fetchProfileBio("TikTok", "absent"), { status: "not_found" });
  assert.equal(tokens, 1);
  // Jeton refusé : erreur, puis un nouveau jeton à l'appel suivant.
  await assert.rejects(fetchProfileBio("TikTok", "expire"), PlatformError);
  await fetchProfileBio("TikTok", "yacine.clips");
  assert.equal(tokens, 2);
});

test("réseau injoignable : PlatformError qui ne cite que l'hôte (jamais la clé)", async () => {
  setKeys();
  globalThis.fetch = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
  await assert.rejects(fetchProfileBio("YouTube", "x"), (e) => e instanceof PlatformError && e.message === "www.googleapis.com : fetch failed");
});

test("identifiant de la vidéo dans le lien d'un clip", () => {
  assert.equal(videoIdOf("YouTube", "https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share"), "dQw4w9WgXcQ");
  assert.equal(videoIdOf("YouTube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), "dQw4w9WgXcQ");
  assert.equal(videoIdOf("YouTube", "https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(videoIdOf("YouTube", "https://www.youtube.com/@yacineclips"), null);
  assert.equal(videoIdOf("TikTok", "https://www.tiktok.com/@yacine.clips/video/7351234567890123456?lang=fr"), "7351234567890123456");
  assert.equal(videoIdOf("TikTok", "https://vm.tiktok.com/ZMabc123/"), null);
  assert.equal(videoIdOf("Instagram", "https://www.instagram.com/reel/C5xYz_12AbC/"), "C5xYz_12AbC");
  assert.equal(videoIdOf("Instagram", "https://www.instagram.com/p/C5xYz_12AbC/?img_index=1"), "C5xYz_12AbC");
  assert.equal(videoIdOf("Facebook", "https://www.facebook.com/dzsketchs/videos/1234567890123/"), "1234567890123");
  assert.equal(videoIdOf("Facebook", "https://www.facebook.com/watch?v=1234567890123"), "1234567890123");
  assert.equal(videoIdOf("Facebook", "https://www.facebook.com/reel/987654321098"), "987654321098");
  assert.equal(videoIdOf("Facebook", "pas un lien"), null);
});

test("statistiques d'un clip : simulées sans clés, lues par chaque API, introuvables, erreur", async () => {
  const yt = "https://www.youtube.com/shorts/dQw4w9WgXcQ", tk = "https://www.tiktok.com/@yacine.clips/video/7351234567890123456";
  const ig = "https://www.instagram.com/reel/C5xYz_12AbC/", fb = "https://www.facebook.com/dzsketchs/videos/1234567890123/";
  const none = mockFetch(() => [500, {}]);
  for (const [p, u] of [["YouTube", yt], ["TikTok", tk], ["Instagram", ig], ["Facebook", fb]]) assert.deepEqual(await fetchClipStats(p, u), { status: "simulated" });
  assert.equal(none.length, 0);

  setKeys();
  const bodies: unknown[] = [];
  const calls = mockFetch((url, init) => {
    if (url.includes("googleapis.com")) return url.includes("id=AAAAAAAAAAA") ? [200, { items: [] }] : url.includes("id=BBBBBBBBBBB") ? [403, { error: { code: 403, message: "quotaExceeded" } }]
      : [200, { items: [{ id: "dQw4w9WgXcQ", statistics: { viewCount: "48200", likeCount: "2110", commentCount: "35" } }] }];
    if (url.endsWith("/oauth/token/")) return [200, { access_token: "jeton", expires_in: 7200 }];
    if (url.includes("research/video/query")) { bodies.push(JSON.parse(String(init?.body))); return [200, { data: { videos: [{ id: 7351234567890123456, view_count: 15300, like_count: 940 }], has_more: false }, error: { code: "ok" } }]; }
    if (url.includes("business_discovery")) return [200, { business_discovery: { media: { data: [
      { permalink: "https://www.instagram.com/p/AUTRE123/", like_count: 3, view_count: 10 },
      { permalink: "https://www.instagram.com/reel/C5xYz_12AbC/", like_count: 512 },
      { permalink: "https://www.instagram.com/reel/D9vues_OK/", like_count: 77, view_count: 8100 },
    ] } } }];
    if (url.includes("/v21.0/1234567890123")) return [200, { views: 22000, likes: { data: [], summary: { total_count: 640 } }, id: "1234567890123" }];
    if (url.includes("/v21.0/1111111111111")) return [400, { error: { code: 100, error_subcode: 33, message: "Unsupported get request" } }];
    return [500, { error: { message: "inattendu" } }];
  });
  assert.deepEqual(await fetchClipStats("YouTube", yt), { status: "found", views: 48200, likes: 2110 });
  assert.match(calls.at(-1)!, /youtube\/v3\/videos\?part=statistics&id=dQw4w9WgXcQ&key=test-youtube_api_key$/);
  assert.deepEqual(await fetchClipStats("YouTube", "https://youtu.be/AAAAAAAAAAA"), { status: "not_found" });
  await assert.rejects(fetchClipStats("YouTube", "https://youtu.be/BBBBBBBBBBB"), (e) => e instanceof PlatformError && /YouTube : 403/.test(e.message));
  // TikTok : vidéo cherchée par son identifiant parmi celles créées dans les 30 jours avant l'envoi.
  assert.deepEqual(await fetchClipStats("TikTok", tk, { submittedAt: new Date("2026-03-10T12:00:00Z") }), { status: "found", views: 15300, likes: 940 });
  assert.match(decodeURIComponent(calls.at(-1)!), /research\/video\/query\/\?fields=id,view_count,like_count$/);
  assert.deepEqual(bodies[0], { query: { and: [{ operation: "EQ", field_name: "video_id", field_values: ["7351234567890123456"] }] }, start_date: "20260210", end_date: "20260311", max_count: 1 });
  // Instagram : par le compte vérifié du clipper ; publication sans view_count (compte non professionnel) : introuvable.
  assert.deepEqual(await fetchClipStats("Instagram", "https://www.instagram.com/reel/D9vues_OK/", { handle: "amira.style" }), { status: "found", views: 8100, likes: 77 });
  assert.match(decodeURIComponent(calls.at(-1)!), /business_discovery\.username\(amira\.style\)\{media\.limit\(50\)\{permalink,like_count,view_count\}\}/);
  assert.deepEqual(await fetchClipStats("Instagram", ig, { handle: "amira.style" }), { status: "not_found" });
  assert.deepEqual(await fetchClipStats("Instagram", ig), { status: "not_found" });
  assert.deepEqual(await fetchClipStats("Facebook", fb), { status: "found", views: 22000, likes: 640 });
  assert.deepEqual(await fetchClipStats("Facebook", "https://www.facebook.com/watch?v=1111111111111"), { status: "not_found" });
  // Lien sans identifiant de vidéo : introuvable, sans appel.
  const before = calls.length;
  assert.deepEqual(await fetchClipStats("TikTok", "https://vm.tiktok.com/ZMabc123/"), { status: "not_found" });
  assert.equal(calls.length, before);
});
