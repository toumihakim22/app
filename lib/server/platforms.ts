// Accès aux API officielles des plateformes (TikTok, Instagram, YouTube, Facebook), sans SDK : fetch et JSON.
// Identifiants dans les variables d'environnement (voir .env.example). Une plateforme sans ses identifiants est en
// « mode simulé » : l'appel n'a pas lieu et le service fait comme s'il avait réussi (démonstration, développement).
// Utilisé par la vérification des comptes sociaux (services/social.ts) ; les clients ci-dessous (jeton TikTok, Graph API
// de Meta, requête avec délai) servent aussi à tout autre appel aux mêmes API (relevé des vues…).

const TIMEOUT_MS = 10_000;
const GRAPH = "https://graph.facebook.com/v21.0";

const env = (key: string) => process.env[key]?.trim() ?? "";

/** Variables nécessaires à chaque plateforme : toutes définies, appels réels ; sinon mode simulé. */
export const PLATFORM_ENV: Record<string, string[]> = {
  TikTok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
  Instagram: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ID"],
  YouTube: ["YOUTUBE_API_KEY"],
  Facebook: ["FACEBOOK_ACCESS_TOKEN"],
};

export const platformConfigured = (platform: string) => !!PLATFORM_ENV[platform]?.every((k) => env(k) !== "");

// En production, une plateforme simulée est signalée une fois dans les journaux du serveur.
const warned = new Set<string>();
export function warnSimulated(platform: string) {
  if (process.env.NODE_ENV !== "production" || warned.has(platform)) return;
  warned.add(platform);
  console.warn(`[ClipBoost] ${platform} : ${PLATFORM_ENV[platform]?.join(", ")} absent(s), appels à l'API simulés.`);
}

/** Échec d'un appel à une plateforme (réseau, délai, quota, identifiants refusés…) ; le détail va dans les journaux. */
export class PlatformError extends Error {}

type JsonReply = { ok: boolean; status: number; data: unknown };

/** Valeur au bout d'un chemin dans un corps JSON (forme propre à chaque API), undefined si un maillon manque. */
export const dig = (value: unknown, ...path: (string | number)[]): unknown =>
  path.reduce<unknown>((o, k) => (o !== null && typeof o === "object" ? (o as Record<string | number, unknown>)[k] : undefined), value);

/**
 * Requête avec délai maximal ; une réponse en erreur garde son corps JSON (codes d'erreur de la plateforme).
 * Le message d'une erreur réseau ne cite que l'hôte : l'adresse peut contenir une clé ou un jeton.
 */
export async function requestJson(url: string, init: RequestInit = {}): Promise<JsonReply> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new PlatformError(`${new URL(url).host} : ${(err as Error).message}`);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Corps vide ou non JSON.
  }
  return { ok: res.ok, status: res.status, data };
}

// Jeton d'application TikTok (« client credentials », environ 2 heures), réutilisé jusqu'à une minute avant son expiration.
let tiktokToken: { value: string; expires: number } | null = null;

export async function tiktokAccessToken(): Promise<string> {
  if (tiktokToken && tiktokToken.expires > Date.now() + 60_000) return tiktokToken.value;
  const { ok, status, data } = await requestJson("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: env("TIKTOK_CLIENT_KEY"), client_secret: env("TIKTOK_CLIENT_SECRET"), grant_type: "client_credentials" }),
  });
  const token = dig(data, "access_token");
  if (!ok || typeof token !== "string") throw new PlatformError(`TikTok : jeton refusé (${status} ${String(dig(data, "error") ?? "")})`);
  tiktokToken = { value: token, expires: Date.now() + Number(dig(data, "expires_in") ?? 7200) * 1000 };
  return tiktokToken.value;
}

