"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/session";
import { SiteFooter } from "@/components/site/nav";
import { PhaseHeader } from "@/components/event/phase-header";
import { clsx } from "@/lib/clsx";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/team", label: "Team" },
  { href: "/app/tasks", label: "Tasks" },
  { href: "/app/store", label: "Store" },
  { href: "/app/arena", label: "Arena" },
  { href: "/app/casino", label: "Casino" },
  { href: "/app/submission", label: "Submit" },
  { href: "/app/wallet", label: "Wallet" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, team, loading, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role === "ADMIN") router.replace("/admin");
    else if (user.role === "MENTOR") router.replace("/mentor");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="text-sm text-ink-soft">Checking credentials…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-3">
            <Link href="/app" className="flex shrink-0 items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-[13px] font-black text-white">A</span>
              <span className="hidden text-sm font-bold tracking-tight sm:block">
                Agent<span className="text-accent">Colosseum</span>
              </span>
            </Link>
            <div className="min-w-0 truncate text-xs font-medium text-ink-soft">
              {team ? team.name : "No team yet"}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={user.role === "PARTICIPANT" ? "/spectator" : "/admin"}
                className="hidden rounded-md px-2 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper-dim hover:text-ink sm:block"
              >
                Stage view
              </Link>
              <button
                onClick={() => logout().then(() => router.push("/"))}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold transition-colors hover:border-ink"
              >
                Log out
              </button>
            </div>
          </div>
          <nav className="-mx-1 flex gap-1 overflow-x-auto pb-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                  pathname === n.href
                    ? "bg-accent-soft text-accent-strong"
                    : "text-ink-soft hover:bg-paper-dim hover:text-ink",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6 sm:px-6">
        <PhaseHeader />
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
