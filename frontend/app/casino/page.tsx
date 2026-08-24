import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";

const TIERS = [
  {
    name: "The Vault",
    risk: "0% risk",
    tone: "border-line",
    win: "Your current balance is locked in — no bonus, no penalty.",
    loss: "Nothing. That's the point.",
    stake: "No wager",
  },
  {
    name: "The Overclock",
    risk: "50 / 50 coin flip",
    tone: "border-violet-200",
    win: "Unlocks high-throughput Tier-1 model keys for Phase 4.",
    loss: "+3 second delay on all tool executions during the Gauntlet.",
    stake: "200 CC fixed",
  },
  {
    name: "The High-Roller",
    risk: "30% win / 70% loss",
    tone: "border-red-200",
    win: "×2.5 multiplier on all points earned during Phase 4.",
    loss: "35% of your total credits deducted immediately.",
    stake: "35% of current balance",
  },
];

export default function CasinoPublicPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionLabel>Casino Royale</SectionLabel>
        <PageTitle sub="Phase 3 freezes coding and opens the stage casino. Every team wagers remaining credits on one of three risk tiers — outcomes are drawn live on the main screen.">
          Fortune favours the reckless
        </PageTitle>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.name} className={`rounded-2xl border bg-white p-6 ${t.tone}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold tracking-tight">{t.name}</h3>
                <span className="rounded-full border border-line bg-paper-dim px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                  {t.risk}
                </span>
              </div>
              <p className="mt-3 text-[13px] text-good">Win — {t.win}</p>
              <p className="mt-2 text-[13px] text-bad">Loss — {t.loss}</p>
              <p className="mt-4 border-t border-line pt-3 font-mono text-xs font-semibold text-ink-soft">
                Stake: {t.stake}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 rounded-xl border border-line bg-paper-dim px-5 py-4 text-[13px] leading-relaxed text-ink-soft">
          <strong className="text-ink">Bust protection:</strong> a team&apos;s balance can never drop below
          300 CC from casino losses. The trade-off is deliberate — teams that spent well arrive with little
          to wager; teams hoarding credits can bet big but already carry a credit-discipline penalty.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
