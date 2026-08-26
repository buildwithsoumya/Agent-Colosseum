import { Router } from "express";
import bcrypt from "bcryptjs";
import { InvitationRegisterInput, LoginInput, RegisterInput } from "@ac/shared";
import { env } from "../config/env.js";
import { badRequest, notFound, unauthorized } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { randomToken, sha256 } from "../lib/rng.js";
import { SESSION_COOKIE } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { completeInvitation, resolveInvitation } from "../services/invitations.js";
import type { PublicUser, TeamRole } from "@ac/shared";

export const authRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
  maxAge: env.SESSION_TTL_HOURS * 3600_000,
};

function toPublicUser(u: { id: string; email: string; name: string; role: PublicUser["role"]; status: PublicUser["status"] }): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, status: u.status };
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
 * Public registration. The server ALWAYS creates a PARTICIPANT account — any
 * client-supplied role field is stripped by the zod schema and ignored.
 */
authRouter.post(
  "/register",
  authLimiter,
  validate(RegisterInput),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body as RegisterInput;
    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) throw badRequest("An account with that email already exists");
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 10),
        role: "PARTICIPANT",
      },
    });
    const token = await createSession(user.id);
    res.cookie(SESSION_COOKIE, token, COOKIE_OPTS).status(201).json({ user: toPublicUser(user) });
  }),
);

/** Public: shows what an invitation grants (for the invitee's pre-account screen). */
authRouter.get(
  "/invitation",
  asyncHandler(async (req, res) => {
    const token = String(req.query.token ?? "");
    if (token.length < 16) throw notFound("Invitation not found");
    const inv = await resolveInvitation(token);
    if (!inv.valid) {
      const reason = inv.reason === "EXPIRED" ? "This invitation has expired." : inv.reason === "USED" ? "This invitation has already been used." : "Invitation not found.";
      throw badRequest(reason);
    }
    res.json({
      email: inv.email,
      role: inv.role,
      teamName: inv.teamName,
      expiresAt: inv.expiresAt,
    });
  }),
);

/** Public: completes account setup from an admin-issued invitation. */
authRouter.post(
  "/register/invitation",
  authLimiter,
  validate(InvitationRegisterInput),
  asyncHandler(async (req, res) => {
    const { name, email, password, invitationToken } = req.body as InvitationRegisterInput;

    let outcome: { role: "MENTOR" | "CAPTAIN"; teamId: string | null };
    try {
      outcome = await completeInvitation({
        token: invitationToken,
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "INVALID_INVITATION") throw badRequest("Invitation is not valid.");
      if (msg === "INVITATION_USED") throw badRequest("This invitation has already been used.");
      if (msg === "INVITATION_EXPIRED") throw badRequest("This invitation has expired.");
      if (msg === "INVITATION_EMAIL_MISMATCH") throw badRequest("This invitation was issued for a different email address.");
      if (msg === "EMAIL_IN_USE") throw badRequest("An account with that email already exists.");
      if (msg.startsWith("INVITATION_TEAM") || msg === "INVITATION_MISSING_TEAM") throw badRequest("The invited team is no longer available.");
      throw err;
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { email: email.toLowerCase() } });
    const token = await createSession(user.id);
    res.cookie(SESSION_COOKIE, token, COOKIE_OPTS).status(201).json({
      user: toPublicUser(user),
      teamRole: outcome.role === "CAPTAIN" ? ("CAPTAIN" as TeamRole) : null,
      teamId: outcome.teamId,
    });
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  validate(LoginInput),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as LoginInput;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // constant-ish response regardless of which factor failed
    if (!user || user.status === "DEACTIVATED" || !(await bcrypt.compare(password, user.passwordHash))) {
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
        ? {
            id: membership.team.id,
            name: membership.team.name,
            isCaptain: membership.teamRole === "CAPTAIN",
            teamRole: membership.teamRole,
          }
        : null,
    });
  }),
);