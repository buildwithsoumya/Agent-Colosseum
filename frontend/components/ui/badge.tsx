import { clsx } from "@/lib/clsx";

import * as React from "react";

type Tone = "neutral" | "accent" | "good" | "bad" | "warn" | "ink";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-module text-ink-soft",
  accent: "border-accent/40 bg-accent/10 text-accent-strong",
  good: "border-good/40 bg-good-soft text-good",
  bad: "border-bad/40 bg-bad-soft text-bad",
  warn: "border-warn/40 bg-warn-soft text-warn",
  ink: "border-line bg-module-raised text-ink",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-[0.125rem] border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
