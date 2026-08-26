"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useRealtime } from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

interface TeamData {
  team: {
    id: string;
    name: string;
    creditBalance: number;
    track: { key: string; name: string } | null;
    members: Array<{
      teamRole: "MEMBER" | "CAPTAIN";
      user: { id: string; name: string; email: string };
    }>;
    problemStatements: Array<{ status: string; title: string }>;
  };
  teamRole: "MEMBER" | "CAPTAIN";
  maxTeamSize: number;
  gates: Record<string, boolean>;
  joinCode?: string | null;
}

type Phase = "loading" | "choose" | "create" | "join" | "joined" | "team";

export default function TeamPage() {
  const { refresh } = useSession();
  const { on } = useRealtime();
  const [data, setData] = useState<TeamData | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [teamName, setTeamName] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  // post-join celebration payload
  const [joinedInfo, setJoinedInfo] = useState<{ name: string; captainName: string | null } | null>(null);
  // freshly created code shown once
  const [newCode, setNewCode] = useState<string | null>(null);

  // problem statement form
  const [psTitle, setPsTitle] = useState("");
  const [psBody, setPsBody] = useState("");
  const [psStatus, setPsStatus] = useState<string | null>(null);
  const [mentorNote, setMentorNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<TeamData>("/api/teams/me");
      setData(d);
      setPhase("team");
      const ps = await api.get<{ problemStatement: { title: string; body: string; status: string; mentorNote: string | null } | null }>(
        "/api/problems/me",
      );
      if (ps.problemStatement) {
        setPsTitle(ps.problemStatement.title);
        setPsBody(ps.problemStatement.body);
        setPsStatus(ps.problemStatement.status);
        setMentorNote(ps.problemStatement.mentorNote);
      }
    } catch {
      setData(null);
      setPhase("choose");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // realtime: member list/count updates without refresh
  useEffect(
    () =>
      on("team:member_joined", (payload) => {
        const d = payload as { teamId?: string };
        if (!d?.teamId || !data || data.team.id === d.teamId) void load();
      }),
    [on, load, data],
  );

  async function createTeam() {
    setError(null);
    try {
      const r = await api.post<{ joinCode: string }>("/api/teams", { name: teamName });
      setNewCode(r.joinCode);
      await refresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function joinTeam() {
    setError(null);
    try {
      const r = await api.post<{ team: { name: string }; captainName: string | null }>("/api/teams/join", {
        joinCode: codeInput,
      });
      setJoinedInfo({ name: r.team.name, captainName: r.captainName });
      await refresh();
      await load();
      setPhase("joined");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function selectTrack(key: string) {
    setError(null);
    try {
      await api.patch("/api/teams/me/track", { trackKey: key });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function saveAndSubmitPs() {
    setError(null);
    try {
      await api.put("/api/problems/me", { title: psTitle, body: psBody });
      await api.post("/api/problems/me/submit");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function regenerate() {
    setError(null);
    try {
      const r = await api.post<{ joinCode: string }>("/api/teams/me/regenerate-code");
      setNewCode(r.joinCode);
      setRegenOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code);
    setNotice("Team join code copied.");
    setTimeout(() => setNotice(null), 2200);
  }

  /* ------------------------------------------------------------- loading */
  if (phase === "loading") {
    return (
      <div className="grid min-h-screen place-items-center tech-grid">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          <span className="mr-2 text-accent">&gt;</span> Loading team…
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------- no team yet */
  if (!data) {
    return (
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {phase === "joined" && joinedInfo ? (
            <motion.div key="joined" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-accent/40 bg-accent-soft">
                <CardContent className="py-8 text-center">
                  <p className="text-3xl">🛡️</p>
                  <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">You&apos;re in!</h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    Welcome to <span className="font-bold text-accent-strong">{joinedInfo.name}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-soft tabular-nums">
                    Captain: {joinedInfo.captainName ?? "—"} · Your role: MEMBER
                  </p>
                  <Button onClick={() => setPhase("team")} className="mt-5 bg-accent hover:bg-accent-strong">
                    Go to Team Dashboard →
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : phase === "create" ? (
            <motion.div key="create" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card>
                <CardHeader><CardTitle>Create a Team</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                  <Button onClick={createTeam} disabled={teamName.trim().length < 2} className="w-full bg-accent hover:bg-accent-strong">
                    Create Team — you become the Captain
                  </Button>
                  <button onClick={() => setPhase("choose")} className="w-full text-center text-xs text-ink-soft hover:text-ink">
                    ← back
                  </button>
                </CardContent>
              </Card>
              {newCode && (
                <Card className="border-accent/40">
                  <CardContent className="text-center py-6">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">Team Join Code</p>
                    <p className="mt-1 font-mono text-3xl font-black tracking-[0.18em] text-accent-strong">{newCode}</p>
                    <Button variant="outline" size="sm" onClick={() => copyCode(newCode)} className="mt-3">Copy Code</Button>
                    <p className="mt-3 text-xs text-ink-soft">Share this with your teammates so they can join.</p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          ) : phase === "join" ? (
            <motion.div key="join" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card>
                <CardHeader><CardTitle>Join a Team</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-[13px] text-ink-soft">Enter your team&apos;s join code. Ask your team captain for it.</p>
                  <Input
                    placeholder="X7K4-P9Q2"
                    value={codeInput}
                    maxLength={9}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    className="font-mono tracking-[0.25em]"
                  />
                  <Button onClick={joinTeam} disabled={codeInput.length < 4} className="w-full bg-accent hover:bg-accent-strong">
                    Join Team
                  </Button>
                  <button onClick={() => setPhase("choose")} className="w-full text-center text-xs text-ink-soft hover:text-ink">
                    ← back
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="mb-3 text-sm font-semibold">What would you like to do?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="cursor-pointer transition-colors hover:border-violet-300" onClick={() => setPhase("create")}>
                  <CardContent className="py-8 text-center">
                    <p className="text-2xl">⚔️</p>
                    <p className="mt-2 font-semibold">Create a Team</p>
                    <p className="mt-1 text-xs text-ink-soft">You become the captain and get a join code</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer transition-colors hover:border-violet-300" onClick={() => setPhase("join")}>
                  <CardContent className="py-8 text-center">
                    <p className="text-2xl">🤝</p>
                    <p className="mt-2 font-semibold">Join a Team</p>
                    <p className="mt-1 text-xs text-ink-soft">Enter the code your captain shared</p>
                  </CardContent>
                </Card>
              </div>
              <a href="/app" className="mt-4 block text-center text-xs text-ink-soft hover:text-ink">
                Skip for now — go to dashboard
              </a>
            </motion.div>
          )}
        </AnimatePresence>
        {error && <p className="rounded-lg border border-bad/40 bg-bad-soft px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bad">[ ERROR ] {error}</p>}
      </div>
    );
  }

  /* ------------------------------------------------------------- in team */
  const isCaptain = data.teamRole === "CAPTAIN";
  const editable = !psStatus || ["DRAFT", "REJECTED", "CHANGES_REQUESTED"].includes(psStatus);
  const emptySlots = Math.max(0, data.maxTeamSize - data.team.members.length);

  return (
    <div className="space-y-4">
      {/* TEAM panel */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <CardTitle className="text-base">{data.team.name}</CardTitle>
            <Badge tone={isCaptain ? "accent" : "neutral"}>{isCaptain ? "CAPTAIN" : "MEMBER"}</Badge>
          </div>
          <span className="font-mono text-xs text-ink-soft tabular-nums">
            {data.team.members.length} / {data.maxTeamSize} members
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* members + empty slots */}
          <ul className="divide-y divide-line rounded-xl border border-line">
            {data.team.members.map((m) => (
              <li key={m.user.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className={`h-1.5 w-1.5 rounded-full ${m.teamRole === "CAPTAIN" ? "bg-accent" : "bg-neutral-300"}`} />
                  {m.user.name}
                </span>
                <Badge tone={m.teamRole === "CAPTAIN" ? "accent" : "neutral"}>{m.teamRole}</Badge>
              </li>
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <li key={`slot-${i}`} className="flex items-center justify-between px-4 py-2.5 text-neutral-400">
                <span className="text-sm">○ Empty slot</span>
                {isCaptain && <span className="text-[11px]">waiting for a code</span>}
              </li>
            ))}
          </ul>

          {/* join code — captains only */}
          {isCaptain ? (
            <div className="rounded-xl border border-violet-200 bg-accent-soft px-4 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-strong">Team Join Code</p>
              {data.joinCode ? (
                <>
                  <p className="mt-1 font-mono text-2xl font-black tracking-[0.22em] text-ink">{data.joinCode}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => copyCode(data.joinCode!)}>Copy Code</Button>
                    <Button size="sm" variant="outline" onClick={() => setRegenOpen(true)}>Regenerate</Button>
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">Share this code with your teammates.</p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-ink-soft">This team predates secure codes.</p>
                  <Button size="sm" onClick={() => regenerate()} className="mt-2">Generate a code now</Button>
                </>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-line bg-paper-dim px-4 py-3 text-xs text-ink-soft">
              Need to share your team&apos;s join code? Ask your captain.
            </p>
          )}

          {!data.team.track && isCaptain && (
            <div className="border-t border-line pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Captain: choose a track</p>
              <TrackPicker onSelect={selectTrack} />
            </div>
          )}
          {data.team.track && (
            <p className="text-sm">Track: <Badge tone="ink">{data.team.track.name}</Badge></p>
          )}
        </CardContent>
      </Card>

      {/* Problem statement */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Problem statement</CardTitle>
          {psStatus && (
            <Badge tone={psStatus === "APPROVED" ? "good" : psStatus === "REJECTED" || psStatus === "CHANGES_REQUESTED" ? "bad" : "neutral"}>
              {psStatus.replace("_", " ")}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {mentorNote && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Mentor note: {mentorNote}</p>}
          <Input placeholder="Problem statement title" value={psTitle} onChange={(e) => setPsTitle(e.target.value)} disabled={!editable} maxLength={120} />
          <Textarea placeholder="Describe the problem your agent will solve." value={psBody} onChange={(e) => setPsBody(e.target.value)} disabled={!editable} rows={5} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveAndSubmitPs} disabled={!editable || psTitle.length < 4 || psBody.length < 20} className="bg-accent hover:bg-accent-strong">
              {psStatus === "REJECTED" || psStatus === "CHANGES_REQUESTED" ? "Revise & resubmit" : "Submit for approval"}
            </Button>
            {psStatus === "SUBMITTED" && <p className="self-center text-xs text-ink-soft">Waiting for mentor review…</p>}
          </div>
        </CardContent>
      </Card>

      {notice && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-5 right-5 z-50 rounded-lg bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg">
          {notice}
        </motion.p>
      )}

      <Modal open={regenOpen} onClose={() => setRegenOpen(false)} title="Regenerate Team Join Code?">
        <p className="text-sm text-ink-soft">The previous code will stop working immediately. Existing members are unaffected.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => setRegenOpen(false)} className="flex-1">Cancel</Button>
          <Button variant="danger" onClick={regenerate} className="flex-1">Regenerate</Button>
        </div>
      </Modal>

      {error && <p className="rounded-lg border border-bad/40 bg-bad-soft px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bad">[ ERROR ] {error}</p>}
    </div>
  );
}

function TrackPicker({ onSelect }: { onSelect: (key: string) => void }) {
  const [tracks, setTracks] = useState<Array<{ key: string; name: string; description: string }>>([]);
  useEffect(() => {
    api.get<{ tracks: Array<{ key: string; name: string; description: string }> }>("/api/tracks").then((d) => setTracks(d.tracks)).catch(() => {});
  }, []);
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {tracks.map((t) => (
        <button key={t.key} onClick={() => onSelect(t.key)} className="rounded-xl border border-line px-4 py-3 text-left transition-colors hover:border-violet-300">
          <p className="text-sm font-semibold">{t.name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{t.description}</p>
        </button>
      ))}
    </div>
  );
}
