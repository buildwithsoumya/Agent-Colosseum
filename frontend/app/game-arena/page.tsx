import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";

export default function GameArenaPublicPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionLabel>Game Arena</SectionLabel>
        <PageTitle sub="An optional credit-earning station, open to every team from Phase 1 through the end of Phase 2. It costs time, not credits — a member at the arena is a member not building.">
          Earn credits between builds
        </PageTitle>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {[
            ["Open to everyone", "No balance gate and no entry fee. Use it to fund a bigger build, recover from overspending, or ignore it entirely."],
            ["Four runs per team", "Across the whole event. One member plays at a time while the rest keep building."],
            ["Honest payouts", "A successful run pays roughly one small component's cost — enough to recover from a miscalculation, never enough to fund a full build by grinding."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-line bg-white p-6">
              <h3 className="text-sm font-bold tracking-tight">{t}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-accent-soft p-6">
          <h3 className="text-sm font-bold tracking-tight text-accent-strong">Demo mini-games</h3>
          <div className="mt-3 grid gap-2 text-[13px] text-ink sm:grid-cols-3">
            <p>Reaction Grid — hit the lit tiles.</p>
            <p>Memory Sequence — repeat the growing pattern.</p>
            <p>Target Sum — pick cards that add exactly to the target.</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
