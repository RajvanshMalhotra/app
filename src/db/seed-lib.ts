import { and, eq } from "drizzle-orm";
import type { db as Db } from "./client";
import { cards, topics } from "./schema";
import { SEED } from "./seed-data";

/** Adds the starter topics and cards that aren't there yet. Returns how many cards were added. */
export async function seedStarterContent(db: typeof Db, log: (msg: string) => void = () => {}): Promise<number> {
  let added = 0;
  for (const t of SEED) {
    const [exists] = await db.select().from(topics).where(and(eq(topics.name, t.topic), eq(topics.track, t.track)));
    if (exists) continue;
    const [topic] = await db.insert(topics).values({ name: t.topic, track: t.track }).returning();
    await db.insert(cards).values(t.cards.map((c) => ({
      type: c.type, prompt: c.prompt, answer: c.answer, difficulty: c.difficulty,
      choices: c.type === "mcq" ? [...c.choices] : null,
      topicId: topic.id, source: "user" as const,
    })));
    added += t.cards.length;
    log(`seeded ${t.topic}: ${t.cards.length} cards`);
  }
  return added;
}
