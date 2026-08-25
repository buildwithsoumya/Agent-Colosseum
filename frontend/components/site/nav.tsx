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
    <header className="sticky top-0 z-40 border-b border-line bg-void/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center border border-line bg-module font-mono text-[12px] font-bold text-accent">
            A
          </span>
          <span className="font-display text-sm font-bold tracking-tighter text-ink">
            AGENT<span className="text-accent">COLOSSEUM</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "rounded-[0.125rem] px-2.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-soft transition-colors",
                "hover:bg-module-raised hover:text-accent",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-[0.125rem] bg-accent px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-accent-strong sm:inline-flex btn-glow"
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
        <nav className="border-t border-line bg-void px-4 py-3 lg:hidden">
          <div className="grid grid-cols-2 gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:bg-module-raised"
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
    <footer className="mt-20 border-t border-line bg-module">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 px-4 py-12 sm:px-6">
        <div className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink">
          <span className="grid h-8 w-8 place-items-center border border-line bg-void font-mono text-sm text-accent">
            A
          </span>
          AGENT COLOSSEUM
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          {["Technical Documentation", "Terminal Access", "Security Protocols", "Privacy"].map((label) => (
            <span
              key={label}
              className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-ink-faint transition-colors hover:text-ink"
            >
              {label}
            </span>
          ))}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          © 2026 AGENT COLOSSEUM · SYSTEM VERSION 2.4.0
        </p>
      </div>
    </footer>
  );
}
