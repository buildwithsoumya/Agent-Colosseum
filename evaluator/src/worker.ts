import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { GameConfigSchema, SocketEvent } from "@ac/shared";
import { Redis } from "ioredis";
import type { TestCase } from "./types.js";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });

const QUEUE_NAME = process.env.EVALUATOR_QUEUE_NAME || "gauntlet";
const CONCURRENCY = Number(process.env.EVALUATOR_CONCURRENCY ?? 2);
const MODE = process.env.EVALUATOR_MODE || "simulated";
const PAYLOAD_COUNT = Number(process.env.GAUNTLET_PAYLOAD_COUNT ?? 10);

function publishRealtime(event: string, payload: unknown): void {
  void redis.publish("realtime", JSON.stringify({ event, payload }));
}

async function processJob(jobId: string, teamId: string): Promise<void> {
  const job = await prisma.evaluationJob.findUnique({
    where: { id: jobId },
    include: { submission: { include: { team: { include: { track: true } } } } },
  });
  if (!job || !job.submission) throw new Error(`job ${jobId} not found`);

  const track = job.submission.team.track;
  if (!track) throw new Error("team has no track");

  // event config drives weights
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
    take: PAYLOAD_COUNT,
  });
  const cases: TestCase[] = payloads.map((p) => ({
    id: p.id,
    kind: p.kind as TestCase["kind"],
    prompt: p.prompt,
    passCondition: p.passCondition,
  }));

  // real event state influences the simulation
  const purchases = await prisma.featurePurchase.findMany({
    where: { OR: [{ teamId }, { targetTeamId: teamId }] },
    include: { feature: true },
  });
  const defensiveBuffsOwned = purchases.filter(
    (p) => p.teamId === teamId && p.feature.category === "DEFENSIVE_BUFF",
  ).length;
  const sabotageLagPenaltyMs = Math.min(
    2500,
    purchases
      .filter((p) => p.targetTeamId === teamId && p.feature.name.toLowerCase().includes("lag"))
      .reduce((s) => s + 1200, 0),
  );
  const overclockBet = await prisma.casinoBet.findFirst({
    where: { teamId, tier: "OVERCLOCK", outcome: "WIN" },
  });

  publishRealtime(SocketEvent.GauntletProgress, {
    teamId,
    stage: "running",
    message: `Gauntlet firing ${cases.length} adversarial payloads`,
  });

  const evaluator = new (await import("./evaluators/simulated.js")).SimulatedEvaluator({
    weights,
    payloadCount: PAYLOAD_COUNT,
    defensiveBuffsOwned,
    sabotageLagPenaltyMs,
    tier1Keys: Boolean(overclockBet),
  });

  await prisma.evaluationJob.update({ where: { id: jobId }, data: { status: "PROCESSING" } });

  const output = await evaluator.evaluate({ jobId, submissionId: job.submissionId, teamId }, cases);

  // per-payload progress for spectator/participant UIs
  let done = 0;
  for (const m of output.metrics) {
    done++;
    publishRealtime(SocketEvent.GauntletProgress, {
      teamId,
      stage: "payload",
      passed: m.passed,
      progress: `${done}/${output.metrics.length}`,
      message: m.passed ? `Payload ${done} survived` : `Payload ${done} broke the agent`,
    });
  }

  await prisma.evaluationResult.create({
    data: {
      jobId,
      teamId,
      accuracyScore: output.accuracyScore,
      resilienceScore: output.resilienceScore,
      latencyScore: output.latencyScore,
      tokenScore: output.tokenScore,
      gauntletScore: output.gauntletScore,
      payloadsTotal: output.metrics.length,
      payloadsPassed: output.metrics.filter((m) => m.passed).length,
      rawMetrics: output.metrics as unknown as object[],
    },
  });

  await prisma.evaluationJob.update({
    where: { id: jobId },
    data: { status: "COMPLETED", finishedAt: new Date() },
  });

  // backend finalises scoring + leaderboard (business rules stay in one place)
  await redis.publish("internal", JSON.stringify({ type: "evaluation.completed", jobId }));
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { jobId, teamId } = job.data as { jobId: string; teamId: string };
    try {
      await processJob(jobId, teamId);
    } catch (err) {
      await prisma.evaluationJob.update({
        where: { id: jobId },
        data: { status: "FAILED", error: String(err), finishedAt: new Date() },
      }).catch(() => {});
      throw err;
    }
  },
  { connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" }, concurrency: CONCURRENCY },
);

worker.on("completed", (job) => console.log(`[evaluator:${MODE}] job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`[evaluator:${MODE}] job ${job?.id} failed:`, err.message));

console.log(`Evaluator worker ready — queue=${QUEUE_NAME} mode=${MODE} concurrency=${CONCURRENCY}`);

const shutdown = async (): Promise<void> => {
  await worker.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
