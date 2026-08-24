import { Queue } from "bullmq";
import { env } from "../config/env.js";

/**
 * Gauntlet queue producer. The evaluator worker consumes this queue;
 * jobs carry only ids — workers load their own state.
 */
let queue: Queue | null = null;

export function gauntletQueue(): Queue {
  if (!queue) {
    queue = new Queue(env.EVALUATOR_QUEUE_NAME || "gauntlet", {
      connection: { url: env.REDIS_URL },
    });
  }
  return queue;
}
