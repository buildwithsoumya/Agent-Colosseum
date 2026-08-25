"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";

interface Entry {
  rank: number;
  teamId: string;
  teamName: string;
  trackName: string | null;
  gauntletScore: number;
  casinoMultiplier: number;
  disciplineScore: number;
  finalScore: number;
  creditBalance: number;
}

export default function PublicLeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [live, setLive] = useState(false);
  const { on, socket } = useRealtime();

  useEffect(() => {
    api
      .get<{ entries: Entry[] }>("/api/leaderboard")
      .then((d) => setEntries(d.entries))
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (payload: unknown) => {
      const data = payload as { entries: Entry[] };
      if (Array.isArray(data?.entries)) setEntries(data.entries);
    };
    return on("leaderboard:updated", handler);
  }, [socket, on]);

  useEffect(() => {
    if (socket) setLive(true);
  }, [socket]);

  return (
    <div className="min-h-screen tech-grid-fine">
      <SiteNav />
      <main className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-6">
          <div className="relative">
            <span className="absolute -left-4 -top-4 font-mono text-[10px] text-line-strong">+</span>
            <span className="absolute -right-4 -top-4 font-mono text-[10px] text-line-strong">+</span>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <SectionLabel>Leaderboard</SectionLabel>
                <PageTitle sub="Final Score = (Gauntlet × Casino Multiplier) + Credit Discipline. Updates live as the Gauntlet runs.">
                  Global Standings
                </PageTitle>
              </div>
              <div className="hidden gap-4 md:flex">
                <span className="inline-flex items-center gap-2 border border-line bg-module px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink">
                  <span className={`h-2 w-2 rounded-full ${live ? "bg-accent led-pulse" : "bg-ink-faint"}`} />
                  {live ? "Live Updates" : "Standby"}
                </span>
                <span className="border border-line bg-module px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                  [ FLTR: ALL TRACKS ]
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 w-full overflow-x-auto pb-4">
          {entries.length === 0 ? (
            <div className="module p-12 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                [ NO SCORES YET ]
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                The leaderboard fills up once the Gauntlet begins.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                  <th className="w-16 px-4 py-4 font-medium">Rank</th>
                  <th className="min-w-[200px] px-4 py-4 font-medium">Team Name</th>
                  <th className="px-4 py-4 font-medium">Track</th>
                  <th className="hidden px-4 py-4 text-right font-medium md:table-cell">Gauntlet</th>
                  <th className="hidden px-4 py-4 text-right font-medium sm:table-cell">Casino</th>
                  <th className="hidden px-4 py-4 text-right font-medium md:table-cell">Discipline</th>
                  <th className="px-4 py-4 text-right font-medium">Total Score</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <motion.tr
                    key={e.teamId}
                    layout
                    initial={{ backgroundColor: "rgba(168,85,247,0.08)" }}
                    animate={{ backgroundColor: "rgba(168,85,247,0)" }}
                    transition={{ duration: 1.2 }}
                    className={`border-b border-line transition-colors hover:bg-module ${
                      e.rank <= 3 ? "border-l-2 border-l-accent bg-module" : "border-l-2 border-l-transparent"
                    }`}
                  >
                    <td
                      className={`px-4 py-4 font-display text-lg font-bold tabular-nums ${
                        e.rank <= 3 ? "text-accent glow-text" : "font-mono text-sm text-ink-soft"
                      }`}
                    >
                      {String(e.rank).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-4 font-semibold text-ink">{e.teamName}</td>
                    <td className="px-4 py-4 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                      {e.trackName ?? "—"}
                    </td>
                    <td className="hidden px-4 py-4 text-right font-mono tabular-nums text-ink-soft md:table-cell">
                      {e.gauntletScore || "—"}
                    </td>
                    <td className="hidden px-4 py-4 text-right sm:table-cell">
                      {e.casinoMultiplier > 1 ? (
                        <span className="rounded-[0.125rem] border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-strong">
                          ×{e.casinoMultiplier}
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-4 text-right font-mono tabular-nums text-ink-soft md:table-cell">
                      {e.disciplineScore}
                    </td>
                    <td className="px-4 py-4 text-right font-bold tabular-nums text-ink">
                      {e.finalScore || "—"}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
