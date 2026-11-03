// Logique métier de la version autonome : la copie fidèle de lib/server/services/*.ts (mêmes contrôles,
// mêmes messages, mêmes effets), sur la base locale. Les règles de calcul viennent de lib/server/rules.ts.
import type { CampaignStatus, Handles, Locale, Role, SignupPayload } from "../../lib/server/db/schema";
import { GRADIENTS, PLATFORM_HOSTS } from "../../lib/server/gradients";
import { link } from "../../lib/server/links";
import { belowMin, clipRisk, fundingCost, instantFee, keepsWeekReading, normalizeHandle, payoutDelta, RISK_WINDOW_DAYS, sentence, socialLinkError, utcDay, validateCampaignNumbers, viewsFor } from "../../lib/server/rules";
import { IMAGE_DATA_URL, type OAuthProvider } from "../../lib/server/validation";
import {
  ApiError, badRequest, forbidden, getSettings, insertCampaign, insertPublication, insertTransaction, insertUser, logActivity,
  newId, newRef, newSocialCode, notFound, notify, notifyRole, randomInt, type CampaignRow, type PubRow, type Store, type TxRow, type UserRow,
} from "./db";
import { issueDocument } from "./documents";
import { hashPassword, sha256Hex, strongEnough, verifyPassword } from "./password";
import { referrerFor, rewardReferral } from "./referrals";

/** Contexte d'une requête : la copie de travail de la base et l'enregistrement immédiat (hors transaction). */
export type Ctx = { db: Store; commit: () => void };

const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/ | /g, " ")} DA`;

// ---------- Images (lib/server/media.ts) ----------

// Signature des formats acceptés : le contenu doit correspondre au type annoncé par la data URL.
const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x),
  webp: (b) => String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP",
};

/**
 * Nouvelle valeur d'une colonne image (photo de profil, couverture d'agence, photo de campagne), mêmes règles que
 * storeImage sur le serveur : undefined garde l'image actuelle, "" ou null la retire, la valeur actuelle la garde ;
 * une nouvelle image est une data URL JPEG, PNG ou WebP dont le contenu correspond au type annoncé. Hors ligne,
 * la data URL elle-même est enregistrée ; une adresse « /api/media/… » (image du serveur) n'existe pas ici.
 */
export function storeImage(value: string | null | undefined, current: string | null): string | null {
  if (value === undefined) return current;
  if (value === "" || value === null) return null;
  if (value === current) return current;
  const type = IMAGE_DATA_URL.exec(value)?.[1];
  if (!type) throw badRequest("Image invalide");
  const start = value.indexOf(",") + 1;
  let head: Uint8Array;
  try {
    head = Uint8Array.from(atob(value.slice(start, start + 16)), (ch) => ch.charCodeAt(0));
  } catch {
    throw badRequest("Image invalide (JPEG, PNG ou WebP)");
  }
  if (!MAGIC[type](head)) throw badRequest("Image invalide (JPEG, PNG ou WebP)");
  return value;
}

// ---------- Sessions (lib/server/auth.ts) ----------

const SESSION_DAYS = 30;

export function createSession(db: Store, userId: string) {
  db.session = { userId, expiresAt: Date.now() + SESSION_DAYS * 86_400_000 };
}

export function destroySession(db: Store) {
  db.session = null;
}

export function currentUser(db: Store): UserRow | null {
  const s = db.session;
  if (!s || s.expiresAt <= Date.now()) return null;
  return db.users.find((u) => u.id === s.userId) ?? null;
}

export function requireUser(db: Store, ...roles: Role[]): UserRow {
  const user = currentUser(db);
  if (!user) throw new ApiError(401, "Veuillez vous connecter");
  if (user.status !== "Actif" && user.role !== "admin") throw forbidden("Votre compte est suspendu");
  if (roles.length && !roles.includes(user.role)) throw forbidden();
  return user;
}

const userOf = (db: Store, id: string) => db.users.find((u) => u.id === id)!;

// ---------- Comptes (accounts.ts) ----------

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const hashCode = (email: string, code: string) => sha256Hex(`${email}:${code}`);
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const emailTaken = (db: Store, email: string) => db.users.some((u) => u.email === email);

/** Crée le code à 6 chiffres. Aucun email n'est envoyé : le code est renvoyé à l'interface, comme en développement. */
async function issueCode(db: Store, email: string, purpose: "signup" | "reset", payload: SignupPayload | null) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const values = { email, purpose, codeHash: await hashCode(email, code), payload, attempts: 0, expiresAt: Date.now() + CODE_MINUTES * 60_000 };
  const row = db.emailCodes.find((r) => r.email === email && r.purpose === purpose);
  if (row) Object.assign(row, values);
  else db.emailCodes.push({ ...values, createdAt: Date.now() });
  return code;
}

// Comme sur le serveur, ces écritures ne sont pas dans une transaction : elles restent même si la requête échoue.
async function consumeCode({ db, commit }: Ctx, email: string, purpose: "signup" | "reset", code: string) {
  const row = db.emailCodes.find((r) => r.email === email && r.purpose === purpose);
  if (!row || row.expiresAt < Date.now()) throw badRequest("Code expiré, demandez-en un nouveau");
  if (row.attempts >= MAX_ATTEMPTS) throw badRequest("Trop d'essais, demandez un nouveau code");
  if (row.codeHash !== (await hashCode(email, code))) {
    row.attempts += 1;
    commit();
    throw badRequest("Code incorrect");
  }
  db.emailCodes.splice(db.emailCodes.indexOf(row), 1);
  commit();
  return row;
}

/** ref : code de parrainage du lien d'inscription, vérifié à la création du compte (verifySignup). */
export async function requestSignup({ db }: Ctx, input: { role: "clipper" | "agence"; name: string; contact?: string; email: string; country: string; password: string; ref?: string }) {
  const settings = getSettings(db);
  if (!settings.signupsOpen || settings.maintenance) throw forbidden("Les inscriptions sont momentanément fermées");
  const email = normalizeEmail(input.email);
  if (emailTaken(db, email)) throw badRequest("Un compte existe déjà avec cet email");
  if (!strongEnough(input.password)) throw badRequest("Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre");
  const payload: SignupPayload = { role: input.role, name: input.name.trim(), contact: input.contact?.trim() || null, country: input.country, passwordHash: await hashPassword(input.password), ref: input.role === "clipper" ? input.ref ?? null : null };
  const devCode = await issueCode(db, email, "signup", payload);
  return { email, devCode };
}

export async function verifySignup(ctx: Ctx, emailInput: string, code: string) {
  const { db } = ctx;
  const email = normalizeEmail(emailInput);
  const row = await consumeCode(ctx, email, "signup", code);
  const p = row.payload as SignupPayload;
  if (emailTaken(db, email)) throw badRequest("Un compte existe déjà avec cet email");
  const id = newId();
  // Clipper : son code de parrainage (insertUser) et son parrain si le code du lien est valable (sinon ignoré).
  insertUser(db, { id, role: p.role, email, passwordHash: p.passwordHash, name: p.name, contact: p.contact, country: p.country, referredBy: referrerFor(db, { id, role: p.role }, p.ref) });
  logActivity(db, p.role === "agence" ? "🏢" : "👤", `${p.name} s'est inscrit${p.role === "agence" ? " (agence)" : ""}.`);
  createSession(db, id);
  return id;
}

