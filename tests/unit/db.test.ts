import { beforeEach, expect, test } from "vitest";
import { db } from "@/db/client";
import { cards, topics, users } from "@/db/schema";
import { resetDb } from "./helpers";

beforeEach(resetDb);

test("inserts a topic and a card", async () => {
  const [t] = await db.insert(topics).values({ name: "Linear Algebra", track: "ml-engineer" }).returning();
  const [c] = await db.insert(cards).values({
    topicId: t.id, type: "math", prompt: "d/dx x^2", answer: "2*x", difficulty: 1, source: "user",
  }).returning();
  expect(c.id).toBeTypeOf("string");
  await db.insert(users).values({ email: "a@b.c" });
});
