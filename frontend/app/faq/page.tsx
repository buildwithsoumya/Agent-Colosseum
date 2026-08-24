import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";

const FAQS: Array<{ q: string; a: string; id?: string }> = [
  {
    q: "What are Colosseum Credits (CC)?",
    a: "The event currency. Every team starts with 1,000 CC and spends it on task unlocks and Feature Store components. The Game Arena can top you up. Your final balance relative to the 100 CC threshold feeds your score.",
  },
  {
    q: "What is the Gauntlet?",
    a: "The Phase 4 automated evaluation. Ten adversarial payloads — prompt injections, rate limits, schema drifts, corrupt inputs — are fired at your agent with no human intervention. It is worth up to 1,000 points.",
  },
  {
    q: "What does 'chaos' mean in Task 2?",
    a: "Live degradation injected into your data sources while your agent runs: field names shift mid-run, records arrive malformed, formats flip. A robust agent completes its reasoning chain anyway.",
  },
  {
    id: "scoring",
    q: "How exactly is scoring calculated?",
    a: "Final Score = (Gauntlet Points × Casino Multiplier) + Credit Discipline Score. Gauntlet metrics: Accuracy & Output Validity 40%, Adversarial Resilience 25%, Latency & Speed 20%, Token Efficiency 15%. Credit Discipline = 150 × (1 − (B − T) / (S − T)) where B is your balance at the end of Casino Royale, T = 100 CC and S = 1,000 CC — floored at 0 and capped at 150.",
  },
  {
    q: "Do I have to gamble in Casino Royale?",
    a: "You must place one wager during Phase 3, but The Vault carries zero risk — it simply locks your balance. The other tiers trade real upside for real damage.",
  },
  {
    q: "Can sabotage kill my team?",
    a: "No. Sabotage applies capped penalties (input pressure, latency) designed to inconvenience, not eliminate. Weaker teams are never crushed out of the event.",
  },
  {
    q: "What if our problem statement gets rejected?",
    a: "Mentors leave notes explaining why. You revise and resubmit during Phase 0 — approval criteria are published on the How It Works page.",
  },
  {
    q: "Is there a starter repository?",
    a: "No. Teams start from an empty repo of their own and assemble the agent from Feature Store components plus their own code.",
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <SectionLabel>FAQ</SectionLabel>
        <PageTitle sub="Everything participants usually ask before the doors open.">Questions, answered</PageTitle>
        <div className="mt-10 divide-y divide-line rounded-2xl border border-line bg-white">
          {FAQS.map((f) => (
            <details key={f.q} id={f.id} className="group px-6 py-5 open:bg-paper-dim/50">
              <summary className="cursor-pointer list-none text-sm font-semibold tracking-tight text-ink marker:hidden">
                <span className="mr-2 inline-block text-accent transition-transform group-open:rotate-90">›</span>
                {f.q}
              </summary>
              <p className="mt-2 pl-5 text-[13px] leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
