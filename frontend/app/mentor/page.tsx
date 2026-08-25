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
    else if (user.globalRole === "PARTICIPANT") router.replace("/app");
  }, [user, loading, router]);

  async function review(id: string, decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES") {
    try {
      await api.post(`/api/problems/${id}/review`, { decision, note: notes[id] || undefined });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Review failed");
    }
  }

  if (loading || !user || user.globalRole === "PARTICIPANT") {
    return <div className="grid min-h-screen place-items-center"><p className="text-sm text-ink-soft">Checking credentials…</p></div>;
  }

  return (
    <div className="min-h-screen bg-paper-dim">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-[13px] font-black text-white">A</span>
              <span className="text-sm font-bold tracking-tight">Mentor Desk</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-soft">{user.name}</span>
            <button onClick={() => logout().then(() => router.push("/"))} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-ink">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold tracking-tight">Problem statement review</h1>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === f ? "bg-accent text-white" : "bg-white text-ink-soft ring-1 ring-line hover:text-ink"
                }`}
              >
                {f.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 && (
          <Card><CardContent><p className="py-6 text-center text-sm text-ink-soft">Nothing in the {filter.replace("_", " ").toLowerCase()} queue.</p></CardContent></Card>
        )}

        {rows.map((r) => (
          <Card key={r.id}>
            <CardHeader className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>{r.title}</CardTitle>
                  <Badge tone={r.status === "APPROVED" ? "good" : r.status === "SUBMITTED" ? "accent" : "neutral"}>{r.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Team {r.team.name} ({r.team.code}) · track {r.track.name}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed">{r.body}</p>
              {!["APPROVED"].includes(r.status) && (
                <>
                  <Textarea
                    placeholder="Mentor note (required for reject / request changes)"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => review(r.id, "APPROVE")} className="bg-good hover:bg-green-800">
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
