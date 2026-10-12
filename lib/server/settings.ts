import { getDb, schema } from "./db";

export const DEFAULT_SETTINGS = {
  maintenance: false,
  signupsOpen: true,
  announcement: "",
  /** Retrait minimum d'un clipper, en DA. */
  minWithdraw: 2000,
  /** Commission ClipBoost ajoutée au budget d'une campagne, en %. */
  commissionRate: 15,
  /** Budget minimum d'une campagne, en DA. */
  minBudget: 50000,
  /** Jours pendant lesquels un clip validé continue de rapporter. */
  earningDays: 7,
  /** Jours de rétention d'un gain avant qu'il soit retirable (contrôle anti-fraude). */
  holdDays: 3,
  /** Frais du retrait instantané : pourcentage et minimum en DA. */
  instantFeePercent: 2,
  instantMinFee: 100,
};

export type Settings = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select().from(schema.settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...stored } as Settings;
}

export async function saveSettings(patch: Partial<Settings>) {
  const db = await getDb();
  for (const [key, value] of Object.entries(patch)) {
    await db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  }
}
