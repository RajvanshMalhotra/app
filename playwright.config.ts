import { defineConfig, devices } from "@playwright/test";

const engine = process.env.PW_WEBKIT
  ? { browserName: "webkit" as const }
  : { browserName: "chromium" as const, channel: "chrome" };

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  webServer: { command: "npm run dev", url: "http://localhost:3000/signin", reuseExistingServer: true, timeout: 120_000 },
  use: { baseURL: "http://localhost:3000" },
  // Device viewports, touch and user agents, run in the installed Google Chrome.
  // Set PW_WEBKIT=1 (after `npx playwright install webkit`) to run phone/tablet in real WebKit.
  projects: [
    { name: "iphone", use: { ...devices["iPhone 14"], ...engine } },
    { name: "ipad", use: { ...devices["iPad Pro 11"], ...engine } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1280, height: 800 } } },
  ],
});