const NO_USER_HASH = "sha256$AAAAAAAAAAAAAAAAAAAAAA==$AAAA";

export async function login({ db }: Ctx, emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const user = db.users.find((u) => u.email === email);
  // On vérifie un mot de passe même si le compte n'existe pas, ou s'il n'en a pas (créé avec Google, Apple ou Discord).
  const ok = await verifyPassword(password, user?.passwordHash || NO_USER_HASH);
  if (!user || !user.passwordHash || !ok) throw badRequest("Email ou mot de passe incorrect");
  if (user.status === "Suspendu") throw forbidden("Votre compte est suspendu. Contactez le support.");
  if (getSettings(db).maintenance && user.role !== "admin") throw forbidden("ClipBoost est en maintenance, réessayez plus tard");
  createSession(db, user.id);
  return user;
}

export async function requestPasswordReset({ db }: Ctx, emailInput: string) {
  const email = normalizeEmail(emailInput);
  // Réponse identique que le compte existe ou non.
  if (!emailTaken(db, email)) return { devCode: undefined };
  return { devCode: await issueCode(db, email, "reset", null) };
}

export async function resetPassword(ctx: Ctx, emailInput: string, code: string, password: string) {
  const { db } = ctx;
  const email = normalizeEmail(emailInput);
  if (!strongEnough(password)) throw badRequest("Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre");
  await consumeCode(ctx, email, "reset", code);
  const user = db.users.find((u) => u.email === email)!;
  user.passwordHash = await hashPassword(password);
  if (db.session?.userId === user.id) destroySession(db);
  createSession(db, user.id);
}

export async function changePassword({ db }: Ctx, userId: string, current: string, next: string) {
  const user = userOf(db, userId);
  // Un compte créé avec Google, Apple ou Discord n'a pas encore de mot de passe : il en définit un sans « current ».
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) throw badRequest("Mot de passe actuel incorrect");
  if (!strongEnough(next)) throw badRequest("Le nouveau mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre");
  user.passwordHash = await hashPassword(next);
}

/**
 * Connexion Google, Apple ou Discord simulée (POST /api/auth/oauth/demo) : aucun échange avec le fournisseur, le
 * compte est identifié par « demo:<email> ». Même résolution et mêmes contrôles, dans le même ordre, que le serveur
 * (oauthSignIn, lib/server/services/accounts.ts) : compte déjà relié, sinon compte existant avec cet email (relié au
 * passage), sinon création avec le rôle choisi si mode « signup ». Les messages sont ceux que l'app affiche en ligne
 * pour les mêmes cas (codes oauth_error, web/src/auth.js). ref : code de parrainage, pris en compte à la création d'un clipper.
 */
export function oauthDemo({ db }: Ctx, input: { provider: OAuthProvider; name: string; email: string; role: "clipper" | "agence"; mode: "login" | "signup"; ref?: string }) {
  const settings = getSettings(db);
  const email = normalizeEmail(input.email), subject = `demo:${email}`;
  const linked = db.oauth.find((a) => a.provider === input.provider && a.subject === subject);
  let user = (linked && db.users.find((u) => u.id === linked.userId)) || db.users.find((u) => u.email === email);
  const maintenance = "ClipBoost est en maintenance, réessayez plus tard.";
  if (user) {
    if (user.role === "admin") throw forbidden("Les comptes administrateurs se connectent avec leur mot de passe.");
    if (user.status === "Suspendu") throw forbidden("Ce compte est suspendu.");
    if (settings.maintenance) throw forbidden(maintenance);
  } else {
    if (input.mode !== "signup") throw badRequest("Aucun compte ClipBoost n'est associé à cette adresse. Inscrivez-vous d'abord.");
    if (settings.maintenance) throw forbidden(maintenance);
    if (!settings.signupsOpen) throw forbidden("Les inscriptions sont fermées pour le moment.");
    // Aucun mot de passe (passwordHash vide) : l'utilisateur pourra en définir un dans ses paramètres.
    const id = newId();
    user = insertUser(db, { id, role: input.role, email, passwordHash: "", name: input.name.trim(), country: "Algérie", referredBy: referrerFor(db, { id, role: input.role }, input.ref) });
    logActivity(db, input.role === "agence" ? "🏢" : "👤", `${user.name} s'est inscrit${input.role === "agence" ? " (agence)" : ""}.`);
  }
  if (!linked || linked.userId !== user.id) {
    if (linked) db.oauth.splice(db.oauth.indexOf(linked), 1);
    db.oauth.push({ provider: input.provider, subject, userId: user.id, email, createdAt: Date.now() });
  }
  createSession(db, user.id);
  return user;
}

