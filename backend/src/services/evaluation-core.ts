/* Mirror of evaluator/src/core.ts — kept close to services so the API can run evaluations inline on Workers.
   Keep the two files in sync until packaging is unified. */
import { GameConfigSchema, SocketEvent } from "@ac/shared";
import { SimulatedEvaluator } from "../eval/simulated.js";
import type { TestCase } from "../eval/types.js";

import { prisma } from "../lib/prisma.js";

export type PublishFn = (event: string, payload: unknown) => void;

/**
 * Runtime-agnostic Gauntlet evaluation for one job.
 * Used by the BullMQ worker (Node) and inline by the API on Cloudflare Workers.
 */
export async function runEvaluation(jobId: string, publish: PublishFn): Promise<void> {
  const job = await prisma.evaluationJob.findUnique({
    where: { id: jobId },
    include: { submission: { include: { team: { include: { track: true } } } } },
  });
  if (!job || !job.submission) throw new Error(`job ${jobId} not found`);
  const track = job.submission.team.track;
  if (!track) throw new Error("team has no track");

  const eventRow = await prisma.event.findFirst();
  const config = GameConfigSchema.parse(eventRow?.config ?? {});
  const weights = {
    accuracy: config.gauntletWeights.accuracy,
    resilience: config.gauntletWeights.resilience,
    latency: config.gauntletWeights.latency,
    tokens: config.gauntletWeights.tokens,
  };

  const payloads = await prisma.gauntletPayload.findMany({
    where: { trackId: track.id },
    orderBy: { position: "asc" },
    take: Number(process.env.GAUNTLET_PAYLOAD_COUNT ?? 10),
  });
  const cases: TestCase[] = payloads.map((p) => ({
    id: p.id,
    kind: p.kind as TestCase["kind"],
    prompt: p.prompt,
    passCondition: p.passCondition,
  }));

  const purchases = await prisma.featurePurchase.findMany({
    where: { OR: [{ teamId: job.teamId }, { targetTeamId: job.teamId }] },
    include: { feature: true },
  });
  const defensiveBuffsOwned = purchases.filter(
    (p) => p.teamId === job.teamId && p.feature.category === "DEFENSIVE_BUFF",
  ).length;
  const sabotageLagPenaltyMs = Math.min(
    2500,
    purchases
      .filter((p) => p.targetTeamId === job.teamId && p.feature.name.toLowerCase().includes("lag"))
      .reduce((s) => s + 1200, 0),
  );
  const overclockBet = await prisma.casinoBet.findFirst({
    where: { teamId: job.teamId, tier: "OVERCLOCK", outcome: "WIN" },
  });

  publish(SocketEvent.GauntletProgress, {
    teamId: job.teamId,
    stage: "running",
    message: `Gauntlet firing ${cases.length} adversarial payloads`,
  });

  await prisma.evaluationJob.update({ where: { id: jobId }, data: { status: "PROCESSING" } });

  const evaluator = new SimulatedEvaluator({
    weights,
    payloadCount: cases.length || Number(process.env.GAUNTLET_PAYLOAD_COUNT ?? 10),
    defensiveBuffsOwned,
    sabotageLagPenaltyMs,
    tier1Keys: Boolean(overclockBet),
  });
  const output = await evaluator.evaluate(
    { jobId, submissionId: job.submissionId, teamId: job.teamId },
    cases,
  );

  let done = 0;
  for (const m of output.metrics) {
    done++;
    publish(SocketEvent.GauntletProgress, {
      teamId: job.teamId,
      stage: "payload",
      passed: m.passed,
      progress: `${done}/${output.metrics.length}`,
      message: m.passed ? `Payload ${done} survived` : `Payload ${done} broke the agent`,
    });
  }

  await prisma.evaluationResult.create({
    data: {
      jobId,
      teamId: job.teamId,
      accuracyScore: output.accuracyScore,
      resilienceScore: output.resilienceScore,
      latencyScore: output.latencyScore,
      tokenScore: output.tokenScore,
      gauntletScore: output.gauntletScore,
      payloadsTotal: output.metrics.length,
      payloadsPassed: output.metrics.filter((m: { passed: boolean }) => m.passed).length,
      rawMetrics: output.metrics as unknown as object[],
    },
  });

  await prisma.evaluationJob.update({
    where: { id: jobId },
    data: { status: "COMPLETED", finishedAt: new Date() },
  });
}
