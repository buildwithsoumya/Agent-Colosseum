import { defineConfig, devices } from "@playwright/test";

/**
 * E2E happy path. Requires the stack running locally:
 *   docker compose up -d postgres redis
 *   npm run db:migrate && npm run db:seed
 *   npm run dev (backend) + npm run dev:frontend + npm run dev:evaluator
 * Run: npx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
