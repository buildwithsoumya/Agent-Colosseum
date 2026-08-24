import { Redis } from "ioredis";
import { env } from "../config/env.js";

// Two lazily-created connections: one for commands, one dedicated to pubsub
// subscriptions (ioredis requires an idle connection per subscriber).
const create = (): Redis => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
  // eslint-disable-next-line no-var
  var __redisSub: Redis | undefined;
}

export const redis = globalThis.__redis ?? create();
export const redisSubscriber = globalThis.__redisSub ?? create();

if (env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
  globalThis.__redisSub = redisSubscriber;
}
