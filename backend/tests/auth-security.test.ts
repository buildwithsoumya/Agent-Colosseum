/**
 * Authentication & role-escalation security suite.
 *
 * Boots the real Express app on an ephemeral port and drives it over HTTP,
 * against a scratch database. Enabled with RUN_DB_TESTS=1 (CI sets it).
 */
import crypto from "node:crypto";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { PrismaClient } from "@prisma/client";

const run = process.env.RUN_DB_TESTS === "1";
const prisma = new PrismaClient();

let app: Express;
let server: http.Server;
let base = "";

const jars = new Map<string, string>();
async function call(
  method: "GET" | "POST" | "PATCH" | "PUT",
  path: string,
  opts: { body?: unknown; as?: string } = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const cookie = opts.as ? jars.get(opts.as) : undefined;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (opts.as && setCookie) {
    const token = /ac_session=([^;]+)/.exec(setCookie)?.[1];
    if (token) jars.set(opts.as, `ac_session=${token}`);
  }
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty body */
  }
  return { status: res.status, json };
}

const stamp = Date.now().toString(36);
const email = (prefix: string) => `${prefix}-${stamp}@sectest.dev`;
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

beforeAll(async () => {
  const { createApp } = await import("../src/app.js");
  app = createApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { endsWith: "@sectest.dev" } }, select: { id: true } });
  for (const u of users) {
    await prisma.session.deleteMany({ where: { userId: u.id } });
    await prisma.teamMember.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  await prisma.team.deleteMany({ where: { name: `sec-team-${stamp}` } });
  await prisma.invitation.deleteMany({ where: { email: { endsWith: "@sectest.dev" } } });
  await prisma.$disconnect();
  server.close();
});

