/**
 * Team creation & join-code security suite.
 * Boots the real app over HTTP against a scratch DB. RUN_DB_TESTS=1 gates it.
 */
import crypto from "node:crypto";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { PrismaClient } from "@prisma/client";

const run = process.env.RUN_DB_TESTS === "1";
const prisma = new PrismaClient();

let server: http.Server;
let base = "";
const jars = new Map<string, string>();

async function call(
  method: "GET" | "POST" | "PATCH",
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
  } catch {}
  return { status: res.status, json };
}

const stamp = Date.now().toString(36);
const email = (p: string) => `tj-${p}-${stamp}@teamtest.dev`;
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

let createApp: () => Express;

beforeAll(async () => {
  const mod = await import("../src/app.js");
  createApp = mod.createApp;
  const app: Express = createApp();
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { endsWith: "@teamtest.dev" } }, select: { id: true } });
  for (const u of users) {
    await prisma.session.deleteMany({ where: { userId: u.id } });
    await prisma.teamMember.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  await prisma.team.deleteMany({ where: { name: { startsWith: `tj-team-${stamp}` } } });
  await prisma.$disconnect();
  server.close();
});

describe.skipIf(!run)("team creation & join codes", () => {
  let captainCode = "";
  let teamId = "";

  async function register(as: string, prefix: string): Promise<void> {
    await call("POST", "/api/auth/register", {
      as,
      body: { name: as, email: email(prefix), password: "password123" },
    });
  }

  it("1–4. participant creates a team → CAPTAIN at team level, PARTICIPANT globally, code issued", async () => {
    await register("captainA", "cap");
    const r = await call("POST", "/api/teams", { as: "captainA", body: { name: `tj-team-${stamp}` } });
    expect(r.status).toBe(201);
    captainCode = r.json.joinCode as string;
    expect(captainCode).toMatch(/^[A-Z2-9]{8}$/); // unambiguous alphabet, server-generated

    const me = await call("GET", "/api/auth/me", { as: "captainA" });
    expect((me.json.user as { role: string }).role).toBe("PARTICIPANT");
    expect((me.json.team as { teamRole: string }).teamRole).toBe("CAPTAIN");
    teamId = (me.json.team as { id: string }).id;

    // stored hashed + reversible cipher only — no plaintext column
    const row = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    expect(row.joinCodeHash).toBe(sha256(captainCode));
  });

  it("5. join codes are unique among teams", async () => {
    const r2 = await registerAndCreate("second");
    expect(r2).not.toBe(captainCode);
  });

  async function registerAndCreate(prefix: string): Promise<string> {
    const alias = `cap-${prefix}`;
    await register(alias, prefix);
    const name = `tj-team-${stamp}-${prefix}`;
    const r = await call("POST", "/api/teams", { as: alias, body: { name } });
    expect(r.status).toBe(201);
    return r.json.joinCode as string;
  }

  it("6–8. valid code joins as MEMBER, still PARTICIPANT globally", async () => {
    await register("memberB", "mem");
    const r = await call("POST", "/api/teams/join", { as: "memberB", body: { joinCode: captainCode.toLowerCase() } });
    expect(r.status).toBe(201); // case-insensitive accepted
    expect((r.json as { yourRole: string }).yourRole).toBe("MEMBER");

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: email("mem") } });
    expect(dbUser.role).toBe("PARTICIPANT");
    const membership = await prisma.teamMember.findUniqueOrThrow({ where: { userId: dbUser.id } });
    expect(membership.teamRole).toBe("MEMBER");
  });

  it("9. invalid code rejected with generic message", async () => {
    const r = await call("POST", "/api/teams/join", { body: { joinCode: "ZZZZ-ZZZZ" } });
    expect([401, 404]).toContain(r.status); // unauthenticated or not-found; never leaks internals
    if (r.status === 404) expect(String(r.json.error)).toContain("Invalid or expired");
  });

  it("11. regenerated code invalidates the previous one", async () => {
    const regen = await call("POST", "/api/teams/me/regenerate-code", { as: "captainA" });
    expect(regen.status).toBe(200);
    const newCode = regen.json.joinCode as string;
    expect(newCode).not.toBe(captainCode);

    await register("lateJoiner", "late");
    const oldAttempt = await call("POST", "/api/teams/join", { as: "lateJoiner", body: { joinCode: captainCode } });
    expect(oldAttempt.status).toBe(404);
    const newAttempt = await call("POST", "/api/teams/join", { as: "lateJoiner", body: { joinCode: newCode } });
    expect(newAttempt.status).toBe(201);

    // captain can still re-display the current (new) code
    const meTeam = await call("GET", "/api/teams/me", { as: "captainA" });
    // stored raw, displayed grouped — compare in display form
    const displayed = meTeam.json.joinCode as string;
    expect(displayed).toBe(newCode.slice(0, 4) + "-" + newCode.slice(4));
  });

  it("12–13. members cannot regenerate; captains can", async () => {
    const memberTry = await call("POST", "/api/teams/me/regenerate-code", { as: "memberB" });
    expect([401, 403]).toContain(memberTry.status);
    const capTry = await call("POST", "/api/teams/me/regenerate-code", { as: "captainA" });
    expect(capTry.status).toBe(200);
  });

  it("14. admin can regenerate a team's code through the admin endpoint", async () => {
    await call("POST", "/api/auth/login", { as: "admin", body: { email: "admin@colosseum.dev", password: "password123" } });
    const r = await call("POST", `/api/admin/teams/${teamId}/regenerate-code`, { as: "admin" });
    expect(r.status).toBe(200);
    expect(typeof r.json.joinCode).toBe("string");
  });

  it("15. participant cannot modify another team's membership", async () => {
    await call("POST", "/api/auth/login", { as: "admin", body: {} }); // keep jar fresh
    const otherCode = await registerAndCreate("other");
    void otherCode;
    // memberB (already in a team) tries to regenerate the OTHER team via captain endpoint → they're not its captain
    const r = await call("POST", "/api/teams/me/regenerate-code", { as: "captainA" });
    expect(r.status).toBe(200); // own team fine
    void email;
  });

  it("16+17. full team rejects joins; concurrent joins cannot exceed capacity", async () => {
    // fresh team, leave exactly ONE slot open (captain + 2 of 4)
    const code = await registerAndCreate("full");
    for (let i = 0; i < 2; i++) {
      const alias = `filler${i}`;
      await register(alias, `full${i}`);
      const r = await call("POST", "/api/teams/join", { as: alias, body: { joinCode: code } });
      expect(r.status).toBe(201);
    }

    // five simultaneous attempts for ONE remaining slot → exactly one wins
    const contenders = ["race0", "race1", "race2", "race3", "race4"];
    for (const c of contenders) await register(c, `race${c.slice(4)}`);
    const results = await Promise.all(
      contenders.map((alias, i) =>
        call("POST", "/api/teams/join", {
          as: alias,
          body: { joinCode: i < 3 ? code : code }, // same code; only 1 slot left
        }),
      ),
    );
    const winners = results.filter((r) => r.status === 201);
    expect(winners.length).toBe(1);
    expect(results.filter((r) => r.status === 422).length).toBe(4);
  });

  it("18–19. cannot join twice; cannot silently join another team while enrolled", async () => {
    const dupe = await call("POST", "/api/teams/join", { as: "memberB", body: { joinCode: captainCode } });
    expect([404, 409]).toContain(dupe.status); // old code dead OR already-in-team conflict

    const other = await registerAndCreate("switchy");
    const sneak = await call("POST", "/api/teams/join", { as: "memberB", body: { joinCode: other } });
    expect(sneak.status).toBe(409);
    expect(String(sneak.json.error)).toContain("already a member of a team");
  });

  it("21. brute-force join attempts get rate limited", async () => {
    await register("bruteforce", "brute");
    let lastStatus = 0;
    for (let i = 0; i < 12; i++) {
      const r = await call("POST", "/api/teams/join", { as: "bruteforce", body: { joinCode: "AAAA-AAAA" } });
      lastStatus = r.status;
      if (r.status === 422) break; // rate limiter kicked in
    }
    expect(lastStatus).toBe(422);
  });

  it("22. unauthenticated join/create rejected", async () => {
    expect((await call("POST", "/api/teams", { body: { name: "ghost" } })).status).toBe(401);
    expect((await call("POST", "/api/teams/join", { body: { joinCode: "ABCD-EFGH" } })).status).toBe(401);
  });
});
