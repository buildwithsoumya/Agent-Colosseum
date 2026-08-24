import { clsx } from "@/lib/clsx";

import * as React from "react";

type Tone = "neutral" | "accent" | "good" | "bad" | "warn" | "ink";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-paper-dim text-ink-soft",
  accent: "border-violet-200 bg-accent-soft text-accent-strong",
  good: "border-green-200 bg-green-50 text-good",
  bad: "border-red-200 bg-red-50 text-bad",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  ink: "border-ink bg-ink text-white",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-tight",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
