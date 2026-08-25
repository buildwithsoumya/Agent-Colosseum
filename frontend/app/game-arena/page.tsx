import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";

export default function GameArenaPublicPage() {
  return (
    <div className="min-h-screen tech-grid">
      <SiteNav />
      <main className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6">
        <SectionLabel>Game Arena</SectionLabel>
        <PageTitle sub="An optional credit-earning station, open to every team from Phase 1 through the end of Phase 2. It costs time, not credits — a member at the arena is a member not building.">
          Earn credits between builds
        </PageTitle>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {[
            ["Open to everyone", "No balance gate and no entry fee. Use it to fund a bigger build, recover from overspending, or ignore it entirely."],
            ["Four runs per team", "Across the whole event. One member plays at a time while the rest keep building."],
            ["Honest payouts", "A successful run pays roughly one small component's cost — enough to recover from a miscalculation, never enough to fund a full build by grinding."],
          ].map(([t, d], i) => (
            <div key={t} className="module module-hover coord-frame relative p-6">
              <span className="absolute right-4 top-4 font-mono text-[10px] text-ink-faint">
                [ NODE-{String(i + 1).padStart(2, "0")} ]
              </span>
              <h3 className="font-display text-base font-semibold tracking-tight text-ink">{t}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 border border-accent/30 bg-accent/5 p-6">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Demo mini-games
          </h3>
          <div className="mt-4 grid gap-2 text-[13px] text-ink sm:grid-cols-3">
            <p className="module p-3 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Reaction Grid — hit the lit tiles.
            </p>
            <p className="module p-3 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Memory Sequence — repeat the growing pattern.
            </p>
            <p className="module p-3 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Target Sum — pick cards that add exactly to the target.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
