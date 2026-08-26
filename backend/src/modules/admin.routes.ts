import { Router } from "express";
import { z } from "zod";
import { badRequest, conflict, forbidden, notFound, unprocessable } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { actionLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  advancePhase,
  announce,
  pauseEvent,
  resetDemoState,
  resumeEvent,
  revealTask,
  snapshot,
  startEvent,
} from "../services/eventEngine.js";
import { applyLedgerEntry, inCreditTransaction, announceBalance } from "../services/credits.js";
import { logAdminAction } from "../services/audit.js";
import { gauntletOverview } from "../services/gauntlet.js";
import { createInvitation } from "../services/invitations.js";
import { regenerateJoinCode } from "../services/teams.js";
import { env } from "../config/env.js";
import { InvitedRole, type Role } from "@ac/shared";

export const adminRouter = Router();
adminRouter.use(requireRole("ADMIN"));

/* ------------------------------------------------------------------ overview */

adminRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const snap = await snapshot();
    const [teamsCount, pendingPS, approvedPS, purchases, arenaRuns, casinoBets, jobs, recentAudit] = await Promise.all([
      prisma.team.count(),
      prisma.problemStatement.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      prisma.problemStatement.count({ where: { status: "APPROVED" } }),
      prisma.featurePurchase.count(),
      prisma.arenaRun.count(),
      prisma.casinoBet.count(),
      gauntletOverview(),
      prisma.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    res.json({
      phase: snap,
      stats: { teamsCount, pendingPS, approvedPS, purchases, arenaRuns, casinoBets },
      jobs,
      audit: recentAudit,
    });
  }),
);

/* -------------------------------------------------------------- event engine */

adminRouter.post("/event/start", asyncHandler(async (req, res) => {
  res.json({ snapshot: await startEvent(req.user!.id) });
}));

adminRouter.post("/event/advance", actionLimiter, asyncHandler(async (req, res) => {
  res.json({ snapshot: await advancePhase(req.user!.id) });
}));

adminRouter.post("/event/pause", asyncHandler(async (req, res) => {
  res.json({ snapshot: await pauseEvent(req.user!.id) });
}));

adminRouter.post("/event/resume", asyncHandler(async (req, res) => {
  res.json({ snapshot: await resumeEvent(req.user!.id) });
}));

adminRouter.post(
  "/event/reset-demo",
  asyncHandler(async (req, res) => {
    if (env.NODE_ENV === "production") throw unprocessable("Demo reset is disabled in production");
    await resetDemoState(req.user!.id);
    res.json({ ok: true });
  }),
);

adminRouter.post(
  "/tasks/reveal",
  actionLimiter,
  validate(z.object({ taskNumber: z.enum(["TASK_1", "TASK_2"]) })),
  asyncHandler(async (req, res) => {
    const { taskNumber } = req.body as { taskNumber: "TASK_1" | "TASK_2" };
    res.json(await revealTask(taskNumber, req.user!.id));
  }),
);

/* ------------------------------------------------------------- announcements */

adminRouter.post(
  "/announcements",
  actionLimiter,
  validate(z.object({ message: z.string().min(2).max(300), level: z.enum(["info", "success", "warning"]).default("info") })),
  asyncHandler(async (req, res) => {
    const body = req.body as { message: string; level: "info" | "success" | "warning" };
    res.status(201).json(await announce(body.message, body.level, req.user!.id));
  }),
);

/* -------------------------------------------------------- problem statements */

adminRouter.get(
  "/problems",
  asyncHandler(async (req, res) => {
    const status = (req.query.status as string | undefined)?.toUpperCase();
    const rows = await prisma.problemStatement.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        team: { select: { name: true } },
        track: { select: { key: true, name: true } },
      },
    });
    res.json({ submissions: rows });
  }),
);

