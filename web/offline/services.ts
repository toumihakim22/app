// Logique métier de la version autonome : la copie fidèle de lib/server/services/*.ts (mêmes contrôles,
// mêmes messages, mêmes effets), sur la base locale. Les règles de calcul viennent de lib/server/rules.ts.
import type { CampaignStatus, Handles, Role, SignupPayload } from "../../lib/server/db/schema";
import { GRADIENTS } from "../../lib/server/gradients";
import { belowMin, fundingCost, instantFee, payoutDelta, validateCampaignNumbers, viewsFor } from "../../lib/server/rules";
import {
  ApiError, badRequest, forbidden, getSettings, insertCampaign, insertPublication, insertTransaction, insertUser, logActivity,
  newId, newRef, notFound, notify, notifyRole, randomInt, type CampaignRow, type PubRow, type Store, type UserRow,
} from "./db";
import { hashPassword, sha256Hex, strongEnough, verifyPassword } from "./password";

/** Contexte d'une requête : la copie de travail de la base et l'enregistrement immédiat (hors transaction). */
export type Ctx = { db: Store; commit: () => void };

const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/ | /g, " ")} DA`;

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

export async function requestSignup({ db }: Ctx, input: { role: "clipper" | "agence"; name: string; contact?: string; email: string; country: string; password: string }) {
  const settings = getSettings(db);
  if (!settings.signupsOpen || settings.maintenance) throw forbidden("Les inscriptions sont momentanément fermées");
  const email = normalizeEmail(input.email);
  if (emailTaken(db, email)) throw badRequest("Un compte existe déjà avec cet email");
  if (!strongEnough(input.password)) throw badRequest("Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre");
  const payload: SignupPayload = { role: input.role, name: input.name.trim(), contact: input.contact?.trim() || null, country: input.country, passwordHash: await hashPassword(input.password) };
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
  insertUser(db, { id, role: p.role, email, passwordHash: p.passwordHash, name: p.name, contact: p.contact, country: p.country });
  logActivity(db, p.role === "agence" ? "🏢" : "👤", `${p.name} s'est inscrit${p.role === "agence" ? " (agence)" : ""}.`);
  createSession(db, id);
  return id;
}

const NO_USER_HASH = "sha256$AAAAAAAAAAAAAAAAAAAAAA==$AAAA";

export async function login({ db }: Ctx, emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const user = db.users.find((u) => u.email === email);
  // On vérifie un mot de passe même si le compte n'existe pas, comme sur le serveur.
  const ok = await verifyPassword(password, user?.passwordHash ?? NO_USER_HASH);
  if (!user || !ok) throw badRequest("Email ou mot de passe incorrect");
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
  if (!(await verifyPassword(current, user.passwordHash))) throw badRequest("Mot de passe actuel incorrect");
  if (!strongEnough(next)) throw badRequest("Le nouveau mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre");
  user.passwordHash = await hashPassword(next);
}

// ---------- Campagnes (campaigns.ts) ----------

export type CampaignInput = {
  title: string; brand?: string; category: string; rate: number; budget: number; minPayout: number; maxPayout: number;
  emoji: string; platforms: string[]; rules: string[];
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
  const id = newId();
  insertCampaign(db, {
    id, ownerId: isAdmin ? null : user.id, brand: isAdmin ? input.brand!.trim() : user.name,
    title: input.title.trim(), category: input.category, rate: input.rate, budget: input.budget,
    minPayout: input.minPayout, maxPayout: input.maxPayout, emoji: input.emoji,
    platforms: input.platforms, rules: input.rules, gradient: GRADIENTS[n % GRADIENTS.length],
    status: isAdmin ? "Active" : "En attente", commissionRate: isAdmin ? 0 : settings.commissionRate,
  });
  if (isAdmin) {
    notifyRole(db, "clipper", "🎯", `Nouvelle campagne : ${input.title.trim()} (${input.rate} DA /1K).`);
    logActivity(db, "🎯", `Campagne « ${input.title.trim()} » publiée.`);
  } else {
    notify(db, user.id, "⏳", `Votre campagne « ${input.title.trim()} » est en cours de vérification.`);
    notifyRole(db, "admin", "🏢", `${user.name} a soumis la campagne « ${input.title.trim()} ».`);
    logActivity(db, "🏢", `${user.name} a soumis la campagne « ${input.title.trim()} ».`);
  }
  return id;
}

/**
 * Changements de statut : approbation (budget + commission prélevés sur le crédit de l'agence),
 * refus, pause, reprise, fin (le budget non consommé et sa commission sont rendus à l'agence).
 */
