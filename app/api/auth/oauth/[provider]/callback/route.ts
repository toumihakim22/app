import { NextResponse, type NextRequest } from "next/server";
import { oauthSignIn } from "@/lib/server/services/accounts";
import { OAuthError, appOrigin, finishOAuth, isOAuthProvider, oauthErrorRedirect } from "@/lib/server/oauth";

type Ctx = { params: Promise<{ provider: string }> };

/**
 * Retour du fournisseur. Ces handlers n'utilisent pas route() (lib/server/http.ts) : Apple revient par un POST
 * envoyé depuis https://appleid.apple.com (« form_post »), que la protection CSRF par l'en-tête Origin refuserait.
 * Le cookie cb_oauth (état à usage unique, comparé à temps constant) joue ce rôle : sans lui, rien n'est échangé.
 * Succès : session ouverte comme une connexion par mot de passe, puis l'app ouvre l'espace du rôle.
 */
async function callback(req: NextRequest, { params }: Ctx) {
  const { provider } = await params;
  try {
    if (!isOAuthProvider(provider)) throw new OAuthError("config");
    const { identity, mode, role } = await finishOAuth(req, provider);
    await oauthSignIn(identity, mode, role);
    return NextResponse.redirect(new URL("/espace#/", appOrigin(req)), 303);
  } catch (err) {
    return oauthErrorRedirect(req, err);
  }
}

export const GET = callback;
export const POST = callback;
