import { clsx } from "@/lib/clsx";

import * as React from "react";

type Variant = "primary" | "outline" | "ghost" | "danger" | "accentSoft" | "good";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  // Solid purple, sharp corners, subtle glow — no gradients
  primary:
    "bg-accent text-white hover:bg-accent-strong btn-glow disabled:bg-ink-faint disabled:shadow-none",
  // Transparent + 1px #18181B border; border shifts to accent on hover
  outline:
    "border border-line bg-transparent text-ink hover:border-accent hover:text-white hover:bg-white/5 transition-colors",
  ghost: "text-ink-soft hover:text-ink hover:bg-module-raised",
  danger: "bg-bad text-void hover:opacity-90",
  accentSoft:
    "bg-accent-soft text-accent-strong border border-accent/30 hover:bg-accent/20",
  good: "bg-good text-void hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-[0.25rem] font-mono text-xs font-medium uppercase tracking-[0.1em]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
