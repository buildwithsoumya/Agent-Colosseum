"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";

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
  socket: Socket | null;
  eventState: EventState | null;
  timer: TimerState | null;
  refreshEventState: () => Promise<void>;
  /** subscribe to a socket event; returns unsubscribe */
  on: (event: string, handler: (payload: unknown) => void) => () => void;
}

const Ctx = createContext<RealtimeValue>({
  socket: null,
  eventState: null,
  timer: null,
  refreshEventState: async () => {},
  on: () => () => {},
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [eventState, setEventState] = useState<EventState | null>(null);
  const [timer, setTimer] = useState<TimerState | null>(null);

  const refreshEventState = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/event/state`, { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as EventState & Record<string, unknown>;
        const { announcements, activity, stats, ...state } = data as never as {
          announcements?: unknown; activity?: unknown; stats?: unknown;
        } & EventState;
        void announcements; void activity; void stats;
        setEventState(state);
      }
    } catch {
      /* backend offline — UI shows waiting state */
    }
  }, []);

  useEffect(() => {
    void refreshEventState();
    const s = io(API_URL, { withCredentials: true, transports: ["websocket", "polling"] });
    setSocket(s);

    s.on("phase:changed", (payload) => {
      setEventState(payload as EventState);
      setTimer({
        phase: (payload as EventState).phase,
        secondsRemaining: (payload as EventState).secondsRemaining,
        endsAt: (payload as EventState).phaseEndsAt,
        paused: (payload as EventState).status === "PAUSED",
        serverTime: (payload as EventState).serverTime,
      });
    });
    s.on("timer:updated", (payload) => setTimer(payload as TimerState));

    return () => {
      s.disconnect();
    };
  }, [refreshEventState]);

  const value = useMemo<RealtimeValue>(
    () => ({
      socket,
      eventState,
      timer: timer ?? (eventState ? {
        phase: eventState.phase,
        secondsRemaining: eventState.secondsRemaining,
        endsAt: eventState.phaseEndsAt,
        paused: eventState.status === "PAUSED",
        serverTime: eventState.serverTime,
      } : null),
      refreshEventState,
      on: (event, handler) => {
        if (!socket) return () => {};
        socket.on(event, handler);
        return () => socket.off(event, handler);
      },
    }),
    [socket, eventState, timer, refreshEventState],
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
  return { label: format(endMs - now), seconds: Math.floor((endMs - now) / 1000) };
}

function format(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
