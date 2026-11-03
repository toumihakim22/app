// Comptes sociaux des clippers (Profil → Comptes sociaux) : un compte par plateforme, prouvé par un code « CB-XXXX »
// que le clipper colle dans la bio du compte, lu par l'API officielle de la plateforme (lib/server/platforms.ts ; sans
// identifiants, mode simulé : la vérification réussit). Seuls les clips publiés depuis un compte vérifié sont acceptés
// (submitClip, services/clips.ts). users.handles (« @compte » montré aux agences et à l'équipe) suit les comptes vérifiés.
import { randomBytes } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { getDb, isUniqueViolation, schema } from "../db";
import type { Handles } from "../db/schema";
import type { User } from "../auth";
import { logActivity, type Tx } from "../events";
import { ApiError, badRequest, notFound } from "../http";
import { newId } from "../ids";
import { fetchProfileBio, PlatformError, type BioResult } from "../platforms";
import { bioHasCode, normalizeHandle, socialCode } from "../rules";

type SocialRow = typeof schema.socialAccounts.$inferSelect;
const S = schema.socialAccounts;

/** Clé de users.handles d'une plateforme (« TikTok » → « tiktok »). */
export const handleKey = (platform: string) => platform.toLowerCase() as keyof Handles;

/** Compte tel que l'app le reçoit (GET /api/state : me.socialAccounts du clipper, users[].socialAccounts pour l'admin). */
export const socialView = (a: SocialRow) => ({
  id: a.id, platform: a.platform, handle: a.handle, code: a.code, status: a.status,
  verifiedAt: a.verifiedAt?.toISOString() ?? null, checkedAt: a.checkedAt?.toISOString() ?? null,
});

const TAKEN = "Ce compte est déjà vérifié par un autre clipper";
const CHANGED = "Ce compte a été modifié entre-temps : réessayez";

/** Refuse un compte (plateforme + identifiant) déjà vérifié par un autre clipper. */
async function assertFree(db: Tx, platform: string, handle: string, userId: string) {
  const [other] = await db.select({ id: S.id }).from(S).where(and(eq(S.platform, platform), eq(S.handle, handle), eq(S.status, "verified"), ne(S.userId, userId)));
  if (other) throw badRequest(TAKEN);
}

/** Code « CB-XXXX » libre (environ un million de codes possibles ; l'index unique couvre une collision simultanée). */
async function freeCode(db: Tx) {
  for (let i = 0; i < 20; i++) {
    const code = socialCode(randomBytes(4));
    const [used] = await db.select({ id: S.id }).from(S).where(eq(S.code, code));
    if (!used) return code;
  }
  throw new Error("Aucun code de vérification libre");
}

/**
 * Le clipper ajoute son compte d'une plateforme (identifiant ou adresse du profil) et reçoit son code. Un compte en attente
 * sur cette plateforme change d'identifiant et garde son code ; un compte vérifié doit d'abord être retiré.
 */
export async function addSocialAccount(user: User, input: { platform: string; handle: string }) {
  const handle = normalizeHandle(input.platform, input.handle);
  if (!handle) throw badRequest("Identifiant invalide : lettres, chiffres, points, tirets ou tirets bas (60 signes au plus)");
  const db = await getDb();
  try {
    return await db.transaction(async (tx) => {
      // Verrou sur le clipper : deux ajouts simultanés ne créent pas deux comptes sur la même plateforme.
      await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, user.id)).for("update");
      await assertFree(tx, input.platform, handle, user.id);
      const [mine] = await tx.select().from(S).where(and(eq(S.userId, user.id), eq(S.platform, input.platform)));
      if (mine?.status === "verified") throw badRequest(`Vous avez déjà un compte ${input.platform} vérifié : retirez-le d'abord pour en changer`);
      if (mine) {
        await tx.update(S).set({ handle, checkedAt: null }).where(eq(S.id, mine.id));
        return { id: mine.id, code: mine.code };
      }
      const id = newId(), code = await freeCode(tx);
      await tx.insert(S).values({ id, userId: user.id, platform: input.platform, handle, code });
      return { id, code };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw badRequest(CHANGED);
    throw err;
  }
}

