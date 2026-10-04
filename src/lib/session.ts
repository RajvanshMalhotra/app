import { and, count, eq, gte, isNull, lte, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, reviews, type Card } from "@/db/schema";

export type SessionItem = { card: Card; kind: "review" | "new" | "drill" };

const DRILLS = 4;
export const DAILY_SIZE = 20;

type Options = {
  /** Cards per day, counting answers already given today. */
  size?: number;
  /** When the user's local day began; answers since then count against `size`. */
  dayStart?: Date;
};

/**
 * Today's queue: due reviews first, then unseen cards, then a few recently-missed
 * cards as weak-spot drills. The latest review of each card holds its schedule.
 * Answers already given since `dayStart` use up part of the day's `size`.
 */
export async function buildDailySession(userId: string, now: Date, opts: Options = {}): Promise<SessionItem[]> {
  let size = opts.size ?? DAILY_SIZE;
  if (opts.dayStart) {
    const [{ n }] = await db.select({ n: count() }).from(reviews)
      .where(and(eq(reviews.userId, userId), gte(reviews.createdAt, opts.dayStart)));
    size -= n;
  }
  if (size <= 0) return [];

  const latest = db.$with("latest").as(
    db.selectDistinctOn([reviews.cardId], { cardId: reviews.cardId, dueAt: reviews.dueAt, correct: reviews.correct })
      .from(reviews).where(eq(reviews.userId, userId))
      .orderBy(reviews.cardId, sql`${reviews.createdAt} desc`),
  );

  const due = await db.with(latest).select({ card: cards }).from(latest)
    .innerJoin(cards, eq(cards.id, latest.cardId))
    .where(lte(latest.dueAt, now)).orderBy(latest.dueAt).limit(size);
  const items: SessionItem[] = due.map((r) => ({ card: r.card, kind: "review" }));
  if (items.length >= size) return items;

  const seenIds = (await db.selectDistinct({ id: reviews.cardId }).from(reviews)
    .where(eq(reviews.userId, userId))).map((r) => r.id);
  const visible = and(eq(cards.qualityStatus, "ok"), or(isNull(cards.ownerUserId), eq(cards.ownerUserId, userId)));
  const fresh = await db.select().from(cards)
    .where(seenIds.length ? and(visible, notInArray(cards.id, seenIds)) : visible)
    .orderBy(cards.difficulty, cards.id).limit(size - items.length);
  items.push(...fresh.map((card) => ({ card, kind: "new" as const })));

  const room = Math.min(DRILLS, size - items.length);
  if (room > 0) {
    const taken = new Set(items.map((i) => i.card.id));
    const weak = await db.with(latest).select({ card: cards }).from(latest)
      .innerJoin(cards, eq(cards.id, latest.cardId))
      .where(eq(latest.correct, false)).limit(room + taken.size);
    items.push(...weak.filter((w) => !taken.has(w.card.id)).slice(0, room)
      .map((w) => ({ card: w.card, kind: "drill" as const })));
  }
  return items;
}
