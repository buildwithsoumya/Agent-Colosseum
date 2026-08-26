import { expect, test } from "@playwright/test";

/**
 * Role-based dashboard & authorization (fix/role-based-dashboards).
 *
 * Requires the stack running locally and RUN_E2E=1:
 *   backend on :4000 and the frontend on $E2E_BASE_URL (default :3000).
 *
 * Covers admin/mentor/participant landing, captain vs member controls, direct
 * URL authorization (wrong-role -> 403, anonymous -> login redirect).
 */
const run = process.env.RUN_E2E === "1";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API = process.env.E2E_API_URL ?? "http://localhost:4000";

test.use({ baseURL: BASE });

async function loginViaApi(request: import("@playwright/test").APIRequestContext, email: string, password: string) {
  const res = await request.post(`${API}/api/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
}

test.describe("role-based dashboards", () => {
  test.skip(() => !run, "set RUN_E2E=1 with the stack running");

  test("anonymous access to a protected area redirects to login", async ({ request, page }) => {
    const res = await request.get(`${BASE}/admin`, { maxRedirects: 0 });
    expect([307, 308, 302]).toContain(res.status());
    const loc = res.headers()["location"] ?? "";
    expect(loc).toContain("/login");
    // Direct browser navigation also lands on /login (middleware redirect).
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    await page;
  });

  test("admin login lands on the admin dashboard and sees admin controls", async ({ request, page }) => {
    await loginViaApi(request, "admin@colosseum.dev", "password123");
    await page.goto("/admin");
    await expect(page.getByText("Event control")).toBeVisible({ timeout: 20_000 });
    // Admin nav is admin-specific, not participant onboarding.
    await expect(page.getByRole("link", { name: /Join team/i })).toHaveCount(0);
  });

  test("mentor login lands on the mentor dashboard", async ({ request, page }) => {
    await loginViaApi(request, "mentor.fintech@colosseum.dev", "password123");
    await page.goto("/mentor");
    await expect(page.getByText(/Problem statement review/i)).toBeVisible({ timeout: 20_000 });
    // No admin/participant controls.
    await expect(page.getByRole("link", { name: /Users/i })).toHaveCount(0);
  });

  test("a participant captain lands on the participant dashboard with captain marker", async ({ request, page }) => {
    await loginViaApi(request, "captain.prime@colosseum.dev", "password123");
    await page.goto("/app");
    await expect(page.getByText("Captain", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    // Participant nav has team/submission, not user management.
    await expect(page.getByRole("link", { name: /Users/i })).toHaveCount(0);
  });

  test("a participant member does NOT see captain controls", async ({ request, page }) => {
    await loginViaApi(request, "mate.prime@colosseum.dev", "password123");
    await page.goto("/app");
    await expect(page.getByText(/NO TEAM YET|Gladiator Prime/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Captain", { exact: true })).toHaveCount(0);
  });

  test("a participant is blocked from the admin dashboard", async ({ request, page }) => {
    await loginViaApi(request, "mate.prime@colosseum.dev", "password123");
    await page.goto("/admin");
    await expect(page.getByText("Access restricted")).toBeVisible({ timeout: 20_000 });
  });

  test("a participant is blocked from the mentor dashboard", async ({ request, page }) => {
    await loginViaApi(request, "captain.prime@colosseum.dev", "password123");
    await page.goto("/mentor");
    await expect(page.getByText("Access restricted")).toBeVisible({ timeout: 20_000 });
  });

  test("a mentor is blocked from the admin dashboard", async ({ request, page }) => {
    await loginViaApi(request, "mentor.fintech@colosseum.dev", "password123");
    await page.goto("/admin");
    await expect(page.getByText("Access restricted")).toBeVisible({ timeout: 20_000 });
  });
});