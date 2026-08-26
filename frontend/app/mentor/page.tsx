"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";

interface PsRow {
  id: string;
  title: string;
  body: string;
  status: string;
  mentorNote: string | null;
  team: { name: string; code: string };
  track: { key: string; name: string };
  submittedAt: string | null;
}

const FILTERS = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CHANGES_REQUESTED"] as const;

export default function MentorPage() {
  const [rows, setRows] = useState<PsRow[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("SUBMITTED");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<number | null>(null);
  const [inReview, setInReview] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, pend, rev] = await Promise.all([
        api.get<{ submissions: PsRow[] }>(`/api/problems/queue?status=${filter}`),
        api.get<{ submissions: PsRow[] }>("/api/problems/queue?status=SUBMITTED"),
        api.get<{ submissions: PsRow[] }>("/api/problems/queue?status=UNDER_REVIEW"),
      ]);
      setRows(d.submissions);
      setPending(pend.submissions.length);
      setInReview(rev.submissions.length);
    } catch {
      setRows([]);
      setPending(0);
      setInReview(0);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES") {
    try {
      await api.post(`/api/problems/${id}/review`, { decision, note: notes[id] || undefined });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Review failed");
    }
  }

  return (
    <div className="space-y-5">
      {/* Mentor overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Pending reviews" value={pending ?? "…"} hint="awaiting your decision" />
        <Stat label="In review" value={inReview ?? "…"} hint="being worked" />
        <Stat label="Current queue" value={rows.length} hint={`${filter.replace("_", " ")}`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          Problem statement review
        </h1>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-[0.125rem] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                filter === f
                  ? "bg-accent text-white"
                  : "border border-line bg-module text-ink-soft hover:text-ink"
              }`}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 && (
        <Card>
          <CardContent>
            <p className="py-6 text-center font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Nothing in the {filter.replace("_", " ").toLowerCase()} queue.
            </p>
          </CardContent>
        </Card>
      )}

      {rows.map((r) => (
        <Card key={r.id} className="coord-frame">
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>{r.title}</CardTitle>
                <Badge tone={r.status === "APPROVED" ? "good" : r.status === "SUBMITTED" ? "accent" : "neutral"}>
                  {r.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Team {r.team.name} ({r.team.code}) · track {r.track.name}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed text-ink">{r.body}</p>
            {!["APPROVED"].includes(r.status) && (
              <>
                <Textarea
                  placeholder="Mentor note (required for reject / request changes)"
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="good" onClick={() => review(r.id, "APPROVE")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => review(r.id, "REQUEST_CHANGES")}>
                    Request changes
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => review(r.id, "REJECT")}>
                    Reject
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}