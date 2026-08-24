"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useCountdown, useRealtime } from "@/lib/realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Overview {
  phase: { phase: string; status: string; secondsRemaining: number };
  stats: { teamsCount: number; pendingPS: number; approvedPS: number; purchases: number; arenaRuns: number; casinoBets: number };
  jobs: Array<{ jobId: string; teamName: string; status: string; gauntletScore: number | null; payloadsPassed: string | null }>;
  audit: Array<{ id: string; actorEmail: string | null; action: string; detail: Record<string, unknown> | null; createdAt: string }>;
}

interface TeamRow {
  id: string;
  name: string;
  code: string;
  creditBalance: number;
  track: { name: string } | null;
  members: Array<{ user: { name: string }; isCaptain: boolean }>;
  problemStatements: Array<{ status: string }>;
  submissions: Array<{ status: string }>;
}

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [adjust, setAdjust] = useState<{ teamId: string; amount: string; reason: string }>({ teamId: "", amount: "", reason: "" });
  const [message, setMessage] = useState<string | null>(null);
  const { user, loading, logout } = useSession();
  const router = useRouter();
  const { on, refreshEventState } = useRealtime();
  const { seconds } = useCountdown();

  const load = useCallback(async () => {
    try {
      const [o, t] = await Promise.all([
        api.get<Overview>("/api/admin/overview"),
        api.get<{ teams: TeamRow[] }>("/api/admin/teams"),
      ]);
      setOverview(o);
      setTeams(t.teams);
    } catch {
      /* unauthenticated */
    }
  }, []);

  useEffect(() => {
    void load();
    const i = setInterval(() => void load(), 10_000);
    return () => clearInterval(i);
  }, [load]);

  useEffect(
    () =>
      on("leaderboard:updated", () => {
        void refreshEventState();
      }),
    [on],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role !== "ADMIN") router.replace(user.role === "MENTOR" ? "/mentor" : "/app");
  }, [user, loading, router]);

  async function action(path: string) {
    try {
      await api.post(path);
      await load();
      await refreshEventState();
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function broadcast() {
    if (announcement.trim().length < 2) return;
    await api.post("/api/admin/announcements", { message: announcement, level: "info" });
    setAnnouncement("");
  }

  async function adjustCredits() {
    try {
      await api.post("/api/admin/credits/adjust", {
        teamId: adjust.teamId,
        amount: Number(adjust.amount),
        reason: adjust.reason,
      });
      setAdjust({ teamId: "", amount: "", reason: "" });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Adjustment failed");
    }
  }

  if (loading || !user || user.role !== "ADMIN") {
    return <div className="grid min-h-screen place-items-center"><p className="text-sm text-ink-soft">Checking credentials…</p></div>;
  }

  return (
    <div className="min-h-screen bg-paper-dim">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-[13px] font-black text-white">A</span>
              <span className="text-sm font-bold tracking-tight">Control Center</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/spectator" className="text-xs font-semibold text-accent hover:text-accent-strong">Stage view →</Link>
            <button onClick={() => logout().then(() => router.push("/"))} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-ink">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        {overview && (
          <>
            {/* Phase control */}
            <Card>
              <CardHeader><CardTitle>Event control</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-mono text-4xl font-black tabular-nums">
                        {seconds >= 0 ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : "--:--"}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-neutral-400">phase timer</p>
                    </div>
                    <div>
                      <Badge tone="accent">{overview.phase.phase}</Badge>
                      <Badge tone={overview.phase.status === "RUNNING" ? "good" : overview.phase.status === "PAUSED" ? "warn" : "neutral"}>
                        {overview.phase.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => action("/api/admin/event/start")} disabled={overview.phase.status !== "SETUP"}>Start</Button>
                    <Button size="sm" variant="outline" onClick={() => action("/api/admin/event/pause")} disabled={overview.phase.status !== "RUNNING"}>Pause</Button>
                    <Button size="sm" variant="outline" onClick={() => action("/api/admin/event/resume")} disabled={overview.phase.status !== "PAUSED"}>Resume</Button>
                    <Button size="sm" onClick={() => action("/api/admin/event/advance")} disabled={overview.phase.status === "SETUP" || overview.phase.phase === "PHASE_5"}>Advance phase →</Button>
                    <RevealButtons onDone={load} />
                  </div>
                </div>

                {/* Broadcast */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  <Input
                    placeholder="Broadcast announcement to all dashboards…"
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                    className="max-w-md flex-1"
                  />
                  <Button size="md" variant="accentSoft" onClick={broadcast}>Broadcast</Button>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Teams", overview.stats.teamsCount],
                ["Pending PS", overview.stats.pendingPS],
                ["Approved PS", overview.stats.approvedPS],
                ["Store purchases", overview.stats.purchases],
                ["Arena runs", overview.stats.arenaRuns],
                ["Casino bets", overview.stats.casinoBets],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl border border-line bg-white px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{l as string}</p>
                  <p className="mt-1 font-mono text-xl font-bold tabular-nums">{v as number}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Teams + credits adjustment */}
              <Card>
                <CardHeader><CardTitle>Teams &amp; credit adjustment</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <ul className="max-h-72 divide-y divide-line overflow-y-auto">
                    {teams.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">{t.name} <span className="ml-1 font-mono text-[10px] text-neutral-400">{t.code}</span></p>
                          <p className="truncate text-[11px] text-neutral-400">
                            {t.track?.name ?? "no track"} · PS {t.problemStatements[0]?.status ?? "—"} · sub {t.submissions[0]?.status ?? "—"}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-bold tabular-nums">{t.creditBalance}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-1.5 border-t border-line p-3">
                    <select
                      value={adjust.teamId}
                      onChange={(e) => setAdjust((a) => ({ ...a, teamId: e.target.value }))}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-2 text-xs focus:border-accent focus:outline-none"
                    >
                      <option value="">Team…</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      placeholder="+/- CC"
                      value={adjust.amount}
                      onChange={(e) => setAdjust((a) => ({ ...a, amount: e.target.value }))}
                      className="w-24"
                    />
                    <Input
                      placeholder="Reason"
                      value={adjust.reason}
                      onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))}
                      className="w-32"
                    />
                    <Button size="sm" onClick={adjustCredits} disabled={!adjust.teamId || !Number(adjust.amount) || !adjust.reason}>
                      Adjust
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Gauntlet jobs */}
              <Card>
                <CardHeader><CardTitle>Gauntlet monitor</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {overview.jobs.length === 0 ? (
                    <p className="px-5 py-8 text-center text-xs text-ink-soft">No evaluation jobs yet.</p>
                  ) : (
                    <ul className="max-h-72 divide-y divide-line overflow-y-auto">
                      {overview.jobs.map((j) => (
                        <li key={j.jobId} className="flex items-center justify-between px-4 py-2">
                          <span className="text-[13px] font-medium">{j.teamName}</span>
                          <span className="flex items-center gap-2">
                            {j.payloadsPassed && <span className="text-[11px] text-ink-soft tabular-nums">{j.payloadsPassed}</span>}
                            <Badge tone={j.status === "COMPLETED" ? "good" : j.status === "FAILED" ? "bad" : "accent"}>{j.status}</Badge>
                            {j.gauntletScore !== null && <span className="font-mono text-sm font-bold tabular-nums">{j.gauntletScore}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Audit log */}
            <Card>
              <CardHeader><CardTitle>Audit log</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ul className="max-h-56 divide-y divide-line overflow-y-auto">
                  {overview.audit.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2">
                      <span className="min-w-0 truncate text-[12px]">
                        <span className="font-mono font-semibold text-accent-strong">{a.action}</span>
                        <span className="ml-2 text-ink-soft">{a.actorEmail ?? "system"}</span>
                        {a.detail && Object.keys(a.detail).length > 0 && (
                          <span className="ml-2 font-mono text-[10px] text-neutral-400">{JSON.stringify(a.detail).slice(0, 90)}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-[10px] text-neutral-400">{new Date(a.createdAt).toLocaleTimeString()}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
        {message && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-bad">{message}</p>}
      </main>
    </div>
  );
}

function RevealButtons({ onDone }: { onDone: () => void }) {
  return (
    <>
      <Button
        size="sm"
        variant="accentSoft"
        onClick={async () => {
          await api.post("/api/admin/tasks/reveal", { taskNumber: "TASK_1" });
          onDone();
        }}
      >
        Reveal Task 1
      </Button>
      <Button
        size="sm"
        variant="accentSoft"
        onClick={async () => {
          await api.post("/api/admin/tasks/reveal", { taskNumber: "TASK_2" });
          onDone();
        }}
      >
        Reveal Task 2
      </Button>
    </>
  );
}
