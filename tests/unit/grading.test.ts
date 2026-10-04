import { expect, test, vi } from "vitest";
import { grade } from "@/lib/grading";
import type { Card } from "@/db/schema";

const base = { id: "c", topicId: "t", ownerUserId: null, choices: null, difficulty: 1, source: "user",
  citation: null, qualityStatus: "ok", flagCount: 0 } as const;
const card = (o: Partial<Card>) => ({ ...base, type: "flashcard", prompt: "p", answer: "a", ...o }) as Card;

test("flashcard uses the self rating", async () => {
  expect(await grade(card({}), { kind: "rating", rating: 4 })).toEqual({ status: "graded", correct: true, rating: 4 });
  expect(await grade(card({}), { kind: "rating", rating: 1 })).toMatchObject({ correct: false, rating: 1 });
});

test("mcq compares choice, case- and space-insensitive", async () => {
  const c = card({ type: "mcq", answer: "Adam", choices: ["SGD", "Adam"] });
  expect(await grade(c, { kind: "choice", choice: " adam " })).toMatchObject({ correct: true, rating: 3 });
  expect(await grade(c, { kind: "choice", choice: "SGD" })).toMatchObject({ correct: false, rating: 1 });
});

test("math delegates to the sidecar", async () => {
  const checkMath = vi.fn().mockResolvedValue({ correct: true, reason: "equivalent" });
  const r = await grade(card({ type: "math", answer: "2*x" }), { kind: "text", text: "2x" }, { checkMath });
  expect(checkMath).toHaveBeenCalledWith("2*x", "2x");
  expect(r).toMatchObject({ status: "graded", correct: true });
});

test("math falls back to self rating when the sidecar is down", async () => {
  const checkMath = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
  const r = await grade(card({ type: "math" }), { kind: "text", text: "2x" }, { checkMath });
  expect(r).toEqual({ status: "self_rate", reason: "Couldn't check this automatically — how did you do?" });
});

test("math parse error is incorrect with feedback", async () => {
  const checkMath = vi.fn().mockResolvedValue({ correct: false, reason: "parse_error" });
  const r = await grade(card({ type: "math" }), { kind: "text", text: "2x+" }, { checkMath });
  expect(r).toMatchObject({ status: "graded", correct: false, feedback: "We couldn't read that expression." });
});

test("math checker timeout falls back to self rating", async () => {
  const checkMath = vi.fn().mockResolvedValue({ correct: false, reason: "timeout" });
  const r = await grade(card({ type: "math" }), { kind: "text", text: "(x+1)^100" }, { checkMath });
  expect(r.status).toBe("self_rate");
});
