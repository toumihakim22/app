// Connexion pour les scripts (migrations, données initiales) : PostgreSQL si DATABASE_URL, sinon PGlite.
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../lib/server/db/schema";

export async function openDb() {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzlePg(pool, { schema });
    return { db, migrate: () => migratePg(db, { migrationsFolder: "drizzle" }), close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(process.env.PGLITE_DIR ?? ".data/pglite");
  const db = drizzle(client, { schema });
  return { db: db as unknown as ReturnType<typeof drizzlePg<typeof schema>>, migrate: () => migrate(db, { migrationsFolder: "drizzle" }), close: () => client.close() };
}
