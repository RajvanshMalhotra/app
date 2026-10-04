import { beforeEach, expect, test } from "vitest";
import { db } from "@/db/client";
import { cards, topics } from "@/db/schema";
import { seedStarterContent } from "@/db/seed-lib";
import { SEED } from "@/db/seed-data";
import { resetDb } from "./helpers";

beforeEach(resetDb);

test("seeds every starter card once, and is a no-op the second time", async () => {
  const total = SEED.reduce((n, t) => n + t.cards.length, 0);
  expect(await seedStarterContent(db)).toBe(total);
  expect(await seedStarterContent(db)).toBe(0);
  expect(await db.select().from(cards)).toHaveLength(total);
  expect(await db.select().from(topics)).toHaveLength(SEED.length);
});
