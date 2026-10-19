// Accès aux API officielles des plateformes (TikTok, Instagram, YouTube, Facebook), sans SDK : fetch et JSON.
// Identifiants dans les variables d'environnement (voir .env.example). Une plateforme sans ses identifiants est en
// « mode simulé » : l'appel n'a pas lieu et le service fait comme s'il avait réussi (démonstration, développement).
// Utilisé par la vérification des comptes sociaux (services/social.ts : fetchProfileBio) et par le relevé automatique des
// vues (services/tracking.ts : fetchClipStats) ; les clients (jeton TikTok, Graph API de Meta, requête avec délai) sont communs.

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

// ---------- Statistiques d'un clip (relevé automatique des vues) ----------

/** Statistiques d'un clip : simulées (pas d'identifiants), lues (likes null s'ils sont masqués), ou introuvables. */
export type StatsResult = { status: "simulated" } | { status: "found"; views: number; likes: number | null } | { status: "not_found" };

const segments = (url: URL) => url.pathname.split("/").filter(Boolean);
/** Segment qui suit l'un des mots donnés dans le chemin (« /shorts/<id> », « /video/<id> »…). */
const after = (parts: string[], ...words: string[]) => { const i = parts.findIndex((p) => words.includes(p.toLowerCase())); return i >= 0 ? parts[i + 1] ?? null : null; };
const valid = (id: string | null | undefined, re: RegExp) => (id && re.test(id) ? id : null);

/**
 * Identifiant de la vidéo dans le lien d'un clip, null si le lien ne le contient pas (lien court à résoudre, profil…) :
 * - YouTube : « youtu.be/<id> », « watch?v=<id> », « /shorts/<id> », « /live/<id> », « /embed/<id> » (11 signes) ;
 * - TikTok : « /@compte/video/<id> » ou « /photo/<id> » (chiffres) ; les liens courts « vm.tiktok.com/… » ne le contiennent pas ;
 * - Instagram : code de la publication, « /reel/<code> », « /reels/<code> », « /p/<code> », « /tv/<code> » ;
 * - Facebook : « /videos/<id> », « /reel/<id> », « watch?v=<id> », « video.php?v=<id> » (chiffres).
 */
export function videoIdOf(platform: string, raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const parts = segments(url), host = url.hostname.toLowerCase();
  if (platform === "YouTube") {
    const id = host.endsWith("youtu.be") ? parts[0] : url.searchParams.get("v") ?? after(parts, "shorts", "live", "embed", "v");
    return valid(id, /^[A-Za-z0-9_-]{11}$/);
  }
  if (platform === "TikTok") return valid(after(parts, "video", "photo"), /^\d{6,25}$/);
  if (platform === "Instagram") return valid(after(parts, "reel", "reels", "p", "tv"), /^[A-Za-z0-9_-]{5,40}$/);
  if (platform === "Facebook") return valid(url.searchParams.get("v") ?? after(parts, "videos", "reel", "reels"), /^\d{5,25}$/);
  return null;
}

const count = (v: unknown) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.floor(Number(v))));
const compactDay = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

/**
 * Vues et likes d'un clip par l'API officielle de sa plateforme (`url` : le lien soumis par le clipper) :
 * - YouTube : videos?part=statistics (viewCount, likeCount ; likeCount absent si les likes sont masqués) ;
 * - TikTok : API Research, video/query (view_count, like_count) sur les vidéos créées dans les 30 jours avant l'envoi du
 *   clip (`submittedAt`, fenêtre imposée par l'API) ;
 * - Instagram : Business Discovery du compte vérifié du clipper (`handle`), ses 50 dernières publications, retrouvée par
 *   son code (like_count, view_count : compte professionnel seulement ; sans view_count, le clip est introuvable) ;
 * - Facebook : nœud vidéo de la Graph API (views, likes.summary).
 * Lève PlatformError si l'API ne répond pas ou refuse la requête ; { status: "not_found" } si la vidéo n'est pas trouvée
 * ou si l'API ne donne pas ses vues.
 */
export async function fetchClipStats(platform: string, url: string, opts: { handle?: string | null; submittedAt?: Date } = {}): Promise<StatsResult> {
  if (!platformConfigured(platform)) {
    warnSimulated(platform);
    return { status: "simulated" };
  }
  const id = videoIdOf(platform, url);
  if (!id) return { status: "not_found" };
  if (platform === "YouTube") {
    const reply = await requestJson(`https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: "statistics", id, key: env("YOUTUBE_API_KEY") })}`);
    if (!reply.ok) throw failed(platform, reply);
    const stats = dig(reply.data, "items", 0, "statistics"), views = count(dig(stats, "viewCount"));
    return views === null ? { status: "not_found" } : { status: "found", views, likes: count(dig(stats, "likeCount")) };
  }
  if (platform === "TikTok") {
    const sent = opts.submittedAt ?? new Date();
    const body = {
      query: { and: [{ operation: "EQ", field_name: "video_id", field_values: [id] }] },
      start_date: compactDay(new Date(sent.getTime() - 28 * 86_400_000)), end_date: compactDay(new Date(sent.getTime() + 86_400_000)), max_count: 1,
    };
    const reply = await tiktokResearch("video/query/", "id,view_count,like_count", body);
    if (!reply.ok) throw failed(platform, reply);
    // L'API filtre déjà sur l'identifiant ; il revient en entier JSON de 64 bits, arrondi par JSON.parse au-delà de
    // 2^53 : la seule vidéo renvoyée est donc acceptée telle quelle.
    const videos = dig(reply.data, "data", "videos");
    const video = Array.isArray(videos) ? videos.find((v) => String(dig(v, "id")) === id) ?? (videos.length === 1 ? videos[0] : undefined) : undefined;
    const views = count(dig(video, "view_count"));
    return views === null ? { status: "not_found" } : { status: "found", views, likes: count(dig(video, "like_count")) };
  }
  if (platform === "Instagram") {
    if (!opts.handle) return { status: "not_found" };
    const reply = await graphGet(env("INSTAGRAM_BUSINESS_ID"), { fields: `business_discovery.username(${opts.handle}){media.limit(50){permalink,like_count,view_count}}` }, env("INSTAGRAM_ACCESS_TOKEN"));
    if (!reply.ok) {
      if (dig(reply.data, "error", "code") === 110 || dig(reply.data, "error", "error_subcode") === 2207013) return { status: "not_found" };
      throw failed(platform, reply);
    }
    const media = dig(reply.data, "business_discovery", "media", "data");
    const post = Array.isArray(media) ? media.find((m) => videoIdOf("Instagram", String(dig(m, "permalink") ?? "")) === id) : undefined;
    const views = count(dig(post, "view_count"));
    return views === null ? { status: "not_found" } : { status: "found", views, likes: count(dig(post, "like_count")) };
  }
  if (platform === "Facebook") {
    const reply = await graphGet(id, { fields: "views,likes.summary(true)" }, env("FACEBOOK_ACCESS_TOKEN"));
    if (!reply.ok) {
      if (dig(reply.data, "error", "code") === 100 && dig(reply.data, "error", "error_subcode") === 33) return { status: "not_found" };
      throw failed(platform, reply);
    }
    const views = count(dig(reply.data, "views"));
    return views === null ? { status: "not_found" } : { status: "found", views, likes: count(dig(reply.data, "likes", "summary", "total_count")) };
  }
  throw new PlatformError(`Plateforme inconnue : ${platform}`);
}
