import { Router } from "express";
import { z } from "zod";
import { SocketEvent } from "@ac/shared";
import { conflict, notFound, unprocessable } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { secureRandomFloat } from "../lib/rng.js";
import { requireTeam } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { actionLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { eventConfig, getEvent, snapshot } from "../services/eventEngine.js";
import { announceBalance, applyLedgerEntry, inCreditTransaction } from "../services/credits.js";
import { publish } from "../realtime/gateway.js";
import { recordActivity } from "../services/activity.js";

export const arenaRouter = Router();

/** Arena state for the caller: games, runs used, eligibility. */
arenaRouter.get(
  "/state",
  requireTeam,
  asyncHandler(async (req, res) => {
    const snap = await snapshot();
    const config = eventConfig(await getEvent());
    const runs = await prisma.arenaRun.findMany({
      where: { teamId: req.membership!.teamId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { game: { select: { name: true } } },
    });
    const games = await prisma.arenaGame.findMany({ where: { active: true } });
    res.json({
      gates: snap.gates,
      maxRuns: config.arenaMaxRunsPerTeam,
      payoutCc: config.arenaPayoutCc,
      runsUsed: await prisma.arenaRun.count({ where: { teamId: req.membership!.teamId } }),
      runsRemaining:
        config.arenaMaxRunsPerTeam - (await prisma.arenaRun.count({ where: { teamId: req.membership!.teamId } })),
      history: runs.map((r) => ({
        id: r.id,
        game: r.game.name,
        result: r.result,
        rewardPaid: r.rewardPaid,
        at: r.createdAt,
      })),
      games,
    });
  }),
);

const PlayInput = z.object({ gameKey: z.string().min(1) });

/**
 * Play a run. The outcome is decided HERE on the server — the client only
 * renders the result it receives (skill-neutral demo mini-games).
 */
arenaRouter.post(
  "/play",
  actionLimiter,
  requireTeam,
  validate(PlayInput),
  asyncHandler(async (req, res) => {
    const snap = await snapshot();
    if (!snap.gates.arenaOpen || snap.status !== "RUNNING") {
      throw unprocessable("The Game Arena is only open during PHASE_1 and PHASE_2");
    }

    const game = await prisma.arenaGame.findUnique({ where: { key: (req.body as z.infer<typeof PlayInput>).gameKey } });
    if (!game || !game.active) throw notFound("Unknown mini-game");

    const config = eventConfig(await getEvent());
    const teamId = req.membership!.teamId;
    const used = await prisma.arenaRun.count({ where: { teamId } });
    if (used >= config.arenaMaxRunsPerTeam) {
      throw unprocessable(`All ${config.arenaMaxRunsPerTeam} arena runs are used up`);
    }
    const lastRun = await prisma.arenaRun.findFirst({
      where: { teamId },
      orderBy: { createdAt: "desc" },
    });
    // one member plays at a time — a team cannot fire concurrent runs
    if (lastRun && Date.now() - lastRun.createdAt.getTime() < 5_000) {
      throw conflict("A team member is already playing — wait a few seconds");
    }

    // skill-neutral demo resolution; real station judging replaces this via admin tools
    const won = secureRandomFloat() < 0.55;
    const reward = won ? config.arenaPayoutCc : 0;

    const balanceAfter = await inCreditTransaction(async (tx) => {
      let balance = (
        await tx.team.findUniqueOrThrow({ where: { id: teamId }, select: { creditBalance: true } })
      ).creditBalance;
      if (reward > 0) {
        ({ balanceAfter: balance } = await applyLedgerEntry(tx, teamId, {
          amount: reward,
          type: "ARENA_REWARD",
          source: `Game Arena: ${game.name}`,
          createdById: req.user!.id,
        }));
      }
      await tx.arenaRun.create({
        data: { teamId, gameId: game.id, playedById: req.user!.id, result: won ? "WIN" : "LOSS", rewardPaid: reward },
      });
      return balance;
    });

    publish(
      SocketEvent.ArenaResult,
      { teamId, game: game.name, result: won ? "WIN" : "LOSS", reward, balance: balanceAfter, at: new Date().toISOString() },
      `team:${teamId}`,
    );
    if (won) {
      await recordActivity("ARENA", `${await teamName(teamId)} won ${reward} CC in the Game Arena`);
      announceBalance(teamId, balanceAfter, { amount: reward, reason: `Arena win: ${game.name}` });
    }
    res.json({ result: won ? "WIN" : "LOSS", reward, balance: balanceAfter });
  }),
);

async function teamName(teamId: string): Promise<string> {
  const t = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
  return t?.name ?? "A team";
}
