import { SocketEvent } from "@ac/shared";
import { conflict, unprocessable } from "../lib/errors.js";
import { onWorkers } from "../types/cf.js";
import { prisma } from "../lib/prisma.js";
import { gauntletQueue } from "../lib/queue.js";
import { emit as publish } from "../lib/runtime.js";
import { recordActivity } from "./activity.js";
import { computeGates, eventConfig, getEvent } from "./eventEngine.js";
import { persistScore } from "./leaderboard.js";
import { computeFinalScore, type ScoreBreakdown } from "./scoring.js";

/**
 * Gauntlet orchestration (backend side):
 * submission lock → BullMQ queue → evaluator worker → internal completion
 * message → ScoringService → leaderboard broadcast.
 */
export async function lockSubmissionAndEnqueue(teamId: string) {
  const event = await getEvent();
  if (!computeGates(event.currentPhase).submissionsOpen) {
    throw unprocessable("Submissions are only open during PHASE_4");
  }
  const submission = await prisma.submission.findUnique({ where: { teamId } });
  if (!submission?.repoUrl) throw unprocessable("Add your repository or drive link before locking");
  if (submission.status !== "OPEN") throw conflict("Submission already locked");

  const job = await prisma.evaluationJob.create({
    data: { submissionId: submission.id, teamId },
  });

  await prisma.submission.update({
    where: { id: submission.id },
    data: { status: "EVALUATING", lockedAt: new Date() },
  });
  await prisma.evaluationJob.update({ where: { id: job.id }, data: { status: "PROCESSING", startedAt: new Date() } });

  if (onWorkers()) {
    // Cloudflare: no BullMQ — run the simulated evaluation in this request's context.
    // The route registers the promise with waitUntil so it survives the response.
    const { runEvaluation } = await import("./evaluation-core.js");
    void (async () => {
      try {
        await runEvaluation(
          job.id,
          (event: string, payload: unknown) => {
            void publish(event, payload);
          },
        );
      } catch (err) {
        await prisma.evaluationJob.update({
          where: { id: job.id },
          data: { status: "FAILED", error: String(err), finishedAt: new Date() },
        }).catch(() => {});
      }
    })();
  } else {
    await gauntletQueue().add(
      "evaluate",
      { jobId: job.id, submissionId: submission.id, teamId },
      { jobId: job.id, attempts: 2, backoff: { type: "fixed", delay: 2000 }, removeOnComplete: 50 },
    );
  }

  publish(SocketEvent.SubmissionUpdated, { teamId, status: "EVALUATING" }, `team:${teamId}`);
  publish(SocketEvent.SubmissionUpdated, { teamId, status: "EVALUATING" });
  publish(SocketEvent.GauntletProgress, {
    teamId,
    stage: "queued",
    message: "Agent entered the Colosseum — evaluation queued",
  });
  await recordActivity("GAUNTLET", `${await teamName(teamId)} entered the Gauntlet`);
  return job;
}

/** Called when the evaluator reports completion over the internal Redis channel. */
export async function finalizeEvaluation(jobId: string): Promise<void> {
  const job = await prisma.evaluationJob.findUnique({
    where: { id: jobId },
    include: { result: true, submission: true },
  });
  if (!job || !job.result) return;
  const config = eventConfig(await getEvent());

  const team = await prisma.team.findUniqueOrThrow({ where: { id: job.teamId } });
  const bestMultiplierBet = await prisma.casinoBet.findFirst({
    where: { teamId: job.teamId, multiplierAwarded: { gt: 1 } },
    orderBy: { multiplierAwarded: "desc" },
  });

  const perkNotes: string[] = [];
  const bets = await prisma.casinoBet.findMany({ where: { teamId: job.teamId } });
  for (const bet of bets) {
    const perk = bet.perk as { type?: string } | null;
    if (bet.outcome === "WIN") {
      if (perk?.type === "TIER1_API_KEY") perkNotes.push("Tier-1 API keys active");
      if (perk?.type === "TOOL_LAG_3S") perkNotes.push("Tool lag penalty applied");
    }
    if (bet.outcome === "LOSS" && perk?.type === "TOOL_LAG_3S") perkNotes.push("Tool lag penalty applied");
  }

  const breakdown: ScoreBreakdown = computeFinalScore(
    {
      teamName: team.name,
      gauntletScoreValue: job.result.gauntletScore,
      casinoMultiplier: bestMultiplierBet?.multiplierAwarded ?? 1,
      finalBalanceAtPhaseEnd: team.balanceSnapshotAtCasinoClose ?? team.creditBalance,
      payloadsPassed: job.result.payloadsPassed,
      payloadsTotal: job.result.payloadsTotal,
      perkNotes,
    },
    config,
  );

  await prisma.evaluationJob.update({
    where: { id: jobId },
    data: { status: "COMPLETED", finishedAt: new Date() },
  });
  await prisma.submission.update({ where: { id: job.submissionId }, data: { status: "EVALUATED" } });
  await persistScore(job.teamId, breakdown);

  publish(SocketEvent.GauntletCompleted, { teamId: job.teamId, finalScore: breakdown.finalScore });
  publish(SocketEvent.SubmissionUpdated, { teamId: job.teamId, status: "EVALUATED" }, `team:${job.teamId}`);
  await recordActivity("SCORE", `${team.name} scored ${breakdown.finalScore} points`, {
    rank: undefined,
    breakdown: {
      gauntlet: breakdown.gauntletScore,
      multiplier: breakdown.casinoMultiplier,
      discipline: breakdown.disciplineScore,
    },
  });
}

async function teamName(teamId: string): Promise<string> {
  const t = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
  return t?.name ?? "A team";
}

export async function gauntletStatusForTeam(teamId: string) {
  const submission = await prisma.submission.findUnique({
    where: { teamId },
    include: {
      jobs: {
        orderBy: { queuedAt: "desc" },
        take: 1,
        include: { result: true },
      },
    },
  });
  const score = await prisma.score.findUnique({ where: { teamId } });
  return { submission, job: submission?.jobs[0] ?? null, score };
}

/** Used by the health endpoint and admin monitor. */
export async function gauntletOverview() {
  const jobs = await prisma.evaluationJob.findMany({
    orderBy: { queuedAt: "desc" },
    take: 25,
    include: { result: true },
  });
  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  const nameById = new Map(teams.map((t) => [t.id, t.name]));
  return jobs.map((j) => ({
    jobId: j.id,
    teamName: nameById.get(j.teamId) ?? j.teamId,
    status: j.status,
    queuedAt: j.queuedAt,
    finishedAt: j.finishedAt,
    gauntletScore: j.result?.gauntletScore ?? null,
    payloadsPassed: j.result ? `${j.result.payloadsPassed}/${j.result.payloadsTotal}` : null,
  }));
}
