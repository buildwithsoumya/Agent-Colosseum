"use client";

import { useRealtime } from "@/lib/realtime";
import { useCountdown } from "@/lib/realtime";
import { Badge } from "@/components/ui/badge";
import { clsx } from "@/lib/clsx";
import { motion, AnimatePresence } from "framer-motion";

export function PhaseHeader() {
  const { eventState } = useRealtime();
  const { seconds } = useCountdown();

  if (!eventState) {
    return (
      <div className="module rounded-[0.25rem] px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          <span className="mr-2 text-accent">&gt;</span> Connecting to the arena…
        </p>
      </div>
    );
  }

  const statusTone =
    eventState.status === "RUNNING" ? "good" : eventState.status === "PAUSED" ? "warn" : eventState.status === "ENDED" ? "ink" : "neutral";

  return (
    <div className="module flex flex-col gap-3 rounded-[0.25rem] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{eventState.phase.replace("PHASE_", "PHASE ")}</Badge>
          <Badge tone={statusTone as never}>
            <span
              className={clsx(
                "inline-block h-1.5 w-1.5",
                eventState.status === "RUNNING" && "bg-good led-pulse",
                eventState.status === "PAUSED" && "bg-warn led-pulse",
                eventState.status === "ENDED" && "bg-ink-soft",
              )}
            />
            {eventState.status}
          </Badge>
          <span className="font-display text-sm font-semibold tracking-tight text-ink">
            {eventState.phaseLabel}
          </span>
        </div>
        <p className="mt-1.5 truncate text-xs text-ink-soft">{eventState.objective}</p>
      </div>
      <div className="shrink-0 border-l border-line pl-4 text-left sm:text-right">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={seconds}
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.15 }}
            className={clsx(
              "font-mono text-3xl font-bold tabular-nums text-ink",
              eventState.status === "PAUSED" && "text-warn",
              seconds >= 0 && seconds <= 60 && "text-bad",
            )}
          >
            {seconds >= 0
              ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
              : "--:--"}
          </motion.div>
        </AnimatePresence>
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
          {eventState.status === "PAUSED" ? "paused by admin" : "time remaining"}
        </p>
      </div>
    </div>
  );
}
