import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { loadEnv } from "@mi/schemas";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

let pool: pg.Pool | undefined;
let db: Database | undefined;

/** Lazily creates (and reuses) the connection pool + Drizzle client. */
export function getDb(): Database {
  if (db) return db;
  const env = loadEnv();
  pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  db = drizzle(pool, { schema });
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    db = undefined;
  }
}

export { schema };