/**
 * Vérification : la bio du compte doit contenir son code (casse indifférente). Chaque tentative est datée (checkedAt).
 * Réussie, le compte est vérifié et devient le « @compte » de la plateforme dans le profil du clipper (users.handles).
 * Renvoie simulated : true quand la plateforme n'a pas d'identifiants (aucun appel, vérification accordée).
 */
export async function verifySocialAccount(user: User, id: string) {
  const db = await getDb();
  const [a] = await db.select().from(S).where(and(eq(S.id, id), eq(S.userId, user.id)));
  if (!a) throw notFound("Compte introuvable");
  if (a.status === "verified") throw badRequest("Ce compte est déjà vérifié");
  await assertFree(db, a.platform, a.handle, user.id);
  let bio: BioResult;
  try {
    bio = await fetchProfileBio(a.platform, a.handle);
  } catch (err) {
    if (!(err instanceof PlatformError)) throw err;
    console.error(err.message);
    await db.update(S).set({ checkedAt: new Date() }).where(eq(S.id, a.id));
    throw new ApiError(502, `Vérification ${a.platform} indisponible pour le moment, réessayez plus tard`);
  }
  if (bio.status !== "simulated") {
    await db.update(S).set({ checkedAt: new Date() }).where(eq(S.id, a.id));
    if (bio.status === "not_found") throw badRequest(`Compte ${a.platform} @${a.handle} introuvable : vérifiez l'identifiant`);
    if (!bioHasCode(bio.bio, a.code)) throw badRequest(`Code ${a.code} absent de la bio de @${a.handle} : collez-le, enregistrez, puis réessayez`);
  }
  try {
    await db.transaction(async (tx) => {
      const [me] = await tx.select().from(schema.users).where(eq(schema.users.id, user.id)).for("update");
      const now = new Date();
      // Seulement si le compte n'a pas changé pendant l'appel à la plateforme (identifiant remplacé, compte retiré).
      const done = await tx.update(S).set({ status: "verified", verifiedAt: now, checkedAt: now })
        .where(and(eq(S.id, a.id), eq(S.handle, a.handle), eq(S.status, "pending"))).returning({ id: S.id });
      if (!done.length) throw badRequest(CHANGED);
      await tx.update(schema.users).set({ handles: { ...me.handles, [handleKey(a.platform)]: `@${a.handle}` } }).where(eq(schema.users.id, me.id));
      await logActivity(tx, "🛡️", `${me.name} a vérifié son compte ${a.platform} @${a.handle}.`);
    });
  } catch (err) {
    // Le même compte vérifié au même instant par un autre clipper (index unique partiel).
    if (isUniqueViolation(err)) throw badRequest(TAKEN);
    throw err;
  }
  return { simulated: bio.status === "simulated" };
}

/** Le clipper retire un compte (en attente ou vérifié) ; un compte vérifié disparaît aussi de son profil (users.handles). */
export async function removeSocialAccount(user: User, id: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [me] = await tx.select().from(schema.users).where(eq(schema.users.id, user.id)).for("update");
    const [a] = await tx.select().from(S).where(and(eq(S.id, id), eq(S.userId, user.id)));
    if (!a) throw notFound("Compte introuvable");
    await tx.delete(S).where(eq(S.id, a.id));
    if (a.status !== "verified") return;
    const key = handleKey(a.platform);
    if (me.handles[key] === `@${a.handle}`) {
      const handles = { ...me.handles };
      delete handles[key];
      await tx.update(schema.users).set({ handles }).where(eq(schema.users.id, me.id));
    }
    await logActivity(tx, "🗑️", `${me.name} a retiré son compte ${a.platform} @${a.handle}.`);
  });
}