// ---------- Campagnes (campaigns.ts) ----------

export type CampaignInput = {
  title: string; brand?: string; category: string; rate: number; budget: number; minPayout: number; maxPayout: number;
  emoji: string; platforms: string[]; rules: string[]; image?: string | null;
};

function getCampaign(db: Store, id: string) {
  const c = db.campaigns.find((x) => x.id === id);
  if (!c) throw notFound("Campagne introuvable");
  return c;
}

/** Une agence crée une campagne : elle attend la validation de l'équipe. L'admin peut publier directement. */
export function createCampaign({ db }: Ctx, user: UserRow, input: CampaignInput) {
  const settings = getSettings(db);
  const error = validateCampaignNumbers(input, settings.minBudget);
  if (error) throw badRequest(error);
  const n = db.campaigns.length;
  const isAdmin = user.role === "admin";
  if (isAdmin && !input.brand?.trim()) throw badRequest("Indiquez la marque");
  const image = storeImage(input.image, null);
  const id = newId();
  insertCampaign(db, {
    id, ownerId: isAdmin ? null : user.id, brand: isAdmin ? input.brand!.trim() : user.name,
    title: input.title.trim(), category: input.category, rate: input.rate, budget: input.budget,
    minPayout: input.minPayout, maxPayout: input.maxPayout, emoji: input.emoji,
    platforms: input.platforms, rules: input.rules, gradient: GRADIENTS[n % GRADIENTS.length], image,
    status: isAdmin ? "Active" : "En attente", commissionRate: isAdmin ? 0 : settings.commissionRate,
  });
  if (isAdmin) {
    notifyRole(db, "clipper", "🎯", `Nouvelle campagne : ${input.title.trim()} (${input.rate} DA /1K).`, link.clipperCampaign(id));
    logActivity(db, "🎯", `Campagne « ${input.title.trim()} » publiée.`);
  } else {
    notify(db, user.id, "⏳", `Votre campagne « ${input.title.trim()} » est en cours de vérification.`, link.agencyCampaign(id));
    notifyRole(db, "admin", "🏢", `${user.name} a soumis la campagne « ${input.title.trim()} ».`, link.adminCampaign(id));
    logActivity(db, "🏢", `${user.name} a soumis la campagne « ${input.title.trim()} ».`);
  }
  return id;
}

/**
 * L'agence modifie sa campagne tant que l'équipe ne l'a pas examinée (« En attente »), ou la corrige après un refus :
 * elle repart alors en vérification (« En attente »), sans le motif du refus. La marque reste le nom de l'agence
 * et le dégradé ne change pas.
 */
export function updateCampaign({ db }: Ctx, user: UserRow, id: string, input: CampaignInput) {
  const settings = getSettings(db);
  const c = getCampaign(db, id);
  if (c.ownerId !== user.id) throw forbidden();
  // Jamais une campagne qui a été financée (prélèvement à l'approbation) : son budget est engagé.
  if ((c.status !== "En attente" && c.status !== "Refusée") || c.reserved !== 0 || c.spent !== 0) throw badRequest("Cette campagne ne peut plus être modifiée");
  const error = validateCampaignNumbers(input, settings.minBudget);
  if (error) throw badRequest(error);
  const image = storeImage(input.image, c.image);
  const title = input.title.trim(), relaunch = c.status === "Refusée";
  Object.assign(c, {
    title, category: input.category, rate: input.rate, budget: input.budget, minPayout: input.minPayout, maxPayout: input.maxPayout,
    emoji: input.emoji, platforms: input.platforms, rules: input.rules, image,
    // Pas encore financée : la commission prélevée à l'approbation est celle affichée à l'agence dans le formulaire (réglage actuel).
    commissionRate: settings.commissionRate, updatedAt: Date.now(),
  } satisfies Partial<CampaignRow>);
  if (relaunch) {
    c.status = "En attente";
    c.reviewNote = null;
    notify(db, user.id, "⏳", `Votre campagne « ${title} » a été relancée : elle est en cours de vérification.`, link.agencyCampaign(id));
    notifyRole(db, "admin", "✏️", `${user.name} a modifié et relancé la campagne « ${title} ».`, link.adminCampaign(id));
    logActivity(db, "✏️", `${user.name} a modifié et relancé la campagne « ${title} ».`);
  } else {
    notifyRole(db, "admin", "✏️", `${user.name} a modifié la campagne « ${title} ».`, link.adminCampaign(id));
    logActivity(db, "✏️", `${user.name} a modifié la campagne « ${title} ».`);
  }
}

/**
 * L'agence annule sa campagne avant la vérification (« En attente ») ou supprime une campagne refusée.
 * Jamais une campagne financée ou qui a déjà payé des clips.
 */
export function deleteCampaign({ db }: Ctx, user: UserRow, id: string) {
  const c = getCampaign(db, id);
  if (c.ownerId !== user.id) throw forbidden();
  if ((c.status !== "En attente" && c.status !== "Refusée") || c.reserved !== 0 || c.spent !== 0) throw badRequest("Cette campagne ne peut pas être supprimée");
  // Comme les clés étrangères du serveur : membres et clips supprimés avec la campagne, transactions détachées.
  const pubIds = new Set(db.publications.filter((p) => p.campaignId === id).map((p) => p.id));
  db.campaigns = db.campaigns.filter((x) => x.id !== id);
  db.members = db.members.filter((m) => m.campaignId !== id);
  db.publications = db.publications.filter((p) => p.campaignId !== id);
  db.snapshots = db.snapshots.filter((x) => !pubIds.has(x.publicationId));
  db.appeals = db.appeals.filter((a) => !pubIds.has(a.publicationId));
  for (const t of db.transactions) if (t.publicationId && pubIds.has(t.publicationId)) t.publicationId = null;
  // Les notifications déjà reçues sur cette campagne mènent désormais à la liste des campagnes.
  for (const n of db.notifications) {
    if (n.link === link.agencyCampaign(id)) n.link = "#/agence/campagnes";
    else if (n.link === link.adminCampaign(id)) n.link = "#/admin/campagnes";
  }
  if (c.status === "En attente") {
    notifyRole(db, "admin", "🗑️", `${user.name} a annulé la campagne « ${c.title} » avant sa vérification.`, "#/admin/campagnes");
    logActivity(db, "🗑️", `${user.name} a annulé la campagne « ${c.title} » avant sa vérification.`);
  } else logActivity(db, "🗑️", `${user.name} a supprimé la campagne refusée « ${c.title} ».`);
}

