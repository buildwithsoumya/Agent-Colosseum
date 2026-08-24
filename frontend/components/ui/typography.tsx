import { clsx } from "@/lib/clsx";

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={clsx("text-xs font-semibold uppercase tracking-[0.14em] text-accent", className)}>
      {children}
    </p>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{children}</h1>
      {sub ? <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">{sub}</p> : null}
    </div>
  );
}
