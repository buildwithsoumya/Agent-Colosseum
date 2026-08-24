import { Router } from "express";
import { z } from "zod";
import type { CasinoTier } from "@ac/shared";
import { prisma } from "../lib/prisma.js";
import { requireTeam } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { actionLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { eventConfig, getEvent, snapshot } from "../services/eventEngine.js";
import { placeBet } from "../services/casino.js";

export const casinoRouter = Router();

/** Tier configuration + the team's current wager state. */
casinoRouter.get(
  "/state",
  requireTeam,
  asyncHandler(async (req, res) => {
    const snap = await snapshot();
    const config = eventConfig(await getEvent());
    const myBet = await prisma.casinoBet.findFirst({
      where: { teamId: req.membership!.teamId },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      gates: snap.gates,
      tiers: {
        VAULT: { risk: "0% risk", description: "Lock in your current balance. No bonus, no penalty.", wager: 0 },
        OVERCLOCK: {
          risk: "50 / 50 coin flip",
          wager: `${config.casinoOverclockWagerCc} CC fixed`,
          win: "Tier-1 high-throughput API keys for PHASE_4",
          loss: "+3s tool execution lag during PHASE_4",
        },
        HIGH_ROLLER: {
          risk: `${Math.round(config.casinoHighRollerWinChance * 100)}% win`,
          wager: `${Math.round(config.casinoHighRollerStakeFraction * 100)}% of current balance`,
          win: `×${config.casinoHighRollerMultiplier} multiplier on all Gauntlet points`,
          loss: "35% of your credits deducted immediately",
        },
      },
      bustFloor: config.bustProtectionFloorCc,
      myBet,
      balance: (
        await prisma.team.findUniqueOrThrow({
          where: { id: req.membership!.teamId },
          select: { creditBalance: true },
        })
      ).creditBalance,
    });
  }),
);

casinoRouter.post(
  "/bet",
  actionLimiter,
  requireTeam,
  validate(z.object({ tier: z.enum(["VAULT", "OVERCLOCK", "HIGH_ROLLER"]) })),
  asyncHandler(async (req, res) => {
    const bet = await placeBet(req.membership!.teamId, (req.body as { tier: CasinoTier }).tier);
    res.status(201).json({ bet });
  }),
);