/** Appel POST à l'API Research de TikTok (jeton d'application) ; un jeton refusé est oublié pour le prochain appel. */
export async function tiktokResearch(path: string, fields: string, body: unknown): Promise<JsonReply> {
  const reply = await requestJson(`https://open.tiktokapis.com/v2/research/${path}?fields=${encodeURIComponent(fields)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await tiktokAccessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (reply.status === 401) tiktokToken = null;
  return reply;
}

/** Appel GET à la Graph API de Meta (Instagram, Facebook) avec le jeton d'accès donné. */
export const graphGet = (path: string, params: Record<string, string>, token: string) =>
  requestJson(`${GRAPH}/${path}?${new URLSearchParams({ ...params, access_token: token })}`);

/** Bio d'un compte : simulée (pas d'identifiants), lue, ou compte introuvable (inexistant, privé, non professionnel…). */
export type BioResult = { status: "simulated" } | { status: "found"; bio: string } | { status: "not_found" };

const failed = (platform: string, reply: JsonReply) =>
  new PlatformError(`${platform} : ${reply.status} ${String(dig(reply.data, "error", "message") ?? dig(reply.data, "error", "code") ?? "")}`.trim());

/**
 * Bio publique d'un compte (`handle` normalisé, sans « @ ») par l'API officielle de sa plateforme :
 * - YouTube : description de la chaîne (Data API v3, channels?forHandle=@…, clé YOUTUBE_API_KEY) ;
 * - Instagram : biographie d'un compte professionnel (Business Discovery de la Graph API, via le compte INSTAGRAM_BUSINESS_ID) ;
 * - Facebook : champs « about » et « description » d'une page (Graph API) ;
 * - TikTok : bio_description (API Research, jeton d'application obtenu avec TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET).
 * Lève PlatformError si l'API ne répond pas ou refuse la requête.
 */
export async function fetchProfileBio(platform: string, handle: string): Promise<BioResult> {
  if (!platformConfigured(platform)) {
    warnSimulated(platform);
    return { status: "simulated" };
  }
  if (platform === "YouTube") {
    const reply = await requestJson(`https://www.googleapis.com/youtube/v3/channels?${new URLSearchParams({ part: "snippet", forHandle: `@${handle}`, key: env("YOUTUBE_API_KEY") })}`);
    if (!reply.ok) throw failed(platform, reply);
    const item = dig(reply.data, "items", 0);
    return item ? { status: "found", bio: String(dig(item, "snippet", "description") ?? "") } : { status: "not_found" };
  }
  if (platform === "Instagram") {
    const reply = await graphGet(env("INSTAGRAM_BUSINESS_ID"), { fields: `business_discovery.username(${handle}){biography}` }, env("INSTAGRAM_ACCESS_TOKEN"));
    if (reply.ok) return { status: "found", bio: String(dig(reply.data, "business_discovery", "biography") ?? "") };
    // Compte inconnu, ou personnel (la Business Discovery ne voit que les comptes professionnels : créateur ou entreprise).
    if (dig(reply.data, "error", "code") === 110 || dig(reply.data, "error", "error_subcode") === 2207013) return { status: "not_found" };
    throw failed(platform, reply);
  }
  if (platform === "Facebook") {
    const reply = await graphGet(encodeURIComponent(handle), { fields: "about,description" }, env("FACEBOOK_ACCESS_TOKEN"));
    if (reply.ok) return { status: "found", bio: [dig(reply.data, "about"), dig(reply.data, "description")].filter(Boolean).join("\n") };
    // 803 : nom de page inconnu ; 100/33 : objet inexistant ou inaccessible.
    const code = dig(reply.data, "error", "code");
    if (code === 803 || (code === 100 && dig(reply.data, "error", "error_subcode") === 33)) return { status: "not_found" };
    throw failed(platform, reply);
  }
  if (platform === "TikTok") {
    const reply = await tiktokResearch("user/info/", "bio_description", { username: handle });
    const bio = dig(reply.data, "data", "bio_description");
    if (reply.ok && bio !== undefined) return { status: "found", bio: String(bio ?? "") };
    // Compte inexistant ou privé : erreur « invalid_params » avec un message explicite.
    if (/not exist|not found|private/i.test(String(dig(reply.data, "error", "message") ?? ""))) return { status: "not_found" };
    throw failed(platform, reply);
  }
  throw new PlatformError(`Plateforme inconnue : ${platform}`);
}
