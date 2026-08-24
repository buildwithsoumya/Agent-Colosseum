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
    <div className={clsx("rounded-xl border border-line bg-white px-4 py-3", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft">{label}</p>
      <div className="mt-1 text-xl font-bold tracking-tight text-ink tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-ink-soft">{hint}</div> : null}
    </div>
  );
}
