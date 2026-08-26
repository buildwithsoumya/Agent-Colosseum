/**
 * Minimal structural types for Cloudflare Workers runtime features used here.
 * Hand-rolled to avoid clashing with DOM/Node lib types.
 */
export interface DurableObjectId {
  toString(): string;
}
export interface DurableObjectStub {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}
export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}
export interface WorkerWebSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  accept(): void;
  addEventListener(type: "close" | "error", cb: () => void): void;
  addEventListener(type: "message", cb: (ev: { data: unknown }) => void): void;
}
export interface WebSocketPair {
  0: WorkerWebSocket;
  1: WorkerWebSocket;
}

declare global {
  // Provided by the Workers runtime at execution time.
  // eslint-disable-next-line no-var
  var WebSocketPair: { new (): WebSocketPair };
}

export function onWorkers(): boolean {
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return nav?.userAgent === "Cloudflare-Workers";
}
