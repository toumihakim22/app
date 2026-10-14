import { createHash, randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { SignupPayload } from "../db/schema";
import { createSession, endOtherSessions, type User } from "../auth";
import { sendEmail } from "../email";
import { logActivity } from "../events";
import { badRequest, forbidden } from "../http";
import { newId } from "../ids";
import { OAuthError, type OAuthIdentity, type OAuthMode, type OAuthRole } from "../oauth";
import { hashPassword, strongEnough, verifyPassword } from "../password";
import { getSettings } from "../settings";

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const hashCode = (email: string, code: string) => createHash("sha256").update(`${email}:${code}`).digest("hex");
// Empreinte factice : le mot de passe est toujours haché, même sans compte ou sans mot de passe (même durée de réponse).
const DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA";
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function issueCode(email: string, purpose: "signup" | "reset", payload: SignupPayload | null) {
  const db = await getDb();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const values = { email, purpose, codeHash: hashCode(email, code), payload, attempts: 0, expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000) };
  await db.insert(schema.emailCodes).values(values).onConflictDoUpdate({ target: [schema.emailCodes.email, schema.emailCodes.purpose], set: values });
  const subject = purpose === "signup" ? "Votre code de vérification ClipBoost" : "Réinitialisation de votre mot de passe ClipBoost";
  await sendEmail(email, subject, `Votre code : ${code}\n\nIl expire dans ${CODE_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`);
  // En développement uniquement, le code est renvoyé à l'interface pour pouvoir tester sans boîte mail.
  return process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY ? code : undefined;
}

async function consumeCode(email: string, purpose: "signup" | "reset", code: string) {
  const db = await getDb();
  const where = and(eq(schema.emailCodes.email, email), eq(schema.emailCodes.purpose, purpose));
  const [row] = await db.select().from(schema.emailCodes).where(where);
  if (!row || row.expiresAt < new Date()) throw badRequest("Code expiré, demandez-en un nouveau");
  if (row.attempts >= MAX_ATTEMPTS) throw badRequest("Trop d'essais, demandez un nouveau code");
  if (row.codeHash !== hashCode(email, code)) {
    await db.update(schema.emailCodes).set({ attempts: row.attempts + 1 }).where(where);
    throw badRequest("Code incorrect");
  }
  await db.delete(schema.emailCodes).where(where);
  return row;
}

async function emailTaken(email: string) {
  const db = await getDb();
  const [row] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  return Boolean(row);
}

export async function requestSignup(input: { role: "clipper" | "agence"; name: string; contact?: string; email: string; country: string; password: string }) {
  const settings = await getSettings();
  if (!settings.signupsOpen || settings.maintenance) throw forbidden("Les inscriptions sont momentanément fermées");
  const email = normalizeEmail(input.email);
  if (await emailTaken(email)) throw badRequest("Un compte existe déjà avec cet email");
  if (!strongEnough(input.password)) throw badRequest("Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre");
  const payload: SignupPayload = { role: input.role, name: input.name.trim(), contact: input.contact?.trim() || null, country: input.country, passwordHash: await hashPassword(input.password) };
  const devCode = await issueCode(email, "signup", payload);
  return { email, devCode };
}

export async function verifySignup(emailInput: string, code: string) {
  const email = normalizeEmail(emailInput);
  const row = await consumeCode(email, "signup", code);
  const p = row.payload as SignupPayload;
  if (await emailTaken(email)) throw badRequest("Un compte existe déjà avec cet email");
  const db = await getDb();
  const id = newId();
  await db.insert(schema.users).values({ id, role: p.role, email, passwordHash: p.passwordHash, name: p.name, contact: p.contact, country: p.country });
  await logActivity(db, p.role === "agence" ? "🏢" : "👤", `${p.name} s'est inscrit${p.role === "agence" ? " (agence)" : ""}.`);
  await createSession(id);
  return id;
}

