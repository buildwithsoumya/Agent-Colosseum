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
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionLabel>Rules</SectionLabel>
        <PageTitle sub="Short, explicit and enforced by the platform itself wherever possible.">Rules of the colosseum</PageTitle>
        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {rules.map(([t, d], i) => (
            <div key={t} className="rounded-2xl border border-line bg-white p-5">
              <p className="font-mono text-xs font-bold text-accent">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-1 text-sm font-bold tracking-tight">{t}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
