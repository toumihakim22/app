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

// ---------- Relevé des vues : historique jour par jour, score de risque de fraude, mode simulé ----------

/**
 * Un relevé du jour d'un clip (table view_snapshots) : likes null s'ils sont inconnus ; `at` : heure du relevé (ms,
 * recorded_at), à défaut midi UTC de son jour.
 */
export type ViewPoint = { day: string; views: number; likes: number | null; at?: number };

/** Jour UTC « AAAA-MM-JJ » d'un instant (même découpage que les séries de GET /api/state et que view_snapshots). */
export const utcDay = (at: number | Date) => new Date(at).toISOString().slice(0, 10);
const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** Fenêtre de l'historique montré à l'équipe et du calcul du risque, en jours. */
export const RISK_WINDOW_DAYS = 14;

/**
 * Vues gagnées par jour : écart avec le relevé précédent, divisé par le nombre de jours écoulés (un jour sans relevé
 * ne crée pas de faux pic). Le premier relevé n'a de gain que si le jour de publication du clip est connu
 * (`publishedDay`) : ses vues ont été gagnées depuis la publication. Sinon (clip suivi après coup), gain null.
 */
export function dailyGains(history: ViewPoint[], publishedDay?: string): (ViewPoint & { gain: number | null })[] {
  const sorted = [...history].sort((a, b) => a.day.localeCompare(b.day));
  return sorted.map((p, i) => {
    const prev = sorted[i - 1];
    if (prev) return { ...p, gain: Math.round(Math.max(0, p.views - prev.views) / Math.max(1, daysBetween(prev.day, p.day))) };
    return { ...p, gain: publishedDay ? Math.round(p.views / (Math.max(0, daysBetween(publishedDay, p.day)) + 1)) : null };
  });
}

/**
 * Intervalle minimal entre deux relevés pour calculer un rythme de vues (heures) : celui du relevé automatique (deux
 * relevés rapprochés, une saisie de l'équipe juste avant le relevé automatique, ne font pas un faux pic). Depuis la
 * publication : une heure seulement (ce rythme ne sert que de référence pour la suite, il ne signale jamais de pic).
 */
export const MIN_RATE_HOURS = 6;
const HOUR_MS = 3_600_000;
const readingAt = (p: ViewPoint) => p.at ?? Date.parse(`${p.day}T12:00:00Z`);

/**
 * Rythme des vues (vues par 24 heures) entre relevés successifs, d'après l'heure réelle de chaque relevé : un jour à
 * peine entamé (clip publié à 21 h, premier relevé à 22 h) n'est pas compté comme un jour entier, ce qui ferait passer
 * la journée complète suivante pour un pic. Chaque intervalle compte au moins MIN_RATE_HOURS heures. Le premier relevé
 * a un rythme depuis la publication si elle est connue (`publishedAt`, ms ; au moins une heure), sinon null (clip suivi
 * après coup).
 */
export function viewRates(history: ViewPoint[], publishedAt?: number) {
  const sorted = [...history].sort((a, b) => a.day.localeCompare(b.day));
  return sorted.map((p, i) => {
    const prev = sorted[i - 1], from = prev ? readingAt(prev) : publishedAt;
    const hours = from === undefined ? null : Math.max(0, (readingAt(p) - from) / HOUR_MS);
    const gained = Math.max(0, p.views - (prev ? prev.views : 0));
    return { ...p, hours, rate: hours === null ? null : (gained / Math.max(prev ? MIN_RATE_HOURS : 1, hours)) * 24 };
  });
}

/** Signaux du score de risque (libellés français, traduits par l'interface) et leur poids ; le score est plafonné à 100. */
export const RISK_SPIKE = "Pic de vues soudain";
export const RISK_LOW_LIKES = "Beaucoup de vues, peu de likes";
export const RISK_NEW_ACCOUNT = "Compte récent";
export const RISK_WEIGHTS: Record<string, number> = { [RISK_SPIKE]: 45, [RISK_LOW_LIKES]: 35, [RISK_NEW_ACCOUNT]: 20 };
/**
 * Pic : entre deux relevés, un rythme de plus de 5 000 vues par jour et plus de 5 fois le rythme moyen des intervalles
 * précédents ; ou plus de 50 000 vues par jour au premier relevé, fait dans les 48 heures après la publication.
 */
