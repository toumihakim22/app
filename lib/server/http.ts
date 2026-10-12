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

/**
 * Enveloppe commune des routes : erreurs JSON homogènes et protection CSRF
 * (une requête qui modifie des données doit venir du site lui-même).
 */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin");
        if (origin && new URL(origin).host !== req.headers.get("host")) throw forbidden("Origine non autorisée");
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

export async function body<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw badRequest("Corps de requête JSON attendu");
  }
  return schema.parse(data);
}

// Limitation simple du nombre de tentatives (par instance du serveur).
const hits = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  if (++entry.count > max) throw new ApiError(429, "Trop de tentatives, réessayez dans quelques minutes");
}

export const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
