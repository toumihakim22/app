import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export type Role = "clipper" | "agence" | "admin";
/** Badge de vérification (agences) : demande en cours, accordé ou refusé par l'équipe. */
export type Verification = "none" | "pending" | "verified" | "rejected";
export type Locale = "fr" | "en" | "ar";
/** Comptes du clipper sur les plateformes (« @pseudo »), affichés aux agences. */
export type Handles = { tiktok?: string; instagram?: string; youtube?: string; facebook?: string };

export const users = pgTable("users", {
  id: id(),
  role: text("role").$type<Role>().notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  contact: text("contact"),
  country: text("country").notNull().default("Algérie"),
  status: text("status").$type<"Actif" | "Suspendu">().notNull().default("Actif"),
  level: text("level").notNull().default("Nouveau"),
  // Crédit prépayé d'une agence, en DA.
  credit: integer("credit").notNull().default(0),
  payoutMethod: text("payout_method"),
  payoutAccount: text("payout_account"),
  handles: jsonb("handles").$type<Handles>().notNull().default({}),
  bio: text("bio").notNull().default(""),
  /** Photo de profil et, pour une agence, photo de couverture : « /api/media/<id> » (table media). */
  avatar: text("avatar"),
  cover: text("cover"),
  verification: text("verification").$type<Verification>().notNull().default("none"),
  /** Message de l'agence avec sa demande, puis motif d'un refus. */
  verificationNote: text("verification_note"),
  locale: text("locale").$type<Locale>().notNull().default("fr"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

/** Comptes Google, Apple ou Discord reliés à un utilisateur (connexion sans mot de passe). */
export const oauthAccounts = pgTable("oauth_accounts", {
  provider: text("provider").$type<"google" | "apple" | "discord">().notNull(),
  /** Identifiant stable du compte chez le fournisseur (« sub » OpenID, id Discord). */
  subject: text("subject").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email"),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.provider, t.subject] }), index("oauth_accounts_user_idx").on(t.userId)]);

export type SocialStatus = "pending" | "verified";

/**
 * Comptes sociaux des clippers (un par plateforme) : le clipper colle le code « CB-XXXX » dans la bio du compte, puis
 * la vérification le lit par l'API de la plateforme. Seuls les clips publiés depuis un compte vérifié sont acceptés.
 * Un même compte (plateforme + identifiant) n'est vérifié que par un seul clipper (index unique partiel).
 */
export const socialAccounts = pgTable("social_accounts", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** « TikTok », « Instagram », « YouTube » ou « Facebook » (PLATFORMS). */
  platform: text("platform").notNull(),
  /** Identifiant normalisé : sans « @ », en minuscules (normalizeHandle, lib/server/rules.ts). */
  handle: text("handle").notNull(),
  code: text("code").notNull(),
  status: text("status").$type<SocialStatus>().notNull().default("pending"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  /** Dernière tentative de vérification (réussie ou non). */
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("social_accounts_user_platform_idx").on(t.userId, t.platform),
  uniqueIndex("social_accounts_code_idx").on(t.code),
  uniqueIndex("social_accounts_verified_handle_idx").on(t.platform, t.handle).where(sql`${t.status} = 'verified'`),
]);

/** Images envoyées (photos de profil, couvertures, photos de campagne), servies par GET /api/media/<id>. */
export const media = pgTable("media", {
  id: id(),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  /** Contenu encodé en base64. */
  data: text("data").notNull(),
  createdAt: createdAt(),
}, (t) => [index("media_owner_idx").on(t.ownerId)]);

export const sessions = pgTable("sessions", {
  // Empreinte SHA-256 du jeton : le jeton lui-même ne vit que dans le cookie.
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export type SignupPayload = { role: "clipper" | "agence"; name: string; contact: string | null; country: string; passwordHash: string };

// Codes à 6 chiffres envoyés par email : inscription et mot de passe oublié.
export const emailCodes = pgTable("email_codes", {
  email: text("email").notNull(),
  purpose: text("purpose").$type<"signup" | "reset">().notNull(),
  codeHash: text("code_hash").notNull(),
  payload: jsonb("payload").$type<SignupPayload | null>(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.email, t.purpose] })]);

export type CampaignStatus = "En attente" | "Active" | "En pause" | "Terminée" | "Refusée";

export const campaigns = pgTable("campaigns", {
  id: id(),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  brand: text("brand").notNull(),
  category: text("category").notNull(),
  // Tarif pour 1 000 vues, en DA.
  rate: integer("rate").notNull(),
  budget: integer("budget").notNull(),
  spent: integer("spent").notNull().default(0),
  minPayout: integer("min_payout").notNull(),
  maxPayout: integer("max_payout").notNull(),
  // Commission ClipBoost (en %) fixée à l'approbation, et montant prélevé sur le crédit de l'agence.
  commissionRate: integer("commission_rate").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  status: text("status").$type<CampaignStatus>().notNull(),
  top: boolean("top").notNull().default(false),
  emoji: text("emoji").notNull().default("🎬"),
  gradient: text("gradient").notNull(),
  platforms: jsonb("platforms").$type<string[]>().notNull(),
  rules: jsonb("rules").$type<string[]>().notNull(),
  /** Photo de la campagne (« /api/media/<id> »), sinon la couverture en dégradé de sa catégorie. */
  image: text("image"),
  /** Motif du dernier refus par l'équipe (effacé quand l'agence relance la campagne). */
  reviewNote: text("review_note"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("campaigns_owner_idx").on(t.ownerId), index("campaigns_status_idx").on(t.status)]);

export const campaignMembers = pgTable("campaign_members", {
  campaignId: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  favorite: boolean("favorite").notNull().default(false),
  joined: boolean("joined").notNull().default(false),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.campaignId, t.userId] })]);

export type PublicationStatus = "En attente" | "Validée" | "Refusée";

export const publications = pgTable("publications", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  platform: text("platform").notNull(),
  url: text("url").notNull(),
  /** Clips envoyés ensemble (même vidéo sur plusieurs plateformes) : même identifiant de lot. */
  batch: text("batch"),
  views: integer("views").notNull().default(0),
  status: text("status").$type<PublicationStatus>().notNull().default("En attente"),
  reason: text("reason"),
  // Total déjà crédité au clipper pour ce clip (seuil et plafond appliqués).
  paid: integer("paid").notNull().default(0),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  /** Likes au dernier relevé ; null : inconnus (plateforme qui ne les donne pas, vues saisies sans likes). */
  likes: integer("likes"),
  /** Dernier relevé des vues (tâche planifiée toutes les 6 heures, ou saisie de l'équipe). */
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  /** Risque de fraude (0 à 100) et ses signaux (fraudRisk, lib/server/rules.ts), recalculés à chaque relevé. Vus par l'admin seul. */
  riskScore: integer("risk_score").notNull().default(0),
  riskFlags: jsonb("risk_flags").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
}, (t) => [index("publications_user_idx").on(t.userId), index("publications_campaign_idx").on(t.campaignId), uniqueIndex("publications_url_idx").on(t.url)]);

/**
 * Historique jour par jour des vues d'un clip : une ligne par clip et par jour (UTC), remplacée par le dernier relevé
 * du jour. Sert au score de risque (pic de vues) et aux vues gagnées sur une période (classement hebdomadaire).
 */
export const viewSnapshots = pgTable("view_snapshots", {
  publicationId: text("publication_id").notNull().references(() => publications.id, { onDelete: "cascade" }),
  /** Jour UTC « AAAA-MM-JJ » (même découpage que les séries de GET /api/state). */
  day: text("day").notNull(),
  views: integer("views").notNull(),
  likes: integer("likes"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.publicationId, t.day] }), index("view_snapshots_day_idx").on(t.day)]);

