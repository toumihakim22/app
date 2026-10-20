import { NextResponse, type NextRequest } from "next/server";
import { clientIp, rateLimit } from "@/lib/server/http";
import { OAuthError, isOAuthProvider, oauthErrorRedirect, startOAuth } from "@/lib/server/oauth";

type Ctx = { params: Promise<{ provider: string }> };

/**
 * Bouton « Continuer avec Google / Apple / Discord » : GET /api/auth/oauth/<fournisseur>?mode=login|signup&role=clipper|agence,
 * et &ref=<code> pour une inscription de clipper par un lien de parrainage.
 * Navigation de premier niveau : les erreurs reviennent à l'app (/espace?oauth_error=<code>), jamais en JSON.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { provider } = await params;
  try {
    if (!isOAuthProvider(provider)) throw new OAuthError("config");
    rateLimit(`oauth:${clientIp(req)}`, 30, 15 * 60_000);
    return NextResponse.redirect(await startOAuth(req, provider), 302);
  } catch (err) {
    return oauthErrorRedirect(req, err);
  }
}
