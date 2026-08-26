"use client";

import Link from "next/link";

/**
 * Clean 403 state shown to an authenticated user who reaches another role's area.
 * Deliberately vague — never leaks what existed behind the restriction.
 */
export function AccessRestricted({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center tech-grid px-6">
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bad">Error 403</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">
          Access restricted
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          You don&apos;t have permission to access this area. Your session has been
          verified; this account&apos;s role does not cover it.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-[0.25rem] border border-line px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink transition-colors hover:border-accent hover:text-accent"
          >
            Return to home
          </Link>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex h-10 items-center rounded-[0.25rem] bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-accent-strong"
            >
              Go to my dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}