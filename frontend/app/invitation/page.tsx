"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/ui/typography";

function InvitationFlow() {
  const searchParams = useSearchParams();
  const { registerInvitation } = useSession();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(true);
  const [inv, setInv] = useState<{ email: string; role: "MENTOR" | "CAPTAIN"; teamName: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link.");
      setLoading(false);
      return;
    }
    api
      .get<{ email: string; role: "MENTOR" | "CAPTAIN"; teamName: string | null }>(`/api/auth/invitation?token=${token}`)
      .then((d) => {
        setInv(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Invitation is not valid.");
        setLoading(false);
      });
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await registerInvitation({ name, email: inv!.email, password, confirmPassword, invitationToken: token });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account");
    } finally {
      setBusy(false);
    }
  }

  const isMentor = inv?.role === "MENTOR";

  return (
    <div className="grid min-h-screen place-items-center tech-grid px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center border border-line bg-module font-mono text-[13px] font-bold text-accent">
            A
          </span>
          <span className="font-display text-sm font-bold tracking-tighter">
            AGENT<span className="text-accent">COLOSSEUM</span>
          </span>
        </Link>

        <div className="relative">
          <span className="absolute -left-4 -top-4 font-mono text-[10px] text-line-strong">+</span>
          <span className="absolute -right-4 -top-4 font-mono text-[10px] text-line-strong">+</span>
          <SectionLabel>Invitation</SectionLabel>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
            {loading ? "Checking invitation…" : done ? "Welcome aboard." : "Create your account"}
          </h1>
          <p className="mt-2 text-[13px] text-ink-soft">
            {loading
              ? "Please wait."
              : done
                ? "Your account is ready."
                : isMentor
                  ? "You're invited to join Agent Colosseum as a Mentor."
                  : "You're invited to become a Team Captain."}
          </p>
        </div>

        {loading && (
          <p className="mt-8 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            <span className="mr-2 text-accent">&gt;</span> Validating invitation…
          </p>
        )}

        {!loading && error && (
          <div className="mt-8 space-y-4">
            <p className="border border-bad/40 bg-bad-soft px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bad">
              [ ERROR ] {error}
            </p>
            <Link href="/login" className="block text-center font-mono text-[11px] font-semibold uppercase tracking-wider text-accent hover:text-accent-strong">
              ← Back to login
            </Link>
          </div>
        )}

        {!loading && !error && inv && !done && (
          <div className="module border-accent/40 px-5 py-4">
            <p className="text-[13px] leading-relaxed text-ink">
              {isMentor ? (
                <span>
                  Role: <span className="font-semibold text-accent">Mentor</span> — you'll review and approve problem
                  statements.
                </span>
              ) : (
                <span>
                  Role: <span className="font-semibold text-accent">Team Captain</span>
                  {inv.teamName ? (
                    <>
                      {" "}
                      for <span className="font-semibold">"{inv.teamName}"</span>
                    </>
                  ) : (
                    ""
                  )}
                </span>
              )}
            </p>
            <p className="mt-2 break-all font-mono text-[10px] uppercase tracking-wider text-ink-faint">{inv.email}</p>
          </div>
        )}

        {!loading && !error && inv && !done && (
          <form onSubmit={submit} className="mt-8 space-y-3.5">
            <Input
              type="email"
              placeholder="Email"
              value={inv.email}
              readOnly
              disabled
              className="opacity-60"
            />
            <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            <Input
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <Input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            {error && (
              <p className="border border-bad/40 bg-bad-soft px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bad">
                [ ERROR ] {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "…" : "Create account"}
            </Button>
          </form>
        )}

        {done && (
          <div className="mt-8 space-y-3">
            <div className="module border-accent/40 px-5 py-6 text-center">
              <p className="font-display text-lg font-bold text-good">Account created successfully.</p>
              <p className="mt-2 text-sm text-ink">
                {isMentor
                  ? "You can now access the mentor dashboard."
                  : "You're now the captain of your team. Continue to the arena."}
              </p>
              <button
                onClick={() => router.push(isMentor ? "/mentor" : "/app")}
                className="mt-5 w-full rounded-[0.125rem] bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-void transition-colors hover:bg-accent-strong"
              >
                {isMentor ? "Open mentor dashboard →" : "Go to my dashboard →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvitationPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center tech-grid"><p className="font-mono text-[11px] text-ink-soft">Loading…</p></div>}>
      <InvitationFlow />
    </Suspense>
  );
}