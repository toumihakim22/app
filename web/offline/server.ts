// API de la version autonome (fichier HTML unique, `node web/build.mjs --offline`) : chaque route de
// app/api/**/route.ts est rejouée dans le navigateur, avec les mêmes schémas (lib/server/validation.ts),
// les mêmes contrôles d'accès et les mêmes réponses. web/src/data.js l'appelle à la place de fetch().
import { z, ZodError, type ZodType } from "zod";
import {
  amountSchema, appealSchema, approveSchema, campaignSchema, campaignStatusSchema, changePasswordSchema, checkoutSchema, clipSchema, creditSchema, forgotSchema,
  loginSchema, membershipSchema, oauthDemoSchema, profileSchema, resetSchema, reviewAppealSchema, reviewClipSchema, settingsSchema, signupSchema, simulatePaymentSchema,
  socialAccountSchema, userStatusSchema, verificationRequestSchema, verificationReviewSchema, verifySchema, viewsSchema, withdrawSchema,
} from "../../lib/server/validation";
import { ApiError, badRequest, clear, forbidden, load, logActivity, save } from "./db";
import * as svc from "./services";
import { reviewAppeal, submitAppeal } from "./appeals";
import { resumeOnlineTopUp, simulatePayment, startOnlineTopUp } from "./payments";
import { publicState, stateFor } from "./state";
import { runDueJobs, trackViews } from "./tracking";
import { viewsTrackedText } from "../../lib/server/rules";

type Req = svc.Ctx & { body: string | undefined; params: Record<string, string> };
type Res = { status?: number; data: unknown };
type Handler = (req: Req) => Res | Promise<Res>;

function body<T>(req: Req, schema: ZodType<T>): T {
  let data: unknown;
  try {
    data = JSON.parse(req.body ?? "");
  } catch {
    throw badRequest("Corps de requête JSON attendu");
  }
  return schema.parse(data);
}

const ok = (data: object = {}, status = 200): Res => ({ status, data: { ok: true, ...data } });