adminRouter.post(
  "/problems/:id/review",
  validate(z.object({ decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]), note: z.string().max(2000).optional() })),
  asyncHandler(async (req, res) => {
    const psId = req.params.id;
    if (!psId) throw badRequest("Missing problem statement id");
    const ps = await prisma.problemStatement.findUnique({ where: { id: psId }, include: { team: true } });
    if (!ps) throw notFound("Problem statement not found");
    const body = req.body as { decision: string; note?: string };
    const status =
      body.decision === "APPROVE" ? "APPROVED" : body.decision === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED";
    const updated = await prisma.problemStatement.update({
      where: { id: ps.id },
      data: { status: status as never, mentorNote: body.note, reviewedById: req.user!.id, reviewedAt: new Date() },
    });
    void logAdminAction(req.user!.id, `problem.${body.decision.toLowerCase()}`, "problem_statement", ps.id);
    res.json({ problemStatement: updated });
  }),
);

/* ------------------------------------------------------------------- credits */

adminRouter.post(
  "/credits/adjust",
  actionLimiter,
  validate(z.object({ teamId: z.string(), amount: z.number().int().refine((n) => n !== 0), reason: z.string().min(3).max(200) })),
  asyncHandler(async (req, res) => {
    const { teamId, amount, reason } = req.body as { teamId: string; amount: number; reason: string };
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw notFound("Team not found");

    const balanceAfter = await inCreditTransaction(async (tx) => {
      const { balanceAfter } = await applyLedgerEntry(tx, teamId, {
        amount,
        type: "ADMIN_ADJUSTMENT",
        source: `Admin adjustment: ${reason}`,
        createdById: req.user!.id,
      });
      return balanceAfter;
    });

    announceBalance(teamId, balanceAfter, { amount, reason });
    void logAdminAction(req.user!.id, "credits.adjust", "team", teamId, { amount, reason });
    res.json({ teamId, balance: balanceAfter });
  }),
);

/** Admin team management: regenerate a team's join code on behalf of the captain. */
adminRouter.post(
  "/teams/:teamId/regenerate-code",
  actionLimiter,
  asyncHandler(async (req, res) => {
    const teamId2 = req.params.teamId;
    if (!teamId2) throw badRequest("Missing team id");
    const result = await prisma.$transaction((tx) => regenerateJoinCode(tx, teamId2));
    void logAdminAction(req.user!.id, "admin.team.regenerate_code", "team", teamId2);
    res.json({ ok: true, joinCode: result.joinCode });
  }),
);

/* ---------------------------------------------------------------- monitoring */

adminRouter.get(
  "/teams",
  asyncHandler(async (_req, res) => {
    const teams = await prisma.team.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        joinCodeUpdatedAt: true,
        creditBalance: true,
        track: { select: { name: true } },
        members: { select: { userId: true, user: { select: { name: true, email: true, role: true } }, teamRole: true } },
        problemStatements: { select: { title: true, status: true } },
        submissions: { select: { status: true, repoUrl: true } },
        casinoBets: { select: { tier: true, outcome: true } },
        _count: { select: { arenaRuns: true, purchases: true } },
      },
    });
    res.json({ teams });
  }),
);

adminRouter.get(
  "/arena",
  asyncHandler(async (_req, res) => {
    const runs = await prisma.arenaRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { game: { select: { name: true } }, team: { select: { name: true } } },
    });
    res.json({ runs });
  }),
);

adminRouter.get(
  "/casino",
  asyncHandler(async (_req, res) => {
    const bets = await prisma.casinoBet.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { team: { select: { name: true } } },
    });
    res.json({ bets });
  }),
);

adminRouter.get(
  "/audit",
  asyncHandler(async (_req, res) => {
    const actions = await prisma.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    res.json({ actions });
  }),
);

/* ------------------------------------------------------------- users & roles */

adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        memberships: {
          select: { teamId: true, teamRole: true, team: { select: { name: true } } },
        },
      },
    });
    res.json({
      users: users.map((u) => {
        const mem = u.memberships[0];
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          globalRole: u.role,
          status: u.status,
          createdAt: u.createdAt,
          team: mem ? { id: mem.teamId, name: mem.team.name, teamRole: mem.teamRole } : null,
        };
      }),
    });
  }),
);