describe.skipIf(!run)("authentication & role security", () => {
  let captainUserId = "";

  it("15. existing demo admin account still works", async () => {
    const r = await call("POST", "/api/auth/login", {
      as: "admin",
      body: { email: "admin@colosseum.dev", password: "password123" },
    });
    expect(r.status).toBe(200);
    expect((r.json.user as { globalRole: string }).globalRole).toBe("ADMIN");
  });

  it("1–4 + 18. registration creates PARTICIPANT and ignores forged role payloads", async () => {
    const r = await call("POST", "/api/auth/register", {
      body: {
        name: "Attacker",
        email: email("attacker"),
        password: "password123",
        role: "ADMIN",
        globalRole: "MENTOR",
      },
    });
    expect(r.status).toBe(201);
    const user = (r.json.user as { globalRole: string }).globalRole;
    expect(user).toBe("PARTICIPANT"); // not ADMIN / MENTOR / CAPTAIN

    const db = await prisma.user.findUniqueOrThrow({ where: { email: email("attacker") } });
    expect(db.globalRole).toBe("PARTICIPANT");
    expect(db.status).toBe("ACTIVE");
    jars.set("attacker", jars.get("attacker") ?? "");
  });

  it("5–6. team creation makes the creator CAPTAIN at team level only", async () => {
    await call("POST", "/api/auth/register", {
      as: "captain",
      body: { name: "Cap", email: email("captain"), password: "password123" },
    });
    const team = await call("POST", "/api/teams", { as: "captain", body: { name: `sec-team-${stamp}` } });
    expect(team.status).toBe(201);

    const me = await call("GET", "/api/auth/me", { as: "captain" });
    expect((me.json.team as { teamRole: string }).teamRole).toBe("CAPTAIN");

    const membership = await prisma.teamMember.findFirstOrThrow({
      where: { user: { email: email("captain") } },
    });
    captainUserId = membership.userId;
    expect(membership.teamRole).toBe("CAPTAIN");
    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: email("captain") } });
    expect(dbUser.globalRole).toBe("PARTICIPANT");
  });

  it("7+10. captain cannot access admin endpoints", async () => {
    expect([401, 403]).toContain((await call("GET", "/api/admin/users", { as: "captain" })).status);
    expect(
      [401, 403].includes(
        (
          await call("POST", "/api/admin/credits/adjust", {
            as: "captain",
            body: { teamId: "x", amount: 1000, reason: "self service" },
          })
        ).status,
      ),
    ).toBe(true);
  });

  it("8. existing mentor works; cannot reach admin-only surfaces", async () => {
    const login = await call("POST", "/api/auth/login", {
      as: "mentor",
      body: { email: "mentor.fintech@colosseum.dev", password: "password123" },
    });
    expect(login.status).toBe(200);
    expect((login.json.user as { globalRole: string }).globalRole).toBe("MENTOR");

    expect([401, 403]).toContain((await call("GET", "/api/admin/overview", { as: "mentor" })).status);
    expect((await call("GET", "/api/problems/queue?status=SUBMITTED", { as: "mentor" })).status).toBe(200);
  });

  it("9. participant cannot access mentor review endpoints", async () => {
    const r = await call("POST", "/api/problems/nonexistent/review", {
      as: "captain",
      body: { decision: "APPROVE" },
    });
    expect([401, 403]).toContain(r.status);
  });

  it("11. participant cannot modify own global role (no such route without admin)", async () => {
    const me = await call("GET", "/api/auth/me", { as: "captain" });
    const selfId = (me.json.user as { id: string }).id;
    const direct = await call("PATCH", `/api/admin/users/${selfId}/global-role`, {
      as: "captain",
      body: { role: "MENTOR" },
    });
    expect([401, 403]).toContain(direct.status);

    // even the admin endpoint refuses to grant ADMIN or touch admins
    const adminEscalate = await call("PATCH", `/api/admin/users/${selfId}/global-role`, {
      as: "admin",
      body: { role: "ADMIN" },
    });
    expect(adminEscalate.status).toBe(400); // zod rejects ADMIN as a value

    const adminSelf = await call("GET", "/api/auth/me", { as: "admin" });
    const adminId = (adminSelf.json.user as { id: string }).id;
    const suspendAdmin = await call("PATCH", `/api/admin/users/${adminId}/status`, {
      as: "admin",
      body: { status: "SUSPENDED" },
    });
    expect(suspendAdmin.status).toBe(422); // cannot modify admin accounts
  });

  it("12. invitation flow grants MENTOR only via authorized creation; token hashed at rest", async () => {
    const invite = await call("POST", "/api/admin/users/invite", {
      as: "admin",
      body: { email: email("invmentor"), role: "MENTOR" },
    });
    expect(invite.status).toBe(201);
    const rawToken = (invite.json.inviteUrl as string).split("/invite/")[1];

    // raw token never stored
    const rows = await prisma.invitation.findMany();
    expect(rows.some((r) => r.tokenHash === rawToken)).toBe(false);

    // forged escalation inside acceptance payload is ignored
    const accept = await call("POST", "/api/auth/invitation/accept", {
      as: "invitedMentor",
      body: { token: rawToken, name: "Invited Mentor", password: "password123", globalRole: "ADMIN" },
    });
    expect(accept.status).toBe(201);
    expect((accept.json.user as { globalRole: string }).globalRole).toBe("MENTOR");

    expect((await call("GET", "/api/problems/queue?status=SUBMITTED", { as: "invitedMentor" })).status).toBe(200);
    expect([401, 403]).toContain((await call("GET", "/api/admin/overview", { as: "invitedMentor" })).status);
  });

  it("16. unauthenticated users cannot mint invitations", async () => {
    const r = await call("POST", "/api/admin/users/invite", {
      body: { email: email("sneak"), role: "MENTOR" },
    });
    expect([401, 403]).toContain(r.status);
  });

  it("13–14. invitations expire and are single-use", async () => {
    // expiry
    const expInvite = await call("POST", "/api/admin/users/invite", {
      as: "admin",
      body: { email: email("expired"), role: "MENTOR", ttlHours: 1 },
    });
    const expToken = ((expInvite.json.inviteUrl as string).split("/invite/")[1])!;
    await prisma.invitation.update({
      where: { tokenHash: sha256(expToken) },
      data: { expiresAt: new Date(Date.now() - 1000), status: "EXPIRED" },
    });
    const expiredAccept = await call("POST", "/api/auth/invitation/accept", {
      body: { token: expToken, name: "Late", password: "password123" },
    });
    expect(expiredAccept.status).toBe(410);

    // reuse
    const onceInvite = await call("POST", "/api/admin/users/invite", {
      as: "admin",
      body: { email: email("once"), role: "MENTOR" },
    });
    const onceToken = ((onceInvite.json.inviteUrl as string).split("/invite/")[1])!;
    expect((await call("POST", "/api/auth/invitation/accept", { body: { token: onceToken, name: "First", password: "password123" } })).status).toBe(201);
    const second = await call("POST", "/api/auth/invitation/accept", { body: { token: onceToken, name: "Second", password: "password123" } });
    expect(second.status).toBe(410);
  });

  it("17. seed does not duplicate demo accounts", async () => {
    const captain = await prisma.user.findUniqueOrThrow({ where: { email: "captain.prime@colosseum.dev" } });
    expect(captain.globalRole).toBe("PARTICIPANT");
    const memberships = await prisma.teamMember.count({ where: { userId: captain.id } });
    expect(memberships).toBeLessThanOrEqual(1);
    const admins = await prisma.user.count({ where: { email: "admin@colosseum.dev" } });
    expect(admins).toBe(1);
  });

  it("18b. suspended accounts fail authentication immediately", async () => {
    await call("POST", "/api/auth/register", {
      as: "susp",
      body: { name: "Susp", email: email("suspendme"), password: "password123" },
    });
    expect((await call("GET", "/api/auth/me", { as: "susp" })).status).toBe(200);

    const u = await prisma.user.findUniqueOrThrow({ where: { email: email("suspendme") } });
    await prisma.user.update({ where: { id: u.id }, data: { status: "SUSPENDED" } });

    expect((await call("GET", "/api/auth/me", { as: "susp" })).status).toBe(401);
    expect(
      (await call("POST", "/api/auth/login", { body: { email: email("suspendme"), password: "password123" } })).status,
    ).toBe(401);
  });

  it("cleanup guard: captain user captured for assertions", () => {
    expect(captainUserId).not.toBe("");
  });
});
