import { SocketEvent } from "@ac/shared";
import { prisma } from "../lib/prisma.js";
import { emit as publish } from "../lib/runtime.js";
import type { ScoreBreakdown } from "./scoring.js";

/** Persists a team's score and recomputes the full leaderboard ranking. */
export async function persistScore(teamId: string, breakdown: ScoreBreakdown): Promise<void> {
  await prisma.score.upsert({
    where: { teamId },
    create: {
      teamId,
      gauntletScore: breakdown.gauntletScore,
      casinoMultiplier: breakdown.casinoMultiplier,
      disciplineScore: breakdown.disciplineScore,
      finalScore: breakdown.finalScore,
      breakdown: breakdown as unknown as object,
    },
    update: {
      gauntletScore: breakdown.gauntletScore,
      casinoMultiplier: breakdown.casinoMultiplier,
      disciplineScore: breakdown.disciplineScore,
      finalScore: breakdown.finalScore,
      breakdown: breakdown as unknown as object,
    },
  });
  await recomputeRanks();
}

/**
 * Rebuilds LeaderboardEntry rows from Scores + live balances and assigns ranks.
 * Ordering: finalScore desc → gauntlet desc → creditBalance asc (spend discipline).
 */
export async function recomputeRanks(): Promise<void> {
  const scores = await prisma.score.findMany({ include: { team: { select: { id: true, creditBalance: true } } } });

  const ranked = [...scores].sort(
    (a, b) =>
      b.finalScore - a.finalScore ||
      b.gauntletScore - a.gauntletScore ||
      a.team.creditBalance - b.team.creditBalance,
  );

  for (let i = 0; i < ranked.length; i++) {
    const s = ranked[i]!;
    await prisma.leaderboardEntry.upsert({
      where: { teamId: s.teamId },
      create: {
        teamId: s.teamId,
        rank: i + 1,
        gauntletScore: s.gauntletScore,
        casinoMultiplier: s.casinoMultiplier,
        disciplineScore: s.disciplineScore,
        finalScore: s.finalScore,
        creditBalance: s.team.creditBalance,
      },
      update: {
        rank: i + 1,
        gauntletScore: s.gauntletScore,
        casinoMultiplier: s.casinoMultiplier,
        disciplineScore: s.disciplineScore,
        finalScore: s.finalScore,
        creditBalance: s.team.creditBalance,
      },
    });
  }

  await broadcastLeaderboard();
}

export async function getLeaderboard(limit?: number) {
  const entries = await prisma.leaderboardEntry.findMany({
    orderBy: { rank: "asc" },
    take: limit,
    include: { team: { select: { name: true, track: { select: { key: true, name: true } } } } },
  });
  return entries.map((e) => ({
    rank: e.rank,
    teamId: e.teamId,
    teamName: e.team.name,
    trackKey: e.team.track?.key ?? null,
    trackName: e.team.track?.name ?? null,
    gauntletScore: e.gauntletScore,
    casinoMultiplier: e.casinoMultiplier,
    disciplineScore: e.disciplineScore,
    finalScore: e.finalScore,
    creditBalance: e.creditBalance,
  }));
}

export async function broadcastLeaderboard(): Promise<void> {
  publish(SocketEvent.LeaderboardUpdated, { entries: await getLeaderboard() });
}
