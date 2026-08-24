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
      <div className="rounded-2xl border border-line bg-white px-5 py-4">
        <p className="text-sm text-ink-soft">Connecting to the arena…</p>
      </div>
    );
  }

  const statusTone =
    eventState.status === "RUNNING" ? "good" : eventState.status === "PAUSED" ? "warn" : eventState.status === "ENDED" ? "ink" : "neutral";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{eventState.phase.replace("PHASE_", "Phase ")}</Badge>
          <Badge tone={statusTone as never}>{eventState.status}</Badge>
          <span className="text-sm font-bold tracking-tight">{eventState.phaseLabel}</span>
        </div>
        <p className="mt-1 truncate text-xs text-ink-soft">{eventState.objective}</p>
      </div>
      <div className="shrink-0 text-left sm:text-right">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={seconds}
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.15 }}
            className={clsx(
              "font-mono text-3xl font-bold tabular-nums",
              eventState.status === "PAUSED" && "text-amber-600",
              seconds >= 0 && seconds <= 60 && "text-bad",
            )}
          >
            {seconds >= 0
              ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
              : "--:--"}
          </motion.div>
        </AnimatePresence>
        <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400">
          {eventState.status === "PAUSED" ? "paused by admin" : "time remaining"}
        </p>
      </div>
    </div>
  );
}
