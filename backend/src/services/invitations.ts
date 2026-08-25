import { prisma } from "../lib/prisma.js";
import { randomToken, sha256 } from "../lib/rng.js";
import type { InvitedRole } from "@ac/shared";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CreatedInvitation {
  token: string;
  /** Shareable link the admin hands to the invitee. */
  link: string;
  email: string;
  role: InvitedRole;
  teamId: string | null;
  expiresAt: Date;
}

/**
 * Creates a signed, single-use, expirable invitation. Only the SHA-256 of the
 * token is stored in the database — the raw token is returned once to the admin.
 */
export async function createInvitation(opts: {
  email: string;
  role: InvitedRole;
  teamId?: string | null;
  createdById?: string;
}): Promise<CreatedInvitation> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const data = await prisma.invitation.create({
    data: {
      tokenHash: sha256(token),
      email: opts.email.toLowerCase().trim(),
      role: opts.role,
      teamId: opts.teamId ?? null,
      expiresAt,
      createdById: opts.createdById,
    },
  });

  return {
    token,
    link: `${process.env.FRONTEND_ORIGIN ?? "http://localhost:3000"}/invitation?token=${token}`,
    email: data.email,
    role: data.role,
    teamId: data.teamId,
    expiresAt: data.expiresAt,
  };
}

export interface ResolvedInvitation {
  id: string;
  email: string;
  role: InvitedRole;
  teamId: string | null;
  teamName: string | null;
  expiresAt: Date;
  valid: boolean;
  reason?: "USED" | "EXPIRED" | "NOT_FOUND";
}

/** Human-facing lookup — never exposes the token or its hash. */
export async function resolveInvitation(token: string): Promise<ResolvedInvitation> {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { team: { select: { id: true, name: true } } },
  });

  if (!invitation) {
    return { id: "", email: "", role: "MENTOR", teamId: null, teamName: null, expiresAt: new Date(0), valid: false, reason: "NOT_FOUND" };
  }

  if (invitation.usedAt) {
    return { id: invitation.id, email: invitation.email, role: invitation.role, teamId: invitation.teamId, teamName: invitation.team?.name ?? null, expiresAt: invitation.expiresAt, valid: false, reason: "USED" };
  }
  if (invitation.expiresAt < new Date()) {
    return { id: invitation.id, email: invitation.email, role: invitation.role, teamId: invitation.teamId, teamName: invitation.team?.name ?? null, expiresAt: invitation.expiresAt, valid: false, reason: "EXPIRED" };
  }

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    teamId: invitation.teamId,
    teamName: invitation.team?.name ?? null,
    expiresAt: invitation.expiresAt,
    valid: true,
  };
}

/**
 * Registers the invitee's account from a validated invitation, transactionally:
 * validates the token, creates the user with the invitation's role, joins the
 * invited team as CAPTAIN when applicable, and marks the invitation used.
 */
export async function completeInvitation(opts: {
  token: string;
  name: string;
  email: string;
  passwordHash: string;
}): Promise<{ role: InvitedRole; teamId: string | null }> {
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({ where: { tokenHash: sha256(opts.token) } });
    if (!invitation) throw new Error("INVALID_INVITATION");
    if (invitation.usedAt) throw new Error("INVITATION_USED");
    if (invitation.expiresAt < new Date()) throw new Error("INVITATION_EXPIRED");
    if (invitation.email.toLowerCase() !== opts.email.toLowerCase()) {
      throw new Error("INVITATION_EMAIL_MISMATCH");
    }

    const existing = await tx.user.findUnique({ where: { email: opts.email.toLowerCase() } });
    if (existing) throw new Error("EMAIL_IN_USE");

    const globalRole = invitation.role === "MENTOR" ? "MENTOR" : "PARTICIPANT";
    const user = await tx.user.create({
      data: {
        name: opts.name,
        email: opts.email.toLowerCase(),
        passwordHash: opts.passwordHash,
        role: globalRole,
      },
    });

    if (invitation.role === "CAPTAIN") {
      if (!invitation.teamId) throw new Error("INVITATION_MISSING_TEAM");
      const team = await tx.team.findUnique({ where: { id: invitation.teamId } });
      if (!team) throw new Error("INVITATION_TEAM_GONE");
      await tx.teamMember.create({
        data: { teamId: invitation.teamId, userId: user.id, teamRole: "CAPTAIN" },
      });
    }

    await tx.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } });

    return { role: invitation.role, teamId: invitation.teamId };
  });
}