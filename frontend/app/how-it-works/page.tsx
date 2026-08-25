import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";

const STEPS = [
  {
    n: "01",
    title: "Form a team, choose a track",
    body: "Create or join a team with an invite code. The captain picks one of the fixed domain tracks — FinTech, CyberSec, Logistics/HealthTech or Custom/Open.",
  },
  {
    n: "02",
    title: "Write your problem statement",
    body: "During onboarding you write your own problem statement inside your track. Technical mentors approve it against three criteria: in-domain, achievable in event time, and addressable by both generic tasks.",
  },
  {
    n: "03",
    title: "Unlock Task 1 and build integrations",
    body: "Task 1 (Integration) is revealed at phase start. Pay the selection cost from your credits, then wire up the data sources and services your agent needs. Verified by three tests.",
  },
  {
    n: "04",
    title: "Orchestrate under chaos",
    body: "Task 2 (Orchestration & Chaos) asks for multi-step agent reasoning across your integrations while schema drifts and corrupted inputs hit mid-run. The Feature Store stays open; defensive buffs help here.",
  },
  {
    n: "05",
    title: "Wager at Casino Royale",
    body: "Coding pauses. Wager remaining credits across three risk tiers: the safe Vault, the 50/50 Overclock, or the High-Roller that can multiply your final score by ×2.5 — at a brutal cost on loss.",
  },
  {
    n: "06",
    title: "Survive the Gauntlet",
    body: "Submit your repo, lock your entry, and watch the automated evaluation fire ten adversarial payloads at your agent. Accuracy, resilience, latency and token efficiency decide 1,000 points.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen tech-grid">
      <SiteNav />
      <main className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6">
        <SectionLabel>How it works</SectionLabel>
        <PageTitle sub="The full journey from empty repo to podium, in six steps.">
          From 1,000 CC to the Gauntlet
        </PageTitle>

        <div className="mt-12 space-y-4">
          {STEPS.map((s) => (
            <div key={s.n} className="module module-hover flex items-start gap-5 p-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center border border-line bg-void font-mono text-sm font-bold text-accent">
                {s.n}
              </span>
              <div>
                <h3 className="font-display text-base font-semibold tracking-tight text-ink">{s.title}</h3>
                <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 border border-accent/30 bg-accent/5 p-6">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            The master formula
          </h3>
          <p className="mt-3 font-mono text-sm font-semibold text-ink">
            Final Score = (Gauntlet Points × Casino Multiplier) + Credit Discipline Score
          </p>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
            Gauntlet is worth up to 1,000 points. Credit discipline adds up to 150 points based on how
            close your final balance lands to the 100 CC threshold. See{" "}
            <a href="/faq#scoring" className="font-semibold text-accent hover:text-accent-strong">
              the FAQ
            </a>{" "}
            for the full breakdown.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