/**
 * Changements de statut : approbation (budget + commission prélevés sur le crédit de l'agence),
 * refus motivé (seulement avant l'approbation), pause, reprise, fin (le budget non consommé et sa commission
 * sont rendus à l'agence).
 */
export function setCampaignStatus({ db }: Ctx, user: UserRow, id: string, next: CampaignStatus, reason?: string) {
  const row = getCampaign(db, id), c = { ...row };
  const isAdmin = user.role === "admin";
  if (!isAdmin) {
    if (c.ownerId !== user.id) throw forbidden();
    const allowed = (c.status === "Active" && next === "En pause") || (c.status === "En pause" && next === "Active");
    if (!allowed) throw badRequest("Action impossible sur cette campagne");
  }
  if (c.status === next) return;
  // Refus : seulement avant l'approbation (une campagne en ligne se termine, ce qui rend son budget), avec un motif.
  const motive = reason?.trim() ?? "";
  if (next === "Refusée") {
    if (c.status !== "En attente") throw badRequest("Seule une campagne en attente peut être refusée");
    if (motive.length < 3) throw badRequest("Indiquez le motif du refus");
  }
  if (c.status === "Terminée" || c.status === "Refusée") throw badRequest("Cette campagne est close");
  // Une campagne en attente est approuvée (et financée à ce moment-là) ou refusée : jamais mise en pause ou terminée,
  // sinon une reprise la mettrait en ligne sans prélever son budget sur le crédit de l'agence.
  if (c.status === "En attente" && next !== "Active" && next !== "Refusée") throw badRequest("Action impossible sur cette campagne");

  const patch: Partial<CampaignRow> = { status: next };
  if (next === "Refusée") Object.assign(patch, { reviewNote: motive, updatedAt: Date.now() });
  if (c.status === "En attente" && next === "Active") patch.reviewNote = null;
  if (isAdmin && c.status === "En attente" && next === "Active" && c.ownerId) {
    const cost = fundingCost(c.budget, c.commissionRate);
    const owner = userOf(db, c.ownerId);
    if (owner.credit < cost) throw badRequest(`Crédit de l'agence insuffisant : ${fmt(cost)} nécessaires (budget + ${c.commissionRate} % de commission), ${fmt(owner.credit)} disponibles`);
    owner.credit -= cost;
    patch.reserved = cost;
  }
  if (next === "Terminée" && c.ownerId && c.reserved > 0) {
    const unspent = Math.max(0, c.budget - c.spent);
    const refund = fundingCost(unspent, c.commissionRate);
    if (refund > 0) {
      userOf(db, c.ownerId).credit += refund;
      patch.reserved = c.reserved - refund;
      notify(db, c.ownerId, "💰", `${fmt(refund)} non consommés sur « ${c.title} » ont été rendus à votre crédit.`, link.agencyBudget(c.id));
    }
  }
  Object.assign(row, patch);

  if (isAdmin) {
    const verb: Record<string, string> = { Active: c.status === "En attente" ? "a été approuvée et est en ligne" : "est de nouveau active", "En pause": "a été mise en pause", "Terminée": "est terminée" };
    const text = next === "Refusée" ? `Votre campagne « ${c.title} » a été refusée : ${sentence(motive)}` : `Votre campagne « ${c.title} » ${verb[next] ?? "a changé de statut"}.`;
    notify(db, c.ownerId, next === "Active" ? "✅" : "⚠️", text, link.agencyCampaign(c.id));
  }
  if (c.status === "En attente" && next === "Active") notifyRole(db, "clipper", "🎯", `Nouvelle campagne : ${c.title} (${c.rate} DA /1K).`, link.clipperCampaign(c.id));
  logActivity(db, "🎯", `Campagne « ${c.title} » : ${c.status} → ${next}.`);
}

/** L'agence ajoute du budget. Si la campagne est déjà financée, le montant (+ commission) est prélevé sur son crédit. */
export function addBudget({ db }: Ctx, user: UserRow, id: string, amount: number) {
  const c = getCampaign(db, id);
  if (c.ownerId !== user.id) throw forbidden();
  if (c.status === "Terminée" || c.status === "Refusée") throw badRequest("Cette campagne est close");
  if (c.status === "En attente") {
    c.budget += amount;
    return;
  }
  const cost = fundingCost(amount, c.commissionRate);
  const owner = userOf(db, user.id);
  if (owner.credit < cost) throw badRequest(`Crédit insuffisant : ${fmt(cost)} nécessaires (commission incluse)`);
  owner.credit -= cost;
  c.budget += amount;
  c.reserved += cost;
  logActivity(db, "💰", `${user.name} a ajouté ${fmt(amount)} au budget de « ${c.title} ».`);
}

export function setMembership({ db }: Ctx, userId: string, campaignId: string, patch: { joined?: boolean; favorite?: boolean }) {
  const c = getCampaign(db, campaignId);
  if (patch.joined && c.status !== "Active") throw badRequest("Cette campagne n'accepte pas de nouveaux clippers");
  const m = db.members.find((x) => x.campaignId === campaignId && x.userId === userId);
  if (!m) db.members.push({ campaignId, userId, joined: patch.joined ?? false, favorite: patch.favorite ?? false, createdAt: Date.now() });
  else {
    if (patch.joined !== undefined) m.joined = patch.joined;
    if (patch.favorite !== undefined) m.favorite = patch.favorite;
  }
}

export function setTop({ db }: Ctx, id: string, top: boolean) {
  const c = db.campaigns.find((x) => x.id === id);
  if (c) c.top = top;
}

