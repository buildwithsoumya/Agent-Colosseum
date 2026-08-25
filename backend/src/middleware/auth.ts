import type { NextFunction, Request, Response } from "express";
import type { Role, TeamRole, UserStatus } from "@ac/shared";
import { prisma } from "../lib/prisma.js";
import { sha256 } from "../lib/rng.js";
import { forbidden, unauthorized } from "../lib/errors.js";

export const SESSION_COOKIE = "ac_session";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
}

export interface Membership {
  teamId: string;
  teamRole: TeamRole;
  /** Convenience flag: whether this membership is a team captain. */
  isCaptain: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      membership?: Membership;
    }
  }
}

/** Resolves the session cookie to a user. Never trusts client-declared roles. */
export async function authOptional(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) return next();

    const session = await prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) return next();

    // Deactivated users cannot use the platform regardless of session validity.
    if (session.user.status === "DEACTIVATED") return next();

    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      status: session.user.status,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized());
  next();
}

/** Alias keeping the "global role" mental model explicit; same check as requireRole. */
export function requireGlobalRole(...roles: Role[]) {
  return requireRole(...roles);
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(unauthorized("Insufficient role"));
    next();
  };
}

/** Loads the caller's team membership if authenticated; rejection is left to route guards. */
export async function loadMembership(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.membership) return next();
    const m = await prisma.teamMember.findUnique({ where: { userId: req.user.id } });
    req.membership = m
      ? { teamId: m.teamId, teamRole: m.teamRole, isCaptain: m.teamRole === "CAPTAIN" }
      : undefined;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireTeam(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized());
  if (!req.membership) return next(unauthorized("You are not in a team yet"));
  next();
}

/** Requires the caller to be the captain of the team in `req.membership`. */
export function requireTeamCaptain(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized());
  if (!req.membership) return next(unauthorized("You are not in a team yet"));
  if (!req.membership.isCaptain) return next(forbidden("Only the team captain can do this"));
  next();
}