export const SPIKE_FACTOR = 5, SPIKE_MIN_VIEWS = 5000, FIRST_DAY_SPIKE = 50_000;
/** Peu de likes : moins de 0,5 % des vues, à partir de 5 000 vues (likes connus seulement). */
export const LOW_LIKES_MIN_VIEWS = 5000, LOW_LIKES_RATIO = 0.005;
/** Compte récent : compte ClipBoost, ou compte social vérifié, de moins de 7 jours à l'envoi du clip. */
export const NEW_ACCOUNT_DAYS = 7;

/**
 * Score de risque de fraude d'un clip (0 à 100) et ses signaux, d'après son historique jour par jour (`history`, la
 * fenêtre RISK_WINDOW_DAYS suffit), son dernier relevé (`views`, `likes`) et l'âge des comptes à l'envoi du clip
 * (`accountAgeDays` : compte ClipBoost ; `socialAgeDays` : compte social vérifié de sa plateforme, s'il existe) :
 * - « Pic de vues soudain » (45) : entre deux relevés de la fenêtre, un rythme (viewRates, heures réelles des relevés)
 *   de plus de SPIKE_MIN_VIEWS vues par jour et plus de SPIKE_FACTOR fois le rythme moyen des intervalles précédents ;
 *   ou plus de FIRST_DAY_SPIKE vues par jour au premier relevé, fait moins de 48 heures après la publication
 *   (`publishedAt` connu ; un premier relevé de quelques heures compte pour un jour) ;
 * - « Beaucoup de vues, peu de likes » (35) : au moins LOW_LIKES_MIN_VIEWS vues et moins de 0,5 % de likes ;
 * - « Compte récent » (20) : un des deux comptes a moins de NEW_ACCOUNT_DAYS jours.
 * Un pic reste signalé tant qu'il est dans la fenêtre : l'équipe examine un clip plusieurs jours après son envoi.
 */
export function fraudRisk(input: { history: ViewPoint[]; views: number; likes: number | null; accountAgeDays: number; socialAgeDays?: number | null; publishedAt?: number }) {
  const flags: string[] = [];
  const rates = viewRates(input.history, input.publishedAt);
  const before: number[] = [];
  let spike = false;
  for (const [i, { rate, hours, views }] of rates.entries()) {
    if (rate === null || hours === null) continue;
    // Premier relevé : pic seulement s'il suit de près la publication (sinon son rythme n'est qu'une moyenne sur la durée).
    if (i === 0) spike ||= hours <= 48 && (views / Math.max(24, hours)) * 24 > FIRST_DAY_SPIKE;
    else if (before.length) spike ||= rate > SPIKE_MIN_VIEWS && rate > SPIKE_FACTOR * (before.reduce((s, g) => s + g, 0) / before.length);
    before.push(rate);
  }
  if (spike) flags.push(RISK_SPIKE);
  if (input.likes !== null && input.views >= LOW_LIKES_MIN_VIEWS && input.likes / input.views < LOW_LIKES_RATIO) flags.push(RISK_LOW_LIKES);
  const social = input.socialAgeDays;
  if (input.accountAgeDays < NEW_ACCOUNT_DAYS || (social != null && social >= 0 && social < NEW_ACCOUNT_DAYS)) flags.push(RISK_NEW_ACCOUNT);
  return { score: Math.min(100, flags.reduce((s, f) => s + RISK_WEIGHTS[f], 0)), flags };
}

/**
 * Risque d'un clip (fraudRisk) à partir de ses relevés les plus récents (`latest` : au moins RISK_WINDOW_DAYS + 2 s'il
 * en a autant, dans n'importe quel ordre), de la date de son envoi et de celles de ses comptes (inscription du clipper,
 * vérification de son compte social sur la plateforme du clip). Même calcul sur le serveur et hors ligne.
 * La publication ne sert au rythme du premier relevé que si tout l'historique est là (sinon, ce relevé est la base).
 */
