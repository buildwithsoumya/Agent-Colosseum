"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "./api";

/**
 * Realtime client.
 * - Cloudflare Workers backend: native WebSocket to /ws carrying {event, payload} frames.
 * - Node/docker backend (dev): Socket.IO fallback over the same subscription API.
 *
 * Pages only ever use `on()` / state — the transport is abstracted here.
 */

interface EventState {
  phase: string;
  phaseLabel: string;
  objective: string;
  status: "SETUP" | "RUNNING" | "PAUSED" | "ENDED";
  phaseEndsAt: string | null;
  serverTime: string;
  secondsRemaining: number;
  gates: Record<string, boolean>;
}

interface TimerState {
  phase: string;
  secondsRemaining: number;
  endsAt: string | null;
  paused: boolean;
  serverTime: string;
}

interface RealtimeValue {
  eventState: EventState | null;
  timer: TimerState | null;
  /** true once the realtime transport has opened at least once */
  connected: boolean;
  refreshEventState: () => Promise<void>;
  on: (event: string, handler: (payload: unknown) => void) => () => void;
}

const Ctx = createContext<RealtimeValue>({
  eventState: null,
  timer: null,
  connected: false,
  refreshEventState: async () => {},
  on: () => () => {},
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [eventState, setEventState] = useState<EventState | null>(null);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [connected, setConnected] = useState(false);

  const handlers = useRef(new Map<string, Set<(payload: unknown) => void>>());
  const socketRef = useRef<{ close(): void } | null>(null);

  const dispatch = useCallback((event: string, payload: unknown) => {
    if (event === "phase:changed") setEventState(payload as EventState);
    if (event === "timer:updated") setTimer(payload as TimerState);
    handlers.current.get(event)?.forEach((h) => h(payload));
  }, []);

  const refreshEventState = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/event/state`, { credentials: "include" });
      if (res.ok) setEventState((await res.json()) as EventState);
    } catch {
      /* backend offline */
    }
  }, []);

  useEffect(() => {
    void refreshEventState();

    let cleanup = (): void => {};
    let cancelled = false;

    const useWs = API_URL.includes("workers.dev") || API_URL.includes("/ws");

    if (useWs) {
      // ---- Workers transport: native WebSocket with backoff reconnect ----
      const wsUrl = `${API_URL.replace(/^http/, "ws").replace(/\/$/, "")}/ws`;
      let ws: WebSocket | null = null;
      let retry = 0;
      let closed = false;

      const connect = (): void => {
        if (cancelled) return;
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;
        ws.onmessage = (msg) => {
          try {
            const frame = JSON.parse(msg.data as string) as { event: string; payload: unknown };
            dispatch(frame.event, frame.payload);
          } catch {}
        };
        ws.onopen = () => {
          retry = 0;
          setConnected(true);
        };
        ws.onclose = () => {
          setConnected(false);
          if (!closed && retry < 10) {
            retry++;
            setTimeout(connect, Math.min(8000, 400 * 2 ** retry));
          }
        };
      };
      connect();

      cleanup = () => {
        closed = true;
        ws?.close();
        socketRef.current = null;
      };
    } else {
      // ---- Node/dev transport: Socket.IO ----
      void import("socket.io-client").then(({ io }) => {
        if (cancelled) return;
        const s = io(API_URL, { withCredentials: true, transports: ["websocket", "polling"] });
        socketRef.current = s;
        s.on("connect", () => setConnected(true));
        s.on("disconnect", () => setConnected(false));
        s.onAny((event: string, payload: unknown) => dispatch(event, payload));
        cleanup = () => {
          s.disconnect();
          socketRef.current = null;
        };
      });
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [dispatch, refreshEventState]);

  const on = useCallback((event: string, handler: (payload: unknown) => void) => {
    let set = handlers.current.get(event);
    if (!set) {
      set = new Set();
      handlers.current.set(event, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }, []);

  const value = useMemo<RealtimeValue>(
    () => ({
      eventState,
      connected,
      timer:
        timer ??
        (eventState
          ? {
              phase: eventState.phase,
              secondsRemaining: eventState.secondsRemaining,
              endsAt: eventState.phaseEndsAt,
              paused: eventState.status === "PAUSED",
              serverTime: eventState.serverTime,
            }
          : null),
      refreshEventState,
      on,
    }),
    [eventState, connected, timer, refreshEventState, on],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRealtime = () => useContext(Ctx);

/** Live countdown derived from server truth (endsAt), corrected by drift. */
export function useCountdown(): { label: string; seconds: number } {
  const { timer } = useRealtime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  if (!timer?.endsAt || timer.paused) return { label: timer?.paused ? "PAUSED" : "--:--", seconds: -1 };
  const endMs = new Date(timer.endsAt).getTime();
  const diff = endMs - now;
  const s = Math.max(0, Math.floor(diff / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return { label: `${mm}:${ss}`, seconds: s };
}
