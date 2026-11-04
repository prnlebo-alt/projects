import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, closeDb } from "./client.js";
import { logger } from "@mi/schemas";

async function main(): Promise<void> {
  const db = getDb();
  logger.info("running migrations", { migrationsFolder: "./migrations" });
  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
  logger.info("migrations complete");
  await closeDb();
}

main().catch((err) => {
  logger.error("migration failed", { error: String(err) });
  process.exitCode = 1;
});