/** Issues a privileged-role invitation (MENTOR or team CAPTAIN). ADMIN is never inviteable. */
adminRouter.post(
  "/invitations",
  actionLimiter,
  validate(z.object({ email: z.string().email(), role: InvitedRole, teamId: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const { email, role, teamId } = req.body as { email: string; role: "MENTOR" | "CAPTAIN"; teamId?: string };

    if (role === "CAPTAIN") {
      if (!teamId) throw badRequest("A team is required for a captain invitation");
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) throw notFound("Team not found");
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) throw conflict("A user with that email already exists");

    const inv = await createInvitation({ email, role, teamId, createdById: req.user!.id });
    void logAdminAction(req.user!.id, `invitation.${role.toLowerCase()}`, "user", email, { teamId: teamId ?? null });

    res.status(201).json({ invitation: { email, role, link: inv.link, expiresAt: inv.expiresAt } });
  }),
);

/** Deactivates a user (immediately blocks new sessions; existing sessions are ignored at auth). */
adminRouter.post(
  "/users/:id/deactivate",
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound("User not found");
    if (target.id === req.user!.id) throw forbidden("You cannot deactivate your own account");
    await prisma.user.update({ where: { id: target.id }, data: { status: "DEACTIVATED" } });
    await prisma.session.deleteMany({ where: { userId: target.id } });
    void logAdminAction(req.user!.id, "user.deactivate", "user", target.id, { email: target.email });
    res.json({ ok: true });
  }),
);

adminRouter.post(
  "/users/:id/activate",
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound("User not found");
    await prisma.user.update({ where: { id: target.id }, data: { status: "ACTIVE" } });
    void logAdminAction(req.user!.id, "user.activate", "user", target.id, { email: target.email });
    res.json({ ok: true });
  }),
);

/** Changes a user's global role to one the server permits. Escalation to ADMIN is restricted. */
adminRouter.post(
  "/users/:id/role",
  validate(z.object({ role: z.enum(["ADMIN", "MENTOR", "PARTICIPANT"]) })),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound("User not found");
    if (target.id === req.user!.id) throw forbidden("You cannot change your own role");

    const next = (req.body as { role: Role }).role;
    // Prevent the last admin from being demoted away from retaining an admin.
    const remainingAdmins = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (target.role === "ADMIN" && next !== "ADMIN" && remainingAdmins <= 1) {
      throw badRequest("Refusing to demote the last active admin");
    }

    await prisma.user.update({ where: { id: target.id }, data: { role: next } });
    // Role changed → invalidate the user's existing sessions so claims refresh.
    await prisma.session.deleteMany({ where: { userId: target.id } });
    void logAdminAction(req.user!.id, "user.role", "user", target.id, { from: target.role, to: next });
    res.json({ ok: true });
  }),
);

/** Assigns a member of the team as its captain (demoting any existing captain). */
adminRouter.post(
  "/teams/:teamId/captain",
  validate(z.object({ userId: z.string() })),
  asyncHandler(async (req, res) => {
    const { teamId } = req.params;
    if (!teamId) throw badRequest("Missing team id");
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw notFound("Team not found");

    const membership = await prisma.teamMember.findUnique({
      where: { userId: (req.body as { userId: string }).userId },
    });
    if (!membership || membership.teamId !== teamId) throw badRequest("That user is not a member of this team");

    await prisma.$transaction([
      prisma.teamMember.updateMany({ where: { teamId, teamRole: "CAPTAIN" }, data: { teamRole: "MEMBER" } }),
      prisma.teamMember.update({ where: { userId: membership.userId }, data: { teamRole: "CAPTAIN" } }),
    ]);
    void logAdminAction(req.user!.id, "team.set_captain", "team", teamId, {
      userId: membership.userId,
      teamRole: "CAPTAIN",
    });
    res.json({ ok: true });
  }),
);

/** Removes the team captain, leaving all members as plain MEMBERs. */
adminRouter.delete(
  "/teams/:teamId/captain",
  asyncHandler(async (req, res) => {
    const { teamId } = req.params;
    if (!teamId) throw badRequest("Missing team id");
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw notFound("Team not found");

    await prisma.teamMember.updateMany({ where: { teamId, teamRole: "CAPTAIN" }, data: { teamRole: "MEMBER" } });
    void logAdminAction(req.user!.id, "team.clear_captain", "team", teamId);
    res.json({ ok: true });
  }),
);
