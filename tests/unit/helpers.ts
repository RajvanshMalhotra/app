import { sql } from "drizzle-orm";
import { db } from "@/db/client";
export async function resetDb() {
  await db.execute(sql`TRUNCATE reviews, cards, topics, users RESTART IDENTITY CASCADE`);
}
