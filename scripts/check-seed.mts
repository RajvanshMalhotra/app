// Verifies seed content: every math answer is accepted by the math checker,
// and every multiple-choice answer is one of its choices.
import { SEED } from "../src/db/seed-data.ts";

let bad = 0;
for (const t of SEED) for (const c of t.cards) {
  if (c.type === "mcq" && !c.choices.includes(c.answer)) { bad++; console.log("MCQ answer not in choices:", c.prompt); }
  if (c.type !== "math") continue;
  const r = await fetch(`${process.env.MATH_URL ?? "http://localhost:8001"}/check`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expected: c.answer, given: c.answer }),
  }).then((x) => x.json());
  if (!r.correct) { bad++; console.log("math answer rejected:", c.answer, r); }
}
console.log(bad ? `${bad} problem(s)` : "all seed answers OK");
process.exit(bad ? 1 : 0);
