"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, formatCC } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { CreditsWidget } from "@/components/event/credits-widget";

interface Tx {
  id: string;
  amount: number;
  type: string;
  source: string;
  balanceAfter: number;
  createdAt: string;
}

export default function ParticipantDashboard() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [earned, setEarned] = useState(0);
  const [spent, setSpent] = useState(0);
  const [psStatus, setPsStatus] = useState<string | null>(null);
  const [submission, setSubmission] = useState<string | null>(null);
  const { eventState, on } = useRealtime();

  useEffect(() => {
    api
      .get<{ transactions: Tx[]; earned: number; spent: number }>("/api/teams/me/transactions")
      .then((d) => {
        setTxs(d.transactions.slice(0, 6));
        setEarned(d.earned);
        setSpent(d.spent);
      })
      .catch(() => {});
    api
      .get<{ problemStatement: { status: string } | null }>("/api/problems/me")
      .then((d) => setPsStatus(d.problemStatement?.status ?? null))
      .catch(() => {});
    api
      .get<{ submission: { status: string; repoUrl: string } | null }>("/api/submissions/me")
      .then((d) => setSubmission(d.submission?.status ?? null))
      .catch(() => {});
  }, []);

  useEffect(
    () =>
      on("credits:updated", () => {
        api
          .get<{ transactions: Tx[]; earned: number; spent: number }>("/api/teams/me/transactions")
          .then((d) => {
            setTxs(d.transactions.slice(0, 6));
            setEarned(d.earned);
            setSpent(d.spent);
          })
          .catch(() => {});
      }),
    [on],
  );

  if (!eventState) return null;

  const objectiveLink =
    eventState.phase === "PHASE_0"
      ? { href: "/app/team", label: "Set up your team" }
      : eventState.phase === "PHASE_1" || eventState.phase === "PHASE_2"
        ? { href: "/app/tasks", label: "Work the tasks & store" }
        : eventState.phase === "PHASE_3"
          ? { href: "/app/casino", label: "Enter Casino Royale" }
          : eventState.phase === "PHASE_4"
            ? { href: "/app/submission", label: "Lock your submission" }
            : { href: "/leaderboard", label: "Watch the podium" };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CreditsWidget />
        <Stat label="Spent" value={formatCC(spent)} hint="this event" />
        <Stat label="Earned" value={formatCC(earned)} hint="store refunds & arena" />
        <Stat
          label="Problem statement"
          value={
            psStatus ? (
              <Badge tone={psStatus === "APPROVED" ? "good" : psStatus === "REJECTED" ? "bad" : "neutral"}>
                {psStatus.replace("_", " ")}
              </Badge>
            ) : (
              <span className="text-sm font-medium text-ink-soft">Not submitted</span>
            )
          }
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              [ OBJ ] Current objective
            </p>
            <p className="mt-1 text-sm text-ink">{eventState.objective}</p>
          </div>
          <Link
            href={objectiveLink.href}
            className="btn-glow inline-flex h-10 shrink-0 items-center rounded-[0.25rem] bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-accent-strong"
          >
            {objectiveLink.label} →
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
            <Link href="/app/wallet" className="font-mono text-[11px] uppercase tracking-wider text-accent hover:text-accent-strong">
              Full wallet →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {txs.length === 0 ? (
              <p className="px-5 py-8 text-center font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                No credits moved yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {txs.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{t.source}</p>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                        {new Date(t.createdAt).toLocaleTimeString()} · balance {formatCC(t.balanceAfter)}
                      </p>
                    </div>
                    <span
                      className={`ml-3 shrink-0 font-mono text-sm font-bold tabular-nums ${
                        t.amount >= 0 ? "text-good" : "text-bad"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {t.amount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status board</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              ["Feature Store", eventState.gates.storeOpen, "/app/store"],
              ["Game Arena", eventState.gates.arenaOpen, "/app/arena"],
              ["Casino Royale", eventState.gates.casinoOpen, "/app/casino"],
              ["Gauntlet submissions", eventState.gates.submissionsOpen, "/app/submission"],
            ].map(([label, open, href]) => (
              <Link
                key={label as string}
                href={href as string}
                className="module module-hover flex items-center justify-between px-4 py-2.5"
              >
                <span className="text-[13px] font-medium text-ink">{label as string}</span>
                <Badge tone={open ? "good" : "neutral"}>{open ? "OPEN" : "CLOSED"}</Badge>
              </Link>
            ))}
            <div className="module flex items-center justify-between px-4 py-2.5">
              <span className="text-[13px] font-medium text-ink">Submission</span>
              <Badge tone={submission === "EVALUATED" ? "good" : submission && submission !== "OPEN" ? "accent" : "neutral"}>
                {submission ?? "NONE"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
