// Connexion et inscription avec Google, Apple ou Discord (OAuth 2.0 / OpenID Connect), sans dépendance :
// node:crypto pour l'état, le PKCE, le nonce et le secret client d'Apple ; fetch pour les échanges avec les fournisseurs.
//
// 1. GET /api/auth/oauth/<fournisseur>?mode=login|signup&role=clipper|agence : un cookie HttpOnly (cb_oauth, 10 minutes)
//    garde l'état, le vérificateur PKCE, le nonce, le mode et le rôle ; redirection vers la page de consentement.
// 2. Retour sur /api/auth/oauth/<fournisseur>/callback (GET ; POST pour Apple, « form_post ») : l'état reçu doit être
//    celui du cookie (comparaison à temps constant), puis le code est échangé contre l'identité du compte.
// Le compte ClipBoost est ensuite retrouvé, relié ou créé par oauthSignIn (services/accounts.ts).
import { createHash, createPrivateKey, randomBytes, sign, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_PROVIDERS, type OAuthProvider } from "./validation";

/** Codes d'erreur transmis à l'app (/espace?oauth_error=<code>), qui affiche le message correspondant (web/src/auth.js). */
export type OAuthErrorCode = "config" | "state" | "denied" | "email" | "no_account" | "admin" | "suspended" | "signups_closed" | "maintenance" | "failed";

export class OAuthError extends Error {
  constructor(public code: OAuthErrorCode, detail?: string) {
    super(detail ?? code);
  }
}

/** Identité renvoyée par le fournisseur : identifiant stable du compte, adresse email vérifiée, nom affiché. */
export type OAuthIdentity = { provider: OAuthProvider; subject: string; email: string; name: string };
export type OAuthMode = "login" | "signup";
export type OAuthRole = "clipper" | "agence";

const COOKIE = "cb_oauth";
const COOKIE_PATH = "/api/auth/oauth";
const FLOW_SECONDS = 10 * 60;
const TIMEOUT_MS = 10_000;

const env = (key: string) => process.env[key]?.trim() ?? "";

const PROVIDERS = {
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    issuers: ["https://accounts.google.com", "accounts.google.com"],
    configured: () => !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")),
    clientId: () => env("GOOGLE_CLIENT_ID"),
  },
  discord: {
    authorize: "https://discord.com/oauth2/authorize",
    token: "https://discord.com/api/oauth2/token",
    scope: "identify email",
    issuers: [],
    configured: () => !!(env("DISCORD_CLIENT_ID") && env("DISCORD_CLIENT_SECRET")),
    clientId: () => env("DISCORD_CLIENT_ID"),
  },
  apple: {
    authorize: "https://appleid.apple.com/auth/authorize",
    token: "https://appleid.apple.com/auth/token",
    scope: "name email",
    issuers: ["https://appleid.apple.com"],
    configured: () => !!(env("APPLE_CLIENT_ID") && env("APPLE_TEAM_ID") && env("APPLE_KEY_ID") && env("APPLE_PRIVATE_KEY")),
    clientId: () => env("APPLE_CLIENT_ID"),
  },
} satisfies Record<OAuthProvider, unknown>;

export const isOAuthProvider = (p: string): p is OAuthProvider => (OAUTH_PROVIDERS as readonly string[]).includes(p);

/** Fournisseurs dont les identifiants sont définis : seuls leurs boutons sont proposés (GET /api/state, données publiques). */
export const configuredProviders = (): OAuthProvider[] => OAUTH_PROVIDERS.filter((p) => PROVIDERS[p].configured());

/** Adresse publique du site : APP_URL (recommandée en production, derrière un proxy), sinon l'origine de la requête. */
export function appOrigin(req: NextRequest) {
  const fromEnv = env("APP_URL");
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      console.error("[oauth] APP_URL invalide : origine de la requête utilisée");
    }
  }
  return req.nextUrl.origin;
}

/** Retour vers l'app après un échec : le code d'erreur devient un message sur la page de connexion (web/src/auth.js). */
export function oauthErrorRedirect(req: NextRequest, err: unknown) {
  const code: OAuthErrorCode = err instanceof OAuthError ? err.code : "failed";
  // Détail technique dans les journaux du serveur seulement (jamais de secret ni de jeton).
  if (code === "failed") console.error("[oauth]", err instanceof Error ? err.message : err);
  return NextResponse.redirect(new URL(`/espace?oauth_error=${code}#/connexion`, appOrigin(req)), 303);
}

/** Adresse de retour fixe, à déclarer telle quelle chez le fournisseur. */
export const callbackUrl = (req: NextRequest, provider: OAuthProvider) => `${appOrigin(req)}/api/auth/oauth/${provider}/callback`;

// ── Cookie du parcours ────────────────────────────────────────────────────────────────────────────────────────────