// ---------- Clips (clips.ts) ----------

/**
 * Un clip publié sur une ou plusieurs plateformes de la campagne : un lien par plateforme, chacun enregistré comme
 * une publication (vues, examen et paiement propres), reliées par le même identifiant de lot. Tous les liens sont
 * vérifiés avant d'enregistrer quoi que ce soit, dont le compte : vérifié par le clipper sur cette plateforme, et le
 * même quand le lien le nomme (socialLinkError). Le score de risque part de l'âge des comptes (« Compte récent »).
 */
export function submitClip({ db }: Ctx, user: UserRow, input: { campaignId: string; title: string; links: { platform: string; url: string }[] }) {
  const c = db.campaigns.find((x) => x.id === input.campaignId);
  if (!c) throw notFound("Campagne introuvable");
  if (c.status !== "Active") throw badRequest("Cette campagne n'accepte plus de clips");
  const member = db.members.find((m) => m.campaignId === c.id && m.userId === user.id && m.joined);
  if (!member) throw badRequest("Rejoignez la campagne avant de soumettre un clip");
  // Comptes sociaux vérifiés du clipper (Profil → Comptes sociaux), par plateforme.
  const verified = new Map(db.social.filter((a) => a.userId === user.id && a.status === "verified").map((a) => [a.platform, a.handle]));
  const links = input.links.map(({ platform, url: raw }) => {
    if (!c.platforms.includes(platform)) throw badRequest(`Cette campagne n'accepte pas ${platform}`);
    let url: URL | null = null;
    try {
      url = new URL(raw.trim());
    } catch {
      // Lien illisible : même message qu'un lien vers un autre site.
    }
    // Le lien doit pointer vers la plateforme déclarée (lib/server/gradients.ts).
    if (!url || url.protocol !== "https:" || !PLATFORM_HOSTS[platform]?.test(url.hostname)) throw badRequest(`Le lien doit être un lien ${platform} (https://…)`);
    const accountError = socialLinkError(platform, url.toString(), verified.get(platform));
    if (accountError) throw badRequest(accountError);
    return { platform, url: url.toString() };
  });
  const urls = links.map((l) => l.url);
  if (new Set(urls).size !== urls.length) throw badRequest("Le même lien est indiqué deux fois");
  // Lien déjà soumis (par ce clipper ou un autre) : le premier dans l'ordre de l'envoi est cité.
  const dup = urls.find((u) => db.publications.some((p) => p.url === u));
  if (dup) throw badRequest(`Ce lien a déjà été soumis : ${dup}`);
  const title = input.title.trim(), batch = newId(), now = Date.now();
  const ids = links.map((l) => {
    const id = newId();
    const social = db.social.find((a) => a.userId === user.id && a.platform === l.platform && a.status === "verified");
    const { score, flags } = clipRisk({ createdAt: now, views: 0, likes: null }, [], { userCreatedAt: user.createdAt, socialVerifiedAt: social?.verifiedAt ?? null });
    insertPublication(db, { id, userId: user.id, campaignId: c.id, title, platform: l.platform, url: l.url, batch, riskScore: score, riskFlags: flags, createdAt: now });
    return id;
  });
  logActivity(db, "🎬", `${user.name} a soumis le clip « ${title} » (${c.title}).`);
  return ids;
}

/**
 * Une campagne ne paie que tant qu'elle est financée : active ou en pause. Terminée, son budget non consommé
 * (et la commission correspondante) a déjà été rendu à l'agence, ou il est entièrement dépensé.
 */
const paying = (c: CampaignRow) => c.status === "Active" || c.status === "En pause";

/**
 * Relevé des vues d'un clip : saisi par l'équipe, ou par le relevé automatique (tracking.ts, `auto` : un nombre inférieur
 * au dernier relevé garde le dernier relevé au lieu d'être refusé). `likes` : undefined ou null garde les likes connus.
 * Chaque relevé remplace celui du jour dans l'historique (snapshots), date le dernier relevé et recalcule le score de
 * risque. Pendant la fenêtre de gains, un clip validé est payé pour ses vues supplémentaires, si sa campagne est encore financée.
 */
export function recordViews({ db }: Ctx, id: string, views: number, likes?: number | null, { auto = false } = {}) {
  const settings = getSettings(db);
  const p = db.publications.find((x) => x.id === id);
  if (!p) throw notFound("Clip introuvable");
  if (views < p.views) {
    if (!auto) throw badRequest("Le nombre de vues ne peut pas diminuer");
    views = p.views;
  }
  const now = Date.now(), day = utcDay(now), nextLikes = likes ?? p.likes;
  const snap = db.snapshots.find((x) => x.publicationId === id && x.day === day);
  // Le relevé du jour fait avant le début de la semaine (dimanche après 23:00 UTC) est gardé : classement (keepsWeekReading).
  if (snap) { if (!keepsWeekReading(snap.recordedAt, now)) Object.assign(snap, { views, likes: nextLikes, recordedAt: now }); }
  else db.snapshots.push({ publicationId: id, day, views, likes: nextLikes, recordedAt: now });
  const { score, flags } = riskOf(db, p, views, nextLikes);
  Object.assign(p, { views, likes: nextLikes, checkedAt: now, riskScore: score, riskFlags: flags } satisfies Partial<PubRow>);
  if (p.status !== "Validée" || !p.approvedAt) return;
  if (Date.now() - p.approvedAt > settings.earningDays * 86_400_000) return;
  const c = getCampaign(db, p.campaignId);
  if (!paying(c)) return;
  const extra = payoutDelta(views, c, p.paid);
  if (!extra) return;
  credit(db, p, c, extra, `${c.title} · vues supplémentaires`, settings.holdDays);
}