/** Dernière exécution de chaque tâche planifiée (« views » : relevé des vues), avec son bilan. */
export const jobRuns = pgTable("job_runs", {
  name: text("name").primaryKey(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }).notNull(),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
});

export type TransactionType = "gain" | "retrait" | "recharge";
export type TransactionStatus = "Validé" | "En cours" | "Refusé";

export const transactions = pgTable("transactions", {
  id: id(),
  ref: text("ref").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<TransactionType>().notNull(),
  label: text("label").notNull(),
  // Montant signé en DA : positif pour un gain ou une recharge, négatif pour un retrait.
  amount: integer("amount").notNull(),
  fee: integer("fee").notNull().default(0),
  status: text("status").$type<TransactionStatus>().notNull(),
  method: text("method"),
  // Date à partir de laquelle un gain devient retirable (période de rétention anti-fraude).
  availableAt: timestamp("available_at", { withTimezone: true }),
  publicationId: text("publication_id").references(() => publications.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [index("transactions_user_idx").on(t.userId), uniqueIndex("transactions_ref_idx").on(t.ref)]);

export const notifications = pgTable("notifications", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  icon: text("icon").notNull(),
  text: text("text").notNull(),
  /** Route de l'app vers l'élément concerné (« #/clipper/publications/<id> »), null pour les anciennes notifications. */
  link: text("link"),
  read: boolean("read").notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index("notifications_user_idx").on(t.userId)]);

export const activity = pgTable("activity", {
  id: id(),
  icon: text("icon").notNull(),
  text: text("text").notNull(),
  createdAt: createdAt(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