export function clipRisk(clip: { createdAt: number; views: number; likes: number | null }, latest: ViewPoint[], accounts: { userCreatedAt: number | null; socialVerifiedAt: number | null }) {
  const sorted = [...latest].sort((a, b) => b.day.localeCompare(a.day));
  const complete = sorted.length <= RISK_WINDOW_DAYS + 1;
  const history = sorted.slice(0, RISK_WINDOW_DAYS + 1).reverse();
  const age = (at: number | null) => (at === null ? null : (clip.createdAt - at) / DAY_MS);
  return fraudRisk({
    history, views: clip.views, likes: clip.likes, accountAgeDays: age(accounts.userCreatedAt) ?? Infinity, socialAgeDays: age(accounts.socialVerifiedAt),
    publishedAt: complete ? clip.createdAt : undefined,
  });
}

/** Niveau d'un score de risque : faible (< 30), moyen (30 à 59), élevé (≥ 60). */
export const riskLevel = (score: number): "faible" | "moyen" | "élevé" => (score >= 60 ? "élevé" : score >= 30 ? "moyen" : "faible");

/** Ligne du journal d'activité d'un relevé lancé par l'équipe (même texte sur le serveur et hors ligne). */
export const viewsTrackedText = (name: string, updated: number, failed: number) =>
  `Vues relevées par ${name} : ${updated} clip${updated > 1 ? "s" : ""} mis à jour${failed ? `, ${failed} en erreur` : ""}.`;

/** Empreinte stable d'un texte dans [0, 1[ (FNV-1a sur 32 bits) : même tirage sur le serveur et hors ligne. */
function unitHash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0) / 0x1_0000_0000;
}

/**
 * Profil de croissance simulé d'un clip, tiré de son identifiant : audience de base (clip encore sans vues), constante
 * de temps en heures (vitesse à laquelle la croissance ralentit) et taux de likes (3 à 8 % des vues).
 */
export function simulatedProfile(id: string) {
  return { reach: 3000 + Math.round(unitHash(`${id}:reach`) * 57_000), tau: 24 + unitHash(`${id}:tau`) * 48, likeRate: 0.03 + unitHash(`${id}:likes`) * 0.05 };
}
/** Part de l'audience finale atteinte à un âge donné (heures) : 1 − e^(−âge/τ), rapide au début puis de plus en plus lente. */
const reached = (ageHours: number, tau: number) => 1 - Math.exp(-Math.max(0, ageHours) / tau);

/**
 * Vues et likes d'un clip en mode simulé (plateforme sans clé d'API, version autonome) : croissance plausible et
 * déterministe, tirée de son identifiant et de son âge (heures depuis l'envoi). Le dernier relevé (`views` à
 * `lastAgeHours`, ou 6 heures plus tôt s'il n'y en a jamais eu) fixe l'audience finale de la courbe ; un clip sans vues
 * suit l'audience de base de son profil. Les vues ne baissent jamais ; les likes suivent leur taux (ceux qui étaient
 * inconnus sont estimés sur toutes les vues).
 */
export function simulatedStats(id: string, ageHours: number, last: { views: number; likes: number | null; lastAgeHours: number | null }) {
  const { reach, tau, likeRate } = simulatedProfile(id);
  const t0 = Math.max(1, last.lastAgeHours ?? ageHours - 6), t1 = Math.max(t0, ageHours);
  // Audience finale : celle que donne le dernier relevé sur la courbe, bornée (une saisie très tôt ne fait pas exploser la suite).
  const total = last.views > 0 ? Math.min(last.views / reached(t0, tau), Math.max(reach, last.views * 3)) : reach;
  // Variation de ±15 % d'un relevé à l'autre, elle aussi tirée de l'identifiant et de l'âge.
  const jitter = 0.85 + unitHash(`${id}:${Math.floor(t1)}`) * 0.3;
  const gained = last.views > 0 ? Math.round(total * (reached(t1, tau) - reached(t0, tau)) * jitter) : Math.round(total * reached(t1, tau) * jitter);
  const views = last.views + Math.max(0, gained);
  const likes = last.likes === null ? Math.round(views * likeRate) : last.likes + Math.round(Math.max(0, gained) * likeRate);
  return { views, likes };
}

/**
 * Historique simulé d'un clip jusqu'à un relevé connu (`views` à `endAt`, en ms) : un relevé par jour UTC (à 22 h, le
 * dernier à `endAt`) sur la courbe du mode simulé, likes au taux de son profil ou à `likeRate`. `spike` : vues faibles
 * et régulières (2 % par jour) puis un pic au dernier relevé, à la place de la courbe. Sert aux données d'exemple (serveur et version autonome).
 */
