import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("dev email").fill(email);
  await page.getByRole("button", { name: "Dev login" }).click();
  await page.waitForURL("**/today");
}

const fresh = (tag: string, project: string) => `${tag}-${project}-${Date.now()}@local.test`;

test("signed-out users are redirected to sign in", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/signin/);
});

/** Answers whatever card is showing and waits for the next one (or the done screen). */
async function answerCurrent(page: Page) {
  const prompt = page.getByTestId("prompt");
  const before = await prompt.textContent();
  const control = page.getByTestId("flip").or(page.getByTestId("choice-0")).or(page.getByTestId("math-input"));
  await control.first().waitFor();
  if (await page.getByTestId("flip").isVisible()) {
    await page.getByTestId("flip").click();
    await page.getByTestId("rate-3").click();
  } else if (await page.getByTestId("choice-0").isVisible()) {
    await page.getByTestId("choice-0").click();
    await page.getByRole("button", { name: /Next card/ }).click();
  } else {
    await page.getByTestId("math-input").fill("0");
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("result")).toBeVisible();
    await page.getByRole("button", { name: /Next card/ }).click();
  }
  await expect(prompt.or(page.getByTestId("done")).first()).not.toHaveText(before!);
}

test("complete the first card and advance", async ({ page }, info) => {
  await login(page, fresh("e2e", info.project.name));
  await expect(page.getByTestId("prompt")).toBeVisible();
  await expect(page.getByTestId("progress")).toHaveAttribute("aria-valuenow", "0");
  await answerCurrent(page);
  await expect(page.getByTestId("progress")).toHaveAttribute("aria-valuenow", "1");
});

// Equivalent (not identical) forms of seed answers, keyed by a fragment of the prompt's TeX.
const EQUIVALENT: [string, string][] = [
  ["x^3 + 2x", "2 + 3x^2"], ["2x\\,dx", "1.0"], ["e^{2x}", "2e^(2x)"], ["\\ln(x^2)", "2*x^(-1)"],
  ["\\text{sum} = 7", "2/12"], ["at least one head", "0.75"], ["Bernoulli}(0.3)", "21/100"],
  ["E[X^2] = 7", "7 - 2^2"], ["(1, 2, 3)", "4 + 10 + 18"], ["(3, 4)", "sqrt(25)"],
  ["2 & 1", "6 - 4"], ["eigenvalues $1, 2, 3$", "1*2*3"], ["F1 score", "4/6"], ["-\\ln p", "ln(1)"],
];

test("a math answer in equivalent form is marked correct", async ({ page }, info) => {
  await login(page, fresh("math", info.project.name));
  const prompt = page.getByTestId("prompt");
  await expect(prompt).toBeVisible();
  // KaTeX keeps each formula's TeX source in a MathML annotation, so textContent includes it.
  const match = async () => {
    const text = (await prompt.textContent()) ?? "";
    return EQUIVALENT.find(([key]) => text.includes(key))?.[1];
  };
  let answer = await match();
  for (let i = 0; i < 20 && !answer; i++) { await answerCurrent(page); answer = await match(); }
  expect(answer, "no math card with a known equivalent answer in the session").toBeTruthy();
  await page.getByTestId("math-input").fill(answer!);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("result")).toContainText("Correct");
});

test("pressing Enter on a graded answer moves on exactly one card", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard shortcut is a laptop feature");
  await login(page, fresh("enter", info.project.name));
  const choice = page.getByTestId("choice-0");
  for (let i = 0; i < 20 && !(await choice.isVisible()); i++) await answerCurrent(page);
  await choice.click();
  await expect(page.getByTestId("result")).toBeVisible();
  const before = Number(await page.getByTestId("progress").getAttribute("aria-valuenow"));
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("progress")).toHaveAttribute("aria-valuenow", String(before + 1));
  await page.waitForTimeout(800); // let the exit animation finish; a second advance would land here
  await expect(page.getByTestId("progress")).toHaveAttribute("aria-valuenow", String(before + 1));
});

test("number keys rate a flashcard after clicking Show answer", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard shortcut is a laptop feature");
  await login(page, fresh("keys", info.project.name));
  const flip = page.getByTestId("flip");
  for (let i = 0; i < 20 && !(await flip.isVisible()); i++) await answerCurrent(page);
  const before = Number(await page.getByTestId("progress").getAttribute("aria-valuenow"));
  await flip.click();
  await expect(page.getByTestId("rate-3")).toBeVisible();
  await page.keyboard.press("3");
  await expect(page.getByTestId("progress")).toHaveAttribute("aria-valuenow", String(before + 1));
});

test("signing out returns to sign in and clears offline copies", async ({ page }, info) => {
  await login(page, fresh("signout", info.project.name));
  await expect(page.getByTestId("prompt")).toBeVisible();
  // Stand in for what the service worker caches in production.
  await page.evaluate(async () => {
    const c = await caches.open("pages-v1");
    await c.put("/api/session", new Response("{}"));
  });
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await page.waitForURL("**/signin**");
  expect(await page.evaluate(() => caches.keys())).not.toContain("pages-v1");
  await page.goto("/today");
  await expect(page).toHaveURL(/signin/);
});

test("navigation adapts to screen size", async ({ page }, info) => {
  await login(page, fresh("nav", info.project.name));
  const tabs = page.getByRole("navigation", { name: "Primary" });
  if (info.project.name === "desktop") await expect(tabs).toBeHidden();
  else await expect(tabs).toBeVisible();
});

test("no horizontal scroll", async ({ page }, info) => {
  await login(page, fresh("scroll", info.project.name));
  await expect(page.getByTestId("prompt")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