export function setCampaignStatus({ db }: Ctx, user: UserRow, id: string, next: CampaignStatus) {
  const row = getCampaign(db, id), c = { ...row };
  const isAdmin = user.role === "admin";
  if (!isAdmin) {
    if (c.ownerId !== user.id) throw forbidden();
    const allowed = (c.status === "Active" && next === "En pause") || (c.status === "En pause" && next === "Active");
    if (!allowed) throw badRequest("Action impossible sur cette campagne");
  }
  if (c.status === next) return;
  if (c.status === "Terminée" || c.status === "Refusée") throw badRequest("Cette campagne est close");

  const patch: Partial<CampaignRow> = { status: next };
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
      notify(db, c.ownerId, "💰", `${fmt(refund)} non consommés sur « ${c.title} » ont été rendus à votre crédit.`);
    }
  }
  Object.assign(row, patch);

  const verb: Record<string, string> = { Active: c.status === "En attente" ? "a été approuvée et est en ligne" : "est de nouveau active", "En pause": "a été mise en pause", "Terminée": "est terminée", "Refusée": "a été refusée" };
  if (isAdmin) notify(db, c.ownerId, next === "Active" ? "✅" : "⚠️", `Votre campagne « ${c.title} » ${verb[next] ?? "a changé de statut"}.`);
  if (c.status === "En attente" && next === "Active") notifyRole(db, "clipper", "🎯", `Nouvelle campagne : ${c.title} (${c.rate} DA /1K).`);
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

// Le lien doit pointer vers la plateforme déclarée.
const HOSTS: Record<string, RegExp> = {
  TikTok: /(^|\.)tiktok\.com$/,
  Instagram: /(^|\.)instagram\.com$/,
  YouTube: /(^|\.)(youtube\.com|youtu\.be)$/,
};

export function submitClip({ db }: Ctx, user: UserRow, input: { campaignId: string; title: string; platform: string; url: string }) {
  const c = db.campaigns.find((x) => x.id === input.campaignId);
  if (!c) throw notFound("Campagne introuvable");
  if (c.status !== "Active") throw badRequest("Cette campagne n'accepte plus de clips");
  if (!c.platforms.includes(input.platform)) throw badRequest(`Cette campagne n'accepte pas ${input.platform}`);
  const member = db.members.find((m) => m.campaignId === c.id && m.userId === user.id && m.joined);
  if (!member) throw badRequest("Rejoignez la campagne avant de soumettre un clip");
  let url: URL;
  try {
    url = new URL(input.url.trim());
  } catch {
    throw badRequest("Lien invalide");
  }
  if (url.protocol !== "https:" || !HOSTS[input.platform]?.test(url.hostname)) throw badRequest(`Le lien doit être un lien ${input.platform} (https://…)`);
  if (db.publications.some((p) => p.url === url.toString())) throw badRequest("Ce clip a déjà été soumis");
  const id = newId();
  insertPublication(db, { id, userId: user.id, campaignId: c.id, title: input.title.trim(), platform: input.platform, url: url.toString() });
  logActivity(db, "🎬", `${user.name} a soumis le clip « ${input.title.trim()} » (${c.title}).`);
  return id;
}

/** Relevé des vues d'un clip. Pendant la fenêtre de gains, un clip validé est payé pour ses vues supplémentaires. */
export function recordViews({ db }: Ctx, id: string, views: number) {
  const settings = getSettings(db);
  const p = db.publications.find((x) => x.id === id);
  if (!p) throw notFound("Clip introuvable");
  if (views < p.views) throw badRequest("Le nombre de vues ne peut pas diminuer");
  p.views = views;
  if (p.status !== "Validée" || !p.approvedAt) return;
  if (Date.now() - p.approvedAt > settings.earningDays * 86_400_000) return;
  const c = getCampaign(db, p.campaignId);
  const extra = payoutDelta(views, c, p.paid);
  if (!extra) return;
  credit(db, p, c, extra, `${c.title} · vues supplémentaires`, settings.holdDays);
}

function credit(db: Store, p: PubRow, c: CampaignRow, amount: number, label: string, holdDays: number) {
  const spent = c.spent + amount;
  p.paid += amount;
  c.spent = spent;
  if (spent >= c.budget) c.status = "Terminée";
  insertTransaction(db, {
    id: newId(), ref: newRef(), userId: p.userId, type: "gain", label, amount, status: "Validé",
    availableAt: Date.now() + holdDays * 86_400_000, publicationId: p.id,
  });
  notify(db, p.userId, "💸", `+${fmt(amount)} pour « ${p.title} ». Retirable dans ${holdDays} jours.`);
  if (spent >= c.budget) {
    notify(db, c.ownerId, "🏁", `Le budget de « ${c.title} » est entièrement consommé : la campagne est terminée.`);
    logActivity(db, "🏁", `Campagne « ${c.title} » terminée (budget consommé).`);
  }
}

