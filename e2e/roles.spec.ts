import { expect, test } from "@playwright/test";

/**
 * Authentication & role flow (fix/auth-role-registration):
 *
 *  1. Public registration always creates a PARTICIPANT and never shows a role
 *     selector (Admin/Mentor/Captain are not selectable).
 *  2. A participant creates a team and becomes its CAPTAIN while staying a
 *     PARTICIPANT globally.
 *  3. An admin issues a MENTOR invitation via User Management; the invitee opens
 *     the one-time link, completes account setup, and lands on the mentor
 *     dashboard (with NO admin access).
 *
 * Requires the stack running locally and RUN_E2E=1 (same as event-flow.spec).
 */
const run = process.env.RUN_E2E === "1";

test.describe("authentication & roles", () => {
  test.skip(() => !run, "set RUN_E2E=1 with the full stack running");

  /* 1 + 2: participant registration → team → captain */
  test("normal registration creates a PARTICIPANT with no role selector, then team creation makes a captain", async ({ page }) => {
    const email = `e2e.participant.${Date.now()}@example.com`;
    await page.goto("/login");
    await page.getByRole("button", { name: "Register" }).click();

    // No privileged role is ever offered to a new user.
    await expect(page.getByText(/role/i).first()).not.toBeVisible();

    await page.getByPlaceholder("Your name").fill("E2E Rookie");
    const emailInputs = page.getByPlaceholder("Email");
    await emailInputs.first().fill(email);
    await page.getByPlaceholder(/Password/).first().fill("password123");
    await page.getByPlaceholder("Confirm password").fill("password123");
    await page.getByRole("button", { name: /Create account/ }).click();

    // Confirmation copy tells the user they are a Participant.
    await expect(page.getByText(/registered as a Participant/i)).toBeVisible();

    // Next step → team creation.
    await page.getByRole("button", { name: /Create or join a team/ }).click();
    await page.waitForURL("**/app/team");

    await page.getByPlaceholder("Team name").fill("E2E Rookies");
    await page.getByRole("button", { name: /Create team/ }).click();

    // Creator is the captain; global role remains participant (no admin link).
    await expect(page.getByText("Captain: choose a track")).toBeVisible();
    await expect(page.getByRole("link", { name: /admin/i })).toHaveCount(0);
  });

  /* 3: admin → invite mentor → mentor completes setup → mentor dashboard */
  test("an admin can invite a mentor who then completes registration", async ({ browser, request }) => {
    // Admin issues a MENTOR invitation through the admin API.
    const login = await request.post("http://localhost:4000/api/auth/login", {
      data: { email: "admin@colosseum.dev", password: "password123" },
    });
    expect(login.ok()).toBeTruthy();

    const inviteeEmail = `e2e.mentor.${Date.now()}@example.com`;
    const inv = await request.post("http://localhost:4000/api/admin/invitations", {
      data: { email: inviteeEmail, role: "MENTOR" },
    });
    expect(inv.ok()).toBeTruthy();
    const { link } = (await inv.json()).invitation;

    // Open the invitation in a fresh, logged-out context.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(link);
    await expect(page.getByText(/invited to join Agent Colosseum as a Mentor/i)).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toHaveValue(inviteeEmail);

    await page.getByPlaceholder("Your name").fill("E2E Mentor");
    await page.getByPlaceholder(/Password/).fill("password123");
    await page.getByPlaceholder("Confirm password").fill("password123");
    await page.getByRole("button", { name: /Create account/ }).click();

    // Lands on the mentor dashboard.
    await page.waitForURL("**/mentor");
    await expect(page.getByText(/Queue|Review/i).first()).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });
});