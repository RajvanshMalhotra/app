import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { cards, topics } from "./schema";
import { SEED } from "./seed-data";

async function main() {
  for (const t of SEED) {
    const [exists] = await db.select().from(topics).where(and(eq(topics.name, t.topic), eq(topics.track, t.track)));
    if (exists) continue;
    const [topic] = await db.insert(topics).values({ name: t.topic, track: t.track }).returning();
    await db.insert(cards).values(t.cards.map((c) => ({
      type: c.type, prompt: c.prompt, answer: c.answer, difficulty: c.difficulty,
      choices: c.type === "mcq" ? [...c.choices] : null,
      topicId: topic.id, source: "user" as const,
    })));
    console.log(`seeded ${t.topic}: ${t.cards.length} cards`);
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
