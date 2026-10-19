import { z } from "zod";
// Module de la seule langue française : la version autonome n'embarque que les langues de zod importées ainsi
// (web/offline/build.mjs écarte les autres de z.locales).
import fr from "zod/v4/locales/fr.js";
import { PLATFORMS } from "./gradients";

// Messages par défaut de zod en français (champs sans message dédié) : l'API répond dans la langue source de l'app,
// que l'interface traduit à l'affichage (dictionnaires « server » de web/src/i18n/). Vaut aussi pour la version autonome.
z.config(fr());

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
// current : obligatoire si le compte a déjà un mot de passe (un compte créé avec Google, Apple ou Discord peut en définir un).
export const changePasswordSchema = z.object({ current: z.string().max(200).default(""), next: password });

/**
 * Image (photo de profil, couverture d'agence, photo de campagne), recadrée et compressée dans le navigateur (web/src/ui.js).
 * - data URL JPEG, PNG ou WebP : nouvelle image (le serveur la range dans la table media, la version autonome la garde telle quelle) ;
 * - adresse déjà enregistrée (« /api/media/<id> » ou data URL) : image inchangée, acceptée seulement si c'est l'image actuelle ;
 * - "" ou null : image retirée.
 */
export const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const MEDIA_URL = /^\/api\/media\/[a-z0-9]{16}$/;
export const MAX_IMAGE_CHARS = 2_000_000; // environ 1,5 Mo une fois décodée
export const imageRef = z.union([z.literal(""), z.null(), z.string().max(MAX_IMAGE_CHARS, "Image trop lourde (1,5 Mo maximum)")
  .refine((v) => IMAGE_DATA_URL.test(v) || MEDIA_URL.test(v), "Image invalide (JPEG, PNG ou WebP)")]);
export const LOCALES = ["fr", "en", "ar"] as const;

export const profileSchema = z.object({
  name: text("Nom", 80).optional(),
  contact: z.string().trim().max(80).optional(),
  country: text("Pays", 60).optional(),
  bio: z.string().trim().max(300).optional(),
  // Ignoré depuis la vérification des comptes sociaux (users.handles suit les comptes vérifiés) ; accepté pour les anciennes versions de l'app.
  handles: z.object({ tiktok: z.string().trim().max(60).optional(), instagram: z.string().trim().max(60).optional(), youtube: z.string().trim().max(60).optional(), facebook: z.string().trim().max(60).optional() }).optional(),
  payoutMethod: z.enum(["BaridiMob", "CCP", "RIB bancaire"]).optional(),
  payoutAccount: z.string().trim().max(60).optional(),
  /** Photo de profil (tous les comptes) et photo de couverture (agences). */
  avatar: imageRef.optional(),
  cover: imageRef.optional(),
  /** Langue de l'interface, mémorisée sur le compte. */
  locale: z.enum(LOCALES).optional(),
});

export const campaignSchema = z.object({
  title: text("Titre", 60),
  brand: z.string().trim().max(40).optional(),
  // Une catégorie de la liste, ou celle précisée par l'agence quand elle choisit « Autre » (texte libre).
  category: z.string({ error: "Catégorie manquante" }).trim().min(2, "Précisez la catégorie").max(30, "Catégorie trop longue (30 caractères maximum)")
    .refine((v) => v.toLowerCase() !== "autre", "Précisez la catégorie"),
  rate: money("Tarif").pipe(z.number().min(20, "Tarif minimum : 20 DA pour 1 000 vues").max(2000, "Tarif trop élevé")),
  budget: money("Budget"),
  minPayout: money("Seuil minimum"),
  maxPayout: money("Plafond"),
  emoji: z.string().trim().min(1).max(8).default("🎬"),
  platforms: z.array(z.enum(PLATFORMS as [string, ...string[]])).min(1, "Choisissez au moins une plateforme")
    .refine((l) => new Set(l).size === l.length, "Plateforme en double"),
  rules: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  /** Photo de la campagne (facultative) : remplace la couverture en dégradé. */
  image: imageRef.optional(),
});

export const campaignStatusSchema = z.object({
  status: z.enum(["Active", "En pause", "Terminée", "Refusée"]).optional(),
  top: z.boolean().optional(),
  /** Motif d'un refus par l'équipe (obligatoire avec status « Refusée »), transmis à l'agence. */
  reason: z.string().trim().max(300, "Motif trop long (300 caractères maximum)").optional(),
});

export const amountSchema = z.object({ amount: money("Montant").pipe(z.number().min(1, "Montant invalide")) });
export const membershipSchema = z.object({ joined: z.boolean().optional(), favorite: z.boolean().optional() });
/** Un clip publié sur une ou plusieurs plateformes de la campagne : un lien par plateforme (un clip enregistré par lien). */
export const clipSchema = z.object({
  campaignId: z.string().min(1),
  title: text("Titre", 100),
  links: z.array(z.object({ platform: z.enum(PLATFORMS as [string, ...string[]], { error: "Plateforme inconnue" }), url: text("Lien", 500) }))
    .min(1, "Ajoutez le lien de votre clip").max(PLATFORMS.length)
    .refine((l) => new Set(l.map((x) => x.platform)).size === l.length, "Un seul lien par plateforme")
    .refine((l) => new Set(l.map((x) => x.url.trim())).size === l.length, "Le même lien est indiqué deux fois"),
});
export const reviewClipSchema = z.discriminatedUnion("approve", [
  z.object({ approve: z.literal(true) }),
  z.object({ approve: z.literal(false), reason: text("Motif", 200) }),
]);
/**
 * Recours d'un clipper contre le refus d'un clip : son explication (20 à 1 000 caractères) et une preuve obligatoire,
 * une capture d'écran envoyée en data URL JPEG, PNG ou WebP (réduite dans le navigateur, sans recadrage).
 */
