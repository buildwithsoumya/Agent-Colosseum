import { Router } from "express";
import { conflict, notFound, unprocessable } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { requireTeam } from "../middleware/auth.js";
import { actionLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { snapshot } from "../services/eventEngine.js";
import { announceBalance, applyLedgerEntry, inCreditTransaction } from "../services/credits.js";

export const tasksRouter = Router();

/**
 * Tasks for the caller's track with per-team unlock state.
 * PRD: only Task 1 carries a selection cost; Task 2 unlocks free at reveal.
 */
tasksRouter.get(
  "/me",
  requireTeam,
  asyncHandler(async (req, res) => {
    const teamId = req.membership!.teamId;
    const team = await prisma.team.findUniqueOrThrow({
      where: { id: teamId },
      select: { trackId: true, track: { select: { task1UnlockCost: true } } },
    });
    if (!team.trackId) throw unprocessable("Select a track first");

    const tasks = await prisma.task.findMany({
      where: { trackId: team.trackId },
      orderBy: { number: "asc" },
      include: {
        _count: { select: { unlocks: { where: { teamId } } } },
      },
    });

    res.json({
      tasks: tasks.map((t) => {
        const revealed = t.state !== "LOCKED";
        const paidUnlock = t.number === "TASK_2" || t._count.unlocks > 0;
        return {
          id: t.id,
          number: t.number,
          title: t.title,
          body: t.body,
          criteria: t.criteria,
          state: t.state,
          unlockCost: t.number === "TASK_1" ? team.track!.task1UnlockCost : null,
          locked: !revealed || !paidUnlock,
        };
      }),
    });
  }),
);

/** Pay the selection cost to unlock Task 1 (PRD credit workflow step). */
tasksRouter.post(
  "/:id/unlock",
  actionLimiter,
  requireTeam,
  asyncHandler(async (req, res) => {
    const snap = await snapshot();
    if (!snap.gates.taskUnlockOpen) {
      throw unprocessable("Task unlocks are only available during PHASE_1");
    }
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { track: true } });
    if (!task) throw notFound("Unknown task");
    if (task.state === "LOCKED") throw unprocessable("That task has not been revealed yet");
    if (task.number !== "TASK_1") throw unprocessable("Only Task 1 requires an unlock");

    const teamId = req.membership!.teamId;
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId }, select: { trackId: true } });
    if (team.trackId !== task.trackId) throw unprocessable("That task belongs to another track");

    const already = await prisma.taskUnlock.findUnique({
      where: { teamId_taskId: { teamId, taskId: task.id } },
    });
    if (already) throw conflict("Your team has already unlocked this task");

    const balanceAfter = await inCreditTransaction(async (tx) => {
      const { balanceAfter } = await applyLedgerEntry(tx, teamId, {
        amount: -task.track.task1UnlockCost,
        type: "TASK_UNLOCK",
        source: `Task 1 selection: ${task.title}`,
        createdById: req.user!.id,
      });
      await tx.taskUnlock.create({ data: { teamId, taskId: task.id, costPaid: task.track.task1UnlockCost } });
      return balanceAfter;
    });

    announceBalance(teamId, balanceAfter, {
      amount: -task.track.task1UnlockCost,
      reason: `Unlocked ${task.title}`,
    });
    res.json({ unlocked: true, balance: balanceAfter });
  }),
);
