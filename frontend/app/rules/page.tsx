import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";

export default function RulesPage() {
  const rules: Array<[string, string]> = [
    ["Tracks are fixed, ideas are yours", "Organizers set the tracks; you write your own problem statement inside your track. Mentors must approve it before you can proceed."],
    ["Same tasks for everyone in a track", "Both generic domain tasks apply to any approved problem statement — no task shopping."],
    ["Credits only move server-side", "Every credit transaction is recorded on an append-only ledger. The balance shown is computed by the platform, never by your browser."],
    ["One submission lock", "Once you lock your Gauntlet submission it cannot be edited. Evaluation starts immediately after locking."],
    ["Casino outcomes are final", "The server decides every outcome the moment you place a wager. Animations are presentation only."],
    ["Bust protection floor", "Casino losses can never push a team below 300 CC. Task and store spending has no floor except zero."],
    ["Tie-breakers", "Equal final scores are broken by higher Gauntlet score, then lower remaining credits (better spend discipline)."],
    ["Mentors advise, judges score", "Mentors approve problem statements and help with setup. All scoring comes from automated evaluation and the published formula."],
  ];
  return (
    <div className="min-h-screen tech-grid">
      <SiteNav />
      <main className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6">
        <SectionLabel>Rules</SectionLabel>
        <PageTitle sub="Short, explicit and enforced by the platform itself wherever possible.">
          Rules of the colosseum
        </PageTitle>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {rules.map(([t, d], i) => (
            <div key={t} className="module module-hover coord-frame relative p-5">
              <span className="absolute right-4 top-4 font-mono text-[10px] text-ink-faint">
                [ LAW-{String(i + 1).padStart(2, "0")} ]
              </span>
              <p className="font-mono text-sm font-bold text-accent">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-1.5 font-display text-base font-semibold tracking-tight text-ink">{t}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
