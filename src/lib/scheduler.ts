import { createEmptyCard, fsrs, type Card as FsrsCard, type Grade } from "ts-fsrs";

export type Rating = 1 | 2 | 3 | 4;
export type SchedState = {
  stability: number; fsrsDifficulty: number; reps: number; lapses: number;
  state: number; learningSteps: number; dueAt: Date; lastReview: Date | null;
};

const f = fsrs({ enable_fuzz: false });

export function scheduleReview(prev: SchedState | null, rating: Rating, now: Date): SchedState {
  const card: FsrsCard = prev
    ? { ...createEmptyCard(prev.lastReview ?? now), due: prev.dueAt, stability: prev.stability,
        difficulty: prev.fsrsDifficulty, reps: prev.reps, lapses: prev.lapses, state: prev.state,
        learning_steps: prev.learningSteps, last_review: prev.lastReview ?? undefined }
    : createEmptyCard(now);
  const { card: c } = f.next(card, now, rating as Grade);
  return { stability: c.stability, fsrsDifficulty: c.difficulty, reps: c.reps, lapses: c.lapses,
           state: c.state, learningSteps: c.learning_steps, dueAt: c.due, lastReview: now };
}
