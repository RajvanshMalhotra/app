import { expect, test } from "vitest";
import { shuffled } from "@/lib/shuffle";

test("keeps the same choices", () => {
  const xs = ["a", "b", "c", "d"];
  expect([...shuffled(xs)].sort()).toEqual(xs);
  expect(xs).toEqual(["a", "b", "c", "d"]);
});

test("the first choice does not always stay first", () => {
  const firsts = new Set(Array.from({ length: 200 }, () => shuffled(["a", "b", "c", "d"])[0]));
  expect(firsts.size).toBe(4);
});
