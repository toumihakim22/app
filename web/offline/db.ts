// Base de données de la version autonome (fichier HTML unique) : les mêmes tables que PostgreSQL,
// dans un objet JSON enregistré dans le localStorage du navigateur.
import type * as schema from "../../lib/server/db/schema";
import { DEFAULT_SETTINGS, type Settings } from "../../lib/server/settings";
import { seed } from "./seed";

// Les dates sont stockées en millisecondes (JSON) au lieu d'objets Date.
type Row<T, K extends keyof T> = Omit<T, K> & { [P in K]: null extends T[P] ? number | null : number };
export type UserRow = Row<typeof schema.users.$inferSelect, "createdAt">;
export type CodeRow = Row<typeof schema.emailCodes.$inferSelect, "createdAt" | "expiresAt">;
export type CampaignRow = Row<typeof schema.campaigns.$inferSelect, "createdAt">;
export type MemberRow = Row<typeof schema.campaignMembers.$inferSelect, "createdAt">;
export type PubRow = Row<typeof schema.publications.$inferSelect, "createdAt" | "approvedAt">;
export type TxRow = Row<typeof schema.transactions.$inferSelect, "createdAt" | "availableAt">;
export type NotifRow = Row<typeof schema.notifications.$inferSelect, "createdAt">;
export type ActivityRow = Row<typeof schema.activity.$inferSelect, "createdAt">;

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
  settings: Partial<Settings>;
  /** Session du navigateur (l'équivalent du cookie cb_session). */
  session: { userId: string; expiresAt: number } | null;
};

const VERSION = 1;
export const STORAGE_KEY = `clipboost-offline-v${VERSION}`;

export const emptyStore = (): Store => ({
  version: VERSION, users: [], emailCodes: [], campaigns: [], members: [], publications: [], transactions: [],
  notifications: [], activity: [], settings: {}, session: null,
});

// ---------- Persistance ----------

function storage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    s.setItem(`${STORAGE_KEY}-test`, "1");
    s.removeItem(`${STORAGE_KEY}-test`);
    return s;
  } catch {
    return null;
  }
}

// Sans localStorage (navigation privée stricte), les données vivent le temps de la page.
let memory: string | null = null;

/**
 * Copie de travail de la base pour une requête : relue à chaque fois, pour que plusieurs onglets
 * restent cohérents. Une requête en erreur n'enregistre rien (comme une transaction annulée).
 */
export async function load(): Promise<Store> {
  const raw = storage()?.getItem(STORAGE_KEY) ?? memory;
  if (raw) {
    try {
      const s = JSON.parse(raw) as Store;
      if (s.version === VERSION) return s;
    } catch {
      // données illisibles : on repart des données d'exemple
    }
  }
  const s = await seed();
  save(s);
  return s;
}

export function save(s: Store) {
  const raw = JSON.stringify(s);
  const ls = storage();
  if (ls) {
    try {
      ls.setItem(STORAGE_KEY, raw);
      return;
    } catch {
      // stockage plein : on garde au moins les données en mémoire
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

export function notify(db: Store, userId: string | null | undefined, icon: string, text: string) {
  if (!userId) return;
  db.notifications.push({ id: newId(), userId, icon, text, read: false, createdAt: Date.now() });
}

export function notifyRole(db: Store, role: schema.Role, icon: string, text: string) {
  for (const u of db.users) if (u.role === role) notify(db, u.id, icon, text);
}

export function logActivity(db: Store, icon: string, text: string) {
  db.activity.push({ id: newId(), icon, text, createdAt: Date.now() });
}

// ---------- Insertion avec les valeurs par défaut des colonnes ----------

export function insertUser(db: Store, v: Pick<UserRow, "id" | "role" | "email" | "passwordHash" | "name"> & Partial<UserRow>) {
  const row: UserRow = { contact: null, country: "Algérie", status: "Actif", level: "Nouveau", credit: 0, payoutMethod: null, payoutAccount: null, handles: {}, bio: "", createdAt: Date.now(), ...v };
  db.users.push(row);
  return row;
}

type CampaignInsert = Omit<CampaignRow, "spent" | "commissionRate" | "reserved" | "top" | "emoji" | "createdAt"> & Partial<CampaignRow>;
export function insertCampaign(db: Store, v: CampaignInsert) {
  const row: CampaignRow = { spent: 0, commissionRate: 0, reserved: 0, top: false, emoji: "🎬", createdAt: Date.now(), ...v };
  db.campaigns.push(row);
  return row;
}

export function insertPublication(db: Store, v: Pick<PubRow, "id" | "userId" | "campaignId" | "title" | "platform" | "url"> & Partial<PubRow>) {
  const row: PubRow = { views: 0, status: "En attente", reason: null, paid: 0, approvedAt: null, createdAt: Date.now(), ...v };
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
