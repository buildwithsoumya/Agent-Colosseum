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

const CATEGORY_INDEX = {
  TOOL_MODULE: "01-T",
  DEFENSIVE_BUFF: "02-D",
  OFFENSIVE_SABOTAGE: "03-O",
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
      const [store] = await Promise.all([
        api.get<{ features: FeatureRow[]; gates: Record<string, boolean>; rivals?: Array<{ id: string; name: string }> }>("/api/store?rivals=1"),
      ]);
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
    <div className="space-y-8">
      {!storeOpen && (
        <div className="module border-l-2 border-l-warn px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-warn">
            The Feature Store is closed — it opens in Phase 1 and stays open through Phase 2.
          </p>
        </div>
      )}

      {(["TOOL_MODULE", "DEFENSIVE_BUFF", "OFFENSIVE_SABOTAGE"] as const).map((cat) => (
        <div key={cat}>
          <h2 className="mb-3 flex items-center gap-2 border-b border-line pb-2 font-mono text-xs font-medium uppercase tracking-[0.14em] text-ink">
            <span className="text-accent">{cat === "TOOL_MODULE" ? "▣" : cat === "DEFENSIVE_BUFF" ? "◈" : "⚡"}</span>
            {CATEGORY_LABEL[cat]}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features
              .filter((f) => f.category === cat)
              .map((f) => (
                <motion.div key={f.id} layout>
                  <Card className="module-hover coord-frame flex h-full flex-col">
                    <CardHeader className="flex items-start justify-between gap-2">
                      <CardTitle className="leading-snug">{f.name}</CardTitle>
                      <span className="shrink-0 font-mono text-sm font-bold text-warn tabular-nums">
                        {f.cost} CC
                      </span>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-between gap-3">
                      <p className="text-[13px] leading-relaxed text-ink-soft">{f.description}</p>
                      <div className="flex items-center justify-between">
                        {f.ownedByTeam >= f.maxPerTeam ? (
                          <Badge tone="good">Owned</Badge>
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                            max {f.maxPerTeam}/team
                          </span>
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

      {message && (
        <p className="border border-accent/40 bg-accent/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-accent-strong">
          [ SYS ] {message}
        </p>
      )}

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? `Acquire: ${open.name.toUpperCase()}` : ""}>
        {open && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">{open.description}</p>
            <div className="flex items-center justify-between border border-line bg-void px-3 py-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Cost</span>
              <span className="font-mono text-sm font-bold text-warn tabular-nums">−{open.cost} CC</span>
            </div>
            {open.category === "OFFENSIVE_SABOTAGE" && (
              <div>
                <label className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  Target rival
                </label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-[0.125rem] border border-line bg-void px-3 text-sm text-ink focus:border-accent focus:outline-none input-glow"
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
              variant={open.category === "OFFENSIVE_SABOTAGE" ? "danger" : "primary"}
              className="w-full"
            >
              Authorize purchase
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
