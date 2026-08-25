"use client";

import { useEffect, useState } from "react";
import { api, formatCC } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Tx {
  id: string;
  amount: number;
  type: string;
  source: string;
  reference: string | null;
  balanceAfter: number;
  createdAt: string;
}

export default function WalletPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [earned, setEarned] = useState(0);
  const [spent, setSpent] = useState(0);

  useEffect(() => {
    api
      .get<{ transactions: Tx[]; earned: number; spent: number }>("/api/teams/me/transactions")
      .then((d) => {
        setTxs(d.transactions);
        setEarned(d.earned);
        setSpent(d.spent);
      })
      .catch(() => {});
  }, []);

  return (
    <Card className="coord-frame">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Transaction ledger</CardTitle>
        <p className="font-mono text-xs text-ink-soft tabular-nums">
          earned <span className="font-bold text-good">+{formatCC(earned)}</span> · spent{" "}
          <span className="font-bold text-bad">−{formatCC(spent)}</span>
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {txs.length === 0 ? (
          <p className="px-5 py-10 text-center font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            No transactions yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-5 py-2.5 font-medium">When</th>
                  <th className="px-5 py-2.5 font-medium">Source</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-5 py-2.5 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {txs.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-module">
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-ink-soft">
                      {new Date(t.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-5 py-2.5 font-medium text-ink">{t.source}</td>
                    <td className="px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                      {t.type}
                    </td>
                    <td
                      className={`px-5 py-2.5 text-right font-mono font-bold tabular-nums ${
                        t.amount >= 0 ? "text-good" : "text-bad"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {t.amount}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono tabular-nums text-ink">
                      {t.balanceAfter}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
