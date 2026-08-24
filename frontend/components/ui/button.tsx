import { clsx } from "@/lib/clsx";

import * as React from "react";

type Variant = "primary" | "outline" | "ghost" | "danger" | "accentSoft";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-black disabled:bg-neutral-300",
  outline: "border border-line bg-white text-ink hover:border-ink transition-colors",
  ghost: "text-ink-soft hover:text-ink hover:bg-paper-dim",
  danger: "bg-bad text-white hover:opacity-90",
  accentSoft: "bg-accent-soft text-accent-strong hover:brightness-[0.98]",
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
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-tight",
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