export function simulatedHistory(id: string, createdAt: number, endAt: number, views: number, opts: { likeRate?: number; spike?: boolean } = {}) {
  const { tau, likeRate } = simulatedProfile(id), rate = opts.likeRate ?? likeRate;
  const times: number[] = [];
  for (let d = utcDay(createdAt), end = utcDay(endAt); d <= end; d = utcDay(Date.parse(`${d}T12:00:00Z`) + DAY_MS)) {
    const at = d === end ? endAt : Date.parse(`${d}T22:00:00Z`);
    if (at >= createdAt + 3_600_000) times.push(at);
  }
  const age = (at: number) => (at - createdAt) / 3_600_000;
  return times.map((at, i): ViewPoint & { at: number } => {
    // Pic : 2 % des vues finales par jour (à l'heure près), puis le saut du dernier relevé.
    const v = i === times.length - 1 ? views : opts.spike ? Math.round((views * 0.02 * age(at)) / 24) : Math.round((views * reached(age(at), tau)) / reached(age(endAt), tau));
    return { day: utcDay(at), at, views: v, likes: Math.round(v * rate) };
  });
}

// ---------- Messagerie par campagne (clipper ↔ agence, ou équipe ClipBoost) ----------

/** Statuts d'une campagne sur lesquels un clipper peut poser une question (rejointe ou non). */
export const ASKABLE_STATUSES = ["Active", "En pause"] as const;
/** Anti-spam : au plus MESSAGE_LIMIT messages envoyés par un utilisateur sur MESSAGE_WINDOW_MS (10 minutes). */
export const MESSAGE_LIMIT = 30, MESSAGE_WINDOW_MS = 10 * 60_000;
/** Longueur maximale de l'extrait d'un message repris dans une notification. */
export const EXCERPT_MAX = 60;

/** Identifiant d'une conversation dans l'app et ses liens : « <campagne>~<clipper> » (les identifiants n'ont pas de « ~ »). */
export const threadKey = (campaignId: string, clipperId: string) => `${campaignId}~${clipperId}`;

/**
 * Campagne de ClipBoost (créée par l'équipe : sans propriétaire, ou propriétaire administrateur) : ce sont les admins
 * qui répondent aux clippers, et non une agence.
 */
export const isTeamCampaign = (ownerId: string | null, ownerRole: string | null | undefined) => !ownerId || ownerRole === "admin";

/** Extrait d'un message pour une notification : une ligne, coupé à EXCERPT_MAX caractères sur un espace, avec « … ». */
export function messageExcerpt(body: string) {
  const line = body.replace(/\s+/g, " ").trim();
  if (line.length <= EXCERPT_MAX) return line;
  const cut = line.slice(0, EXCERPT_MAX), space = cut.lastIndexOf(" ");
  return `${(space > EXCERPT_MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.!?…-]+$/, "")}…`;
}

/**
 * Notification de l'agence (ou des admins) à chaque message d'un clipper : « Nouvelle question » quand il ouvre la
 * conversation ou relance après une réponse, « Nouveau message » quand il complète sa question. Même texte sur le
 * serveur, hors ligne et dans les données d'exemple (traduit par l'interface, web/src/i18n/<langue>/server.js).
 */
export const clipperMessageText = (clipper: string, campaign: string, body: string, question: boolean) =>
  `${question ? "Nouvelle question" : "Nouveau message"} de ${clipper} sur « ${campaign} » : « ${messageExcerpt(body)} »`;

/** Notification du clipper à chaque réponse : de l'agence (son nom), ou de l'équipe pour une campagne de ClipBoost. */
export const replyText = (agency: string | null, campaign: string, body: string) =>
  agency ? `Réponse de ${agency} sur « ${campaign} » : « ${messageExcerpt(body)} »` : `L'équipe ClipBoost a répondu sur « ${campaign} » : « ${messageExcerpt(body)} »`;

/** Message tel que stocké (dates en millisecondes), pour messageThreads. */
export type MessageRow = { id: string; campaignId: string; clipperId: string; senderId: string; body: string; createdAt: number; readAt: number | null };

