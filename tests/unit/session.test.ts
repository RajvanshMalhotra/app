import { beforeEach, expect, test } from "vitest";
import { db } from "@/db/client";
import { cards, reviews, topics, users } from "@/db/schema";
import { buildDailySession } from "@/lib/session";
import { resetDb } from "./helpers";

beforeEach(resetDb);
const now = new Date("2026-10-04T10:00:00Z");

async function setup(nCards: number) {
  const [u] = await db.insert(users).values({ email: "u@x.y" }).returning();
  const [t] = await db.insert(topics).values({ name: "Prob", track: "ml-engineer" }).returning();
  if (nCards === 0) return { u, cs: [] };
  const cs = await db.insert(cards).values(Array.from({ length: nCards }, (_, i) => ({
    topicId: t.id, type: "flashcard" as const, prompt: `q${i}`, answer: `a${i}`, source: "user" as const,
  }))).returning();
  return { u, cs };
}

function rev(userId: string, cardId: string, dueAt: Date, correct = true, createdAt = new Date("2026-10-01T00:00:00Z")) {
  return { userId, cardId, clientAnswerId: crypto.randomUUID(), rating: correct ? 3 : 1, correct,
    responseMs: 4000, stability: 1, fsrsDifficulty: 5, reps: 1, lapses: 0, state: 2, dueAt, createdAt };
}

test("empty when there are no cards", async () => {
  const [u] = await db.insert(users).values({ email: "e@x.y" }).returning();
  expect(await buildDailySession(u.id, now)).toEqual([]);
});

test("due reviews come first, not-yet-due cards are excluded", async () => {
  const { u, cs } = await setup(3);
  await db.insert(reviews).values([
    rev(u.id, cs[0].id, new Date("2026-10-03T00:00:00Z")),
    rev(u.id, cs[1].id, new Date("2026-10-10T00:00:00Z")),
  ]);
  const s = await buildDailySession(u.id, now);
  expect(s[0]).toMatchObject({ kind: "review", card: { id: cs[0].id } });
  expect(s.map((i) => i.card.id)).not.toContain(cs[1].id);
  expect(s.find((i) => i.card.id === cs[2].id)?.kind).toBe("new");
});

test("caps at size", async () => {
  const { u } = await setup(40);
  expect(await buildDailySession(u.id, now, { size: 20 })).toHaveLength(20);
});

test("uses only the latest review of each card", async () => {
  const { u, cs } = await setup(1);
  await db.insert(reviews).values([
    rev(u.id, cs[0].id, new Date("2026-10-02T00:00:00Z"), true, new Date("2026-10-01T00:00:00Z")),
    rev(u.id, cs[0].id, new Date("2026-10-20T00:00:00Z"), true, new Date("2026-10-02T00:00:00Z")),
  ]);
  expect(await buildDailySession(u.id, now)).toEqual([]);
});

test("another user's private cards are never shown", async () => {
  const { u } = await setup(0);
  const [other] = await db.insert(users).values({ email: "o@x.y" }).returning();
  const [t] = await db.insert(topics).values({ name: "Private", track: "ml-engineer" }).returning();
  await db.insert(cards).values({ topicId: t.id, ownerUserId: other.id, type: "flashcard", prompt: "secret", answer: "s", source: "user" });
  expect(await buildDailySession(u.id, now)).toEqual([]);
});

test("adds not-yet-due cards answered wrong as weak-spot drills", async () => {
  const { u, cs } = await setup(2);
  await db.insert(reviews).values([
    rev(u.id, cs[0].id, new Date("2026-10-05T00:00:00Z"), false),
    rev(u.id, cs[1].id, new Date("2026-10-30T00:00:00Z"), true),
  ]);
  const s = await buildDailySession(u.id, now);
  expect(s).toEqual([expect.objectContaining({ kind: "drill", card: expect.objectContaining({ id: cs[0].id }) })]);
});

test("answers given today count against the daily size", async () => {
  const { u, cs } = await setup(40);
  const dayStart = new Date("2026-10-04T00:00:00Z");
  const earlierToday = new Date("2026-10-04T08:00:00Z");
  // Five cards answered this morning; they're already due again (short learning steps).
  await db.insert(reviews).values(cs.slice(0, 5).map((c) => rev(u.id, c.id, earlierToday, true, earlierToday)));
  expect(await buildDailySession(u.id, now, { size: 20, dayStart })).toHaveLength(15);
});

test("the session is empty once today's quota is used", async () => {
  const { u, cs } = await setup(30);
  const dayStart = new Date("2026-10-04T00:00:00Z");
  const earlierToday = new Date("2026-10-04T08:00:00Z");
  await db.insert(reviews).values(cs.slice(0, 20).map((c) => rev(u.id, c.id, earlierToday, true, earlierToday)));
  expect(await buildDailySession(u.id, now, { size: 20, dayStart })).toEqual([]);
});

test("yesterday's answers don't count against today", async () => {
  const { u, cs } = await setup(30);
  const dayStart = new Date("2026-10-04T00:00:00Z");
  const yesterday = new Date("2026-10-03T08:00:00Z");
  await db.insert(reviews).values(cs.slice(0, 20).map((c) => rev(u.id, c.id, new Date("2026-10-30T00:00:00Z"), true, yesterday)));
  expect(await buildDailySession(u.id, now, { size: 20, dayStart })).toHaveLength(10);
});
