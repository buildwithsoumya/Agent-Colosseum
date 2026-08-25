import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";

const TIERS = [
  {
    name: "The Vault",
    risk: "0% RISK",
    accent: "text-good",
    border: "border-good/30",
    win: "Your current balance is locked in — no bonus, no penalty.",
    loss: "Nothing. That's the point.",
    stake: "NO WAGER",
  },
  {
    name: "The Overclock",
    risk: "50/50 FLIP",
    accent: "text-accent",
    border: "border-accent/30",
    win: "Unlocks high-throughput Tier-1 model keys for Phase 4.",
    loss: "+3 second delay on all tool executions during the Gauntlet.",
    stake: "200 CC FIXED",
  },
  {
    name: "The High-Roller",
    risk: "30% WIN / 70% LOSS",
    accent: "text-bad",
    border: "border-bad/30",
    win: "×2.5 multiplier on all points earned during Phase 4.",
    loss: "35% of your total credits deducted immediately.",
    stake: "35% OF BALANCE",
  },
];

export default function CasinoPublicPage() {
  return (
    <div className="min-h-screen tech-grid">
      <SiteNav />
      <main className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6">
        <SectionLabel>Casino Royale</SectionLabel>
        <PageTitle sub="Phase 3 freezes coding and opens the stage casino. Every team wagers remaining credits on one of three risk tiers — outcomes are drawn live on the main screen.">
          Fortune favours the reckless
        </PageTitle>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {TIERS.map((t, i) => (
            <div key={t.name} className={`module coord-frame relative flex flex-col p-6 ${t.border}`}>
              <span className="absolute right-4 top-4 font-mono text-[10px] text-ink-faint">
                [ TIER-{String(i + 1).padStart(2, "0")} ]
              </span>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold tracking-tight text-ink">{t.name}</h3>
                <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${t.accent}`}>
                  {t.risk}
                </span>
              </div>
              <div className="mt-5 flex-1 space-y-3">
                <p className="text-[13px] leading-relaxed text-ink-soft">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-good">
                    WIN ▸{" "}
                  </span>
                  {t.win}
                </p>
                <p className="text-[13px] leading-relaxed text-ink-soft">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-bad">
                    LOSS ▸{" "}
                  </span>
                  {t.loss}
                </p>
              </div>
              <p className="mt-4 border-t border-line pt-3 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-warn">
                Stake: {t.stake}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 border border-line bg-module p-6">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            <strong className="font-mono text-xs uppercase tracking-[0.14em] text-warn">
              Bust protection:
            </strong>{" "}
            <span className="mt-2 block">
              a team&apos;s balance can never drop below 300 CC from casino losses. The trade-off is
              deliberate — teams that spent well arrive with little to wager; teams hoarding credits can bet
              big but already carry a credit-discipline penalty.
            </span>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
