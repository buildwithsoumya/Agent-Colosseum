import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";

const ILLUSTRATIVE = [
  { name: "Python REPL Sandbox", cat: "Tool Module", cost: 400, desc: "Write and execute arbitrary Python for dynamic computation and parsing." },
  { name: "Vector Memory Engine", cat: "Tool Module", cost: 350, desc: "Vector-store persistence to maintain state across multi-turn queries." },
  { name: "Air-Gap Guardrail Shield", cat: "Defensive Buff", cost: 300, desc: "Strips prompt injection tags and dangerous payloads before they reach the LLM." },
  { name: "Schema Inspector Tool", cat: "Defensive Buff", cost: 250, desc: "Inspects source metadata before execution — immune to column name shifts." },
  { name: "Prompt-Poison Injection", cat: "Offensive Sabotage", cost: 350, desc: "Injects a trap payload into a targeted rival's Task 2 input stream." },
  { name: "Network Lag Spike", cat: "Offensive Sabotage", cost: 200, desc: "Applies a delay penalty to a target rival's API tool calls for 10 minutes." },
];

export default function FeatureStorePublicPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionLabel>Feature Store</SectionLabel>
        <PageTitle sub="With no starter repository, the store is how agents get assembled. It opens with Task 1 and stays open through the chaos phase. Prices below are illustrative — track owners set final pricing.">
          Your credits are your toolbox
        </PageTitle>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ILLUSTRATIVE.map((f) => (
            <div key={f.name} className="flex flex-col rounded-2xl border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-full border border-line bg-paper-dim px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                  {f.cat}
                </span>
                <span className="font-mono text-sm font-bold text-accent tabular-nums">{f.cost} CC</span>
              </div>
              <h3 className="mt-3 text-sm font-bold tracking-tight">{f.name}</h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-ink-soft">{f.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 rounded-xl border border-line bg-paper-dim px-5 py-4 text-[13px] leading-relaxed text-ink-soft">
          <strong className="text-ink">Balancing rule:</strong> the store must be priced so that a competent,
          focused build is affordable within 1,000 CC without arena earnings — while an ambitious build with
          full defensive coverage and sabotage is not.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
