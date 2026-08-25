import { clsx } from "@/lib/clsx";

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={clsx(
        "inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.14em] text-accent",
        className,
      )}
    >
      <span className="h-1 w-1 bg-accent" aria-hidden />
      {children}
    </p>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {children}
      </h1>
      {sub ? (
        <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">{sub}</p>
      ) : null}
    </div>
  );
}
