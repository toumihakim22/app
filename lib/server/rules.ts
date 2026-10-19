// Règles métier pures (sans base de données), partagées par l'API et les tests.
import { PLATFORM_HOSTS } from "./gradients";

export type PayoutCampaign = { rate: number; minPayout: number; maxPayout: number };

/** Gain brut d'un clip : tarif pour 1 000 vues, sans seuil ni plafond. */
export const rawEarnings = (views: number, rate: number) => Math.floor((views * rate) / 1000);

/** Un clip sous le seuil minimum n'est ni examiné ni payé. */
export const belowMin = (views: number, c: PayoutCampaign) => rawEarnings(views, c.rate) < c.minPayout;

/** Gain d'un clip validé : zéro sous le seuil, et jamais plus que le plafond. */
export function payoutFor(views: number, c: PayoutCampaign): number {
  if (belowMin(views, c)) return 0;
  return Math.min(rawEarnings(views, c.rate), c.maxPayout);
}

/** Vues nécessaires pour atteindre un montant donné. */
export const viewsFor = (amount: number, rate: number) => Math.ceil((amount * 1000) / rate);

/** Montant à prélever sur le crédit de l'agence : budget + commission ClipBoost. */
export const fundingCost = (budget: number, commissionRate: number) => budget + Math.round((budget * commissionRate) / 100);

/** Frais d'un retrait instantané. */
export function instantFee(amount: number, feePercent: number, minFee: number) {
  return Math.max(minFee, Math.round((amount * feePercent) / 100));
}

/**
 * Montant supplémentaire à créditer quand les vues d'un clip validé évoluent :
 * on paie la différence avec ce qui a déjà été versé, sans dépasser le budget restant.
 */
export function payoutDelta(views: number, c: PayoutCampaign & { budget: number; spent: number }, alreadyPaid: number) {
  const due = payoutFor(views, c) - alreadyPaid;
  if (due <= 0) return 0;
  return Math.max(0, Math.min(due, c.budget - c.spent));
}

export function validateCampaignNumbers(n: { rate: number; budget: number; minPayout: number; maxPayout: number }, minBudget: number): string | null {
  if (n.budget < minBudget) return `Le budget minimum est de ${minBudget} DA`;
  if (n.maxPayout <= n.minPayout) return "Le plafond doit être supérieur au seuil minimum";
  if (n.maxPayout > n.budget) return "Le plafond par clip ne peut pas dépasser le budget";
  return null;
}

/**
 * Motif saisi par l'équipe (refus d'une campagne, d'un badge), cité en fin de notification
 * avec un seul point final : « … a été refusée : motif. », même si le motif se termine déjà par un point.
 */
export const sentence = (text: string) => (/[.!?…]$/.test(text) ? text : `${text}.`);

// ---------- Comptes sociaux des clippers (code « CB-XXXX » dans la bio) ----------

/** Alphabet des codes : sans signes ambigus (0/O, 1/I/L). 32 signes : un octet aléatoire modulo 32 reste uniforme. */
export const SOCIAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Code de vérification « CB-XXXX » tiré de 4 octets aléatoires (node:crypto sur le serveur, Web Crypto hors ligne). */
export const socialCode = (bytes: ArrayLike<number>) => `CB-${Array.from({ length: 4 }, (_, i) => SOCIAL_CODE_ALPHABET[bytes[i] % 32]).join("")}`;

/** Le code figure dans la bio, en majuscules ou en minuscules, comme un mot entier (« CB-7F3K », « cb-7f3k »). */
export const bioHasCode = (bio: string, code: string) =>
  new RegExp(`(^|[^A-Z0-9])${code.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}($|[^A-Z0-9])`, "i").test(bio);

/** Identifiant valide : lettres (toutes écritures), chiffres, points, tirets et tirets bas, 60 signes au plus. */
const HANDLE = /^[\p{L}\p{N}._-]{1,60}$/u;
// Premiers segments d'adresse qui ne sont pas un compte (Instagram, Facebook) : publication, page de service…
const NOT_ACCOUNT = new Set(["p", "reel", "reels", "tv", "stories", "explore", "watch", "share", "groups", "pages", "people", "profile.php", "story.php", "permalink.php"]);

/**
 * Identifiant normalisé d'un compte saisi par le clipper : « @Yacine.Clips », « yacine.clips » ou l'adresse du profil
 * (« https://www.tiktok.com/@yacine.clips », « instagram.com/yacine.clips/ ») donnent « yacine.clips ».
 * Sans « @ » initial et en minuscules (comparaisons) ; null si ce n'est pas un identifiant valide.
 */
export function normalizeHandle(platform: string, raw: string): string | null {
  let s = raw.trim();
  if (/^https?:\/\//i.test(s) || /^([\w-]+\.)+[a-z]{2,}\//i.test(s)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    } catch {
      return null;
    }
    if (!PLATFORM_HOSTS[platform]?.test(url.hostname)) return null;
    let parts: string[];
    try {
      parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    } catch {
      return null;
    }
    // Le segment « @compte » (TikTok, YouTube), sinon l'adresse d'un profil Instagram ou d'une page Facebook.
    const at = parts.find((p) => p.startsWith("@"));
    s = at ?? ((platform === "Instagram" || platform === "Facebook") && parts.length === 1 && !NOT_ACCOUNT.has(parts[0].toLowerCase()) ? parts[0] : "");
  }
  s = s.replace(/^@+/, "").toLowerCase();
  return HANDLE.test(s) ? s : null;
}

/**
 * Compte nommé dans le lien d'un clip, quand la plateforme l'y met : TikTok « https://www.tiktok.com/@compte/video/… »,
 * YouTube « https://www.youtube.com/@compte/… ». null sinon (lien court, « youtu.be/… », « /shorts/<id> », Instagram, Facebook).
 */
export function handleInUrl(platform: string, url: string): string | null {
  if (platform !== "TikTok" && platform !== "YouTube") return null;
  try {
    const first = decodeURIComponent(new URL(url).pathname.split("/")[1] ?? "");
    // Tel quel (sans « @ », en minuscules), même s'il n'a pas la forme d'un identifiant : il ne correspondra à aucun compte.
    return first.startsWith("@") ? first.replace(/^@+/, "").toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Un lien de clip est accepté s'il vient du compte vérifié du clipper sur sa plateforme (`handle`, undefined si aucun) :
 * message d'erreur (même texte sur le serveur et hors ligne), ou null si le lien est accepté.
 */
export function socialLinkError(platform: string, url: string, handle: string | undefined): string | null {
  if (!handle) return `Vérifiez d'abord votre compte ${platform} (Profil → Comptes sociaux)`;
  const named = handleInUrl(platform, url);
  return named && named !== handle ? `Ce lien ne vient pas de votre compte ${platform} vérifié (@${handle})` : null;
}
