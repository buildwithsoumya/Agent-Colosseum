"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CasinoState {
  gates: Record<string, boolean>;
  bustFloor: number;
  myBet: { tier: string; outcome: string; wagerAmount: number; postBalance: number; multiplierAwarded: number } | null;
  balance: number;
}

const TIER_INFO = [
  {
    key: "VAULT" as const,
    name: "The Vault",
    risk: "0% RISK",
    riskTone: "text-good",
    border: "border-good/30",
    blurb: "Lock in your current balance. No bonus, no penalty.",
  },
  {
    key: "OVERCLOCK" as const,
    name: "The Overclock",
    risk: "50 / 50",
    riskTone: "text-accent",
    border: "border-accent/30",
    blurb: "Fixed 200 CC stake. Win Tier-1 API keys, or eat +3s tool lag in the Gauntlet.",
  },
  {
    key: "HIGH_ROLLER" as const,
    name: "The High-Roller",
    risk: "30% WIN",
    riskTone: "text-bad",
    border: "border-bad/30",
    blurb: "Stake 35% of your balance. Win a ×2.5 score multiplier — lose the stake entirely.",
  },
];

export default function CasinoPage() {
  const [state, setState] = useState<CasinoState | null>(null);
  const [spinning, setSpinning] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<null | { outcome: string; tier: string; postBalance: number; mult: number }>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { eventState, on } = useRealtime();

  const load = useCallback(async () => {
    try {
      setState(await api.get<CasinoState>("/api/casino/state"));
    } catch {
      /* not in team */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => on("casino:result", load), [on, load]);

  async function bet(tier: "VAULT" | "OVERCLOCK" | "HIGH_ROLLER") {
    setSpinning(tier);
    setOutcome(null);
    // short suspense beat — the real result is already decided server-side
    await new Promise((r) => setTimeout(r, 1400));
    try {
      const r = await api.post<{ bet: { outcome: string; postBalance: number; multiplierAwarded: number } }>("/api/casino/bet", { tier });
      setOutcome({ outcome: r.bet.outcome, tier, postBalance: r.bet.postBalance, mult: r.bet.multiplierAwarded });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Bet failed");
    } finally {
      setSpinning(null);
    }
  }

  if (!state) return <p className="text-sm text-ink-soft">Loading casino…</p>;

  return (
    <div className="space-y-4">
      {!state.gates.casinoOpen && (
        <div className="module border-l-2 border-l-warn px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-warn">
            The Casino opens only during Phase 3. Code freezes — hands off keyboards.
          </p>
        </div>
      )}
      {state.myBet && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="accent">Wager locked</Badge>
              <span className="font-mono text-sm font-semibold uppercase tracking-wider text-ink">
                {state.myBet.tier.replace("_", "-")}
              </span>
            </div>
            <p className="font-mono text-sm tabular-nums text-ink-soft">
              balance {state.myBet.postBalance} CC
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        {TIER_INFO.map((t) => (
          <motion.div key={t.key} whileHover={{ y: -2 }}>
            <Card className={`module-hover coord-frame h-full ${t.border}`}>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>{t.name}</CardTitle>
                <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${t.riskTone}`}>
                  {t.risk}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="min-h-[48px] text-[13px] leading-relaxed text-ink-soft">{t.blurb}</p>
                <Button
                  variant={t.key === "HIGH_ROLLER" ? "danger" : t.key === "VAULT" ? "outline" : "primary"}
                  disabled={!state.gates.casinoOpen || Boolean(state.myBet) || spinning !== null}
                  onClick={() => bet(t.key)}
                  className="w-full"
                >
                  {spinning === t.key ? "Spinning…" : state.myBet ? "Locked" : "Place wager"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {(spinning || outcome) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`border px-6 py-8 text-center ${
            outcome?.outcome === "WIN"
              ? "border-good/40 bg-good-soft"
              : outcome?.outcome === "LOSS"
                ? "border-bad/40 bg-bad-soft"
                : "border-line bg-module"
          }`}
        >
          {spinning ? (
            <motion.p
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="font-mono text-lg font-bold uppercase tracking-[0.14em] text-ink"
            >
              Drawing result…
            </motion.p>
          ) : outcome ? (
            <>
              <p className="font-mono text-3xl font-black tracking-tight">
                {outcome.outcome === "WIN" ? (
                  <span className={outcome.mult > 1 ? "text-warn glow-text" : "text-good"}>
                    {outcome.mult > 1 ? "×2.5 JACKPOT" : "WIN"}
                  </span>
                ) : outcome.outcome === "LOSS" ? (
                  <span className="text-bad">LOSS</span>
                ) : (
                  <span className="text-ink">LOCKED IN</span>
                )}
              </p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                balance now {outcome.postBalance} CC
              </p>
            </>
          ) : null}
        </motion.div>
      )}

      {message && (
        <p className="border border-bad/40 bg-bad-soft px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bad">
          [ ERROR ] {message}
        </p>
      )}

      <p className="font-mono text-[10px] uppercase tracking-wider leading-relaxed text-ink-faint">
        Bust protection: losses can never take you below {state.bustFloor} CC. All outcomes are drawn by the
        server and recorded in an audit ledger.
      </p>
    </div>
  );
}
