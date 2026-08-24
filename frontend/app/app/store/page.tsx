"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

interface FeatureRow {
  id: string;
  category: "TOOL_MODULE" | "DEFENSIVE_BUFF" | "OFFENSIVE_SABOTAGE";
  name: string;
  description: string;
  cost: number;
  maxPerTeam: number;
  ownedByTeam: number;
}

const CATEGORY_LABEL = {
  TOOL_MODULE: "Tool Modules",
  DEFENSIVE_BUFF: "Defensive Buffs",
  OFFENSIVE_SABOTAGE: "Offensive Sabotage",
} as const;

export default function StorePage() {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [rivals, setRivals] = useState<Array<{ id: string; name: string }>>([]);
  const [open, setOpen] = useState<FeatureRow | null>(null);
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [storeOpen, setStoreOpen] = useState(true);
  const { eventState } = useRealtime();

  const load = useCallback(async () => {
    try {
      const [store, teamList] = await Promise.all([
        api.get<{ features: FeatureRow[]; gates: Record<string, boolean>; rivals?: Array<{ id: string; name: string }> }>("/api/store?rivals=1"),
        api.get<{ teams?: never }>("/api/teams"),
      ]);
      void teamList;
      setFeatures(store.features);
      setStoreOpen(Boolean(store.gates.storeOpen));
      if (store.rivals) setRivals(store.rivals);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (eventState?.gates) setStoreOpen(Boolean(eventState.gates.storeOpen));
  }, [eventState]);

  async function purchase() {
    if (!open) return;
    setMessage(null);
    try {
      await api.post("/api/store/purchase", {
        featureId: open.id,
        ...(open.category === "OFFENSIVE_SABOTAGE" ? { targetTeamId: targetId } : {}),
      });
      setMessage(`Purchased ${open.name} for ${open.cost} CC`);
      setOpen(null);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Purchase failed");
      setOpen(null);
    }
  }

  return (
    <div className="space-y-4">
      {!storeOpen && (
        <p className="rounded-xl border border-line bg-paper-dim px-4 py-3 text-sm text-ink-soft">
          The Feature Store is closed — it opens in Phase 1 and stays open through Phase 2.
        </p>
      )}

      {(["TOOL_MODULE", "DEFENSIVE_BUFF", "OFFENSIVE_SABOTAGE"] as const).map((cat) => (
        <div key={cat}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            {CATEGORY_LABEL[cat]}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features
              .filter((f) => f.category === cat)
              .map((f) => (
                <motion.div key={f.id} layout>
                  <Card className="flex h-full flex-col">
                    <CardHeader className="flex items-start justify-between gap-2">
                      <CardTitle className="leading-snug">{f.name}</CardTitle>
                      <span className="shrink-0 font-mono text-sm font-bold text-accent tabular-nums">{f.cost}</span>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-between gap-3">
                      <p className="text-[13px] leading-relaxed text-ink-soft">{f.description}</p>
                      <div className="flex items-center justify-between">
                        {f.ownedByTeam >= f.maxPerTeam ? (
                          <Badge tone="good">Owned</Badge>
                        ) : (
                          <span className="text-[11px] text-neutral-400">max {f.maxPerTeam}/team</span>
                        )}
                        <Button
                          size="sm"
                          variant={cat === "OFFENSIVE_SABOTAGE" ? "danger" : "outline"}
                          disabled={!storeOpen || f.ownedByTeam >= f.maxPerTeam}
                          onClick={() => {
                            setTargetId("");
                            setOpen(f);
                          }}
                        >
                          Buy
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
          </div>
        </div>
      ))}

      {message && <p className="rounded-lg border border-violet-200 bg-accent-soft px-4 py-2.5 text-sm font-medium text-accent-strong">{message}</p>}

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? `Buy ${open.name}` : ""}>
        {open && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">{open.description}</p>
            <p className="rounded-lg bg-paper-dim px-3 py-2 font-mono text-sm font-bold tabular-nums">
              −{open.cost} CC from your balance
            </p>
            {open.category === "OFFENSIVE_SABOTAGE" && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Target rival</label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Select a rival team…</option>
                  {rivals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button
              onClick={purchase}
              disabled={open.category === "OFFENSIVE_SABOTAGE" && !targetId}
              className={`w-full ${open.category === "OFFENSIVE_SABOTAGE" ? "bg-bad hover:bg-red-800" : "bg-accent hover:bg-accent-strong"}`}
            >
              Confirm purchase
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
