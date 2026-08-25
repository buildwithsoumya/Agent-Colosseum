"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface InvitationPreview {
  email: string;
  role: "MENTOR" | "CAPTAIN";
  teamName: string | null;
  expiresAt: string;
  status: string;
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [invite, setInvite] = useState<InvitationPreview | null>(null);
  const [state, setState] = useState<"loading" | "form" | "invalid" | "done">("loading");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<InvitationPreview>(`/api/auth/invitation/${token}`)
      .then((d) => {
        setInvite(d);
        setState(d.status === "VALID" ? "form" : "invalid");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ user: { globalRole: string }; teamRole?: string }>(
        "/api/auth/invitation/accept",
        { token, name, password },
      );
      setState("done");
      setTimeout(
        () => router.push(r.user.globalRole === "MENTOR" ? "/mentor" : "/app/team"),
        1200,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept the invitation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-paper-dim px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-[13px] font-black text-white">A</span>
          <span className="text-sm font-bold tracking-tight">
            Agent<span className="text-accent">Colosseum</span>
          </span>
        </Link>

        {state === "loading" && (
          <p className="rounded-2xl border border-line bg-white px-6 py-10 text-center text-sm text-ink-soft">
            Checking your invitation…
          </p>
        )}

        {state === "invalid" && (
          <div className="rounded-2xl border border-line bg-white px-6 py-10 text-center">
            <p className="text-3xl">⚠️</p>
            <h1 className="mt-3 text-lg font-bold tracking-tight">Invitation unavailable</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              This invitation is invalid, expired, already used, or revoked. Ask an event admin to issue
              a new one.
            </p>
            <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-accent hover:text-accent-strong">
              Go to login →
            </Link>
          </div>
        )}

        {invite && (state === "form" || state === "done") && (
          <div className="rounded-2xl border border-line bg-white p-8 shadow-sm">
            <Badge tone="accent">{invite.role === "MENTOR" ? "Mentor invitation" : "Team Captain invitation"}</Badge>
            <h1 className="mt-3 text-xl font-bold tracking-tight">
              You&apos;re invited to join Agent Colosseum as a{" "}
              {invite.role === "MENTOR" ? "Mentor" : "Team Captain"}
              {invite.teamName ? ` for ${invite.teamName}` : ""}.
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Create your account to continue. The role is fixed by this invitation and cannot be changed.
            </p>
            <p className="mt-3 rounded-lg bg-paper-dim px-3 py-2 font-mono text-xs text-ink-soft">{invite.email}</p>

            {state === "done" ? (
              <p className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-good">
                Account created — redirecting…
              </p>
            ) : (
              <form onSubmit={accept} className="mt-6 space-y-3.5">
                <Input placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
                <Input type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
                <Input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
                {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-bad">{error}</p>}
                <Button type="submit" disabled={busy} className="w-full bg-accent hover:bg-accent-strong">
                  {busy ? "Creating account…" : "Create account & continue"}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
