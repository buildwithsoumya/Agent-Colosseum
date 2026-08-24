import type { NextFunction, Request, Response } from "express";
import type { Role } from "@ac/shared";
import { prisma } from "../lib/prisma.js";
import { sha256 } from "../lib/rng.js";
import { unauthorized } from "../lib/errors.js";

export const SESSION_COOKIE = "ac_session";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      membership?: { teamId: string; isCaptain: boolean };
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

    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
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
    req.membership = m ? { teamId: m.teamId, isCaptain: m.isCaptain } : undefined;
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
