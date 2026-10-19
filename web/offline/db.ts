// Base de données de la version autonome (fichier HTML unique) : les mêmes tables que PostgreSQL,
// dans un objet JSON enregistré dans le localStorage du navigateur. Sans table media : une image
// (photo de profil, couverture, photo de campagne) est gardée en data URL dans sa propre colonne.
import type * as schema from "../../lib/server/db/schema";
import { socialCode } from "../../lib/server/rules";
import { DEFAULT_SETTINGS, type Settings } from "../../lib/server/settings";
import { seed } from "./seed";

// Les dates sont stockées en millisecondes (JSON) au lieu d'objets Date.
type Row<T, K extends keyof T> = Omit<T, K> & { [P in K]: null extends T[P] ? number | null : number };
export type UserRow = Row<typeof schema.users.$inferSelect, "createdAt">;
export type CodeRow = Row<typeof schema.emailCodes.$inferSelect, "createdAt" | "expiresAt">;
export type CampaignRow = Row<typeof schema.campaigns.$inferSelect, "createdAt" | "updatedAt">;
export type MemberRow = Row<typeof schema.campaignMembers.$inferSelect, "createdAt">;
export type PubRow = Row<typeof schema.publications.$inferSelect, "createdAt" | "approvedAt" | "checkedAt">;
export type TxRow = Row<typeof schema.transactions.$inferSelect, "createdAt" | "availableAt">;
export type NotifRow = Row<typeof schema.notifications.$inferSelect, "createdAt">;
export type ActivityRow = Row<typeof schema.activity.$inferSelect, "createdAt">;
/** Compte Google, Apple ou Discord relié (connexion simulée : sujet « demo:<email> »). */
export type OAuthRow = Row<typeof schema.oauthAccounts.$inferSelect, "createdAt">;
/** Compte social d'un clipper, vérifié par un code « CB-XXXX » dans sa bio (vérification simulée hors ligne). */
export type SocialRow = Row<typeof schema.socialAccounts.$inferSelect, "createdAt" | "verifiedAt" | "checkedAt">;
/** Relevé du jour d'un clip (historique jour par jour des vues). */
export type SnapshotRow = Row<typeof schema.viewSnapshots.$inferSelect, "recordedAt">;
/** Dernière exécution d'une tâche planifiée (« views » : relevé des vues, lancé à la demande toutes les 6 heures). */
export type JobRunRow = Row<typeof schema.jobRuns.$inferSelect, "lastRunAt">;

export type Store = {
  version: number;
  users: UserRow[];
  emailCodes: CodeRow[];
  campaigns: CampaignRow[];
  members: MemberRow[];
  publications: PubRow[];
  transactions: TxRow[];
  notifications: NotifRow[];
  activity: ActivityRow[];
  oauth: OAuthRow[];
  social: SocialRow[];
  snapshots: SnapshotRow[];
  jobRuns: JobRunRow[];
  settings: Partial<Settings>;
  /** Session du navigateur (l'équivalent du cookie cb_session). */
  session: { userId: string; expiresAt: number } | null;
};

// Les colonnes ajoutées depuis la première version sont complétées au chargement (voir upgrade()) : la clé
// ne change pas, pour que les données déjà enregistrées dans le navigateur soient conservées.
const VERSION = 1;
export const STORAGE_KEY = `clipboost-offline-v${VERSION}`;

export const emptyStore = (): Store => ({
  version: VERSION, users: [], emailCodes: [], campaigns: [], members: [], publications: [], transactions: [],
  notifications: [], activity: [], oauth: [], social: [], snapshots: [], jobRuns: [], settings: {}, session: null,
});

// ---------- Persistance ----------

// Pas d'écriture de test ici : un stockage presque plein la ferait échouer et ferait passer la page sur
// une base vide en mémoire (les données d'exemple), alors que la vraie base est toujours lisible.
function storage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    s.getItem(STORAGE_KEY);
    return s;
  } catch {
    return null;
  }
}

// Sans localStorage utilisable (navigation privée stricte), les données vivent le temps de la page.
let memory: string | null = null;

/**
 * Base enregistrée par une version précédente du fichier : les colonnes ajoutées depuis reçoivent leur
 * valeur par défaut (comme une migration SQL). Sans effet sur une base à jour ; refait à chaque chargement,
 * il couvre aussi les lignes écrites entre-temps par un ancien fichier ouvert dans un autre onglet.
 */
function upgrade(s: Store): Store {
  s.oauth ??= [];
  s.social ??= [];
  s.snapshots ??= [];
  s.jobRuns ??= [];
  for (const u of s.users) {
    u.avatar ??= null;
    u.cover ??= null;
    u.verification ??= "none";
    u.verificationNote ??= null;
    u.locale ??= "fr";
  }
  for (const c of s.campaigns) {
    c.image ??= null;
    c.reviewNote ??= null;
    c.updatedAt ??= c.createdAt;
  }
  for (const p of s.publications) {
    p.batch ??= null;
    p.likes ??= null;
    p.checkedAt ??= null;
    p.riskScore ??= 0;
    p.riskFlags ??= [];
  }
  return s;
}

/**
 * Copie de travail de la base pour une requête : relue à chaque fois, pour que plusieurs onglets
 * restent cohérents. Une requête en erreur n'enregistre rien (comme une transaction annulée).
 */
