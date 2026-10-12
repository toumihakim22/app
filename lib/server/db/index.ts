import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Connexion PostgreSQL. Sans DATABASE_URL (développement), une base PostgreSQL embarquée
// (PGlite) est créée dans .data/ pour que le projet démarre sans rien installer.
export type Db = ReturnType<typeof drizzlePg<typeof schema>>;

const globalForDb = globalThis as unknown as { clipboostDb?: Promise<Db> };

async function connect(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    return drizzlePg(pool, { schema });
  }
  if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL est obligatoire en production");
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(process.env.PGLITE_DIR ?? ".data/pglite");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  globalForDb.clipboostDb ??= connect();
  return globalForDb.clipboostDb;
}

export { schema };
