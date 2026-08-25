import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";

const ILLUSTRATIVE = [
  { name: "Python REPL Sandbox", cat: "Tool Module", cost: 400, desc: "Write and execute arbitrary Python for dynamic computation and parsing.", icon: "memory" },
  { name: "Vector Memory Engine", cat: "Tool Module", cost: 350, desc: "Vector-store persistence to maintain state across multi-turn queries.", icon: "database" },
  { name: "Air-Gap Guardrail Shield", cat: "Defensive Buff", cost: 300, desc: "Strips prompt injection tags and dangerous payloads before they reach the LLM.", icon: "shield" },
  { name: "Schema Inspector Tool", cat: "Defensive Buff", cost: 250, desc: "Inspects source metadata before execution — immune to column name shifts.", icon: "search" },
  { name: "Prompt-Poison Injection", cat: "Offensive Sabotage", cost: 350, desc: "Injects a trap payload into a targeted rival's Task 2 input stream.", icon: "bolt" },
  { name: "Network Lag Spike", cat: "Offensive Sabotage", cost: 200, desc: "Applies a delay penalty to a target rival's API tool calls for 10 minutes.", icon: "sensors_off" },
];

const CAT_ICONS: Record<string, string> = {
  "Tool Module": "build",
  "Defensive Buff": "security",
  "Offensive Sabotage": "bolt",
};

export default function FeatureStorePublicPage() {
  const cats = ["Tool Module", "Defensive Buff", "Offensive Sabotage"];
  return (
    <div className="min-h-screen tech-grid">
      <SiteNav />
      <main className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6">
        <SectionLabel>Feature Store</SectionLabel>
        <PageTitle sub="With no starter repository, the store is how agents get assembled. It opens with Task 1 and stays open through the chaos phase. Prices below are illustrative — track owners set final pricing.">
          Your credits are your toolbox
        </PageTitle>

        <div className="mt-12 grid gap-10 lg:grid-cols-3">
          {cats.map((cat) => (
            <div key={cat} className="flex flex-col gap-6">
              <h2 className="flex items-center gap-2 border-b border-line pb-2 font-mono text-xs font-medium uppercase tracking-[0.14em] text-ink">
                <span className="text-accent">{cat === "Tool Module" ? "▣" : cat === "Defensive Buff" ? "◈" : "⚡"}</span>
                {cat}
              </h2>
              {ILLUSTRATIVE.filter((f) => f.cat === cat).map((f) => (
                <div key={f.name} className="module module-hover coord-frame relative flex flex-col gap-4 p-6">
                  <span className="absolute right-4 top-4 font-mono text-[10px] text-ink-faint">
                    [ {cat === "Tool Module" ? "01-T" : cat === "Defensive Buff" ? "02-D" : "03-O"} ]
                  </span>
                  <div className="grid h-12 w-12 place-items-center border border-line bg-module-raised">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                      {CAT_ICONS[cat] === "build" ? (
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                      ) : CAT_ICONS[cat] === "security" ? (
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      ) : (
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-tight text-ink">{f.name}</h3>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft">{f.desc}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
                    <span className="font-mono text-sm font-semibold text-warn tabular-nums">{f.cost} CC</span>
                    <span className="rounded-[0.125rem] bg-accent px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                      Buy
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-10 border border-accent/30 bg-accent/5 p-6">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            <strong className="font-mono text-xs uppercase tracking-[0.14em] text-accent">
              Balancing rule:
            </strong>{" "}
            <span className="mt-2 block">
              the store must be priced so that a competent, focused build is affordable within 1,000 CC
              without arena earnings — while an ambitious build with full defensive coverage and sabotage is
              not.
            </span>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