export async function load(): Promise<Store> {
  const raw = storage()?.getItem(STORAGE_KEY) ?? memory;
  if (raw) {
    try {
      const s = JSON.parse(raw) as Store;
      if (s.version === VERSION) return upgrade(s);
    } catch {
      // données illisibles : on repart des données d'exemple
    }
  }
  const s = await seed();
  // Copie illisible ou d'un format inconnu : effacée d'abord, pour que sa place serve aux données d'exemple.
  if (raw) {
    memory = null;
    storage()?.removeItem(STORAGE_KEY);
  }
  save(s);
  return s;
}

/** Erreur d'une requête que le navigateur ne peut pas enregistrer (images surtout : elles sont gardées dans la base). */
export const STORAGE_FULL = "Espace de stockage du navigateur plein : choisissez une image plus légère.";

/**
 * Enregistre la base. Si le navigateur refuse (quota du localStorage atteint), la requête échoue avec
 * STORAGE_FULL et la base enregistrée reste celle d'avant la requête, comme une transaction annulée.
 */
export function save(s: Store) {
  const raw = JSON.stringify(s);
  const ls = storage();
  if (ls) {
    try {
      ls.setItem(STORAGE_KEY, raw);
      memory = null;
      return;
    } catch {
      // Une base est déjà enregistrée : le stockage est plein. On ne garde pas ces changements en mémoire,
      // le prochain chargement relirait la base enregistrée et ils disparaîtraient sans prévenir.
      if (ls.getItem(STORAGE_KEY) !== null) throw new ApiError(413, STORAGE_FULL);
      // Rien n'a jamais pu être enregistré (stockage indisponible) : les données vivent le temps de la page.
    }
  }
  memory = raw;
}

export function clear() {
  memory = null;
  storage()?.removeItem(STORAGE_KEY);
}

// ---------- Identifiants (même format que lib/server/ids.ts) ----------

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function newId(size = 16) {
  let out = "";
  for (const b of crypto.getRandomValues(new Uint8Array(size))) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export const newRef = () => `T-${newId(6).toUpperCase()}`;

/** Code de vérification « CB-XXXX » libre (même format que le serveur, lib/server/rules.ts). */
export function newSocialCode(db: Store) {
  for (;;) {
    const code = socialCode(crypto.getRandomValues(new Uint8Array(4)));
    if (!db.social.some((a) => a.code === code)) return code;
  }
}

/** Entier aléatoire uniforme dans [min, max[. */
export function randomInt(min: number, max: number) {
  const range = max - min, limit = Math.floor(0x1_0000_0000 / range) * range, buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return min + (buf[0] % range);
}

// ---------- Erreurs (mêmes statuts que lib/server/http.ts) ----------

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const badRequest = (message: string) => new ApiError(400, message);
export const forbidden = (message = "Accès refusé") => new ApiError(403, message);
export const notFound = (message = "Introuvable") => new ApiError(404, message);

// ---------- Réglages, notifications et journal (lib/server/settings.ts, events.ts) ----------

export const getSettings = (db: Store): Settings => ({ ...DEFAULT_SETTINGS, ...db.settings });

export function notify(db: Store, userId: string | null | undefined, icon: string, text: string, link?: string) {
  if (!userId) return;
  db.notifications.push({ id: newId(), userId, icon, text, link: link ?? null, read: false, createdAt: Date.now() });
}

export function notifyRole(db: Store, role: schema.Role, icon: string, text: string, link?: string) {
  for (const u of db.users) if (u.role === role) notify(db, u.id, icon, text, link);
}

export function logActivity(db: Store, icon: string, text: string) {
  db.activity.push({ id: newId(), icon, text, createdAt: Date.now() });
}

// ---------- Insertion avec les valeurs par défaut des colonnes ----------

export function insertUser(db: Store, v: Pick<UserRow, "id" | "role" | "email" | "passwordHash" | "name"> & Partial<UserRow>) {
  const row: UserRow = {
    contact: null, country: "Algérie", status: "Actif", level: "Nouveau", credit: 0, payoutMethod: null, payoutAccount: null, handles: {}, bio: "",
    avatar: null, cover: null, verification: "none", verificationNote: null, locale: "fr", createdAt: Date.now(), ...v,
  };
  db.users.push(row);
  return row;
}

type CampaignInsert = Omit<CampaignRow, "spent" | "commissionRate" | "reserved" | "top" | "emoji" | "image" | "reviewNote" | "createdAt" | "updatedAt"> & Partial<CampaignRow>;
export function insertCampaign(db: Store, v: CampaignInsert) {
  const createdAt = v.createdAt ?? Date.now();
  const row: CampaignRow = { spent: 0, commissionRate: 0, reserved: 0, top: false, emoji: "🎬", image: null, reviewNote: null, createdAt, updatedAt: createdAt, ...v };
  db.campaigns.push(row);
  return row;
}

export function insertPublication(db: Store, v: Pick<PubRow, "id" | "userId" | "campaignId" | "title" | "platform" | "url"> & Partial<PubRow>) {
  const row: PubRow = { batch: null, views: 0, status: "En attente", reason: null, paid: 0, approvedAt: null, likes: null, checkedAt: null, riskScore: 0, riskFlags: [], createdAt: Date.now(), ...v };
  db.publications.push(row);
  return row;
}

export function insertTransaction(db: Store, v: Pick<TxRow, "id" | "ref" | "userId" | "type" | "label" | "amount" | "status"> & Partial<TxRow>) {
  const row: TxRow = { fee: 0, method: null, availableAt: null, publicationId: null, createdAt: Date.now(), ...v };
  db.transactions.push(row);
  return row;
}

/** Tri du plus récent au plus ancien ; à date égale, la dernière ligne insérée d'abord. */
export const newestFirst = <T extends { createdAt: number }>(rows: T[]) => rows.slice().reverse().sort((a, b) => b.createdAt - a.createdAt);