/** Score de risque d'un clip (clipRisk) : ses derniers relevés, l'inscription du clipper, la vérification de son compte social. */
function riskOf(db: Store, p: PubRow, views: number, likes: number | null) {
  const latest = db.snapshots.filter((x) => x.publicationId === p.id).sort((a, b) => b.day.localeCompare(a.day)).slice(0, RISK_WINDOW_DAYS + 2)
    .map((x) => ({ day: x.day, views: x.views, likes: x.likes, at: x.recordedAt }));
  const social = db.social.find((a) => a.userId === p.userId && a.platform === p.platform && a.status === "verified");
  return clipRisk({ createdAt: p.createdAt, views, likes }, latest, { userCreatedAt: db.users.find((u) => u.id === p.userId)?.createdAt ?? null, socialVerifiedAt: social?.verifiedAt ?? null });
}

function credit(db: Store, p: PubRow, c: CampaignRow, amount: number, label: string, holdDays: number) {
  const spent = c.spent + amount;
  p.paid += amount;
  c.spent = spent;
  if (spent >= c.budget) c.status = "Terminée";
  const txId = newId();
  insertTransaction(db, {
    id: txId, ref: newRef(), userId: p.userId, type: "gain", label, amount, status: "Validé",
    availableAt: Date.now() + holdDays * 86_400_000, publicationId: p.id,
  });
  notify(db, p.userId, "💸", `+${fmt(amount)} pour « ${p.title} ». Retirable dans ${holdDays} jours.`, link.clipperTx(txId));
  if (spent >= c.budget) {
    notify(db, c.ownerId, "🏁", `Le budget de « ${c.title} » est entièrement consommé : la campagne est terminée.`, link.agencyCampaign(c.id));
    logActivity(db, "🏁", `Campagne « ${c.title} » terminée (budget consommé).`);
  }
}

/**
 * Validation d'un clip (validateClip du serveur) : validation normale (reviewClip) ou recours accepté (appeals.ts),
 * mêmes règles. La campagne doit encore payer et le seuil être atteint, sinon l'erreur est levée (la requête n'enregistre
 * rien). Le clip est validé et le gain de ses vues relevées crédité au clipper, avec sa notification. Renvoie le montant.
 */
export function validateClip(db: Store, p: PubRow, holdDays: number) {
  const c = getCampaign(db, p.campaignId);
  // Campagne terminée : son budget restant a été rendu à l'agence, un gain ne serait plus couvert. Le clip peut être refusé.
  if (!paying(c)) throw badRequest("Cette campagne est terminée : ce clip ne peut plus être validé");
  if (belowMin(p.views, c)) throw badRequest(`Seuil non atteint : ${viewsFor(c.minPayout, c.rate).toLocaleString("fr-FR")} vues minimum`);
  p.status = "Validée";
  p.approvedAt = Date.now();
  const amount = payoutDelta(p.views, c, p.paid);
  if (amount > 0) credit(db, p, c, amount, c.title, holdDays);
  return amount;
}

export function reviewClip({ db }: Ctx, admin: UserRow, id: string, decision: { approve: true } | { approve: false; reason: string }) {
  const settings = getSettings(db);
  const p = db.publications.find((x) => x.id === id);
  if (!p) throw notFound("Clip introuvable");
  if (p.status !== "En attente") throw badRequest("Ce clip a déjà été traité");
  if (!decision.approve) {
    p.status = "Refusée";
    p.reason = decision.reason;
    notify(db, p.userId, "⚠️", `Clip « ${p.title} » refusé : ${sentence(decision.reason)}`, link.clip(p.id));
    logActivity(db, "🚫", `Clip « ${p.title} » refusé par ${admin.name}.`);
    return;
  }
  const amount = validateClip(db, p, settings.holdDays);
  if (!amount) notify(db, p.userId, "✅", `Votre clip « ${p.title} » a été validé.`, link.clip(p.id));
  logActivity(db, "✅", `Clip « ${p.title} » validé (${fmt(amount)}).`);
}

// ---------- Portefeuille (money.ts, wallet.ts) ----------

/** Soldes d'un clipper, en DA. */
export function balances(db: Store, userId: string) {
  const now = Date.now();
  let available = 0, pending = 0, earned = 0;
  for (const t of db.transactions) {
    if (t.userId !== userId) continue;
    if (t.type === "gain" && t.status === "Validé") {
      earned += t.amount;
      if (t.availableAt !== null && t.availableAt <= now) available += t.amount;
      else if (t.availableAt !== null) pending += t.amount;
    } else if (t.type === "retrait" && t.status !== "Refusé") available += t.amount;
  }
  return { available, pending, earned };
}

/** Demande de retrait d'un clipper vers son moyen de paiement enregistré. */
export function requestWithdrawal({ db }: Ctx, user: UserRow, amount: number, instant: boolean) {
  const settings = getSettings(db);
  if (!user.payoutMethod || !user.payoutAccount) throw badRequest("Ajoutez d'abord un moyen de retrait (BaridiMob, CCP ou RIB) dans votre profil");
  if (amount < settings.minWithdraw) throw badRequest(`Le retrait minimum est de ${fmt(settings.minWithdraw)}`);
  const fee = instant ? instantFee(amount, settings.instantFeePercent, settings.instantMinFee) : 0;
  const { available } = balances(db, user.id);
  if (amount > available) throw badRequest(`Solde disponible insuffisant (${fmt(available)})`);
  const id = newId();
  insertTransaction(db, {
    id, ref: newRef(), userId: user.id, type: "retrait", amount: -amount, fee, status: "En cours",
    method: user.payoutMethod, label: `Retrait ${instant ? "instantané " : ""}vers ${user.payoutMethod}`,
  });
  notifyRole(db, "admin", "💸", `${user.name} demande un retrait de ${fmt(amount)}${instant ? " (instantané)" : ""}.`, link.adminPayment(id));
  logActivity(db, "💸", `${user.name} a demandé un retrait de ${fmt(amount)}.`);
}

/**
 * Une agence annonce une recharge de son crédit (virement ou carte Visa / Mastercard ; Edahabia et CIB se paient en ligne,
 * payments.ts). Le crédit est ajouté quand l'équipe confirme la réception. Carte : la marque et les 4 derniers chiffres dans le libellé.
 */
