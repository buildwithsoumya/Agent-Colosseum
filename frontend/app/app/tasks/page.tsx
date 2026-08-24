"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TaskRow {
  id: string;
  number: string;
  title: string;
  body: string;
  criteria: string[];
  state: string;
  unlockCost: number | null;
  locked: boolean;
}

const stateTone: Record<string, "neutral" | "accent" | "good" | "ink"> = {
  LOCKED: "neutral",
  REVEALED: "accent",
  ACTIVE: "ink",
  COMPLETED: "good",
  CLOSED: "neutral",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ tasks: TaskRow[] }>("/api/tasks/me");
      setTasks(d.tasks);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function unlock(id: string) {
    setBusy(id);
    setMessage(null);
    try {
      const r = await api.post<{ balance: number }>(`/api/tasks/${id}/unlock`);
      setMessage(`Unlocked — new balance ${r.balance} CC`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Every team in a track gets the same two tasks. Unlocking Task 1 costs credits; Task 2 unlocks free
        when it is revealed.
      </p>
      {tasks.length === 0 && !message && (
        <Card><CardContent><p className="text-sm text-ink-soft">Select a track first — see Team.</p></CardContent></Card>
      )}
      {tasks.map((t) => (
        <Card key={t.id}>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <CardTitle>{t.title}</CardTitle>
              <Badge tone={stateTone[t.state] ?? "neutral"}>{t.state}</Badge>
            </div>
            {t.locked && t.unlockCost !== null && t.state !== "LOCKED" && (
              <Button size="sm" onClick={() => unlock(t.id)} disabled={busy === t.id}>
                Unlock for {t.unlockCost} CC
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-ink">{t.body}</p>
            {t.criteria?.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line pt-3">
                {(t.criteria as string[]).map((c) => (
                  <li key={c} className="flex gap-2 text-xs text-ink-soft">
                    <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
      {message && <p className="text-xs font-medium text-accent-strong">{message}</p>}
    </div>
  );
}
