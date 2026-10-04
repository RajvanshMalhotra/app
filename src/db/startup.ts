import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./client";
import { seedStarterContent } from "./seed-lib";

/** Brings the database schema up to date, then adds any missing starter content. */
export async function migrateAndSeed() {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const added = await seedStarterContent(db, (m) => console.log(`[startup] ${m}`));
  console.log(`[startup] database ready (${added} starter cards added)`);
}