export function requestCredit({ db }: Ctx, user: UserRow, amount: number, method: string, card?: { brand: string; last4: string }) {
  const id = newId(), ref = newRef();
  const label = `Recharge par ${method}${method === "carte Visa / Mastercard" && card ? ` · ${card.brand} •••• ${card.last4}` : ""}`;
  insertTransaction(db, { id, ref, userId: user.id, type: "recharge", amount, status: "En cours", method, label });
  notifyRole(db, "admin", "🏦", `${user.name} annonce une recharge de ${fmt(amount)} par ${method} (réf. ${ref}).`, link.adminPayment(id));
  return ref;
}

/**
 * Validation d'une recharge encore « En cours » : seul endroit où une recharge devient « Validé » et où le crédit de
 * l'agence augmente, confirmation de l'équipe (reviewTransaction) ou paiement en ligne (settleOnlinePayment, payments.ts).
 * La facture de la recharge est créée ici (documents.ts).
 */
export function validateRecharge(db: Store, t: TxRow) {
  t.status = "Validé";
  userOf(db, t.userId).credit += t.amount;
  issueDocument(db, t);
}

/**
 * L'équipe traite un retrait (validé : reçu, et prime de parrainage au premier retrait d'un filleul) ou confirme une
 * recharge annoncée (virement, carte Visa / Mastercard). Une recharge payée en ligne ne se traite pas à la main : Chargily
 * la confirme (ici, la page de paiement simulée).
 */
export function reviewTransaction({ db }: Ctx, admin: UserRow, id: string, approve: boolean) {
  const t = db.transactions.find((x) => x.id === id);
  if (!t) throw notFound("Transaction introuvable");
  if (t.status !== "En cours" || t.type === "gain") throw badRequest("Cette transaction a déjà été traitée");
  if (t.provider === "chargily") throw badRequest("Paiement en ligne : confirmé automatiquement par Chargily");
  if (t.type === "recharge" && approve) validateRecharge(db, t);
  else {
    t.status = approve ? "Validé" : "Refusé";
    // Retrait versé : son reçu, puis la prime du parrain s'il s'agit du premier retrait d'un filleul (referrals.ts).
    if (approve) {
      issueDocument(db, t);
      rewardReferral(db, t, getSettings(db));
    }
  }
  const what = t.type === "retrait" ? `retrait de ${fmt(-t.amount)}` : `recharge de ${fmt(t.amount)}`;
  // Accord du participe : « le retrait » est validé, « la recharge » est validée.
  const done = `${approve ? "validé" : "refusé"}${t.type === "recharge" ? "e" : ""}`;
  const net = t.type === "retrait" && approve && t.fee ? ` (${fmt(-t.amount - t.fee)} versés après ${fmt(t.fee)} de frais)` : "";
  notify(db, t.userId, approve ? "✅" : "⚠️", `Votre ${what} a été ${done}${net}.`, link.userTx(t.type, t.id));
  logActivity(db, approve ? "✅" : "🚫", `${what[0].toUpperCase()}${what.slice(1)} ${done} par ${admin.name}.`);
}

// ---------- Profil et administration (profile.ts) ----------

export function updateProfile({ db }: Ctx, user: UserRow, input: {
  name?: string; contact?: string; country?: string; bio?: string; handles?: Handles; payoutMethod?: string; payoutAccount?: string;
  avatar?: string | null; cover?: string | null; locale?: Locale;
}) {
  const patch: Partial<UserRow> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.country !== undefined) patch.country = input.country;
  // Photo de profil (tous les comptes, l'admin compris), couverture (agences seulement), langue de l'interface.
  if (input.avatar !== undefined) patch.avatar = storeImage(input.avatar, user.avatar);
  if (user.role === "agence" && input.cover !== undefined) patch.cover = storeImage(input.cover, user.cover);
  if (input.locale !== undefined) patch.locale = input.locale;
  if (user.role === "agence" && input.contact !== undefined) patch.contact = input.contact.trim();
  // Bio : présentation du clipper (vue par les marques) ou de l'agence (vue par les clippers sur sa page).
  if (input.bio !== undefined && (user.role === "clipper" || user.role === "agence")) patch.bio = input.bio.trim();
  // Comptes sociaux (handles) : plus modifiables ici, ils suivent les comptes vérifiés (addSocialAccount…).
  if (user.role === "clipper") {
    if (input.payoutMethod !== undefined) patch.payoutMethod = input.payoutMethod;
    if (input.payoutAccount !== undefined) patch.payoutAccount = input.payoutAccount.trim();
  }
  if (patch.name === "") throw badRequest("Le nom est obligatoire");
  const previousName = user.name;
  Object.assign(userOf(db, user.id), patch);
  if (user.role === "agence" && patch.name && patch.name !== previousName) {
    for (const c of db.campaigns) if (c.ownerId === user.id) c.brand = patch.name;
  }
}

export function setUserStatus({ db }: Ctx, admin: UserRow, id: string, status: "Actif" | "Suspendu") {
  const u = db.users.find((x) => x.id === id);
  if (!u) throw notFound("Utilisateur introuvable");
  if (u.role === "admin") throw badRequest("Un administrateur ne peut pas être suspendu");
  u.status = status;
  if (status === "Suspendu" && db.session?.userId === id) destroySession(db);
  notify(db, id, status === "Actif" ? "✅" : "⛔", status === "Actif" ? "Votre compte a été réactivé." : "Votre compte a été suspendu.", link.home(u.role));
  logActivity(db, status === "Actif" ? "✅" : "⛔", `${u.name} a été ${status === "Actif" ? "réactivé" : "suspendu"} par ${admin.name}.`);
}

// ---------- Badge de vérification des agences (verification.ts) ----------

