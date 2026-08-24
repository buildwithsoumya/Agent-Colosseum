import http from "node:http";
import { createApp } from "./app.js";
import { env, isProd } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { initGateway } from "./realtime/gateway.js";
import { startHeartbeat, snapshot } from "./services/eventEngine.js";
import { finalizeEvaluation } from "./services/gauntlet.js";
import { redisSubscriber } from "./lib/redis.js";
import { captureException } from "./lib/monitor.js";

async function main(): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);
  initGateway(server);

  // internal channel: evaluator → backend (score finalisation stays in the backend)
  await redisSubscriber.subscribe("internal");
  redisSubscriber.on("message", async (_ch, msg) => {
    try {
      const parsed = JSON.parse(msg) as { type: string; jobId?: string };
      if (parsed.type === "evaluation.completed" && parsed.jobId) {
        await finalizeEvaluation(parsed.jobId);
      }
    } catch (err) {
      captureException(err, { msg });
    }
  });

  startHeartbeat();

  // surface current phase in health endpoint
  app.get("/api/health", async (_req, res) => {
    let phase: string | null = null;
    try {
      phase = (await snapshot()).phase;
    } catch {
      /* event may not be seeded yet */
    }
    res.json({ ok: true, uptimeSec: Math.floor(process.uptime()), phase });
  });

  server.listen(env.BACKEND_PORT, () => {
    logger.info(`Agent Colosseum backend listening on :${env.BACKEND_PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (): Promise<void> => {
    logger.info("shutting down…");
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  process.on("unhandledRejection", (reason) => captureException(reason));
  process.on("uncaughtException", (err) => {
    captureException(err);
    if (isProd) process.exit(1);
  });
}

void main();
