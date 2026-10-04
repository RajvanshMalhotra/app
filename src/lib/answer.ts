import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, reviews } from "@/db/schema";
import { grade, type GradeResult, type Response } from "./grading";
import { scheduleReview, type Rating } from "./scheduler";

type Args = {
  userId: string; cardId: string; clientAnswerId: string; response: Response;
  responseMs: number; now: Date; deps?: Parameters<typeof grade>[2];
};

/**
 * Grades an answer and, when graded, stores the review with its next due date.
 * Idempotent per (userId, clientAnswerId): a retried or double-tapped submit
 * returns the first result and never writes a second review.
 */
export async function recordAnswer(a: Args): Promise<GradeResult & { dueAt?: Date }> {
  const replay = await findReplay(a.userId, a.clientAnswerId);
  if (replay) return replay;

  const [card] = await db.select().from(cards).where(and(
    eq(cards.id, a.cardId),
    or(isNull(cards.ownerUserId), eq(cards.ownerUserId, a.userId)),
  ));
  if (!card) throw new Error("card not found");

  const g = await grade(card, a.response, a.deps);
  if (g.status !== "graded") return g;

  const [prev] = await db.select().from(reviews)
    .where(and(eq(reviews.userId, a.userId), eq(reviews.cardId, a.cardId)))
    .orderBy(desc(reviews.createdAt)).limit(1);
  const s = scheduleReview(prev ? { ...prev, lastReview: prev.createdAt } : null, g.rating, a.now);

  const inserted = await db.insert(reviews).values({
    userId: a.userId, cardId: a.cardId, clientAnswerId: a.clientAnswerId, rating: g.rating,
    correct: g.correct, responseMs: a.responseMs, stability: s.stability, fsrsDifficulty: s.fsrsDifficulty,
    reps: s.reps, lapses: s.lapses, state: s.state, learningSteps: s.learningSteps, dueAt: s.dueAt, createdAt: a.now,
  }).onConflictDoNothing().returning();
  if (inserted.length === 0) return (await findReplay(a.userId, a.clientAnswerId)) ?? g;
  return { ...g, dueAt: inserted[0].dueAt };
}

async function findReplay(userId: string, clientAnswerId: string) {
  const [r] = await db.select().from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.clientAnswerId, clientAnswerId)));
  return r ? { status: "graded" as const, correct: r.correct, rating: r.rating as Rating, dueAt: r.dueAt } : null;
}