const routes: Record<string, Record<string, Handler>> = {
  "/api/state": {
    GET: (req) => {
      const { db } = req;
      // Pas de tâche planifiée dans un fichier HTML : le relevé des vues dû (plus de 6 heures) est lancé ici, puis enregistré.
      if (runDueJobs(req)) {
        try {
          req.commit();
        } catch {
          // Stockage plein : la base enregistrée reste celle d'avant ; le relevé sera refait au prochain chargement.
        }
      }
      const user = svc.currentUser(db);
      if (!user || (user.status === "Suspendu" && user.role !== "admin")) return { data: { user: null, public: publicState(db) } };
      return { data: { user: user.id, ...stateFor(db, user) } };
    },
  },
  "/api/auth/signup": {
    POST: async (req) => {
      const { email, devCode } = await svc.requestSignup(req, body(req, signupSchema));
      return ok({ email, devCode });
    },
  },
  "/api/auth/verify": {
    POST: async (req) => {
      const { email, code } = body(req, verifySchema);
      await svc.verifySignup(req, email, code);
      return ok();
    },
  },
  "/api/auth/login": {
    POST: async (req) => {
      const { email, password } = body(req, loginSchema);
      const user = await svc.login(req, email, password);
      return ok({ role: user.role });
    },
  },
  // Connexion Google, Apple ou Discord simulée (le serveur passe par /api/auth/oauth/<fournisseur> et son callback).
  "/api/auth/oauth/demo": {
    POST: (req) => {
      const user = svc.oauthDemo(req, body(req, oauthDemoSchema));
      return ok({ role: user.role });
    },
  },
  "/api/auth/logout": {
    POST: ({ db }) => {
      svc.destroySession(db);
      return ok();
    },
  },
  "/api/auth/forgot": {
    POST: async (req) => {
      const { email } = body(req, forgotSchema);
      const { devCode } = await svc.requestPasswordReset(req, email);
      return ok({ devCode });
    },
  },
  "/api/auth/reset": {
    POST: async (req) => {
      const { email, code, password } = body(req, resetSchema);
      await svc.resetPassword(req, email, code, password);
      return ok();
    },
  },
  "/api/auth/password": {
    POST: async (req) => {
      const user = svc.requireUser(req.db);
      const { current, next } = body(req, changePasswordSchema);
      await svc.changePassword(req, user.id, current, next);
      return ok();
    },
  },
  "/api/me": {
    PATCH: (req) => {
      const user = svc.requireUser(req.db);
      svc.updateProfile(req, user, body(req, profileSchema));
      return ok();
    },
  },
  "/api/notifications/read": {
    POST: (req) => {
      const user = svc.requireUser(req.db);
      const { ids } = body(req, z.object({ ids: z.array(z.string()).optional() }));
      svc.markNotificationsRead(req, user.id, ids);
      return ok();
    },
  },
  "/api/campaigns": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "agence", "admin");
      return ok({ id: svc.createCampaign(req, user, body(req, campaignSchema)) }, 201);
    },
  },
  "/api/campaigns/:id": {
    // Modification (en attente) ou correction et relance (refusée), par l'agence propriétaire.
    PUT: (req) => {
      const user = svc.requireUser(req.db, "agence");
      svc.updateCampaign(req, user, req.params.id, body(req, campaignSchema));
      return ok();
    },
    PATCH: (req) => {
      const user = svc.requireUser(req.db, "agence", "admin");
      const { status, top, reason } = body(req, campaignStatusSchema);
      if (top !== undefined) {
        if (user.role !== "admin") throw forbidden();
        svc.setTop(req, req.params.id, top);
      }
      if (status) svc.setCampaignStatus(req, user, req.params.id, status, reason);
      return ok();
    },
    // Annulation avant la vérification ou suppression après un refus, par l'agence propriétaire.
    DELETE: (req) => {
      const user = svc.requireUser(req.db, "agence");
      svc.deleteCampaign(req, user, req.params.id);
      return ok();
    },
  },
  "/api/campaigns/:id/budget": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "agence");
      const { amount } = body(req, amountSchema);
      svc.addBudget(req, user, req.params.id, amount);
      return ok();
    },
  },
  "/api/campaigns/:id/membership": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "clipper");
      svc.setMembership(req, user.id, req.params.id, body(req, membershipSchema));
      return ok();
    },
  },
  "/api/clips": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "clipper");
      const ids = svc.submitClip(req, user, body(req, clipSchema));
      return ok({ id: ids[0], ids }, 201);
    },
  },
  "/api/clips/:id/review": {
    POST: (req) => {
      const admin = svc.requireUser(req.db, "admin");
      svc.reviewClip(req, admin, req.params.id, body(req, reviewClipSchema));
      return ok();
    },
  },
  "/api/clips/:id/views": {
    POST: (req) => {
      svc.requireUser(req.db, "admin");
      const { views, likes } = body(req, viewsSchema);
      svc.recordViews(req, req.params.id, views, likes);
      return ok();
    },
  },
  // Recours du clipper contre le refus de son clip (une seule fois), puis décision de l'équipe (motif obligatoire).
  "/api/clips/:id/appeal": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "clipper");
      return ok({ id: submitAppeal(req, user, req.params.id, body(req, appealSchema)) }, 201);
    },
  },
  "/api/appeals/:id/review": {
    POST: (req) => {
      const admin = svc.requireUser(req.db, "admin");
      reviewAppeal(req, admin, req.params.id, body(req, reviewAppealSchema));
      return ok();
    },
  },
  // Relevé des vues (toujours simulé hors ligne) : bouton de l'admin, et l'adresse de la tâche planifiée du serveur.
  "/api/admin/track-views": {
    POST: (req) => {
      const admin = svc.requireUser(req.db, "admin");
      const summary = trackViews(req, "admin");
      logActivity(req.db, "📈", viewsTrackedText(admin.name, summary.updated, summary.failed));
      return ok(summary);
    },
  },
  "/api/cron/views": {
    // Sans CRON_SECRET (comme en développement) ; une requête GET n'est pas enregistrée d'office.
    GET: (req) => {
      const summary = trackViews(req, "cron");
      req.commit();
      return ok(summary);
    },
  },
  // Comptes sociaux du clipper : ajout (code « CB-XXXX »), vérification (toujours simulée hors ligne), retrait.
  "/api/social": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "clipper");
      return ok(svc.addSocialAccount(req, user, body(req, socialAccountSchema)), 201);
    },
  },
  "/api/social/:id/verify": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "clipper");
      return ok(svc.verifySocialAccount(req, user, req.params.id));
    },
  },
  "/api/social/:id": {
    DELETE: (req) => {
      const user = svc.requireUser(req.db, "clipper");
      svc.removeSocialAccount(req, user, req.params.id);
      return ok();
    },
  },
  "/api/withdrawals": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "clipper");
      const { amount, instant } = body(req, withdrawSchema);
      svc.requestWithdrawal(req, user, amount, instant);
      return ok({}, 201);
    },
  },
  "/api/credit": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "agence");
      const { amount, method, card } = body(req, creditSchema);
      return ok({ ref: svc.requestCredit(req, user, amount, method, card) }, 201);
    },
  },
  // Paiement en ligne des recharges (Edahabia, CIB) : toujours simulé hors ligne, la page de paiement simulée de l'app.
  "/api/credit/checkout": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "agence");
      const { amount, method } = body(req, checkoutSchema);
      return ok(startOnlineTopUp(req, user, amount, method), 201);
    },
  },
  "/api/credit/checkout/:id": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "agence");
      return ok(resumeOnlineTopUp(req, user, req.params.id));
    },
  },
  "/api/payments/simulate/:id": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "agence");
      const { paid } = body(req, simulatePaymentSchema);
      simulatePayment(req, user, req.params.id, paid);
      return ok();
    },
  },
  // Webhook de Chargily : sans clé (comme ici, toujours), le serveur le refuse de la même façon.
  "/api/payments/chargily/webhook": {
    POST: () => {
      throw new ApiError(503, "Paiement en ligne non configuré");
    },
  },
  "/api/verification": {
    POST: (req) => {
      const user = svc.requireUser(req.db, "agence");
      const { message } = body(req, verificationRequestSchema);
      svc.requestVerification(req, user, message);
      return ok();
    },
  },
  "/api/transactions/:id/review": {
    POST: (req) => {
      const admin = svc.requireUser(req.db, "admin");
      const { approve } = body(req, approveSchema);
      svc.reviewTransaction(req, admin, req.params.id, approve);
      return ok();
    },
  },
  "/api/admin/users/:id": {
    PATCH: (req) => {
      const admin = svc.requireUser(req.db, "admin");
      const { status } = body(req, userStatusSchema);
      svc.setUserStatus(req, admin, req.params.id, status);
      return ok();
    },
  },
  "/api/admin/users/:id/verification": {
    POST: (req) => {
      const admin = svc.requireUser(req.db, "admin");
      svc.reviewVerification(req, admin, req.params.id, body(req, verificationReviewSchema));
      return ok();
    },
  },
  "/api/admin/settings": {
    PATCH: (req) => {
      const admin = svc.requireUser(req.db, "admin");
      const patch = body(req, settingsSchema);
      Object.assign(req.db.settings, patch);
      logActivity(req.db, "⚙️", `Réglages modifiés par ${admin.name} : ${Object.keys(patch).join(", ")}.`);
      return ok();
    },
  },
};

