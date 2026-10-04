import { beforeEach, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, reviews, topics, users } from "@/db/schema";
import { recordAnswer } from "@/lib/answer";
import { resetDb } from "./helpers";

beforeEach(resetDb);
const now = new Date("2026-10-04T10:00:00Z");

async function setup(type: "flashcard" | "math" = "flashcard") {
  const [u] = await db.insert(users).values({ email: "u@x.y" }).returning();
  const [t] = await db.insert(topics).values({ name: "T", track: "ml-engineer" }).returning();
  const [c] = await db.insert(cards).values({ topicId: t.id, type, prompt: "q", answer: "a", source: "user" }).returning();
  return { u, c };
}

test("writes one review with FSRS state", async () => {
  const { u, c } = await setup();
  const r = await recordAnswer({ userId: u.id, cardId: c.id, clientAnswerId: "k1-abcdef",
    response: { kind: "rating", rating: 3 }, responseMs: 5000, now });
  expect(r).toMatchObject({ status: "graded", correct: true });
  const rows = await db.select().from(reviews).where(eq(reviews.userId, u.id));
  expect(rows).toHaveLength(1);
  expect(rows[0].dueAt.getTime()).toBeGreaterThan(now.getTime());
});

test("double submit with the same clientAnswerId writes once", async () => {
  const { u, c } = await setup();
  const args = { userId: u.id, cardId: c.id, clientAnswerId: "same-abcdef",
    response: { kind: "rating" as const, rating: 3 as const }, responseMs: 5000, now };
  await Promise.all([recordAnswer(args), recordAnswer(args)]);
  expect(await db.select().from(reviews)).toHaveLength(1);
});

test("a second review continues from the first one's schedule", async () => {
  const { u, c } = await setup();
  const first = await recordAnswer({ userId: u.id, cardId: c.id, clientAnswerId: "first-abcdef",
    response: { kind: "rating", rating: 3 }, responseMs: 5000, now });
  const later = first.dueAt!;
  await recordAnswer({ userId: u.id, cardId: c.id, clientAnswerId: "second-abcdef",
    response: { kind: "rating", rating: 3 }, responseMs: 5000, now: later });
  const rows = await db.select().from(reviews).where(eq(reviews.cardId, c.id)).orderBy(reviews.createdAt);
  expect(rows.map((r) => r.reps)).toEqual([1, 2]);
});

test("self_rate results write nothing", async () => {
  const { u, c } = await setup("math");
  const checkMath = vi.fn().mockRejectedValue(new Error("down"));
  const r = await recordAnswer({ userId: u.id, cardId: c.id, clientAnswerId: "sr-abcdef",
    response: { kind: "text", text: "2x" }, responseMs: 5000, now, deps: { checkMath } });
  expect(r.status).toBe("self_rate");
  expect(await db.select().from(reviews)).toHaveLength(0);
});

test("cannot answer another user's private card", async () => {
  const { u } = await setup();
  const [other] = await db.insert(users).values({ email: "o@x.y" }).returning();
  const [t] = await db.insert(topics).values({ name: "P", track: "ml-engineer" }).returning();
  const [priv] = await db.insert(cards).values({ topicId: t.id, ownerUserId: other.id, type: "flashcard", prompt: "s", answer: "s", source: "user" }).returning();
  await expect(recordAnswer({ userId: u.id, cardId: priv.id, clientAnswerId: "priv-abcdef",
    response: { kind: "rating", rating: 3 }, responseMs: 1, now })).rejects.toThrow("card not found");
});
