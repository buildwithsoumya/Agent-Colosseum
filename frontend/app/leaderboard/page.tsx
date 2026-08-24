"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";

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
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionLabel>Leaderboard</SectionLabel>
        <PageTitle sub="Final Score = (Gauntlet × Casino Multiplier) + Credit Discipline. Updates live as the Gauntlet runs.">
          Standings
          {live && (
            <span className="ml-3 inline-flex items-center gap-1.5 align-middle text-xs font-medium text-good">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" /> live
            </span>
          )}
        </PageTitle>

        <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-white">
          {entries.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-ink-soft">
              No scores yet — the leaderboard fills up once the Gauntlet begins.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-paper-dim text-[11px] uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-semibold">Rank</th>
                  <th className="px-4 py-3 font-semibold">Team</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Track</th>
                  <th className="px-4 py-3 text-right font-semibold">Gauntlet</th>
                  <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Casino</th>
                  <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">Discipline</th>
                  <th className="px-4 py-3 text-right font-semibold">Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((e) => (
                  <motion.tr
                    key={e.teamId}
                    layout
                    initial={{ backgroundColor: "rgba(109,40,217,0.06)" }}
                    animate={{ backgroundColor: "rgba(109,40,217,0)" }}
                    transition={{ duration: 1.2 }}
                  >
                    <td className="px-4 py-3 font-mono font-bold tabular-nums">#{e.rank}</td>
                    <td className="px-4 py-3 font-semibold">{e.teamName}</td>
                    <td className="hidden px-4 py-3 text-ink-soft md:table-cell">{e.trackName ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{e.gauntletScore || "—"}</td>
                    <td className="hidden px-4 py-3 text-right sm:table-cell">
                      {e.casinoMultiplier > 1 ? (
                        <Badge tone="accent">×{e.casinoMultiplier}</Badge>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-ink-soft md:table-cell">
                      {e.disciplineScore}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{e.finalScore || "—"}</td>
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
