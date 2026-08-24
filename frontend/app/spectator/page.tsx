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

  const phaseLabel = eventState ? `${eventState.phase.replace("PHASE_", "PHASE ")} · ${eventState.phaseLabel}` : "Connecting…";

  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-8 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-base font-black">A</span>
          <span className="text-xl font-black tracking-tight">
            AGENT<span className="text-violet-400">COLOSSEUM</span>
          </span>
        </Link>
        <AnimatePresence mode="wait">
          <motion.p
            key={phaseLabel}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-300"
          >
            {phaseLabel}
            {eventState?.status === "PAUSED" && <span className="ml-2 text-amber-400">· PAUSED</span>}
          </motion.p>
        </AnimatePresence>
        <p
          className={`font-mono text-5xl font-black tabular-nums ${
            countdown.seconds >= 0 && countdown.seconds <= 60 ? "text-red-400" : "text-white"
          }`}
        >
          {countdown.label}
        </p>
      </div>

      {/* announcement ticker */}
      <AnimatePresence>
        {announcement && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-violet-700"
          >
            <p className="px-8 py-3 text-center text-lg font-bold tracking-tight">{announcement.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid flex-1 gap-6 p-8 lg:grid-cols-[1.6fr_1fr]">
        {/* leaderboard */}
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">Live standings</h2>
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {entries.slice(0, 8).map((e) => (
                <motion.div
                  key={e.teamId}
                  layout
                  initial={{ backgroundColor: "rgba(139,92,246,0.25)" }}
                  animate={{ backgroundColor: "rgba(139,92,246,0)" }}
                  transition={{ duration: 2 }}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4"
                >
                  <div className="flex min-w-0 items-center gap-5">
                    <span className={`font-mono text-3xl font-black tabular-nums ${e.rank <= 3 ? "text-violet-300" : "text-neutral-600"}`}>
                      {String(e.rank).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xl font-bold tracking-tight">{e.teamName}</p>
                      <p className="truncate text-xs uppercase tracking-wider text-neutral-500">{e.trackName ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-6">
                    {e.casinoMultiplier > 1 && (
                      <span className="rounded-full bg-violet-700/40 px-3 py-1 font-mono text-sm font-bold text-violet-200">×{e.casinoMultiplier}</span>
                    )}
                    <span className="font-mono text-sm tabular-nums text-neutral-500">{e.creditBalance} CC</span>
                    <span className="w-28 text-right font-mono text-4xl font-black tabular-nums">{e.finalScore || "—"}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {entries.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center text-neutral-500">
                Standings appear once the Gauntlet scores land.
              </p>
            )}
          </div>
        </section>

        {/* activity feed */}
        <section className="min-w-0">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">Arena wire</h2>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {activity.map((a) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <p className="text-[13px] leading-snug text-neutral-200">{a.summary}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-neutral-600">
                    {new Date(a.createdAt).toLocaleTimeString()} · {a.kind}
                  </p>
                </motion.li>
              ))}
            </AnimatePresence>
            {activity.length === 0 && (
              <li className="rounded-xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-neutral-500">
                Quiet in the arena… for now.
              </li>
            )}
          </ul>

          {eventState && (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-300">Current objective</p>
              <p className="mt-1 text-sm leading-relaxed text-neutral-300">{PHASE_META[eventState.phase as keyof typeof PHASE_META]?.objective}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
