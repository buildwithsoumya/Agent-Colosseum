"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { useCountdown, useRealtime } from "@/lib/realtime";
import { PHASE_META } from "@ac/shared";

interface Entry {
  rank: number;
  teamId: string;
  teamName: string;
  trackName: string | null;
  gauntletScore: number;
  casinoMultiplier: number;
  finalScore: number;
  creditBalance: number;
}

interface Activity {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
}

export default function SpectatorPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [announcement, setAnnouncement] = useState<{ message: string; level: string } | null>(null);
  const { eventState, on, socket } = useRealtime();
  const countdown = useCountdown();

  useEffect(() => {
    api.get<{ entries: Entry[] }>("/api/leaderboard").then((d) => setEntries(d.entries)).catch(() => {});
    api.get<{ activity: Activity[] }>("/api/event/activity").then((d) => setActivity(d.activity)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const un1 = on("leaderboard:updated", (payload) => {
      const d = payload as { entries: Entry[] };
      if (Array.isArray(d?.entries)) setEntries(d.entries);
    });
    const un2 = on("activity:new", (payload) => {
      const a = payload as Activity;
      setActivity((prev) => [a, ...prev].slice(0, 8));
    });
    const un3 = on("announcement:new", (payload) => {
      setAnnouncement(payload as { message: string; level: string });
      setTimeout(() => setAnnouncement(null), 12_000);
    });
    return () => {
      un1();
      un2();
      un3();
    };
  }, [socket, on]);

  const phaseLabel = eventState ? `${eventState.phase.replace("PHASE_", "PHASE ")} · ${eventState.phaseLabel}` : "CONNECTING…";

  return (
    <div className="flex min-h-screen flex-col bg-void text-ink tech-grid">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-line bg-module px-6 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center border border-accent/40 bg-void font-mono text-base font-bold text-accent">
            A
          </span>
          <span className="font-display text-xl font-bold tracking-tighter">
            AGENT<span className="text-accent">COLOSSEUM</span>
          </span>
        </Link>
        <AnimatePresence mode="wait">
          <motion.p
            key={phaseLabel}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="hidden font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft sm:block"
          >
            {phaseLabel}
            {eventState?.status === "PAUSED" && (
              <span className="ml-2 text-warn">· PAUSED</span>
            )}
          </motion.p>
        </AnimatePresence>
        <div className="text-right">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">Time remaining</p>
          <p
            className={`font-mono text-3xl font-black tabular-nums sm:text-5xl ${
              countdown.seconds >= 0 && countdown.seconds <= 60 ? "text-bad" : "text-ink"
            }`}
          >
            {countdown.label}
          </p>
        </div>
      </div>

      {/* announcement ticker */}
      <AnimatePresence>
        {announcement && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-accent/30 bg-accent"
          >
            <p className="px-8 py-3 text-center font-display text-lg font-bold tracking-tight text-void">
              {announcement.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid flex-1 gap-6 p-6 sm:p-8 lg:grid-cols-[1.6fr_1fr]">
        {/* leaderboard */}
        <section>
          <h2 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-ink-faint">
            ● Live standings
          </h2>
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {entries.slice(0, 8).map((e) => (
                <motion.div
                  key={e.teamId}
                  layout
                  initial={{ backgroundColor: "rgba(168,85,247,0.12)" }}
                  animate={{ backgroundColor: "rgba(168,85,247,0)" }}
                  transition={{ duration: 2 }}
                  className={`flex items-center justify-between border bg-module px-5 py-4 transition-colors hover:border-accent/50 ${
                    e.rank <= 3 ? "border-l-2 border-l-accent" : "border-line"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-5">
                    <span
                      className={`font-display text-3xl font-bold tabular-nums ${
                        e.rank <= 3 ? "text-accent glow-text" : "text-ink-faint"
                      }`}
                    >
                      {String(e.rank).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-xl font-bold tracking-tight">{e.teamName}</p>
                      <p className="truncate font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                        {e.trackName ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-6">
                    {e.casinoMultiplier > 1 && (
                      <span className="border border-warn/40 bg-warn-soft px-3 py-1 font-mono text-sm font-bold text-warn">
                        ×{e.casinoMultiplier}
                      </span>
                    )}
                    <span className="hidden font-mono text-sm tabular-nums text-ink-faint sm:block">
                      {e.creditBalance} CC
                    </span>
                    <span className="w-28 text-right font-mono text-4xl font-black tabular-nums text-ink">
                      {e.finalScore || "—"}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {entries.length === 0 && (
              <p className="border border-dashed border-line px-6 py-16 text-center font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                Standings appear once the Gauntlet scores land.
              </p>
            )}
          </div>
        </section>

        {/* activity feed */}
        <section className="min-w-0">
          <h2 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-ink-faint">
            ▸ Arena wire
          </h2>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {activity.map((a) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="border border-line bg-module px-4 py-3"
                >
                  <p className="text-[13px] leading-snug text-ink-soft">
                    <span className="mr-2 font-mono text-accent">&gt;</span>
                    {a.summary}
                  </p>
                  <p className="mt-1 pl-4 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                    {new Date(a.createdAt).toLocaleTimeString()} · {a.kind}
                  </p>
                </motion.li>
              ))}
            </AnimatePresence>
            {activity.length === 0 && (
              <li className="border border-dashed border-line px-4 py-10 text-center font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                Quiet in the arena… for now.
              </li>
            )}
          </ul>

          {eventState && (
            <div className="mt-6 border border-line bg-module px-5 py-4 coord-frame">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
                Current objective
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {PHASE_META[eventState.phase as keyof typeof PHASE_META]?.objective}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
