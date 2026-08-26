/**
 * Cloudflare Workers entrypoint — Hono-routed port of the event-day API core.
 * Local/docker deployments keep the full Express app (src/server.ts).
 *
 * Covered here: auth/session, event state+timer, tracks, teams (create/join/
 * regenerate/view), leaderboard, WebSocket hub, health.
 * Node-only surfaces (BullMQ queue consumer, file uploads, admin console APIs)
 * remain on src/server.ts until their Workers equivalents land.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { DurableObjectNamespace as DONs, WorkerWebSocket, WebSocketPair } from "./types/cf.js";
import { configureWorkerBus } from "./lib/runtime.js";
import { configureRateLimitDo } from "./lib/ratelimit.js";


interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}
interface TeamMembershipInfo {
  teamId: string;
  teamRole: "MEMBER" | "CAPTAIN";
}

const SESSION_COOKIE = "ac_session";
const SESSION_TTL_MS = 24 * 3600_000;

/** Prisma client (lazy so bindings land in process.env first). */
async function db() {
  const mod = await import("./lib/prisma.js");
  return mod.prisma;
}

type Tx = import("@prisma/client").Prisma.TransactionClient;
async function tx<T>(fn: (t: Tx) => Promise<T>): Promise<T> {
  return ((await db()).$transaction(fn) as unknown as Promise<T>);
}

/* ------------------------------------------------------- Durable Objects */

export class RealtimeHub {
  private clients = new Set<WorkerWebSocket>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect" && request.headers.get("Upgrade") === "websocket") {
      const pair = new (globalThis.WebSocketPair as unknown as { new (): WebSocketPair })();
      this.clients.add(pair[1]);
      pair[1].addEventListener("close", () => this.clients.delete(pair[1]));
      pair[1].addEventListener("error", () => this.clients.delete(pair[1]));
      pair[1].accept();
      return new Response(null, { status: 101, webSocket: pair[0] } as never);
    }

    if (url.pathname === "/publish" && request.method === "POST") {
      const body = (await request.json()) as { event: string; payload: unknown };
      this.broadcast(body.event, body.payload);
      return new Response("ok");
    }
    return new Response("not found", { status: 404 });
  }

  broadcast(event: string, payload: unknown): void {
    const msg = JSON.stringify({ event, payload });
    for (const ws of this.clients) {
      try {
        ws.send(msg);
      } catch {
        this.clients.delete(ws);
      }
    }
  }
}

export class JoinRateLimiter {
  private counts = new Map<string, number>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? "";
    switch (url.pathname.replace("/", "")) {
      case "count":
        return new Response(String(this.counts.get(userId) ?? 0));
      case "increment": {
        const n = (this.counts.get(userId) ?? 0) + 1;
        this.counts.set(userId, n);
        return new Response(String(n));
      }
      case "clear":
        this.counts.delete(userId);
        return new Response("ok");
      default:
        return new Response("not found", { status: 404 });
    }
  }
}

/* ------------------------------------------------------------------ utils */

const bad = (status: number, error: string) => Response.json({ error }, { status });

async function resolveSession(token?: string) {
  if (!token) return null;
  const prisma = await db();
  const { sha256 } = await import("./lib/rng.js");
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  const member = await prisma.teamMember.findUnique({ where: { userId: session.user.id } });
  return {
    user: { id: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role },
    membership: member ? { teamId: member.teamId, teamRole: member.teamRole as "MEMBER" | "CAPTAIN" } : null,
  };
}

async function issueSession(userId: string): Promise<string> {
  const prisma = await db();
  const { randomToken, sha256 } = await import("./lib/rng.js");
  const token = randomToken();
  await prisma.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return token;
}

/* -------------------------------------------------------------------- app */

