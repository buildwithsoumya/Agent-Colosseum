"use client";

import Link from "next/link";
import { useState } from "react";
import { clsx } from "@/lib/clsx";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/timeline", label: "Timeline" },
  { href: "/tracks", label: "Tracks" },
  { href: "/feature-store", label: "Feature Store" },
  { href: "/game-arena", label: "Game Arena" },
  { href: "/casino", label: "Casino Royale" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/faq", label: "FAQ" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-[13px] font-black text-white">
            A
          </span>
          <span className="text-sm font-bold tracking-tight">
            Agent<span className="text-accent">Colosseum</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "rounded-md px-2.5 py-1.5 text-[13px] font-medium text-ink-soft transition-colors",
                "hover:bg-paper-dim hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-lg bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-black sm:inline-flex"
          >
            Enter the Arena
          </Link>
          <button
            className="rounded-md p-2 text-ink lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-line bg-white px-4 py-3 lg:hidden">
          <div className="grid grid-cols-2 gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper-dim"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-dim">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-sm font-bold tracking-tight">
            Agent<span className="text-accent">Colosseum</span>
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Build the agent. Spend the credits. Survive the Gauntlet.
          </p>
        </div>
        <p className="text-xs text-neutral-400">
          Event platform demo · PRD v2 implementation
        </p>
      </div>
    </footer>
  );
}
