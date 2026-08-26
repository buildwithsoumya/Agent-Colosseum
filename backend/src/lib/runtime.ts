import { onWorkers, type DurableObjectNamespace } from "../types/cf.js";

/**
 * Runtime detection + realtime event bus abstraction.
 *
 * Two runtimes share the same services:
 *  - Node (docker/local dev): src/server.ts registers the Socket.IO gateway as
 *    the publisher; events fan out via Redis pubsub.
 *  - Cloudflare Workers: a Durable Object (`RealtimeHub`) holds WebSocket
 *    clients; emit() forwards to it via stub.fetch. Redis/BullMQ unused there.
 */

export const runtime = {
  isWorkers: onWorkers(),
  isNode: !onWorkers(),
};

export interface RealtimeBus {
  publish(event: string, payload: unknown, room?: string): Promise<void>;
}

let hubNamespace: DurableObjectNamespace | undefined;

export function configureWorkerBus(ns: DurableObjectNamespace): void {
  hubNamespace = ns;
}

/** Fire-and-forget realtime emit usable from synchronous service code. */
export function emit(event: string, payload: unknown, room?: string): void {
  if (runtime.isWorkers) {
    if (!hubNamespace) return;
    const stub = hubNamespace.get(hubNamespace.idFromName("global"));
    stub
      .fetch("https://hub/publish", {
        method: "POST",
        body: JSON.stringify({ event, payload, room }),
      })
      .catch(() => {});
    return;
  }
  nodePublisher?.(event, payload, room);
}

/* ---- Node wiring (set once by src/server.ts so socket.io stays out of the Workers bundle) ---- */

let nodePublisher: ((event: string, payload: unknown, room?: string) => void) | null = null;

export function registerNodePublisher(
  fn: (event: string, payload: unknown, room?: string) => void,
): void {
  nodePublisher = fn;
}
