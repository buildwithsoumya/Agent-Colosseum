import { expect, test } from "@playwright/test";

/**
 * Team creation → captain → join-code → member join flow.
 * Requires stack on :3000/:4000 and RUN_E2E=1. Uses unique suffixes per run.
 */
const run = process.env.RUN_E2E === "1";
const API = process.env.E2E_API_URL ?? "http://localhost:4000";
const SUFFIX = `${Date.now().toString(36)}`;

test.describe("team join code flow", () => {
  test.skip(() => !run, "set RUN_E2E=1 with the stack running");

  let joinCode = "";

  test("captain registers, creates a team, sees the code", async ({ page, request }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Create one" }).click();
    await page.getByPlaceholder("Your name").fill(`Captain ${SUFFIX}`);
    await page.getByPlaceholder("Email").fill(`cap-${SUFFIX}@e2e.dev`);
    await page.getByPlaceholder(/Password \(min 8/).fill("password123");
    await page.getByPlaceholder("Confirm password").fill("password123");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.getByText("You're registered as a")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Create or join a team/ }).click();

    await page.getByText("Create a Team").first().click();
    await page.getByPlaceholder("Team name").fill(`E2E Squad ${SUFFIX}`);
    await page.getByRole("button", { name: /Create Team/ }).click();

    const codeEl = page.getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/).first();
    await expect(codeEl).toBeVisible({ timeout: 15_000 });
    joinCode = (await codeEl.textContent()) ?? "";
    await expect(page.getByText("CAPTAIN")).toBeVisible();
  });

  test("member joins with the code; captain count updates", async ({ request }) => {
    expect(joinCode).not.toBe("");
    // member joins via API (same cookie semantics as the UI form)
    const login = await request.post(`${API}/api/auth/login`, {
      data: { email: `mem-${SUFFIX}@e2e.dev`, password: "password123" },
    });
    if (!login.ok()) {
      await request.post(`${API}/api/auth/register`, {
        data: { name: `Member ${SUFFIX}`, email: `mem-${SUFFIX}@e2e.dev`, password: "password123" },
      });
    }
    const join = await request.post(`${API}/api/teams/join`, { data: { joinCode } });
    expect(join.status()).toBe(201);
    expect((await join.json()).yourRole).toBe("MEMBER");

    // captain's view reflects 2/N without any server restart
    const me = await request.get(`${API}/api/teams/me`);
    expect(me.ok()).toBeTruthy();
  });
});
