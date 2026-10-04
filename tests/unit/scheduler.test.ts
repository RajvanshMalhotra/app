import { expect, test } from "vitest";
import { scheduleReview } from "@/lib/scheduler";

const now = new Date("2026-10-04T10:00:00Z");

test("new card rated Good is due later than now", () => {
  const s = scheduleReview(null, 3, now);
  expect(s.dueAt.getTime()).toBeGreaterThan(now.getTime());
  expect(s.reps).toBe(1);
});

test("Again comes back sooner than Easy", () => {
  const again = scheduleReview(null, 1, now);
  const easy = scheduleReview(null, 4, now);
  expect(again.dueAt.getTime()).toBeLessThan(easy.dueAt.getTime());
});

test("lapse on a mature card increments lapses", () => {
  let s = scheduleReview(null, 3, now);
  s = scheduleReview(s, 3, s.dueAt);
  s = scheduleReview(s, 3, s.dueAt);
  const lapsed = scheduleReview(s, 1, s.dueAt);
  expect(lapsed.lapses).toBe(1);
});
