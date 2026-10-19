// Lecture de la bio par les API des plateformes (lib/server/platforms.ts), sans réseau : fetch est remplacé par des
// réponses types de chaque API (forme des corps JSON et codes d'erreur documentés par TikTok, Meta et Google).
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchProfileBio, PLATFORM_ENV, PlatformError, platformConfigured } from "../lib/server/platforms";

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
