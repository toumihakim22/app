import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const badRequest = (message: string) => new ApiError(400, message);
export const forbidden = (message = "Accès refusé") => new ApiError(403, message);
export const notFound = (message = "Introuvable") => new ApiError(404, message);

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Hôte d'une origine (« https://clipboost.dz » → « clipboost.dz »), null si ce n'en est pas une. */
function hostOf(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

/**
 * Enveloppe commune des routes : erreurs JSON homogènes et protection CSRF
 * (une requête qui modifie des données doit venir du site lui-même).
 */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin");
        // « Origin: null » (page locale, iframe isolée, redirection d'un autre site) n'est pas une adresse : refusée aussi.
        if (origin && hostOf(origin) !== req.headers.get("host")) throw forbidden("Origine non autorisée");
      }
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) return json({ error: err.issues[0]?.message ?? "Données invalides" }, { status: 400 });
      console.error(err);
      return json({ error: "Erreur interne du serveur" }, { status: 500 });
    }
  };
}

/**
 * Taille maximale d'un corps de requête : les plus gros sont les formulaires avec images (profil d'agence : photo
 * et couverture, 1,5 Mo chacune au plus une fois décodées). Au-delà, la requête est refusée avant d'être lue en entier.
 */
const MAX_BODY_BYTES = 8_000_000;
const tooLarge = () => new ApiError(413, "Requête trop volumineuse");

async function readText(req: NextRequest): Promise<string> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw tooLarge();
  if (!req.body) return "";
  // Lecture par morceaux : un envoi sans Content-Length (« chunked ») est arrêté dès qu'il dépasse la limite.
  const reader = req.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      throw tooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function body<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = JSON.parse(await readText(req));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw badRequest("Corps de requête JSON attendu");
  }
  return schema.parse(data);
}

// Limitation simple du nombre de tentatives (par instance du serveur).
const hits = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  // Les fenêtres écoulées sont oubliées de temps en temps : la table ne grossit pas sans fin (essais sur des milliers d'emails).
  if (hits.size > 10_000) for (const [k, e] of hits) if (e.reset < now) hits.delete(k);
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  if (++entry.count > max) throw new ApiError(429, "Trop de tentatives, réessayez dans quelques minutes");
}

export const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
