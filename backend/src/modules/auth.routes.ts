import { Router } from "express";
import bcrypt from "bcryptjs";
import { LoginInput, RegisterInput } from "@ac/shared";
import { env } from "../config/env.js";
import { AppError, badRequest, unauthorized } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { randomToken, sha256 } from "../lib/rng.js";
import { SESSION_COOKIE } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { PublicUser } from "@ac/shared";

export const authRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
  maxAge: env.SESSION_TTL_HOURS * 3600_000,
};

function toPublicUser(u: { id: string; email: string; name: string; role: PublicUser["role"] }): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

async function createSession(userId: string): Promise<string> {
  const token = randomToken();
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + env.SESSION_TTL_HOURS * 3600_000),
    },
  });
  return token;
}

authRouter.post(
  "/register",
  authLimiter,
  validate(RegisterInput),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body as RegisterInput;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw badRequest("An account with that email already exists");
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 10), role: "PARTICIPANT" },
    });
    const token = await createSession(user.id);
    res.cookie(SESSION_COOKIE, token, COOKIE_OPTS).status(201).json({ user: toPublicUser(user) });
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  validate(LoginInput),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as LoginInput;
    const user = await prisma.user.findUnique({ where: { email } });
    // constant-ish response regardless of which factor failed
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }
    const token = await createSession(user.id);
    res.cookie(SESSION_COOKIE, token, COOKIE_OPTS).json({ user: toPublicUser(user) });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
    res.clearCookie(SESSION_COOKIE, { path: "/" }).json({ ok: true });
  }),
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const membership = await prisma.teamMember.findUnique({
      where: { userId: req.user.id },
      include: { team: { select: { id: true, name: true } } },
    });
    res.json({
      user: req.user,
      team: membership ? { id: membership.team.id, name: membership.team.name, isCaptain: membership.isCaptain } : null,
    });
  }),
);
