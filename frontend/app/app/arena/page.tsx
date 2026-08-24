"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ArenaState {
  gates: Record<string, boolean>;
  maxRuns: number;
  payoutCc: number;
  runsUsed: number;
  runsRemaining: number;
  history: Array<{ id: string; game: string; result: string; rewardPaid: number; at: string }>;
  games: Array<{ key: string; name: string; description: string; durationSec: number }>;
}

export default function ArenaPage() {
  const [state, setState] = useState<ArenaState | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [result, setResult] = useState<null | { result: string; reward: number; balance: number; game: string }>(null);

  const load = useCallback(async () => {
    try {
      setState(await api.get<ArenaState>("/api/arena/state"));
    } catch {
      /* not in a team yet */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function play(gameKey: string, gameName: string) {
    setPlaying(gameKey);
    setResult(null);
    try {
      const r = await api.post<{ result: "WIN" | "LOSS"; reward: number; balance: number }>("/api/arena/play", { gameKey });
      setResult({ ...r, game: gameName });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Run failed");
    } finally {
      setPlaying(null);
    }
  }

  const [message, setMessage] = useState<string | null>(null);
  void message;

  if (!state) return <p className="text-sm text-ink-soft">Loading arena…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Runs remaining</p>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {Math.max(0, state.runsRemaining)} <span className="text-sm font-medium text-neutral-400">/ {state.maxRuns}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Win pays</p>
            <p className="font-mono text-lg font-bold text-good tabular-nums">+{state.payoutCc} CC</p>
          </div>
        </CardContent>
      </Card>

      {!state.gates.arenaOpen && (
        <p className="rounded-xl border border-line bg-paper-dim px-4 py-3 text-sm text-ink-soft">
          The Game Arena is open during Phase 1 and Phase 2 only.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {state.games.map((g) => (
          <motion.div key={g.key} whileHover={{ y: -2 }}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{g.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="min-h-[36px] text-xs leading-relaxed text-ink-soft">{g.description}</p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!state.gates.arenaOpen || state.runsRemaining <= 0 || playing !== null}
                  onClick={() => play(g.key, g.name)}
                  className="w-full"
                >
                  {playing === g.key ? "Playing…" : "Play a run"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl border px-5 py-4 ${result.result === "WIN" ? "border-green-200 bg-green-50" : "border-line bg-paper-dim"}`}
        >
          <p className="font-mono text-xl font-bold">
            {result.result === "WIN" ? `+${result.reward} CC` : "No reward"}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {result.game} · balance now {result.balance} CC
          </p>
        </motion.div>
      )}

      {state.history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Run history</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-line">
              {state.history.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-[13px]">{h.game}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={h.result === "WIN" ? "good" : "neutral"}>{h.result}</Badge>
                    {h.rewardPaid > 0 && <span className="font-mono text-xs font-bold text-good">+{h.rewardPaid}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