/** s : état, v : vérificateur PKCE, n : nonce, m : mode, r : rôle choisi à l'inscription, e : expiration (ms). */
type Flow = { p: OAuthProvider; s: string; v: string; n: string; m: OAuthMode; r: OAuthRole; e: number };

const random = (bytes = 32) => randomBytes(bytes).toString("base64url");
const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** Égalité à temps constant (état, nonce). */
function same(a: unknown, b: string) {
  if (typeof a !== "string") return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Apple revient par un POST depuis appleid.apple.com (« form_post ») : le cookie doit être SameSite=None, donc Secure.
// Google et Discord reviennent par une navigation GET : SameSite=Lax suffit (Secure en production).
const cookieOptions = (provider: OAuthProvider, maxAge: number) => ({
  httpOnly: true,
  secure: provider === "apple" || process.env.NODE_ENV === "production",
  sameSite: provider === "apple" ? ("none" as const) : ("lax" as const),
  path: COOKIE_PATH,
  maxAge,
});

function readFlow(raw: string | undefined): Flow | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Flow;
    const strings = [f.s, f.v, f.n].every((x) => typeof x === "string" && x.length >= 32);
    if (!strings || !isOAuthProvider(f.p) || (f.m !== "login" && f.m !== "signup") || (f.r !== "clipper" && f.r !== "agence") || typeof f.e !== "number") return null;
    return f;
  } catch {
    return null;
  }
}

/** Paramètres d'URL encodés en %20 (et non « + ») : Apple attend « scope=name%20email ». */
const query = (params: Record<string, string>) => Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

/** Début du parcours : enregistre le cookie et renvoie l'adresse de la page de consentement du fournisseur. */
export async function startOAuth(req: NextRequest, provider: OAuthProvider): Promise<string> {
  const conf = PROVIDERS[provider];
  if (!conf.configured()) throw new OAuthError("config");
  const q = req.nextUrl.searchParams;
  const flow: Flow = {
    p: provider, s: random(), v: random(48), n: random(),
    m: q.get("mode") === "login" ? "login" : "signup",
    r: q.get("role") === "agence" ? "agence" : "clipper",
    e: Date.now() + FLOW_SECONDS * 1000,
  };
  (await cookies()).set(COOKIE, b64url(JSON.stringify(flow)), cookieOptions(provider, FLOW_SECONDS));
  const params: Record<string, string> = { client_id: conf.clientId(), redirect_uri: callbackUrl(req, provider), response_type: "code", scope: conf.scope, state: flow.s };
  const pkce = { code_challenge: createHash("sha256").update(flow.v).digest("base64url"), code_challenge_method: "S256" };
  if (provider === "google") Object.assign(params, pkce, { nonce: flow.n, prompt: "select_account" });
  // Discord : pas de nonce (OAuth 2.0 seul) ; « prompt=none » évite de redemander le consentement déjà donné.
  if (provider === "discord") Object.assign(params, pkce, { prompt: "none" });
  // Apple : réponse en POST (obligatoire avec le scope name/email). Les paramètres PKCE ne font pas partie de son API
  // documentée : l'état, le nonce et l'authentification du client (secret signé) protègent l'échange.
  if (provider === "apple") Object.assign(params, { response_mode: "form_post", nonce: flow.n });
  return `${conf.authorize}?${query(params)}`;
}

// ── Retour du fournisseur ─────────────────────────────────────────────────────────────────────────────────────────

async function callbackParams(req: NextRequest, provider: OAuthProvider): Promise<Record<string, string>> {
  if (req.method === "GET") return Object.fromEntries(req.nextUrl.searchParams);
  // Seul Apple revient en POST (form_post).
  if (provider !== "apple") throw new OAuthError("state", "POST inattendu");
  try {
    const form = await req.formData();
    return Object.fromEntries([...form.entries()].filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch {
    throw new OAuthError("failed", "formulaire de retour illisible");
  }
}

async function call(url: string, init: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new OAuthError("failed", `${url} injoignable : ${(err as Error).message}`);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new OAuthError("failed", `${url} : ${res.status} ${String(data.error ?? "")}`);
  return data;
}

const tokenRequest = (url: string, form: Record<string, string>) =>
  call(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams(form) });

/**
 * Revendications d'un id_token OpenID Connect : émetteur, audience, expiration et nonce vérifiés.
 * La signature n'est pas vérifiée : le jeton vient directement du point de terminaison « token » du fournisseur,
 * sur une connexion TLS authentifiée et en échange du secret client (OpenID Connect Core, § 3.1.3.7, point 6).
 */
function idTokenClaims(token: unknown, issuers: string[], clientId: string, nonce: string) {
  if (typeof token !== "string" || token.split(".").length !== 3) throw new OAuthError("failed", "id_token absent");
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    throw new OAuthError("failed", "id_token illisible");
  }
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  const now = Date.now() / 1000;
  if (!issuers.includes(String(c.iss))) throw new OAuthError("failed", "id_token : émetteur inattendu");
  if (!aud.includes(clientId) || (aud.length > 1 && c.azp !== clientId)) throw new OAuthError("failed", "id_token : audience inattendue");
  if (typeof c.exp !== "number" || c.exp < now - 60) throw new OAuthError("failed", "id_token expiré");
  if (!same(c.nonce, nonce)) throw new OAuthError("failed", "id_token : nonce différent");
  if (typeof c.sub !== "string" || !c.sub) throw new OAuthError("failed", "id_token sans identifiant");
  return c;
}

