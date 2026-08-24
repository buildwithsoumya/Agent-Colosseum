import { SocketEvent, type CasinoTier } from "@ac/shared";
import { conflict, unprocessable } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { secureRandomFloat } from "../lib/rng.js";
import { announceBalance, applyLedgerEntry, inCreditTransaction } from "./credits.js";
import { computeGates, eventConfig, getEvent } from "./eventEngine.js";
import { recordActivity } from "./activity.js";
import { publish } from "../realtime/gateway.js";

/**
 * Casino Royale — every outcome is decided here on the server.
 * The client only ever animates the result it receives.
 *
 * PRD mechanics (figures configurable via Event.config):
 *  VAULT        100% safe — locks balance, no bonus/penalty.
 *  OVERCLOCK    fixed wager; win → Tier-1 API key perk; loss → 3s tool-lag penalty.
 *  HIGH_ROLLER  stakes a fraction of balance; win → ×2.5 Gauntlet multiplier (stake returned);
 *               loss → stake lost. Bust protection: casino losses can never push a
 *               team below the floor (300 CC default).
 */
export async function placeBet(teamId: string, tier: CasinoTier) {
  const event = await getEvent();
  const config = eventConfig(event);
  if (!computeGates(event.currentPhase).casinoOpen || event.status !== "RUNNING") {
    throw unprocessable("The Casino is only open during PHASE_3");
  }

  const existing = await prisma.casinoBet.findFirst({ where: { teamId } });
  if (existing) throw conflict("Your team has already locked in a wager");

  const bet = await inCreditTransaction(async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw unprocessable("Team not found");
    const preBalance = team.creditBalance;

    let outcome: "PUSH" | "WIN" | "LOSS" = "PUSH";
    let reward = 0;
    let multiplierAwarded = 1;
    let stakeRecorded = 0;
    let perk: Record<string, unknown> | null = null;

    if (tier === "VAULT") {
      perk = { type: "VAULT_LOCKED" };
    } else if (tier === "OVERCLOCK") {
      const wager = config.casinoOverclockWagerCc;
      if (preBalance < wager) throw unprocessable(`The Overclock requires ${wager} CC`);
      await applyLedgerEntry(tx, teamId, {
        amount: -wager,
        type: "CASINO_STAKE",
        source: "Casino Royale: The Overclock stake",
      });
      stakeRecorded = wager;
      const won = secureRandomFloat() < config.casinoOverclockWinChance;
      outcome = won ? "WIN" : "LOSS";
      perk = won ? { type: "TIER1_API_KEY", description: "High-throughput model keys for the Gauntlet" } : { type: "TOOL_LAG_3S", description: "+3s delay on tool executions during PHASE_4" };
      // stake is spent either way; no CC returns
    } else {
      const rawStake = Math.floor(preBalance * config.casinoHighRollerStakeFraction);
      // Bust protection caps the real deduction at balance − floor.
      const maxDeductible = Math.max(0, preBalance - config.bustProtectionFloorCc);
      const stake = Math.min(rawStake, maxDeductible);
      if (stake <= 0) throw unprocessable("Nothing left to wager at the High-Roller table");
      await applyLedgerEntry(tx, teamId, {
        amount: -stake,
        type: "CASINO_STAKE",
        source: "Casino Royale: The High-Roller stake",
      });
      stakeRecorded = stake;
      const won = secureRandomFloat() < config.casinoHighRollerWinChance;
      if (won) {
        outcome = "WIN";
        reward = stake;
        multiplierAwarded = config.casinoHighRollerMultiplier;
        perk = { type: "SCORE_MULTIPLIER", value: config.casinoHighRollerMultiplier };
        await applyLedgerEntry(tx, teamId, {
          amount: stake,
          type: "CASINO_REWARD",
          source: "Casino Royale: High-Roller stake returned",
        });
      } else {
        outcome = "LOSS";
      }
    }

    const postTeam = await tx.team.findUniqueOrThrow({ where: { id: teamId } });
    return tx.casinoBet.create({
      data: {
        teamId,
        tier,
        wagerAmount: stakeRecorded,
        outcome,
        preBalance,
        postBalance: postTeam.creditBalance,
        reward,
        multiplierAwarded,
        perk: (perk ?? undefined) as never,
      },
    });
  });

  const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId }, select: { name: true } });

  publish(SocketEvent.CasinoResult, {
    teamId,
    teamName: team.name,
    tier: bet.tier,
    outcome: bet.outcome,
    wager: bet.wagerAmount,
    postBalance: bet.postBalance,
    multiplierAwarded: bet.multiplierAwarded,
    at: bet.createdAt.toISOString(),
  });
  await recordActivity(
    "CASINO",
    casinoSummary(team.name, tier, bet.outcome),
    { tier: bet.tier, outcome: bet.outcome },
  );
  await announceBalance(teamId, bet.postBalance, {
    amount: bet.postBalance - bet.preBalance,
    reason: `Casino Royale (${tier.toLowerCase()})`,
  });
  return bet;
}

function casinoSummary(teamName: string, tier: CasinoTier, outcome: "PUSH" | "WIN" | "LOSS"): string {
  if (tier === "VAULT") return `${teamName} locked in the Vault`;
  if (tier === "OVERCLOCK") return outcome === "WIN" ? `${teamName} won The Overclock — Tier-1 keys unlocked` : `${teamName} lost The Overclock — tool lag incoming`;
  return outcome === "WIN" ? `${teamName} hit The High-Roller — ×2.5 multiplier!` : `${teamName} lost The High-Roller stake`;
}
