import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { schema } from "./db";
import { newId } from "./ids";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0] | Db;

export async function notify(db: Tx, userId: string | null | undefined, icon: string, text: string) {
  if (!userId) return;
  await db.insert(schema.notifications).values({ id: newId(), userId, icon, text });
}

export async function notifyRole(db: Tx, role: "clipper" | "agence" | "admin", icon: string, text: string) {
  const ids = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, role));
  if (ids.length) await db.insert(schema.notifications).values(ids.map(({ id }) => ({ id: newId(), userId: id, icon, text })));
}

export async function logActivity(db: Tx, icon: string, text: string) {
  await db.insert(schema.activity).values({ id: newId(), icon, text });
}

export type { Tx };
