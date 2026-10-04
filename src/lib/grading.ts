import type { Card } from "@/db/schema";
import type { Rating } from "./scheduler";
import { checkMath as realCheckMath } from "./math-client";

export type Response =
  | { kind: "rating"; rating: Rating } | { kind: "choice"; choice: string } | { kind: "text"; text: string };
export type GradeResult =
  | { status: "graded"; correct: boolean; rating: Rating; feedback?: string }
  | { status: "self_rate"; reason: string };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const SELF = "Couldn't check this automatically — how did you do?";

export async function grade(card: Card, res: Response, deps = { checkMath: realCheckMath }): Promise<GradeResult> {
  if (res.kind === "rating") return { status: "graded", correct: res.rating >= 3, rating: res.rating };
  if (card.type === "mcq" && res.kind === "choice") {
    const ok = norm(res.choice) === norm(card.answer);
    return { status: "graded", correct: ok, rating: ok ? 3 : 1 };
  }
  if (card.type === "math" && res.kind === "text") {
    try {
      const r = await deps.checkMath(card.answer, res.text);
      if (r.reason === "parse_error") return { status: "graded", correct: false, rating: 1, feedback: "We couldn't read that expression." };
      return { status: "graded", correct: r.correct, rating: r.correct ? 3 : 1 };
    } catch {
      return { status: "self_rate", reason: SELF };
    }
  }
  return { status: "self_rate", reason: SELF };
}
