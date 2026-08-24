"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface GauntletStatus {
  submission: { repoUrl: string; status: string; lockedAt: string | null; fileKey: string | null } | null;
  job: {
    id: string;
    status: string;
    result: {
      gauntletScore: number;
      accuracyScore: number;
      resilienceScore: number;
      latencyScore: number;
      tokenScore: number;
      payloadsPassed: number;
      payloadsTotal: number;
    } | null;
  } | null;
  score: { gauntletScore: number; casinoMultiplier: number; disciplineScore: number; finalScore: number; breakdown: { explanation?: Record<string, string> } } | null;
}

export default function SubmissionPage() {
  const [status, setStatus] = useState<GauntletStatus | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const { eventState, on } = useRealtime();

  const load = useCallback(async () => {
    try {
      const d = await api.get<GauntletStatus>("/api/gauntlet/me");
      setStatus(d);
      if (d.submission) setRepoUrl(d.submission.repoUrl);
    } catch {
      /* not in team */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () =>
      on("gauntlet:progress", (payload) => {
        const d = payload as { progress?: string; message?: string };
        if (d.progress) setProgress(d.progress);
        else if (d.message) setProgress(d.message);
      }),
    [on],
  );

  async function save() {
    setMessage(null);
    try {
      await api.put("/api/submissions/me", { repoUrl, notes });
      setMessage("Saved. Lock it in when you are ready — locking is final.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function lock() {
    setMessage(null);
    try {
      await api.post("/api/submissions/me/lock");
      setMessage("Submission locked. The Gauntlet is evaluating your agent…");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Lock failed");
    }
  }

  if (!status) return <p className="text-sm text-ink-soft">Loading…</p>;

  const editable = !status.submission || status.submission.status === "OPEN";

  return (
    <div className="space-y-4">
      {!eventState?.gates.submissionsOpen && (
        <p className="rounded-xl border border-line bg-paper-dim px-4 py-3 text-sm text-ink-soft">
          Submissions open during Phase 4 only.
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Gauntlet submission</CardTitle>
          <Badge tone={status.submission?.status === "EVALUATED" ? "good" : status.submission?.status === "OPEN" ? "neutral" : "accent"}>
            {status.submission?.status ?? "NOT STARTED"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Repository or drive URL"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={!editable}
          />
          <Textarea
            placeholder="Notes for evaluators (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!editable}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} variant="outline" disabled={!editable || repoUrl.length < 8}>
              Save
            </Button>
            <Button
              onClick={lock}
              disabled={!editable || !status.submission}
              className="bg-accent hover:bg-accent-strong"
            >
              Lock &amp; enter the Gauntlet
            </Button>
            {message && <p className="text-xs font-medium text-accent-strong">{message}</p>}
          </div>
        </CardContent>
      </Card>

      {progress && status.job && status.job.status !== "COMPLETED" && (
        <Card>
          <CardContent className="flex items-center gap-3">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <p className="text-sm font-medium">Gauntlet live · {progress}</p>
          </CardContent>
        </Card>
      )}

      {status.job?.result && (
        <Card>
          <CardHeader><CardTitle>Evaluation metrics</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Accuracy", status.job.result.accuracyScore],
                ["Resilience", status.job.result.resilienceScore],
                ["Latency", status.job.result.latencyScore],
                ["Token efficiency", status.job.result.tokenScore],
              ].map(([label, v]) => (
                <div key={label as string} className="rounded-xl border border-line px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{label as string}</p>
                  <p className="mt-1 font-mono text-lg font-bold tabular-nums">{v as number}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-paper-dim">
                    <div className="h-1 rounded-full bg-accent" style={{ width: `${v as number}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-soft tabular-nums">
              {status.job.result.payloadsPassed}/{status.job.result.payloadsTotal} adversarial payloads passed
            </p>
          </CardContent>
        </Card>
      )}

      {status.score && (
        <Card>
          <CardHeader><CardTitle>Final score breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-accent-soft px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-accent-strong">Gauntlet</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums">{status.score.gauntletScore}</p>
              </div>
              <div className="rounded-xl border border-violet-200 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-accent-strong">Casino mult.</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums">×{status.score.casinoMultiplier}</p>
              </div>
              <div className="rounded-xl border border-line px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Discipline</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums">{status.score.disciplineScore}</p>
              </div>
              <div className="rounded-xl bg-ink px-4 py-3 text-white">
                <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">Final</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums">{status.score.finalScore}</p>
              </div>
            </div>
            {status.score.breakdown?.explanation && (
              <ul className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-ink-soft">
                {Object.values(status.score.breakdown.explanation).map((line) =>
                  line ? <li key={line}>· {line}</li> : null,
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
