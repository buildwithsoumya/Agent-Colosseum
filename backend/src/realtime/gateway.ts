import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { SocketEvent } from "@ac/shared";
import { env, isProd } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { redisSubscriber } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { SESSION_COOKIE } from "../middleware/auth.js";
import { sha256 } from "../lib/rng.js";

let io: Server | null = null;

export const ROOMS = {
  event: "event",
  team: (teamId: string) => `team:${teamId}`,
  admins: "role:admins",
  mentors: "role:mentors",
};

export function initGateway(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN.split(","), credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      // Cookie comes automatically on same-site requests; token is the fallback for cross-origin dev.
      const cookieToken = parseCookie(socket.request.headers.cookie ?? "")[SESSION_COOKIE];
      const token = socket.handshake.auth?.token ?? cookieToken;
      if (!token) return next(); // anonymous spectators allowed on public room
      const session = await prisma.session.findUnique({
        where: { tokenHash: sha256(token) },
        include: { user: true },
      });
      if (!session || session.expiresAt < new Date()) return next();
      if (session.user.status !== "ACTIVE") return next();
      socket.data.user = { id: session.user.id, globalRole: session.user.globalRole };
      const membership = await prisma.teamMember.findUnique({ where: { userId: session.user.id } });
      if (membership) socket.data.teamId = membership.teamId;
      next();
    } catch (err) {
      logger.error({ err }, "socket auth failed");
      next();
    }
  });

  io.on("connection", (socket: Socket) => {
    socket.join(ROOMS.event);
    const user = socket.data.user as { id: string; globalRole: string } | undefined;

    if (user) {
      if (user.globalRole === "ADMIN") void socket.join(ROOMS.admins);
      if (user.globalRole === "MENTOR") void socket.join(ROOMS.mentors);
      if (socket.data.teamId) void socket.join(ROOMS.team(socket.data.teamId as string));
    }
  });

  // Any service (backend modules or the evaluator worker) publishes to the
  // `realtime` Redis channel; this gateway fans messages out to rooms.
  void redisSubscriber.subscribe("realtime");
  redisSubscriber.on("message", (_channel, message) => {
    try {
      const msg = JSON.parse(message) as PublishPayload;
      dispatch(msg);
    } catch (err) {
      logger.error({ err }, "bad realtime message");
    }
  });

  logger.info("Socket.IO gateway ready");
  return io;
}

interface PublishPayload {
  event: SocketEventName_;
  room?: string; // undefined = global event room
  payload: unknown;
}

type SocketEventName_ = (typeof SocketEvent)[keyof typeof SocketEvent];

function dispatch(msg: PublishPayload): void {
  if (!io) return;
  const target = msg.room ?? ROOMS.event;
  io.to(target).emit(msg.event, msg.payload);
}

/** Publish a realtime event from anywhere in the backend (or evaluator via its own publisher). */
export function publish(event: SocketEventName_, payload: unknown, room?: string): void {
  dispatch({ event, payload, room });
}

function parseCookie(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}
