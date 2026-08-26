import { onWorkers } from "../types/cf.js";

/**
 * Failed-join-attempt tracking (brute-force resistance).
 * Node → Redis; Workers → RealtimeHub DO doubles as the counter store.
 */
export interface JoinAttemptStore {
  count(userId: string): Promise<number>;
  increment(userId: string): Promise<void>;
  clear(userId: string): Promise<void>;
}

let hubNs: import("../types/cf.js").DurableObjectNamespace | undefined;
export function configureRateLimitDo(ns: import("../types/cf.js").DurableObjectNamespace): void {
  hubNs = ns;
}

async function doFetch(op: string, userId: string): Promise<string> {
  if (!hubNs) return "0";
  const stub = hubNs.get(hubNs.idFromName("join-limiter"));
  const res = await stub.fetch(`https://limiter/${op}?userId=${encodeURIComponent(userId)}`);
  return res.text();
}

export const joinAttempts: JoinAttemptStore = {
  async count(userId) {
    if (!onWorkers()) {
      const { redis } = await import("./redis.js");
      const v = await redis.get(`joinfail:${userId}`);
      return v ? Number(v) : 0;
    }
    return Number(await doFetch("count", userId));
  },
  async increment(userId) {
    if (!onWorkers()) {
      const { redis } = await import("./redis.js");
      const key = `joinfail:${userId}`;
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, 600);
      return;
    }
    await doFetch("increment", userId);
  },
  async clear(userId) {
    if (!onWorkers()) {
      const { redis } = await import("./redis.js");
      await redis.del(`joinfail:${userId}`);
      return;
    }
    await doFetch("clear", userId);
  },
};