/** Une agence demande le badge bleu, avec un message facultatif pour l'équipe (et redemande après un refus). */
export function requestVerification({ db }: Ctx, user: UserRow, message?: string) {
  if (user.verification === "pending") throw badRequest("Votre demande est déjà en cours d'examen");
  if (user.verification === "verified") throw badRequest("Votre agence est déjà vérifiée");
  Object.assign(userOf(db, user.id), { verification: "pending", verificationNote: message?.trim() || null } satisfies Partial<UserRow>);
  notifyRole(db, "admin", "🛡️", `${user.name} demande le badge de vérification.`, link.adminUser(user.id));
  logActivity(db, "🛡️", `${user.name} demande le badge de vérification.`);
}

/** L'équipe accorde le badge (avec ou sans demande), refuse une demande (motif obligatoire) ou retire le badge. */
export function reviewVerification({ db }: Ctx, admin: UserRow, id: string, input: { decision: "approve" | "reject" | "revoke"; reason?: string }) {
  const u = db.users.find((x) => x.id === id);
  if (!u) throw notFound("Utilisateur introuvable");
  if (u.role !== "agence") throw badRequest("Seules les agences peuvent être vérifiées");
  const reason = input.reason?.trim() ?? "";
  const allowed = { approve: u.verification !== "verified", reject: u.verification === "pending", revoke: u.verification === "verified" }[input.decision];
  if (!allowed) throw badRequest("Action impossible pour ce compte");
  if (input.decision === "approve") {
    Object.assign(u, { verification: "verified", verificationNote: null } satisfies Partial<UserRow>);
    notify(db, u.id, "🛡️", "Votre agence est maintenant vérifiée : le badge bleu s'affiche à côté de son nom.", link.agencyProfile());
    logActivity(db, "🛡️", `Badge de vérification accordé à ${u.name} par ${admin.name}.`);
  } else if (input.decision === "reject") {
    if (reason.length < 3) throw badRequest("Indiquez le motif du refus");
    Object.assign(u, { verification: "rejected", verificationNote: reason } satisfies Partial<UserRow>);
    notify(db, u.id, "⚠️", `Votre demande de badge de vérification a été refusée : ${sentence(reason)}`, link.agencyProfile());
    logActivity(db, "🛡️", `Demande de badge de ${u.name} refusée par ${admin.name}.`);
  } else {
    Object.assign(u, { verification: "none", verificationNote: reason || null } satisfies Partial<UserRow>);
    notify(db, u.id, "⚠️", reason ? `Le badge de vérification de votre agence a été retiré : ${sentence(reason)}` : "Le badge de vérification de votre agence a été retiré.", link.agencyProfile());
    logActivity(db, "🛡️", `Badge de vérification retiré à ${u.name} par ${admin.name}.`);
  }
}

// ---------- Comptes sociaux des clippers (social.ts) ----------
// Hors ligne, la vérification est toujours simulée (aucun appel aux plateformes) : elle réussit, avec les mêmes
// contrôles que le serveur (compte d'un autre clipper, compte déjà vérifié…).

const handleKey = (platform: string) => platform.toLowerCase() as keyof Handles;
const SOCIAL_TAKEN = "Ce compte est déjà vérifié par un autre clipper";

function assertFree(db: Store, platform: string, handle: string, userId: string) {
  if (db.social.some((a) => a.platform === platform && a.handle === handle && a.status === "verified" && a.userId !== userId)) throw badRequest(SOCIAL_TAKEN);
}

/** Ajout d'un compte (ou nouvel identifiant d'un compte en attente, qui garde son code) : renvoie son code « CB-XXXX ». */
export function addSocialAccount({ db }: Ctx, user: UserRow, input: { platform: string; handle: string }) {
  const handle = normalizeHandle(input.platform, input.handle);
  if (!handle) throw badRequest("Identifiant invalide : lettres, chiffres, points, tirets ou tirets bas (60 signes au plus)");
  assertFree(db, input.platform, handle, user.id);
  const mine = db.social.find((a) => a.userId === user.id && a.platform === input.platform);
  if (mine?.status === "verified") throw badRequest(`Vous avez déjà un compte ${input.platform} vérifié : retirez-le d'abord pour en changer`);
  if (mine) {
    Object.assign(mine, { handle, checkedAt: null });
    return { id: mine.id, code: mine.code };
  }
  const id = newId(), code = newSocialCode(db);
  db.social.push({ id, userId: user.id, platform: input.platform, handle, code, status: "pending", verifiedAt: null, checkedAt: null, createdAt: Date.now() });
  return { id, code };
}

/** Vérification simulée : le compte devient vérifié et son « @compte » s'affiche dans le profil (handles). */
export function verifySocialAccount({ db }: Ctx, user: UserRow, id: string) {
  const a = db.social.find((x) => x.id === id && x.userId === user.id);
  if (!a) throw notFound("Compte introuvable");
  if (a.status === "verified") throw badRequest("Ce compte est déjà vérifié");
  assertFree(db, a.platform, a.handle, user.id);
  const now = Date.now(), me = userOf(db, user.id);
  Object.assign(a, { status: "verified", verifiedAt: now, checkedAt: now });
  me.handles = { ...me.handles, [handleKey(a.platform)]: `@${a.handle}` };
  logActivity(db, "🛡️", `${me.name} a vérifié son compte ${a.platform} @${a.handle}.`);
  return { simulated: true };
}

/** Retrait d'un compte ; un compte vérifié disparaît aussi du profil (handles). */
export function removeSocialAccount({ db }: Ctx, user: UserRow, id: string) {
  const a = db.social.find((x) => x.id === id && x.userId === user.id);
  if (!a) throw notFound("Compte introuvable");
  db.social.splice(db.social.indexOf(a), 1);
  if (a.status !== "verified") return;
  const me = userOf(db, user.id), key = handleKey(a.platform);
  if (me.handles[key] === `@${a.handle}`) {
    const handles = { ...me.handles };
    delete handles[key];
    me.handles = handles;
  }
  logActivity(db, "🗑️", `${me.name} a retiré son compte ${a.platform} @${a.handle}.`);
}

export function markNotificationsRead({ db }: Ctx, userId: string, ids?: string[]) {
  for (const n of db.notifications) if (n.userId === userId && (!ids?.length || ids.includes(n.id))) n.read = true;
}