export function createWorkerApp(hubNs: DONs, limiterNs: DONs) {
  configureWorkerBus(hubNs);
  configureRateLimitDo(limiterNs);

  const app = new Hono();

  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",");
  app.use("*", async (c, next) => {
    const origin = c.req.header("Origin");
    // CORS preflight must answer 2xx or browsers refuse the real request.
    if (c.req.method === "OPTIONS") {
      c.res = new Response(null, { status: 204 });
      if (origin && allowedOrigins.includes(origin)) {
        c.res.headers.set("Access-Control-Allow-Origin", origin);
        c.res.headers.set("Access-Control-Allow-Credentials", "true");
        c.res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
        c.res.headers.set("Access-Control-Allow-Headers", "Content-Type");
        c.res.headers.set("Access-Control-Max-Age", "86400");
      }
      return;
    }
    await next();
    c.header("Cache-Control", "no-store"); // API state must never be cached by browsers/CDN
    if (origin && allowedOrigins.includes(origin)) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
    }
  });

  // session resolution
  app.use("/api/*", async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const session = await resolveSession(token);
    if (session) {
      c.set("user" as never, session.user as never);
      if (session.membership) c.set("membership" as never, session.membership as never);
    }
    await next();
  });

  const me = (c: { get(k: string): unknown }) =>
    c.get("user") ? ({ ...(c.get("user") as AuthUser) } as AuthUser) : null;
  const membershipOf = (c: { get(k: string): unknown }) => c.get("membership") as TeamMembershipInfo | undefined;

  /* ---- health ---- */
  app.get("/api/health", (c) => c.json({ ok: true, uptimeSec: Math.floor(Date.now() / 1000), phase: null }));

  /* ---- auth ---- */
  app.post("/api/auth/register", async (c) => {
    const bcrypt = (await import("bcryptjs")).default;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const emailAddr = String(body.email ?? "").toLowerCase().trim();
    const password = String(body.password ?? "");
    if (name.length < 2 || !emailAddr.includes("@") || password.length < 8) {
      return bad(400, "Validation failed");
    }
    const prisma = await db();
    if (await prisma.user.findUnique({ where: { email: emailAddr } })) {
      return bad(400, "An account with that email already exists");
    }
    const user = await prisma.user.create({
      data: { name, email: emailAddr, passwordHash: await bcrypt.hash(password, 10), role: "PARTICIPANT" },
    });
    setCookie(c, SESSION_COOKIE, await issueSession(user.id), {
      httpOnly: true, sameSite: "None", path: "/", maxAge: SESSION_TTL_MS / 1000,
      secure: true, // api and web live on different workers.dev subdomains = cross-site
    });
    return c.json(
      { user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status } },
      201,
    );
  });

  app.post("/api/auth/login", async (c) => {
    const bcrypt = (await import("bcryptjs")).default;
    const body = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string };
    const prisma = await db();
    const user = await prisma.user.findUnique({
      where: { email: String(body.email ?? "").toLowerCase().trim() },
    });
    if (!user || user.status !== "ACTIVE" || !(await bcrypt.compare(String(body.password ?? ""), user.passwordHash))) {
      return bad(401, "Invalid email or password");
    }
    setCookie(c, SESSION_COOKIE, await issueSession(user.id), {
      httpOnly: true, sameSite: "None", path: "/", maxAge: SESSION_TTL_MS / 1000,
      secure: true,
    });
    return c.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status } });
  });

  app.post("/api/auth/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) {
      const prisma = await db();
      const { sha256 } = await import("./lib/rng.js");
      await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
    }
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  app.get("/api/auth/me", async (c) => {
    const user = me(c);
    if (!user) return bad(401, "Authentication required");
    const prisma = await db();
    const membership = await prisma.teamMember.findUnique({
      where: { userId: user.id },
      include: { team: { select: { id: true, name: true } } },
    });
    return c.json({
      user,
      team: membership
        ? { ...membership.team, teamRole: membership.teamRole }
        : null,
    });
  });

  /* ---- public reads ---- */
  app.get("/api/event/state", async (c) => {
    const engine = await import("./services/eventEngine.js");
    const prisma = await db();
    const snap = await engine.snapshot();
    const [announcements, activity, teamsCount, submissionsCount] = await Promise.all([
      prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.activityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
      prisma.team.count(),
      prisma.submission.count(),
    ]);
    return c.json({ ...snap, announcements, activity, stats: { teams: teamsCount, submissions: submissionsCount } });
  });

  app.get("/api/event/activity", async (c) => {
    const prisma = await db();
    return c.json({
      activity: await prisma.activityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    });
  });

  app.get("/api/leaderboard", async (c) => {
    const lb = await import("./services/leaderboard.js");
    return c.json({ entries: await lb.getLeaderboard() });
  });

  app.get("/api/tracks", async (c) => {
    const prisma = await db();
    return c.json({
      tracks: await prisma.track.findMany({
        where: { active: true },
        orderBy: { key: "asc" },
        select: {
          id: true, key: true, name: true, description: true,
          task1Title: true, task1Body: true, task1UnlockCost: true,
          task2Title: true, task2Body: true,
          _count: { select: { teams: true } },
        },
      }),
    });
  });

  /* ---- teams (event-day core) ---- */
  app.post("/api/teams", async (c) => {
    const user = me(c);
    if (!user) return bad(401, "Auth required");
    const prisma = await db();
    if (await prisma.teamMember.findUnique({ where: { userId: user.id } })) {
      return bad(409, "You're already a member of a team.");
    }
    const engine = await import("./services/eventEngine.js");
    const snap = await engine.snapshot();
    if (!snap.gates.teamCreateOpen) return bad(422, "Team creation is closed for this event.");

    const body = (await c.req.json().catch(() => ({}))) as { name?: string };
    const name = String(body.name ?? "").trim();
    if (name.length < 2 || name.length > 40) return bad(400, "Validation failed");

    const teamsSvc = await import("./services/teams.js");
    const created = await tx((tx) => teamsSvc.createTeam(tx, user.id, name));
    const full = await teamsSvc.teamView(prisma, created.teamId);
    const { recordActivity } = await import("./services/activity.js");
    await recordActivity("TEAM", `Team "${full.name}" entered the arena`);
    return c.json({ team: full, joinCode: created.joinCode }, 201);
  });

  app.post("/api/teams/join", async (c) => {
    const user = me(c);
    if (!user) return bad(401, "Auth required");
    const limiterStub = limiterNs.get(limiterNs.idFromName("global"));
    const count = Number(await (await limiterStub.fetch(`https://limiter/count?userId=${user.id}`)).text());
    if (count >= 10) return bad(422, "Too many failed attempts. Try again in a few minutes.");

    const prisma = await db();
    const engine = await import("./services/eventEngine.js");
    const snap = await engine.snapshot();
    if (!snap.gates.teamJoinOpen) return bad(422, "Team registration is closed for this event.");
    if (await prisma.teamMember.findUnique({ where: { userId: user.id } })) {
      return bad(409, "You're already a member of a team.");
    }
    const cfg = engine.eventConfig(await engine.getEvent());

    const body = (await c.req.json().catch(() => ({}))) as { joinCode?: string };
    const teamsSvc = await import("./services/teams.js");
    try {
      const joined = await tx((tx) =>
        teamsSvc.joinByCode(tx, user.id, String(body.joinCode ?? ""), cfg.maxTeamSize),
      );
      void (await limiterStub.fetch(`https://limiter/clear?userId=${user.id}`));
      const memberCount = await prisma.teamMember.count({ where: { teamId: joined.teamId } });
      const hub = hubNs.get(hubNs.idFromName("global"));
      void hub.fetch("https://hub/publish", {
        method: "POST",
        body: JSON.stringify({
          event: "team:member_joined",
          payload: { teamId: joined.teamId, teamName: joined.teamName, memberCount, maxTeamSize: cfg.maxTeamSize },
        }),
      });
      const { recordActivity } = await import("./services/activity.js");
      await recordActivity("TEAM", `${user.name} joined "${joined.teamName}"`);
      return c.json(
        {
          team: { id: joined.teamId, name: joined.teamName },
          captainName: joined.captainName,
          yourRole: "MEMBER",
          memberCount,
          maxTeamSize: cfg.maxTeamSize,
        },
        201,
      );
    } catch (err) {
      void (await limiterStub.fetch(`https://limiter/increment?userId=${user.id}`));
      throw err;
    }
  });

  app.get("/api/teams/me", async (c) => {
    const user = me(c);
    if (!user) return bad(401, "Authentication required");
    const membership = membershipOf(c);
    if (!membership) return bad(401, "You are not in a team yet");
    const prisma = await db();
    const teamsSvc = await import("./services/teams.js");
    const engine = await import("./services/eventEngine.js");
    const [team, cfg] = await Promise.all([
      teamsSvc.teamView(prisma, membership.teamId),
      engine.eventConfig(await engine.getEvent()),
    ]);
    const joinCode =
      membership.teamRole === "CAPTAIN"
        ? await teamsSvc.displayableCode(prisma, membership.teamId)
        : undefined;
    return c.json({
      team,
      teamRole: membership.teamRole,
      maxTeamSize: cfg.maxTeamSize,
      gates: (await engine.snapshot()).gates,
      ...(joinCode !== undefined ? { joinCode } : {}),
    });
  });

  app.post("/api/teams/me/regenerate-code", async (c) => {
    const user = me(c);
    const membership = membershipOf(c);
    if (!user || !membership) return bad(401, "Authentication required");
    if (membership.teamRole !== "CAPTAIN") return bad(403, "Only the team captain can regenerate the join code.");
    const prisma = await db();
    const teamsSvc = await import("./services/teams.js");
    const raw = await tx((tx) => teamsSvc.regenerateJoinCode(tx, membership.teamId));
    return c.json({ joinCode: raw.joinCode });
  });

  /* ---- websocket hub passthrough ---- */
  app.get("/ws", (c) => {
    if (c.req.header("Upgrade") !== "websocket") return bad(426, "WebSocket upgrade required");
    const stub = hubNs.get(hubNs.idFromName("global"));
    const headers = new Headers(c.req.raw.headers);
    return stub.fetch(new Request("https://hub/connect", { headers }));
  });

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  return app;
}

export interface WorkerEnv {
  DATABASE_URL?: string;
  AUTH_SECRET: string;
  CORS_ORIGIN: string;
  HYPERDRIVE?: { connectionString: string };
  REALTIME_HUB: DONs;
  JOIN_LIMITER: DONs;
}

export default {
  async fetch(request: Request, envVars: WorkerEnv, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    // Bindings must be visible before any service module initialises.
    const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
    g.process = g.process ?? ({ env: {} } as never);
    Object.assign(g.process.env ?? {}, {
      NODE_ENV: "production",
      // Hyperdrive terminates Postgres locally for the Worker — no TLS upgrade,
      // no CA store issues. Falls back to the raw pooler secret if unbound.
      DATABASE_URL:
        envVars.HYPERDRIVE?.connectionString ??
        envVars.DATABASE_URL ??
        "",
      DB_VIA_HYPERDRIVE: envVars.HYPERDRIVE ? "1" : "0",
      AUTH_SECRET: envVars.AUTH_SECRET,
      CORS_ORIGIN: envVars.CORS_ORIGIN,
    });

    const app = createWorkerApp(envVars.REALTIME_HUB, envVars.JOIN_LIMITER);
    return app.fetch(request);
  },
};
