"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { user, loading, logout } = useSession();
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ submissions: PsRow[] }>(`/api/problems/queue?status=${filter}`);
      setRows(d.submissions);
    } catch {
      setRows([]);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role === "PARTICIPANT") router.replace("/app");
  }, [user, loading, router]);

  async function review(id: string, decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES") {
    try {
      await api.post(`/api/problems/${id}/review`, { decision, note: notes[id] || undefined });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Review failed");
    }
  }

  if (loading || !user || user.role === "PARTICIPANT") {
    return (
      <div className="grid min-h-screen place-items-center tech-grid">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          <span className="mr-2 text-accent">&gt;</span> Checking credentials…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen tech-grid">
      <header className="sticky top-0 z-40 border-b border-line bg-void/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center border border-accent/40 bg-module font-mono text-[12px] font-bold text-accent">
                A
              </span>
              <span className="font-display text-sm font-bold tracking-tighter">
                MENTOR<span className="text-accent">DESK</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] uppercase tracking-wider text-ink-soft sm:block">
              {user.name}
            </span>
            <button
              onClick={() => logout().then(() => router.push("/"))}
              className="rounded-[0.125rem] border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft transition-colors hover:border-bad hover:text-bad"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] space-y-4 px-4 py-6 sm:px-6">
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
      </main>
    </div>
  );
}
