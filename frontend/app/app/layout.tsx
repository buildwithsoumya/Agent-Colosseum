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
    else if (user.globalRole === "ADMIN") router.replace("/admin");
    else if (user.globalRole === "MENTOR") router.replace("/mentor");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center tech-grid">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          <span className="mr-2 text-accent">&gt;</span> Checking credentials…
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col tech-grid">
      <header className="sticky top-0 z-40 border-b border-line bg-void/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-3">
            <Link href="/app" className="flex shrink-0 items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center border border-line bg-module font-mono text-[12px] font-bold text-accent">
                A
              </span>
              <span className="hidden font-display text-sm font-bold tracking-tighter sm:block">
                AGENT<span className="text-accent">COLOSSEUM</span>
              </span>
            </Link>
            <div className="min-w-0 truncate font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              {team ? team.name : "NO TEAM YET"}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={user.globalRole === "ADMIN" ? "/admin" : user.globalRole === "MENTOR" ? "/mentor" : "/spectator"}
                className="hidden rounded-[0.125rem] border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft transition-colors hover:border-accent hover:text-accent sm:block"
              >
                Stage view
              </Link>
              <button
                onClick={() => logout().then(() => router.push("/"))}
                className="rounded-[0.125rem] border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft transition-colors hover:border-bad hover:text-bad"
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
                  "shrink-0 rounded-[0.125rem] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors",
                  pathname === n.href
                    ? "bg-accent text-white"
                    : "text-ink-soft hover:bg-module-raised hover:text-ink",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 space-y-5 px-4 py-6 sm:px-6">
        <PhaseHeader />
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