function match(pathname: string) {
  const parts = pathname.split("/");
  for (const [pattern, methods] of Object.entries(routes)) {
    const p = pattern.split("/");
    if (p.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (p.every((seg, i) => (seg.startsWith(":") ? (params[seg.slice(1)] = decodeURIComponent(parts[i])) !== "" : seg === parts[i]))) return { methods, params };
  }
  return null;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

async function handle(path: string, init: { method?: string; body?: BodyInit | null } = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const route = match(new URL(path, "http://clipboost.local").pathname);
  if (!route) return json({}, 404);
  const handler = route.methods[method];
  if (!handler) return json({}, 405);
  const db = await load();
  const commit = () => save(db);
  try {
    const res = await handler({ db, commit, body: typeof init.body === "string" ? init.body : undefined, params: route.params });
    if (method !== "GET") commit();
    return json(res.data, res.status);
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.message }, err.status);
    if (err instanceof ZodError) return json({ error: err.issues[0]?.message ?? "Données invalides" }, 400);
    console.error(err);
    return json({ error: "Erreur interne du serveur" }, 500);
  }
}

// Les requêtes sont traitées l'une après l'autre, comme des transactions successives.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

export const offlineApi = {
  /** Même signature que fetch() pour les chemins /api/*. */
  fetch: (path: string, init?: { method?: string; body?: BodyInit | null }) => serial(() => handle(path, init)),
  /** Efface les données enregistrées dans ce navigateur : les données d'exemple seront recréées. */
  reset: () => serial(async () => clear()),
};

(globalThis as { __CLIPBOOST_OFFLINE__?: typeof offlineApi }).__CLIPBOOST_OFFLINE__ = offlineApi;
