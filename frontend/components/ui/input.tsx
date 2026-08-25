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
        "h-10 w-full rounded-[0.125rem] border border-line bg-void px-3 text-sm text-ink",
        "placeholder:text-ink-faint focus:border-accent focus:outline-none input-glow",
        "transition-shadow",
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
        "w-full rounded-[0.125rem] border border-line bg-void px-3 py-2 text-sm text-ink",
        "placeholder:text-ink-faint focus:border-accent focus:outline-none input-glow",
        "transition-shadow min-h-[96px]",
        className,
      )}
      {...props}
    />
  );
});
