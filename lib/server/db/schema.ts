import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export type Role = "clipper" | "agence" | "admin";
export type Handles = { tiktok?: string; instagram?: string; youtube?: string };

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
  createdAt: createdAt(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

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
  createdAt: createdAt(),
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
  views: integer("views").notNull().default(0),
  status: text("status").$type<PublicationStatus>().notNull().default("En attente"),
  reason: text("reason"),
  // Total déjà crédité au clipper pour ce clip (seuil et plafond appliqués).
  paid: integer("paid").notNull().default(0),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("publications_user_idx").on(t.userId), index("publications_campaign_idx").on(t.campaignId), uniqueIndex("publications_url_idx").on(t.url)]);

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
