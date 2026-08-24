import { clsx } from "@/lib/clsx";

import * as React from "react";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={clsx(
        "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink",
        "placeholder:text-neutral-400 focus:border-accent focus:outline-none",
        "focus:ring-2 focus:ring-accent/15 transition-shadow",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={clsx(
        "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink",
        "placeholder:text-neutral-400 focus:border-accent focus:outline-none",
        "focus:ring-2 focus:ring-accent/15 transition-shadow min-h-[96px]",
        className,
      )}
      {...props}
    />
  );
});
