"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Role } from "@ac/shared";
import { useSession } from "@/lib/session";
import { roleHome } from "@/components/auth/require-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/ui/typography";

const DEMO_ACCOUNTS = [
  ["Admin", "admin@colosseum.dev"],
  ["Mentor", "mentor.fintech@colosseum.dev"],
  ["Captain", "captain.prime@colosseum.dev"],
];

/** Only ever route `next` to a destination the user's role may access. */
function resolveDestination(role: Role, next: string | null): string {
  if (next && next.startsWith("/")) {
    if (role === "ADMIN" && next.startsWith("/admin")) return next;
    if (role === "MENTOR" && next.startsWith("/mentor")) return next;
    if (role !== "ADMIN" && role !== "MENTOR" && next.startsWith("/app")) return next;
  }
  return roleHome(role);
}

function LoginPage() {
  const { login, register } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const user = await login(email, password);
        router.push(resolveDestination(user.role, next));
      } else {
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          return;
        }
        await register(name, email, password, confirmPassword);
        setRegistered(true);
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
              {mode === "login" ? "Enter the arena" : "Join the roster"}
            </h1>
            <p className="mt-2 text-[13px] text-ink-soft">
              {mode === "login"
                ? "Log in to your team or event staff account."
                : "Create a participant account — you can form a team next."}
            </p>
          </div>

          {registered ? (
            <div className="module border-accent/40 px-5 py-6 text-center">
              <p className="font-display text-lg font-bold text-good">Account created successfully.</p>
              <p className="mt-2 text-sm text-ink">
                You&apos;re registered as a <span className="font-semibold text-accent">Participant</span>. You can form
                a team next.
              </p>
              <button
                onClick={() => router.push("/app/team")}
                className="mt-5 w-full rounded-[0.125rem] bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-void transition-colors hover:bg-accent-strong"
              >
                Create or join a team →
              </button>
              <button
                onClick={() => router.push("/app")}
                className="mt-2 w-full rounded-[0.125rem] border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft transition-colors hover:text-ink"
              >
                Go to my dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-3.5">
              {mode === "register" && (
                <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
              )}
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              <Input type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
              {mode === "register" && (
                <Input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              )}
              {error && (
                <p className="border border-bad/40 bg-bad-soft px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bad">
                  [ ERROR ] {error}
                </p>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
              </Button>
            </form>
          )}

          <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            {mode === "login" ? (
              <>
                No account?{" "}
                <button onClick={() => setMode("register")} className="font-semibold text-accent hover:text-accent-strong">
                  Register
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

export default function LoginPageBoundary() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