/**
 * Conversations envoyées à l'interface (GET /api/state), de la plus récente à la plus ancienne : messages dans l'ordre,
 * unread : messages de l'autre côté pas encore lus par le lecteur (clipper ou non), awaiting : le dernier message vient du
 * clipper (une réponse est attendue). Même forme sur le serveur et hors ligne.
 */
export function messageThreads(rows: MessageRow[], readerIsClipper: boolean) {
  const sorted = rows.slice().sort((a, b) => a.createdAt - b.createdAt);
  const threads = new Map<string, { id: string; campaignId: string; clipperId: string; unread: number; awaiting: boolean; lastAt: string; messages: { id: string; senderId: string; fromClipper: boolean; body: string; at: string; read: boolean }[] }>();
  for (const m of sorted) {
    const key = threadKey(m.campaignId, m.clipperId), fromClipper = m.senderId === m.clipperId, read = m.readAt !== null;
    let t = threads.get(key);
    if (!t) threads.set(key, (t = { id: key, campaignId: m.campaignId, clipperId: m.clipperId, unread: 0, awaiting: false, lastAt: "", messages: [] }));
    t.messages.push({ id: m.id, senderId: m.senderId, fromClipper, body: m.body, at: new Date(m.createdAt).toISOString(), read });
    if (!read && fromClipper !== readerIsClipper) t.unread++;
    t.awaiting = fromClipper;
    t.lastAt = new Date(m.createdAt).toISOString();
  }
  return [...threads.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt) || a.id.localeCompare(b.id));
}

// ---------- Classement hebdomadaire des clippers (vues validées) et primes du top 10 ----------

/** Heure d'Alger (Africa/Algiers) : UTC+1 toute l'année, sans heure d'été. Les semaines du classement suivent cette heure. */
export const ALGIERS_OFFSET_MS = 3_600_000;
const WEEK_MS = 7 * DAY_MS;
/** Rangs primés (top 10 : une prime par rang, réglage weeklyPrizes) et semaines rattrapées au plus par une clôture en retard. */
export const PRIZE_RANKS = 10, CATCH_UP_WEEKS = 8;

/** Début de la semaine (ms) qui contient `at` : lundi 00:00, heure d'Alger (dimanche 23:00 UTC). */
export function weekStart(at: number) {
  const local = at + ALGIERS_OFFSET_MS, midnight = local - (((local % DAY_MS) + DAY_MS) % DAY_MS);
  return midnight - ((new Date(midnight).getUTCDay() + 6) % 7) * DAY_MS - ALGIERS_OFFSET_MS;
}

/** Clé ISO de la semaine qui contient `at`, heure d'Alger : « 2026-W43 » (année ISO : celle du jeudi de la semaine). */
export function weekKey(at: number) {
  const thursday = new Date(weekStart(at) + ALGIERS_OFFSET_MS + 3 * DAY_MS), year = thursday.getUTCFullYear();
  return `${year}-W${String(Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / WEEK_MS) + 1).padStart(2, "0")}`;
}

/** Bornes d'une semaine « 2026-W43 » en ms : début (lundi 00:00 à Alger) et fin exclue (lundi suivant) ; null si la clé n'existe pas. */
export function weekBounds(key: string) {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return null;
  const jan4 = Date.UTC(+m[1], 0, 4), start = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY_MS + (+m[2] - 1) * WEEK_MS - ALGIERS_OFFSET_MS;
  // Semaine 0, ou semaine 53 d'une année qui n'en a que 52.
  return +m[2] >= 1 && weekKey(start) === key ? { start, end: start + WEEK_MS } : null;
}

/** Numéro de la semaine d'une clé (« 2026-W43 » → 43), cité dans les libellés et les notifications. */
export const weekNumber = (key: string) => Number(key.slice(6));

/**
 * Semaines terminées à clôturer à l'instant `now` : celles qui suivent la dernière semaine clôturée (`lastClosed`),
 * jusqu'à la semaine écoulée ; sans clôture précédente (premier lancement), la semaine écoulée seule. Une tâche arrêtée
 * longtemps ne rattrape que les CATCH_UP_WEEKS dernières semaines.
 */
