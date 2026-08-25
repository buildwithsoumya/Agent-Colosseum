"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/ui/typography";

const DEMO_ACCOUNTS = [
  ["Admin", "admin@colosseum.dev"],
  ["Mentor", "mentor.fintech@colosseum.dev"],
  ["Captain", "captain.prime@colosseum.dev"],
];

export default function LoginPage() {
  const { login, register } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "registered">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "register" && password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const user = await login(email, password);
        router.push(
          user.globalRole === "ADMIN" ? "/admin" : user.globalRole === "MENTOR" ? "/mentor" : "/app",
        );
      } else {
        // The server always assigns PARTICIPANT — privileged roles arrive via admin invitations.
        await register(name, email, password);
        setMode("registered");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function quickFill(demoEmail: string) {
    setMode("login");
    setEmail(demoEmail);
    setPassword("password123");
  }

  if (mode === "registered") {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green-50 text-2xl">✓</div>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Account created successfully.</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            You&apos;re registered as a <span className="font-semibold text-accent-strong">Participant</span>.
          </p>
          <p className="mt-1 text-sm text-ink-soft">Next step: create or join a team.</p>
          <Button
            onClick={() => router.push("/app/team")}
            className="mt-6 w-full bg-accent hover:bg-accent-strong"
          >
            Create or join a team →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen tech-grid lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-16 sm:px-10">
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
            <SectionLabel>{mode === "login" ? "Secure access" : "New operator"}</SectionLabel>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
              {mode === "login" ? "Enter the arena" : "Create your account"}
            </h1>
            <p className="mt-2 text-[13px] text-ink-soft">
              {mode === "login"
                ? "Log in to your team or event staff account."
                : "Every new account is a Participant — you'll create or join a team next."}
            </p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-3.5">
            {mode === "register" && (
              <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            )}
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <Input type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            {mode === "register" && (
              <Input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
            )}
            {error && (
              <p className="border border-bad/40 bg-bad-soft px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bad">
                [ ERROR ] {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full bg-accent hover:bg-accent-strong">
              {busy ? "…" : mode === "login" ? "Log in" : "Create Account"}
            </Button>
          </form>

          <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            {mode === "login" ? (
              <>
                No account?{" "}
                <button onClick={() => setMode("register")} className="font-semibold text-accent hover:text-accent-strong">
                  Create one
                </button>
              </>
            ) : (
              <>
                Already registered?{" "}
                <button onClick={() => setMode("login")} className="font-semibold text-accent hover:text-accent-strong">
                  Log in
                </button>
              </>
            )}
          </p>
          <p className="mt-6 rounded-lg bg-paper-dim px-3 py-2 text-[11px] leading-relaxed text-neutral-400">
            Mentor and organiser accounts are provisioned by event admins via invitation — they cannot be
            self-registered.
          </p>
        </div>
      </div>

      <div className="hidden flex-col justify-center border-l border-line bg-module px-10 lg:flex">
        <SectionLabel>Demo access</SectionLabel>
        <h2 className="mt-3 max-w-md font-display text-3xl font-bold leading-tight tracking-tight">
          Explore every role of the platform.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          The development seed ships accounts for each role. Password for all demo accounts is{" "}
          <code className="border border-line bg-void px-1.5 py-0.5 font-mono text-xs text-accent">
            password123
          </code>
          .
        </p>
        <div className="mt-6 max-w-md space-y-2">
          {DEMO_ACCOUNTS.map(([role, mail], i) => (
            <button
              key={mail}
              onClick={() => quickFill(mail)}
              className="module module-hover coord-frame flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-display text-sm font-semibold">{role}</span>
              </span>
              <span className="font-mono text-xs text-ink-soft">{mail}</span>
            </button>
          ))}
          <p className="pt-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Spectator view needs no login: /spectator
          </p>
        </div>
      </div>
    </div>
  );
}