export const appealSchema = z.object({
  message: z.string({ error: "Message manquant" }).trim()
    .min(20, "Expliquez votre contestation en 20 caractères au moins").max(1000, "Message trop long (1 000 caractères maximum)"),
  proof: z.string({ error: "Ajoutez une capture d'écran comme preuve" }).min(1, "Ajoutez une capture d'écran comme preuve")
    .max(MAX_IMAGE_CHARS, "Image trop lourde (1,5 Mo maximum)").refine((v) => IMAGE_DATA_URL.test(v), "Image invalide (JPEG, PNG ou WebP)"),
});
/** Décision de l'équipe sur un recours : acceptation (le clip est validé) ou refus, motif obligatoire dans les deux cas. */
export const reviewAppealSchema = z.object({
  approve: z.boolean({ error: "Indiquez votre décision" }),
  reason: z.string({ error: "Motif manquant" }).trim()
    .min(3, "Indiquez le motif de votre décision (3 caractères minimum)").max(300, "Motif trop long (300 caractères maximum)"),
});
/** Compte social d'un clipper (Profil → Comptes sociaux) : identifiant ou adresse du profil, normalisé par le service (normalizeHandle). */
export const socialAccountSchema = z.object({
  platform: z.enum(PLATFORMS as [string, ...string[]], { error: "Plateforme inconnue" }),
  handle: text("Identifiant", 200),
});
/** Relevé saisi par l'équipe : vues, et likes facultatifs (absents ou null : les likes connus sont gardés). */
export const viewsSchema = z.object({ views: z.coerce.number().int().min(0).max(1_000_000_000), likes: z.coerce.number().int().min(0).max(1_000_000_000).nullish() });
export const withdrawSchema = z.object({ amount: money("Montant").pipe(z.number().min(1, "Montant invalide")), instant: z.boolean().default(false) });
export const CREDIT_METHODS = ["virement bancaire", "carte Edahabia", "carte CIB", "carte Visa / Mastercard"] as const;
/** Moyens de recharge payés en ligne via Chargily Pay (les autres sont confirmés à la main par l'équipe). */
export const ONLINE_CREDIT_METHODS = ["carte Edahabia", "carte CIB"] as const satisfies readonly (typeof CREDIT_METHODS)[number][];
/**
 * Recharge du crédit d'une agence. Carte Visa / Mastercard : seules la marque et les 4 derniers chiffres sont transmis
 * (le numéro complet ne quitte jamais le navigateur ; en production, le paiement passe par la page sécurisée d'une passerelle).
 */
export const creditSchema = z.object({
  amount: money("Montant").pipe(z.number().min(10000, "Recharge minimum : 10 000 DA")),
  method: z.enum(CREDIT_METHODS, { error: "Moyen de paiement inconnu" }),
  card: z.object({ brand: z.enum(["Visa", "Mastercard"]), last4: z.string().regex(/^\d{4}$/, "Carte invalide") }).optional(),
}).refine((d) => d.method !== "carte Visa / Mastercard" || !!d.card, { message: "Indiquez votre carte Visa ou Mastercard", path: ["card"] })
  // Edahabia et CIB se paient en ligne (POST /api/credit/checkout) : le crédit arrive avec la confirmation de Chargily.
  .refine((d) => !(ONLINE_CREDIT_METHODS as readonly string[]).includes(d.method), { message: "Carte Edahabia ou CIB : utilisez le paiement en ligne", path: ["method"] });
/** Paiement en ligne d'une recharge : montant et carte (Edahabia ou CIB), puis page de paiement de Chargily Pay. */
export const checkoutSchema = z.object({
  amount: money("Montant").pipe(z.number().min(10000, "Recharge minimum : 10 000 DA")),
  method: z.enum(ONLINE_CREDIT_METHODS, { error: "Paiement en ligne : carte Edahabia ou CIB" }),
});
/** Mode simulé : issue du paiement choisie sur la page de paiement simulée (payé ou annulé). */
export const simulatePaymentSchema = z.object({ paid: z.boolean() });
export const approveSchema = z.object({ approve: z.boolean() });
export const userStatusSchema = z.object({ status: z.enum(["Actif", "Suspendu"]) });
/** Badge de vérification : demande d'une agence (message facultatif pour l'équipe), puis décision de l'admin. */
export const verificationRequestSchema = z.object({ message: z.string().trim().max(300, "Message trop long (300 caractères maximum)").optional() });
export const verificationReviewSchema = z.object({
  decision: z.enum(["approve", "reject", "revoke"]),
  reason: z.string().trim().max(200, "Motif trop long (200 caractères maximum)").optional(),
});
/** Connexion Google, Apple ou Discord. */
export const OAUTH_PROVIDERS = ["google", "apple", "discord"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
/** Version autonome uniquement : connexion simulée (aucun échange avec le fournisseur). */
// mode : « login » (connexion d'un compte existant) ou « signup » (inscription avec le rôle choisi, ou connexion si le compte existe).
export const oauthDemoSchema = z.object({ provider: z.enum(OAUTH_PROVIDERS), name: text("Nom", 80), email, role: z.enum(["clipper", "agence"]).default("clipper"), mode: z.enum(["login", "signup"]).default("signup") });
export const settingsSchema = z.object({
  maintenance: z.boolean(), signupsOpen: z.boolean(), announcement: z.string().trim().max(200),
  minWithdraw: z.number().int().min(0), commissionRate: z.number().int().min(0).max(50), minBudget: z.number().int().min(0),
  earningDays: z.number().int().min(1).max(60), holdDays: z.number().int().min(0).max(60),
  instantFeePercent: z.number().min(0).max(20), instantMinFee: z.number().int().min(0),
}).partial();
