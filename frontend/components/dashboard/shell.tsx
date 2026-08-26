"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { Badge } from "@/components/ui/badge";

export interface NavItem {
  href: string;
  label: string;
}

interface DashboardShellProps {
  brand: string;
  accentWord?: string;
  nav: NavItem[];
  userName?: string;
  /** Participant variant: shows the user's team and captain marker. */
  teamName?: string | null;
  captain?: boolean;
  rightSlot?: React.ReactNode;
  onLogout: () => void;
  children: React.ReactNode;
}

/**
 * Shared role-aware dashboard chrome. Each role supplies its own navigation set
 * through `nav`; the header surfaces role-appropriate context (name for staff,
 * team + captain marker for participants). Navigation is scrollable on mobile.
 */
export function DashboardShell({
  brand,
  accentWord,
  nav,
  userName,
  teamName,
  captain,
  rightSlot,
  onLogout,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();

  const brandParts = accentWord ? brand.split(accentWord) : null;

  return (
    <div className="min-h-screen tech-grid">
      <header className="sticky top-0 z-40 border-b border-line bg-void/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-3">
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center border border-line bg-module font-mono text-[12px] font-bold text-accent">
                A
              </span>
              <span className="hidden font-display text-sm font-bold tracking-tighter sm:block">
                {brandParts ? (
                  <>
                    {brandParts[0]}
                    <span className="text-accent">{accentWord}</span>
                    {brandParts[1]}
                  </>
                ) : (
                  brand
                )}
              </span>
            </Link>

            {teamName !== undefined && (
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  {teamName}
                </span>
                {captain && <Badge tone="accent">Captain</Badge>}
              </div>
            )}

            <div className="flex shrink-0 items-center gap-2">
              {rightSlot}
              {userName && (
                <span className="hidden max-w-[160px] truncate font-mono text-[11px] uppercase tracking-wider text-ink-soft md:block">
                  {userName}
                </span>
              )}
              <button
                onClick={onLogout}
                className="rounded-[0.125rem] border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft transition-colors hover:border-bad hover:text-bad"
              >
                Log out
              </button>
            </div>
          </div>

          <nav className="-mx-1 flex gap-1 overflow-x-auto pb-2">
            {nav.map((n) => (
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

      <main className="mx-auto w-full max-w-[1280px] space-y-5 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}