import { expect, test } from "vitest";
import { startOfDay } from "@/lib/day";

test("start of the local day in a timezone ahead of UTC", () => {
  // 20:00 UTC on Oct 4 is 01:30 on Oct 5 in India, so the day began at 18:30 UTC.
  expect(startOfDay(new Date("2026-10-04T20:00:00Z"), "Asia/Kolkata").toISOString()).toBe("2026-10-04T18:30:00.000Z");
});

test("start of the local day in a timezone behind UTC", () => {
  // 03:00 UTC on Oct 4 is 20:00 on Oct 3 in Los Angeles (PDT, UTC-7).
  expect(startOfDay(new Date("2026-10-04T03:00:00Z"), "America/Los_Angeles").toISOString()).toBe("2026-10-03T07:00:00.000Z");
});

test("unknown timezone falls back to UTC", () => {
  expect(startOfDay(new Date("2026-10-04T20:00:00Z"), "Not/AZone").toISOString()).toBe("2026-10-04T00:00:00.000Z");
});
