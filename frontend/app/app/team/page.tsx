"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TeamData {
  team: {
    id: string;
    name: string;
    code: string;
    creditBalance: number;
    track: { key: string; name: string } | null;
    members: Array<{ isCaptain: boolean; user: { id: string; name: string; email: string } }>;
    problemStatements: Array<{ status: string; title: string }>;
  };
  isCaptain: boolean;
}

interface TrackOption {
  key: string;
  name: string;
  description: string;
}

export default function TeamPage() {
  const { refresh } = useSession();
  const [data, setData] = useState<TeamData | null>(null);
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // problem statement form
  const [psTitle, setPsTitle] = useState("");
  const [psBody, setPsBody] = useState("");
  const [psStatus, setPsStatus] = useState<string | null>(null);
  const [mentorNote, setMentorNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<TeamData>("/api/teams/me");
      setData(d);
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
    }
  }, []);

  useEffect(() => {
    void load();
    api.get<{ tracks: TrackOption[] }>("/api/tracks").then((d) => setTracks(d.tracks)).catch(() => {});
  }, [load]);

  async function createTeam() {
    setError(null);
    try {
      await api.post("/api/teams", { name: teamName });
      await load();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function joinTeam() {
    setError(null);
    try {
      await api.post("/api/teams/join", { code: joinCode.toUpperCase() });
      await load();
      await refresh();
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

  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Create a team</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <Button onClick={createTeam} disabled={teamName.length < 2} className="w-full">
              Create team (you become captain)
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Join a team</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="6-character invite code" value={joinCode} maxLength={6} onChange={(e) => setJoinCode(e.target.value)} className="uppercase font-mono tracking-[0.2em]" />
            <Button onClick={joinTeam} disabled={joinCode.length !== 6} variant="outline" className="w-full">
              Join with code
            </Button>
          </CardContent>
        </Card>
        {error && <p className="lg:col-span-2 font-mono text-[11px] uppercase tracking-wider text-bad">[ ERROR ] {error}</p>}
      </div>
    );
  }

  const editable = !psStatus || ["DRAFT", "REJECTED", "CHANGES_REQUESTED"].includes(psStatus);
  const phaseAllowsTrack = true;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{data.team.name}</CardTitle>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-soft">
              invite code{" "}
              <span className="border border-line bg-void px-1.5 py-0.5 font-bold tracking-[0.15em] text-accent">
                {data.team.code}
              </span>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-line">
            {data.team.members.map((m) => (
              <li key={m.user.id} className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <span className="h-1.5 w-1.5 bg-accent" />
                  {m.user.name}
                </span>
                {m.isCaptain && <Badge tone="accent">Captain</Badge>}
              </li>
            ))}
          </ul>

          {!data.team.track && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                Captain: choose a track
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {tracks.map((t) => (
                  <button
                    key={t.key}
                    disabled={!phaseAllowsTrack || !data.isCaptain}
                    onClick={() => selectTrack(t.key)}
                    className="module module-hover px-4 py-3 text-left disabled:pointer-events-none disabled:opacity-40"
                  >
                    <p className="text-sm font-semibold text-ink">{t.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          {data.team.track && (
            <p className="mt-3 text-sm text-ink">
              Track: <Badge tone="ink">{data.team.track.name}</Badge>
            </p>
          )}
        </CardContent>
      </Card>

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
          {mentorNote && (
            <p className="border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn">
              [ MENTOR NOTE ] {mentorNote}
            </p>
          )}
          <Input
            placeholder="Problem statement title"
            value={psTitle}
            onChange={(e) => setPsTitle(e.target.value)}
            disabled={!editable}
            maxLength={120}
          />
          <Textarea
            placeholder="Describe the problem your agent will solve. It must sit inside your chosen track, be achievable in event time, and be addressable by both generic tasks."
            value={psBody}
            onChange={(e) => setPsBody(e.target.value)}
            disabled={!editable}
            rows={5}
            minLength={20}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={saveAndSubmitPs}
              disabled={!editable || psTitle.length < 4 || psBody.length < 20}
            >
              {psStatus === "REJECTED" || psStatus === "CHANGES_REQUESTED" ? "Revise & resubmit" : "Submit for approval"}
            </Button>
            {psStatus === "SUBMITTED" && (
              <p className="self-center font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Waiting for mentor review…
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      {error && <p className="font-mono text-[11px] uppercase tracking-wider text-bad">[ ERROR ] {error}</p>}
    </div>
  );
}
