import { clsx } from "@/lib/clsx";

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("module rounded-[0.25rem] px-4 py-3", className)}>
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-soft">
        {label}
      </p>
      <div className="mt-1.5 text-xl font-bold tracking-tight text-ink tabular-nums">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