export async function login(emailInput: string, password: string) {
  const db = await getDb();
  const email = normalizeEmail(emailInput);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  // On vérifie un mot de passe même si le compte n'existe pas, pour ne pas révéler les emails inscrits.
  // Un compte créé avec Google, Apple ou Discord n'a pas de mot de passe (empreinte vide) tant qu'il n'en a pas défini.
  const ok = await verifyPassword(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) throw badRequest("Email ou mot de passe incorrect");
  if (user.status === "Suspendu") throw forbidden("Votre compte est suspendu. Contactez le support.");
  const settings = await getSettings();
  if (settings.maintenance && user.role !== "admin") throw forbidden("ClipBoost est en maintenance, réessayez plus tard");
  await createSession(user.id);
  return user;
}

/**
 * Connexion avec Google, Apple ou Discord (identité vérifiée par lib/server/oauth.ts) :
 * 1. compte déjà relié à ce compte du fournisseur ;
 * 2. sinon compte ClipBoost de la même adresse email (vérifiée par le fournisseur), relié au passage ;
 * 3. sinon, en mode inscription, nouveau compte sans mot de passe avec le rôle choisi (il pourra en définir un dans Paramètres).
 * Mêmes règles que la connexion par mot de passe (suspension, maintenance) et que l'inscription (inscriptions fermées).
 * Les administrateurs se connectent uniquement avec leur mot de passe.
 */
export async function oauthSignIn(identity: OAuthIdentity, mode: OAuthMode, role: OAuthRole): Promise<User> {
  const db = await getDb();
  const settings = await getSettings();
  const email = normalizeEmail(identity.email);
  const A = schema.oauthAccounts;
  const [linked] = await db.select({ user: schema.users }).from(A).innerJoin(schema.users, eq(A.userId, schema.users.id))
    .where(and(eq(A.provider, identity.provider), eq(A.subject, identity.subject)));
  let user: User | undefined = linked?.user ?? (await db.select().from(schema.users).where(eq(schema.users.email, email)))[0];
  if (user) {
    if (user.role === "admin") throw new OAuthError("admin");
    if (user.status === "Suspendu") throw new OAuthError("suspended");
    if (settings.maintenance) throw new OAuthError("maintenance");
    if (!linked) await db.insert(A).values({ provider: identity.provider, subject: identity.subject, userId: user.id, email }).onConflictDoNothing();
  } else {
    if (mode === "login") throw new OAuthError("no_account");
    if (settings.maintenance) throw new OAuthError("maintenance");
    if (!settings.signupsOpen) throw new OAuthError("signups_closed");
    const name = (identity.name.trim() || email.split("@")[0]).slice(0, 80);
    const id = newId();
    user = await db.transaction(async (tx) => {
      const [created] = await tx.insert(schema.users).values({ id, role, email, passwordHash: "", name, country: "Algérie" }).returning();
      await tx.insert(A).values({ provider: identity.provider, subject: identity.subject, userId: id, email });
      await logActivity(tx, role === "agence" ? "🏢" : "👤", `${name} s'est inscrit${role === "agence" ? " (agence)" : ""}.`);
      return created;
    });
  }
  await createSession(user.id);
  return user;
}

export async function requestPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput);
  // Réponse identique que le compte existe ou non.
  if (!(await emailTaken(email))) return { devCode: undefined };
  return { devCode: await issueCode(email, "reset", null) };
}

export async function resetPassword(emailInput: string, code: string, password: string) {
  const email = normalizeEmail(emailInput);
  if (!strongEnough(password)) throw badRequest("Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre");
  await consumeCode(email, "reset", code);
  const db = await getDb();
  const [user] = await db.update(schema.users).set({ passwordHash: await hashPassword(password) }).where(eq(schema.users.email, email)).returning();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
  await createSession(user.id);
}

/**
 * Changement de mot de passe depuis les paramètres. `current` est exigé si le compte a déjà un mot de passe ;
 * un compte créé avec Google, Apple ou Discord définit ainsi son premier mot de passe.
 * Les sessions ouvertes sur les autres appareils sont fermées ; celle-ci reste ouverte.
 */
export async function changePassword(userId: string, current: string, next: string) {
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) throw badRequest("Mot de passe actuel incorrect");
  if (!strongEnough(next)) throw badRequest("Le nouveau mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre");
  await db.update(schema.users).set({ passwordHash: await hashPassword(next) }).where(eq(schema.users.id, userId));
  await endOtherSessions(userId);
}
