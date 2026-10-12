import { z } from "zod";
import { CATEGORIES, PLATFORMS } from "./gradients";

const text = (label: string, max: number) => z.string({ error: `${label} manquant` }).trim().min(1, `${label} obligatoire`).max(max, `${label} trop long`);
const money = (label: string) => z.coerce.number({ error: `${label} invalide` }).int(`${label} invalide`).min(0, `${label} invalide`).max(1_000_000_000, `${label} trop élevé`);

export const email = z.string().trim().toLowerCase().email("Adresse email invalide").max(200);
export const password = z.string().min(1, "Mot de passe obligatoire").max(200);
export const code = z.string().trim().regex(/^\d{6}$/, "Le code contient 6 chiffres");

export const signupSchema = z.object({
  role: z.enum(["clipper", "agence"]),
  name: text("Nom", 80),
  contact: z.string().trim().max(80).optional(),
  email, country: text("Pays", 60), password,
  terms: z.literal(true, { error: "Vous devez accepter les conditions d'utilisation" }),
});
export const verifySchema = z.object({ email, code });
export const loginSchema = z.object({ email, password });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ email, code, password });
export const changePasswordSchema = z.object({ current: password, next: password });

export const profileSchema = z.object({
  name: text("Nom", 80).optional(),
  contact: z.string().trim().max(80).optional(),
  country: text("Pays", 60).optional(),
  bio: z.string().trim().max(300).optional(),
  handles: z.object({ tiktok: z.string().trim().max(60).optional(), instagram: z.string().trim().max(60).optional(), youtube: z.string().trim().max(60).optional() }).optional(),
  payoutMethod: z.enum(["BaridiMob", "CCP", "RIB bancaire"]).optional(),
  payoutAccount: z.string().trim().max(60).optional(),
});

export const campaignSchema = z.object({
  title: text("Titre", 60),
  brand: z.string().trim().max(40).optional(),
  category: z.enum(CATEGORIES as [string, ...string[]], { error: "Catégorie inconnue" }),
  rate: money("Tarif").pipe(z.number().min(20, "Tarif minimum : 20 DA pour 1 000 vues").max(2000, "Tarif trop élevé")),
  budget: money("Budget"),
  minPayout: money("Seuil minimum"),
  maxPayout: money("Plafond"),
  emoji: z.string().trim().min(1).max(8).default("🎬"),
  platforms: z.array(z.enum(PLATFORMS as [string, ...string[]])).min(1, "Choisissez au moins une plateforme"),
  rules: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
});

export const campaignStatusSchema = z.object({
  status: z.enum(["Active", "En pause", "Terminée", "Refusée"]).optional(),
  top: z.boolean().optional(),
});
export const amountSchema = z.object({ amount: money("Montant").pipe(z.number().min(1, "Montant invalide")) });
export const membershipSchema = z.object({ joined: z.boolean().optional(), favorite: z.boolean().optional() });
export const clipSchema = z.object({ campaignId: z.string().min(1), title: text("Titre", 100), platform: z.enum(PLATFORMS as [string, ...string[]]), url: text("Lien", 500) });
export const reviewClipSchema = z.discriminatedUnion("approve", [
  z.object({ approve: z.literal(true) }),
  z.object({ approve: z.literal(false), reason: text("Motif", 200) }),
]);
export const viewsSchema = z.object({ views: z.coerce.number().int().min(0).max(1_000_000_000) });
export const withdrawSchema = z.object({ amount: money("Montant").pipe(z.number().min(1)), instant: z.boolean().default(false) });
export const creditSchema = z.object({ amount: money("Montant").pipe(z.number().min(10000, "Recharge minimum : 10 000 DA")), method: z.enum(["virement bancaire", "carte Edahabia", "carte CIB"]) });
export const approveSchema = z.object({ approve: z.boolean() });
export const userStatusSchema = z.object({ status: z.enum(["Actif", "Suspendu"]) });
export const settingsSchema = z.object({
  maintenance: z.boolean(), signupsOpen: z.boolean(), announcement: z.string().trim().max(200),
  minWithdraw: z.number().int().min(0), commissionRate: z.number().int().min(0).max(50), minBudget: z.number().int().min(0),
  earningDays: z.number().int().min(1).max(60), holdDays: z.number().int().min(0).max(60),
  instantFeePercent: z.number().min(0).max(20), instantMinFee: z.number().int().min(0),
}).partial();