export function weeksToClose(lastClosed: string | null, now: number) {
  const last = weekKey(weekStart(now) - 1), from = lastClosed ? weekBounds(lastClosed) : null;
  if (!from) return [last];
  const out: string[] = [];
  for (let at = from.end; at < weekStart(now); at += WEEK_MS) out.push(weekKey(at));
  return out.slice(-CATCH_UP_WEEKS);
}

/**
 * Un relevé fait après le début d'une semaine ne remplace pas le relevé du même jour UTC fait avant (dimanche entre
 * 23:00 et minuit UTC) : la semaine terminée garde son dernier relevé, la suivante part du même (aucune vue comptée deux fois).
 */
export const keepsWeekReading = (previousAt: number, now: number) => previousAt < weekStart(now) && weekStart(now) <= now;

/** Relevé d'un clip (view_snapshots : vues et heure du relevé, ms) pour le calcul des vues d'une semaine. */
export type WeekReading = { publicationId: string; views: number; at: number };

/**
 * Vues gagnées par chaque clip pendant la semaine [start, end[ : vues du dernier relevé avant la fin, moins celles du
 * dernier relevé avant le début (0 sans relevé avant : toutes ses vues comptent). Clip sans relevé dans la semaine : 0.
 */
export function weekGains(readings: WeekReading[], start: number, end: number) {
  const before = new Map<string, WeekReading>(), last = new Map<string, WeekReading>();
  for (const r of readings) {
    if (r.at < start && (before.get(r.publicationId)?.at ?? -Infinity) < r.at) before.set(r.publicationId, r);
    if (r.at < end && (last.get(r.publicationId)?.at ?? -Infinity) < r.at) last.set(r.publicationId, r);
  }
  const gains = new Map<string, number>();
  for (const [id, r] of last) gains.set(id, Math.max(0, r.views - (before.get(id)?.views ?? 0)));
  return gains;
}

/** Ligne du classement : rang (à partir de 1), clipper, vues validées de la semaine, prime de son rang (0 au-delà du 10e). */
export type RankRow = { rank: number; userId: string; views: number; prize: number };

/**
 * Classement d'une semaine : vues gagnées (weekGains) par les clips « Validée » de chaque clipper, additionnées. Les
 * clippers suspendus et ceux sans vue ne sont pas classés. Ex æquo : le plus de vues d'abord, puis l'inscription la plus
 * ancienne. Les PRIZE_RANKS premiers reçoivent la prime de leur rang (`prizes`, réglage weeklyPrizes).
 */
export function weeklyRanking(clips: { id: string; userId: string; status: string }[], gains: Map<string, number>, clippers: { id: string; createdAt: number; status: string }[], prizes: number[]): RankRow[] {
  const total = new Map<string, number>();
  for (const c of clips) if (c.status === "Validée" && gains.get(c.id)) total.set(c.userId, (total.get(c.userId) ?? 0) + gains.get(c.id)!);
  return clippers.filter((u) => u.status !== "Suspendu" && (total.get(u.id) ?? 0) > 0)
    .sort((a, b) => total.get(b.id)! - total.get(a.id)! || a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    .map((u, i) => ({ rank: i + 1, userId: u.id, views: total.get(u.id)!, prize: i < PRIZE_RANKS ? Math.max(0, Math.floor(prizes[i] ?? 0)) : 0 }));
}

/** Rang abrégé des textes du serveur : « 1er », « 2e »… (traduit par l'interface). */
export const rankText = (rank: number) => (rank === 1 ? "1er" : `${rank}e`);
const amountText = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} DA`;
/** Libellé de la transaction d'une prime (même texte sur le serveur, hors ligne et dans les données d'exemple). */
export const prizeLabel = (week: string, rank: number) => `Prime classement · semaine ${weekNumber(week)} (${rankText(rank)})`;
/** Notification du gagnant d'une prime. */
export const prizeNotice = (week: string, rank: number, amount: number) => `Vous êtes ${rankText(rank)} du classement de la semaine ${weekNumber(week)} : +${amountText(amount)}`;
/** Ligne du journal d'activité à la clôture d'une semaine. */
export const weekClosedText = (week: string, winners: number, paid: number) =>
  `Classement de la semaine ${weekNumber(week)} clôturé : ${winners ? `${winners} prime${winners > 1 ? "s" : ""} versée${winners > 1 ? "s" : ""} (${amountText(paid)})` : "aucune prime versée"}.`;