export function reviewClip({ db }: Ctx, admin: UserRow, id: string, decision: { approve: true } | { approve: false; reason: string }) {
  const settings = getSettings(db);
  const p = db.publications.find((x) => x.id === id);
  if (!p) throw notFound("Clip introuvable");
  if (p.status !== "En attente") throw badRequest("Ce clip a déjà été traité");
  if (!decision.approve) {
    p.status = "Refusée";
    p.reason = decision.reason;
    notify(db, p.userId, "⚠️", `Clip « ${p.title} » refusé : ${decision.reason}.`);
    logActivity(db, "🚫", `Clip « ${p.title} » refusé par ${admin.name}.`);
    return;
  }
  const c = getCampaign(db, p.campaignId);
  if (belowMin(p.views, c)) throw badRequest(`Seuil non atteint : ${viewsFor(c.minPayout, c.rate).toLocaleString("fr-FR")} vues minimum`);
  p.status = "Validée";
  p.approvedAt = Date.now();
  const amount = payoutDelta(p.views, c, 0);
  if (amount > 0) credit(db, p, c, amount, c.title, settings.holdDays);
  else notify(db, p.userId, "✅", `Votre clip « ${p.title} » a été validé.`);
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
  insertTransaction(db, {
    id: newId(), ref: newRef(), userId: user.id, type: "retrait", amount: -amount, fee, status: "En cours",
    method: user.payoutMethod, label: `Retrait ${instant ? "instantané " : ""}vers ${user.payoutMethod}`,
  });
  notifyRole(db, "admin", "💸", `${user.name} demande un retrait de ${fmt(amount)}${instant ? " (instantané)" : ""}.`);
  logActivity(db, "💸", `${user.name} a demandé un retrait de ${fmt(amount)}.`);
}

/** Une agence demande à recharger son crédit. Le crédit est ajouté quand l'équipe confirme la réception. */
export function requestCredit({ db }: Ctx, user: UserRow, amount: number, method: string) {
  const ref = newRef();
  insertTransaction(db, { id: newId(), ref, userId: user.id, type: "recharge", amount, status: "En cours", method, label: `Recharge par ${method}` });
  notifyRole(db, "admin", "🏦", `${user.name} annonce une recharge de ${fmt(amount)} par ${method} (réf. ${ref}).`);
  return ref;
}

/** L'équipe traite un retrait ou confirme une recharge. */
export function reviewTransaction({ db }: Ctx, admin: UserRow, id: string, approve: boolean) {
  const t = db.transactions.find((x) => x.id === id);
  if (!t) throw notFound("Transaction introuvable");
  if (t.status !== "En cours" || t.type === "gain") throw badRequest("Cette transaction a déjà été traitée");
  t.status = approve ? "Validé" : "Refusé";
  if (t.type === "recharge" && approve) userOf(db, t.userId).credit += t.amount;
  const what = t.type === "retrait" ? `retrait de ${fmt(-t.amount)}` : `recharge de ${fmt(t.amount)}`;
  const net = t.type === "retrait" && approve && t.fee ? ` (${fmt(-t.amount - t.fee)} versés après ${fmt(t.fee)} de frais)` : "";
  notify(db, t.userId, approve ? "✅" : "⚠️", `Votre ${what} a été ${approve ? "validé" : "refusé"}${net}.`);
  logActivity(db, approve ? "✅" : "🚫", `${what[0].toUpperCase()}${what.slice(1)} ${approve ? "validé" : "refusé"} par ${admin.name}.`);
}

// ---------- Profil et administration (profile.ts) ----------

export function updateProfile({ db }: Ctx, user: UserRow, input: { name?: string; contact?: string; country?: string; bio?: string; handles?: Handles; payoutMethod?: string; payoutAccount?: string }) {
  const patch: Partial<UserRow> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.country !== undefined) patch.country = input.country;
  if (user.role === "agence" && input.contact !== undefined) patch.contact = input.contact.trim();
  if (user.role === "clipper") {
    if (input.bio !== undefined) patch.bio = input.bio.trim();
    if (input.handles !== undefined) patch.handles = input.handles;
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
  notify(db, id, status === "Actif" ? "✅" : "⛔", status === "Actif" ? "Votre compte a été réactivé." : "Votre compte a été suspendu.");
  logActivity(db, status === "Actif" ? "✅" : "⛔", `${u.name} a été ${status === "Actif" ? "réactivé" : "suspendu"} par ${admin.name}.`);
}

export function markNotificationsRead({ db }: Ctx, userId: string, ids?: string[]) {
  for (const n of db.notifications) if (n.userId === userId && (!ids?.length || ids.includes(n.id))) n.read = true;
}
