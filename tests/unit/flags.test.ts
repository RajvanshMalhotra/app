import { expect, test } from "vitest";
import { devLoginAllowed } from "@/lib/flags";

test("dev login needs an explicit opt-in outside production", () => {
  expect(devLoginAllowed({ NODE_ENV: "development" })).toBe(false);
  expect(devLoginAllowed({ NODE_ENV: "development", ENABLE_DEV_LOGIN: "1" })).toBe(true);
  expect(devLoginAllowed({ NODE_ENV: "test", ENABLE_DEV_LOGIN: "1" })).toBe(true);
});

test("dev login is never allowed in production", () => {
  expect(devLoginAllowed({ NODE_ENV: "production", ENABLE_DEV_LOGIN: "1" })).toBe(false);
});