const verifiedFlag = (v: unknown) => v === true || v === "true";
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Secret client d'Apple : JWT ES256 signé avec la clé privée « Sign in with Apple » (valable 5 minutes). */
function appleClientSecret() {
  let pem = env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (!pem.includes("BEGIN")) pem = `-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: env("APPLE_KEY_ID"), typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: env("APPLE_TEAM_ID"), iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: env("APPLE_CLIENT_ID") }));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${signature.toString("base64url")}`;
}

async function exchange(provider: OAuthProvider, req: NextRequest, flow: Flow, params: Record<string, string>): Promise<OAuthIdentity> {
  const conf = PROVIDERS[provider], clientId = conf.clientId(), redirectUri = callbackUrl(req, provider);
  const base = { grant_type: "authorization_code", code: params.code, redirect_uri: redirectUri, client_id: clientId };
  if (provider === "google") {
    const tok = await tokenRequest(conf.token, { ...base, client_secret: env("GOOGLE_CLIENT_SECRET"), code_verifier: flow.v });
    const c = idTokenClaims(tok.id_token, conf.issuers, clientId, flow.n);
    if (!text(c.email) || !verifiedFlag(c.email_verified)) throw new OAuthError("email");
    return { provider, subject: String(c.sub), email: text(c.email), name: text(c.name) || [text(c.given_name), text(c.family_name)].filter(Boolean).join(" ") };
  }
  if (provider === "discord") {
    const tok = await tokenRequest(conf.token, { ...base, client_secret: env("DISCORD_CLIENT_SECRET"), code_verifier: flow.v });
    if (typeof tok.access_token !== "string") throw new OAuthError("failed", "Discord : jeton d'accès absent");
    const me = await call("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/json" } });
    if (typeof me.id !== "string" || !me.id) throw new OAuthError("failed", "Discord : identifiant absent");
    if (!text(me.email) || me.verified !== true) throw new OAuthError("email");
    return { provider, subject: me.id, email: text(me.email), name: text(me.global_name) || text(me.username) };
  }
  const tok = await tokenRequest(conf.token, { ...base, client_secret: appleClientSecret() });
  const c = idTokenClaims(tok.id_token, conf.issuers, clientId, flow.n);
  if (!text(c.email) || !verifiedFlag(c.email_verified)) throw new OAuthError("email");
  // Apple n'envoie le nom qu'à la première autorisation, dans le champ « user » du formulaire de retour.
  let name = "";
  try {
    const user = JSON.parse(params.user ?? "null") as { name?: { firstName?: unknown; lastName?: unknown } } | null;
    name = [text(user?.name?.firstName), text(user?.name?.lastName)].filter(Boolean).join(" ");
  } catch {
    // Champ absent ou illisible : le nom sera tiré de l'adresse email.
  }
  return { provider, subject: String(c.sub), email: text(c.email), name };
}

/**
 * Retour du fournisseur : contrôle de l'état (cookie, à usage unique), puis échange du code contre l'identité vérifiée.
 * Renvoie aussi le mode et le rôle choisis au départ.
 */
export async function finishOAuth(req: NextRequest, provider: OAuthProvider): Promise<{ identity: OAuthIdentity; mode: OAuthMode; role: OAuthRole }> {
  const conf = PROVIDERS[provider];
  if (!conf.configured()) throw new OAuthError("config");
  const jar = await cookies();
  const flow = readFlow(jar.get(COOKIE)?.value);
  jar.set(COOKIE, "", cookieOptions(provider, 0));
  const params = await callbackParams(req, provider);
  // Consentement refusé (access_denied ; user_cancelled_authorize chez Apple).
  if (params.error) throw new OAuthError(/denied|cancel/i.test(params.error) ? "denied" : "failed", `${provider} : ${params.error}`);
  if (!flow || flow.p !== provider || flow.e < Date.now() || !same(params.state, flow.s)) throw new OAuthError("state");
  if (!params.code) throw new OAuthError("failed", `${provider} : code absent`);
  return { identity: await exchange(provider, req, flow, params), mode: flow.m, role: flow.r };
}
