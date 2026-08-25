import { Router } from "express";
import { z } from "zod";
import { badRequest, notFound, unprocessable } from "../lib/errors.js";
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
import { createInvitation } from "./auth.routes.js";
import { applyLedgerEntry, inCreditTransaction, announceBalance } from "../services/credits.js";
import { logAdminAction } from "../services/audit.js";
import { gauntletOverview } from "../services/gauntlet.js";
import { env } from "../config/env.js";

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
        team: { select: { name: true, code: true } },
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

/* ---------------------------------------------------------------- monitoring */

adminRouter.get(
  "/teams",
  asyncHandler(async (_req, res) => {
    const teams = await prisma.team.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        creditBalance: true,
        track: { select: { name: true } },
        members: { select: { user: { select: { name: true, email: true } }, teamRole: true } },
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

/* ------------------------------------------------------------ user management */

const INVITABLE = z.enum(["MENTOR", "CAPTAIN"]);

/** Every account with global role, team and team-level role. */
adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        globalRole: true,
        status: true,
        createdAt: true,
        memberships: {
          select: { teamRole: true, team: { select: { id: true, name: true } } },
        },
      },
    });
    res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        globalRole: u.globalRole,
        status: u.status,
        createdAt: u.createdAt,
        team: u.memberships[0]
          ? { id: u.memberships[0].team.id, name: u.memberships[0].team.name, teamRole: u.memberships[0].teamRole }
          : null,
      })),
    });
  }),
);

/** Mint a single-use invitation. Raw token is returned exactly once and only hashed server-side. */
adminRouter.post(
  "/users/invite",
  actionLimiter,
  validate(z.object({ email: z.string().email(), role: INVITABLE, teamId: z.string().optional(), ttlHours: z.number().int().min(1).max(336).optional() })),
  asyncHandler(async (req, res) => {
    const body = req.body as { email: string; role: "MENTOR" | "CAPTAIN"; teamId?: string; ttlHours?: number };
    const invite = await createInvitation({
      email: body.email,
      role: body.role,
      teamId: body.teamId,
      createdById: req.user!.id,
      ttlHours: body.ttlHours,
    });
    void logAdminAction(req.user!.id, "user.invite", "invitation", invite.id, { email: body.email, role: body.role });
    // raw token lives ONLY in this response — the database stores its SHA-256
    res.status(201).json({ invitation: { id: invite.id, expiresAt: invite.expiresAt }, inviteUrl: `/invite/${invite.token}` });
  }),
);

adminRouter.get(
  "/users/invites",
  asyncHandler(async (_req, res) => {
    const invites = await prisma.invitation.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { team: { select: { name: true } } },
    });
    res.json({
      invitations: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        teamName: i.team?.name ?? null,
        status: i.expiresAt < new Date() && i.status === "PENDING" ? "EXPIRED" : i.status,
        expiresAt: i.expiresAt,
        usedAt: i.usedAt,
        createdAt: i.createdAt,
      })),
    });
  }),
);

adminRouter.post(
  "/users/invites/:id/revoke",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw badRequest("Missing invitation id");
    const updated = await prisma.invitation.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "REVOKED" },
    });
    if (updated.count === 0) throw notFound("No pending invitation with that id");
    void logAdminAction(req.user!.id, "user.invite.revoke", "invitation", id);
    res.json({ ok: true });
  }),
);

/** Deactivate / reactivate an account. Suspended users fail all authentication immediately. */
adminRouter.patch(
  "/users/:id/status",
  validate(z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) })),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { status } = req.body as { status: "ACTIVE" | "SUSPENDED" };
    if (!id) throw badRequest("Missing user id");
    if (id === req.user!.id) throw unprocessable("You cannot change your own account status");

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw notFound("User not found");
    if (target.globalRole === "ADMIN") throw unprocessable("Admin accounts cannot be modified here");

    await prisma.user.update({ where: { id }, data: { status } });
    if (status === "SUSPENDED") await prisma.session.deleteMany({ where: { userId: id } }); // kill live sessions now
    void logAdminAction(req.user!.id, `user.${status.toLowerCase()}`, "user", id, { email: target.email });
    res.json({ ok: true, status });
  }),
);

/**
 * Adjust a global role between PARTICIPANT and MENTOR.
 * Deliberately CANNOT grant or revoke ADMIN — admin provisioning stays manual/seeded.
 */
adminRouter.patch(
  "/users/:id/global-role",
  validate(z.object({ role: z.enum(["PARTICIPANT", "MENTOR"]) })),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { role } = req.body as { role: "PARTICIPANT" | "MENTOR" };
    if (!id) throw badRequest("Missing user id");
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw notFound("User not found");
    if (target.globalRole === "ADMIN") throw unprocessable("Admin accounts cannot be modified here");
    if (target.globalRole !== "PARTICIPANT" && target.globalRole !== "MENTOR") {
      throw unprocessable("Only participant/mentor roles can be changed here");
    }

    await prisma.user.update({ where: { id }, data: { globalRole: role } });
    void logAdminAction(req.user!.id, "user.global_role_change", "user", id, {
      email: target.email,
      from: target.globalRole,
      to: role,
    });
    res.json({ ok: true, globalRole: role });
  }),
);

/** Assign or remove the CAPTAIN team role within one specific team. */
adminRouter.post(
  "/teams/:teamId/captain",
  validate(z.object({ userId: z.string().min(1), action: z.enum(["ASSIGN", "REMOVE"]) })),
  asyncHandler(async (req, res) => {
    const teamId = req.params.teamId;
    if (!teamId) throw badRequest("Missing team id");
    const { userId, action } = req.body as { userId: string; action: "ASSIGN" | "REMOVE" };

    const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
    if (!membership) throw notFound("That user is not a member of this team");
    const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    await prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { teamRole: action === "ASSIGN" ? "CAPTAIN" : "MEMBER" },
    });
    void logAdminAction(req.user!.id, `team.captain_${action.toLowerCase()}`, "team", teamId, {
      user: target.email,
    });
    res.json({ ok: true, teamRole: action === "ASSIGN" ? "CAPTAIN" : "MEMBER" });
  }),
);

adminRouter.get(
  "/audit",
  asyncHandler(async (_req, res) => {
    const actions = await prisma.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    res.json({ actions });
  }),
);
