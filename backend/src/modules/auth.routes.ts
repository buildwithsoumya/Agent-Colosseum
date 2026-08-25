import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  InvitationAcceptInput,
  LoginInput,
  RegisterInput,
  type GlobalRole,
  type PublicUser,
} from "@ac/shared";
import { env } from "../config/env.js";
import { badRequest, conflict, gone, notFound, unauthorized } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { randomToken, sha256 } from "../lib/rng.js";
import { SESSION_COOKIE } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const authRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
  maxAge: env.SESSION_TTL_HOURS * 3600_000,
};

function toPublicUser(u: {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
}): PublicUser {
  return { id: u.id, email: u.email, name: u.name, globalRole: u.globalRole };
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

/**
 * Public registration.
 *
 * SECURITY: the client can NEVER choose a role. `RegisterInput` has no role field
 * and zod strips anything extra, so even a forged `{ role: "ADMIN" }` payload is
 * discarded before it reaches the database. Every account starts as PARTICIPANT.
 */
authRouter.post(
  "/register",
  authLimiter,
  validate(RegisterInput),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body as RegisterInput;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw badRequest("An account with that email already exists");
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 10), globalRole: "PARTICIPANT" },
    });
    const token = await createSession(user.id);
    res.cookie(SESSION_COOKIE, token, COOKIE_OPTS).status(201).json({ user: toPublicUser(user) });
  }),
);

/* ----------------------------------------------------------- invitations */

/** Admin-only: mint a single-use invitation for a privileged (non-ADMIN) role. */
export async function createInvitation(params: {
  email: string;
  role: "MENTOR" | "CAPTAIN";
  teamId?: string | null;
  createdById: string;
  ttlHours?: number;
}): Promise<{ id: string; token: string; expiresAt: Date }> {
  const email = params.email.toLowerCase().trim();
  if (await prisma.user.findUnique({ where: { email } })) {
    throw conflict("A user with that email already exists");
  }
  let teamName: string | null = null;
  if (params.role === "CAPTAIN") {
    if (!params.teamId) throw badRequest("Captain invitations require a team");
    const team = await prisma.team.findUnique({ where: { id: params.teamId } });
    if (!team) throw notFound("Team not found");
    teamName = team.name;
  }

  const token = randomToken(32); // raw token: shown once to the admin, never stored
  const ttl = params.ttlHours ?? 72;
  const invitation = await prisma.invitation.create({
    data: {
      tokenHash: sha256(token),
      email,
      role: params.role,
      teamId: params.role === "CAPTAIN" ? params.teamId : null,
      expiresAt: new Date(Date.now() + ttl * 3600_000),
      createdById: params.createdById,
    },
  });
  void teamName;
  return { id: invitation.id, token, expiresAt: invitation.expiresAt };
}

/** Public preview of an invitation (safe fields only). */
authRouter.get(
  "/invitation/:token",
  asyncHandler(async (req, res) => {
    const token = req.params.token;
    if (!token) throw notFound("Invitation not found");
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: { team: { select: { name: true } } },
    });
    if (!invitation) throw notFound("This invitation is not valid");

    const expired = invitation.expiresAt < new Date() || invitation.status === "EXPIRED";
    const usable = invitation.status === "PENDING" && !expired && !(await prisma.user.findUnique({ where: { email: invitation.email } }));

    res.json({
      email: invitation.email,
      role: invitation.role,
      teamName: invitation.team?.name ?? null,
      expiresAt: invitation.expiresAt,
      status: usable ? "VALID" : invitation.status === "PENDING" ? (expired ? "EXPIRED" : "UNAVAILABLE") : invitation.status,
    });
  }),
);

/**
 * Accept an invitation: validates the hashed token, expiry and single-use state,
 * then creates the account with the invited role inside one transaction.
 * The role comes from the stored invitation row — never from the request body.
 */
authRouter.post(
  "/invitation/accept",
  authLimiter,
  validate(InvitationAcceptInput),
  asyncHandler(async (req, res) => {
    const { token, name, password } = req.body as { token: string; name: string; password: string };

    const result = await prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({ where: { tokenHash: sha256(token) } });
      if (!invitation) throw notFound("This invitation is not valid");
      if (invitation.status !== "PENDING") throw gone("This invitation has already been used or revoked");
      if (invitation.expiresAt < new Date()) {
        await tx.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
        throw gone("This invitation has expired");
      }
      if (await tx.user.findUnique({ where: { email: invitation.email } })) {
        throw conflict("An account with that email already exists");
      }

      // claim the invitation atomically before creating the account
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, status: "PENDING", usedAt: null },
        data: { usedAt: new Date(), status: "USED" },
      });
      if (claimed.count !== 1) throw gone("This invitation has already been used");

      const passwordHash = await bcrypt.hash(password, 10);
      if (invitation.role === "MENTOR") {
        return tx.user.create({
          data: { name, email: invitation.email, passwordHash, globalRole: "MENTOR" },
        });
      }
      // CAPTAIN: participant globally + captain within the invited team
      if (!invitation.teamId) throw badRequest("Invitation is missing its team");
      return tx.user.create({
        data: {
          name,
          email: invitation.email,
          passwordHash,
          globalRole: "PARTICIPANT",
          memberships: { create: { teamId: invitation.teamId, teamRole: "CAPTAIN" } },
        },
      });
    });

    const token2 = await createSession(result.id);
    res
      .cookie(SESSION_COOKIE, token2, COOKIE_OPTS)
      .status(201)
      .json({ user: toPublicUser(result), teamRole: result.globalRole === "PARTICIPANT" ? "CAPTAIN" : undefined });
  }),
);

/* ---------------------------------------------------------------- session */

authRouter.post(
  "/login",
  authLimiter,
  validate(LoginInput),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as LoginInput;
    const user = await prisma.user.findUnique({ where: { email } });
    // constant-ish response regardless of which factor failed; suspended accounts cannot log in
    if (
      !user ||
      user.status !== "ACTIVE" ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
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
      team: membership
        ? { id: membership.team.id, name: membership.team.name, teamRole: membership.teamRole }
        : null,
    });
  }),
);

