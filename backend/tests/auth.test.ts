import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app.js";

/**
 * End-to-end authorization tests against a real database and a live in-process
 * HTTP server. The server is authoritative: no client payload can escalate a
 * role. Covers registration safety, role enforcement, team captains, mentor
 * invitations, and invitation lifecycle.
 *
 * Enabled with RUN_DB_TESTS=1 (CI sets it). Uses unique emails per run and
 * cleans up after itself; seeded demo data is left untouched.
 */
const run = process.env.RUN_DB_TESTS === "1";
const prisma = new PrismaClient();
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const REPO_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe.skipIf(!run)("auth & role registration", () => {
  const RUN_ID = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
  const email = (tag: string) => `test.${tag}.${RUN_ID}@example.com`;

  let server: http.Server;
  let base = "";
  const jar = new Map<string, string>();

  // Shared across tests so the "cannot be reused" / "mentor access" tests can
  // reuse the exact mentor token and email created by the invitation test.
  let mentorEmail = "";
  let mentorToken = "";
  let adminEmail = "";

  beforeAll(async () => {
    server = http.createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server?.close();
    // Only remove the run-scoped test users/invitations; never the seeded demo accounts.
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
    await prisma.invitation.deleteMany({ where: { email: { contains: RUN_ID } } });
    await prisma.$disconnect();
  });

  function clearAuth() {
    jar.clear();
  }
  function authHeaders(): Record<string, string> {
    const token = jar.get("ac_session");
    return token ? { cookie: `ac_session=${token}` } : {};
  }
  function capture(res: Response) {
    const sc = res.headers.get("set-cookie");
    if (sc) {
      for (const part of sc.split(",")) {
        const m = part.match(/^([^=]+)=([^;]*)/);
        if (m) jar.set(m[1]!, m[2]!);
      }
    }
  }
  async function req(
    method: string,
    url: string,
    options: { body?: unknown; auth?: boolean } = {},
  ): Promise<{ status: number; json: any }> {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.auth ? authHeaders() : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    capture(res);
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* empty body */
    }
    return { status: res.status, json };
  }

  const register = (tag: string, extra: Record<string, unknown> = {}) =>
    req("POST", "/api/auth/register", {
      body: { name: "Test User", email: email(tag), password: "password123", confirmPassword: "password123", ...extra },
      auth: true,
    });

  const login = async (address: string, pass = "password123") => {
    clearAuth();
    await req("POST", "/api/auth/login", { body: { email: address, password: pass }, auth: true });
  };

  /* ------------------------------------------------ registration safety */

  it("normal registration creates a PARTICIPANT with ACTIVE status", async () => {
    const r = await register("normal");
    expect(r.status).toBe(201);
    expect(r.json.user.role).toBe("PARTICIPANT");
    expect(r.json.user.status).toBe("ACTIVE");
  });

  it("public registration CANNOT create an ADMIN, MENTOR, or CAPTAIN", async () => {
    for (const [tag, extra] of [
      ["admin-attempt", { role: "ADMIN" }],
      ["mentor-attempt", { role: "MENTOR" }],
      ["captain-attempt", { role: "CAPTAIN", isCaptain: true }],
    ] as const) {
      const r = await register(tag, extra as Record<string, unknown>);
      expect(r.status).toBe(201);
      expect(r.json.user.role).toBe("PARTICIPANT");
    }
  });

  it("rejects a mismatched confirmPassword", async () => {
    const r = await req("POST", "/api/auth/register", {
      body: { name: "T", email: email("mismatch"), password: "password123", confirmPassword: "different" },
    });
    expect(r.status).toBe(400);
  });

  /* ------------------------------------------------ teams & captain */

  it("a participant can create a team and becomes its CAPTAIN (not admin)", async () => {
    await register("team-maker");
    const team = await req("POST", "/api/teams", { body: { name: `Team ${RUN_ID}` }, auth: true });
    expect(team.status).toBe(201);
    const member = team.json.team.members.find((m: any) => m.teamRole === "CAPTAIN");
    expect(member.user.email).toBe(email("team-maker"));

    const me = await req("GET", "/api/teams/me", { auth: true });
    expect(me.json.teamRole).toBe("CAPTAIN");

    // captain's global role stays PARTICIPANT and admin is blocked
    const session = await req("GET", "/api/auth/me", { auth: true });
    expect(session.json.user.role).toBe("PARTICIPANT");
    const admin = await req("GET", "/api/admin/overview", { auth: true });
    expect([401, 403]).toContain(admin.status);
  });

  /* ------------------------------------------------ participant scope */

  it("a participant cannot reach mentor-only or admin-only endpoints", async () => {
    await register("plain");
    const queue = await req("GET", "/api/problems/queue", { auth: true });
    expect([401, 403]).toContain(queue.status);
    const overview = await req("GET", "/api/admin/overview", { auth: true });
    expect([401, 403]).toContain(overview.status);
    const users = await req("GET", "/api/admin/users", { auth: true });
    expect([401, 403]).toContain(users.status);
  });

  it("a participant cannot modify their own global role", async () => {
    await register("role-lock");
    const me = await req("GET", "/api/auth/me", { auth: true });
    const attempt = await req("POST", `/api/admin/users/${me.json.user.id}/role`, { body: { role: "ADMIN" }, auth: true });
    expect([401, 403]).toContain(attempt.status);
    const after = await req("GET", "/api/auth/me", { auth: true });
    expect(after.json.user.role).toBe("PARTICIPANT");
  });

  /* ------------------------------------------------ privileged invitation flow */

  it("MENTOR is assigned only through the admin-issued invitation flow", async () => {
    // A non-admin cannot issue an invitation.
    await register("would-be-admin");
    const denied = await req("POST", "/api/admin/invitations", {
      body: { email: email("invitee"), role: "MENTOR" },
      auth: true,
    });
    expect([401, 403]).toContain(denied.status);

    // Provision a dedicated admin for this run (server assigns the role below).
    adminEmail = `admin.${RUN_ID}@colosseum.dev`;
    await req("POST", "/api/auth/register", {
      body: { name: "Admin", email: adminEmail, password: "password123", confirmPassword: "password123" },
    });
    await prisma.user.update({ where: { email: adminEmail.toLowerCase() }, data: { role: "ADMIN" } });
    await login(adminEmail);

    const inv = await req("POST", "/api/admin/invitations", {
      body: { email: email("invitee"), role: "MENTOR" },
      auth: true,
    });
    expect(inv.status).toBe(201);
    mentorToken = new URL(inv.json.invitation.link).searchParams.get("token") as string;

    // Invitee previews what the invitation grants.
    const peek = await req("GET", `/api/auth/invitation?token=${mentorToken}`);
    expect(peek.status).toBe(200);
    expect(peek.json.role).toBe("MENTOR");

    // Invitee completes setup → global role MENTOR (server-assigned).
    const setup = await req("POST", "/api/auth/register/invitation", {
      body: {
        name: "Invitee",
        email: email("invitee"),
        password: "password123",
        confirmPassword: "password123",
        invitationToken: mentorToken,
      },
    });
    expect(setup.status).toBe(201);
    expect(setup.json.user.role).toBe("MENTOR");
    mentorEmail = email("invitee").toLowerCase();

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: mentorEmail } });
    expect(dbUser.role).toBe("MENTOR");
  });

  it("an invitation is single-use (cannot be reused)", async () => {
    const reuse = await req("POST", "/api/auth/register/invitation", {
      body: {
        name: "Impostor",
        email: `impostor.${RUN_ID}@example.com`,
        password: "password123",
        confirmPassword: "password123",
        invitationToken: mentorToken,
      },
    });
    expect(reuse.status).toBe(400);

    const used = await prisma.invitation.findUniqueOrThrow({ where: { tokenHash: sha256(mentorToken) } });
    expect(used.usedAt).not.toBeNull();
  });

  it("an expired invitation is rejected", async () => {
    await login(adminEmail);
    const inv = await req("POST", "/api/admin/invitations", {
      body: { email: email("expired"), role: "MENTOR" },
      auth: true,
    });
    const token = new URL(inv.json.invitation.link).searchParams.get("token") as string;
    await prisma.invitation.update({
      where: { tokenHash: sha256(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const attempt = await req("POST", "/api/auth/register/invitation", {
      body: {
        name: "Late",
        email: email("expired"),
        password: "password123",
        confirmPassword: "password123",
        invitationToken: token,
      },
    });
    expect(attempt.status).toBe(400);
    expect(attempt.json.error.toLowerCase()).toContain("expired");
  });

  /* ------------------------------------------------ role scoping after invite */

  it("a mentor can reach mentor endpoints but NOT admin endpoints", async () => {
    await login(mentorEmail);
    const queue = await req("GET", "/api/problems/queue", { auth: true });
    expect([200, 401, 403]).toContain(queue.status);
    // If the mentor role is recognised the queue returns 200.
    expect(queue.status).toBe(200);
    const admin = await req("GET", "/api/admin/users", { auth: true });
    expect([401, 403]).toContain(admin.status);
  });

  it("existing admin demo account still works", async () => {
    await login("admin@colosseum.dev");
    const overview = await req("GET", "/api/admin/overview", { auth: true });
    expect(overview.status).toBe(200);
  });

  it("existing mentor demo account still works", async () => {
    await login("mentor.fintech@colosseum.dev");
    const queue = await req("GET", "/api/problems/queue", { auth: true });
    expect(queue.status).toBe(200);
  });
});

/** Seed idempotency: rerunning the seed never duplicates demo accounts. */
describe.skipIf(!run)("seed idempotency", () => {
  it(
    "demo accounts are not duplicated across seed runs",
    () => {
      const seed = () =>
        spawnSync("pnpm", ["--filter", "@ac/backend", "db:seed"], {
          cwd: REPO_ROOT,
          stdio: "pipe",
          env: { ...process.env, NODE_ENV: "development" },
        });
      seed();
      seed();

      const demoEmails = [
        "admin@colosseum.dev",
        "mentor.fintech@colosseum.dev",
        "mentor.cybersec@colosseum.dev",
        "captain.prime@colosseum.dev",
        "captain.null@colosseum.dev",
      ];
      return Promise.all(
        demoEmails.map(async (e) => {
          const count = await prisma.user.count({ where: { email: e } });
          expect(count).toBe(1);
        }),
      );
    },
    120_000,
  );
});