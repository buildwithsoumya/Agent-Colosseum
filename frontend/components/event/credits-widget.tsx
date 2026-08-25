"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { api, formatCC } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

export function CreditsWidget({ className }: { className?: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [flash, setFlash] = useState<null | { amount: number; reason: string }>(null);
  const reduced = useReducedMotion();
  const { on } = useRealtime();

  useEffect(() => {
    api
      .get<{ team: { creditBalance: number } }>("/api/teams/me")
      .then((d) => setBalance(d.team.creditBalance))
      .catch(() => {});
  }, []);

  const onCredits = useCallback(
    (payload: unknown) => {
      const data = payload as { balance: number; amount: number; reason: string };
      if (typeof data.balance === "number") setBalance(data.balance);
      setFlash({ amount: data.amount ?? 0, reason: data.reason ?? "" });
      setTimeout(() => setFlash(null), 2600);
    },
    [],
  );

  useEffect(() => on("credits:updated", onCredits), [on, onCredits]);

  return (
    <div
      className={`module relative overflow-hidden rounded-[0.25rem] px-4 py-3 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-soft">
          Colosseum Credits
        </p>
        <span className="h-1.5 w-1.5 bg-accent led-pulse" aria-hidden />
      </div>
      <motion.p
        key={balance ?? "…"}
        animate={reduced ? undefined : flash ? { scale: [1, 1.08, 1] } : undefined}
        className="mt-1 font-mono text-2xl font-bold tabular-nums text-ink"
      >
        {balance === null ? "—" : formatCC(balance)}
      </motion.p>
      {flash && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`mt-0.5 font-mono text-[11px] uppercase tracking-wider ${
            flash.amount >= 0 ? "text-good" : "text-bad"
          }`}
        >
          {flash.amount >= 0 ? "+" : ""}
          {formatCC(flash.amount)} · {flash.reason}
        </motion.p>
      )}
    </div>
  );
}
