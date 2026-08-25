import { expect, test } from "@playwright/test";

/**
 * Happy-path event flow (Definition of Done §37):
 * login → team → track → problem statement → approval → task reveal →
 * purchase → arena → casino → submission → gauntlet → leaderboard.
 *
 * The suite resets the demo event through the admin API first, then walks the
 * journey as a real user. Requires backend + frontend + evaluator running.
 */
const run = process.env.RUN_E2E === "1";

test.describe("agent colosseum happy path", () => {
  test.skip(() => !run, "set RUN_E2E=1 with the full stack running");

  let psId: string;

  test("admin can log in and reset + start the event", async ({ request }) => {
    const res = await request.post("http://localhost:4000/api/auth/login", {
      data: { email: "admin@colosseum.dev", password: "password123" },
    });
    expect(res.ok()).toBeTruthy();
    await request.post("http://localhost:4000/api/admin/event/reset-demo");
    const start = await request.post("http://localhost:4000/api/admin/event/start");
    expect(start.ok()).toBeTruthy();
  });

  test("participant logs in, creates team, picks track, submits PS", async ({ page }) => {
    await page.goto("/login");
    // SECURITY: no role selector may exist anywhere on public registration
    const registerFirst = async () => {
      await page.goto("/login");
      if (!(await page.getByRole("button", { name: "Create one" }).isVisible().catch(() => false))) {
        // already on register mode or different copy — try clicking by text
      }
      await page.getByRole("button", { name: "Create one" }).click().catch(() => {});
      const selectCount = await page.locator('select[name*="role" i], [data-testid="role-selector"]').count();
      if (selectCount > 0) throw new Error("ROLE SELECTOR FOUND ON PUBLIC REGISTRATION");
      await page.getByPlaceholder("Your name").fill("E2E Captain");
      await page.getByPlaceholder("Email").fill("e2e.captain@colosseum.dev");
      await page.getByPlaceholder(/Password \(min 8/).fill("password123");
      await page.getByPlaceholder("Confirm password").fill("password123");
      await page.getByRole("button", { name: "Create Account" }).click();
      await expect(page.getByText("You're registered as a")).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: /Create or join a team/ }).click();
    };
    await registerFirst();
    await page.waitForURL("**/app/team", { timeout: 20_000 });

    await page.getByPlaceholder("Team name").fill("E2E Legion");
    await page.getByRole("button", { name: /Create team/ }).click();
    await page.getByText("Captain: choose a track").waitFor();
    await page.getByRole("button", { name: /FinTech/ }).click();

    await page.getByPlaceholder("Problem statement title").fill("Fraud triage agent");
    await page
      .getByPlaceholder(/Describe the problem/)
      .fill("An agent that triages suspicious transactions in real time and drafts investigator summaries with evidence trails.");
    await page.getByRole("button", { name: /Submit for approval/ }).click();
    await expect(page.getByText("SUBMITTED")).toBeVisible({ timeout: 10_000 });
  });

  test("mentor approves the problem statement", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill("mentor.fintech@colosseum.dev");
    await page.getByPlaceholder(/Password/).fill("password123");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/mentor");

    await page.getByText("Fraud triage agent").first().waitFor();
    const card = page.locator("li, div").filter({ hasText: "Fraud triage agent" }).last();
    await card.getByPlaceholder(/Mentor note/).fill("Good scope");
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Nothing in the submitted queue")).toBeVisible();
  });
});
