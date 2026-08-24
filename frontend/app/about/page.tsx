import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionLabel>About the event</SectionLabel>
        <PageTitle sub="Agent Colosseum is a multi-stage, gamified hackathon where teams build and deploy autonomous AI agents using standard APIs, custom tool pipelines and framework-agnostic LLM integrations.">
          Not a static hackathon.
        </PageTitle>

        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <div className="space-y-6 text-sm leading-relaxed text-ink-soft">
            <p>
              Unlike traditional hackathons, Agent Colosseum operates like a real-time strategic game.
              Teams select a <strong className="text-ink">domain track</strong>, write their own problem
              statement, and receive two generic domain tasks that apply to any approved idea in their
              track.
            </p>
            <p>
              Every team starts with <strong className="text-ink">1,000 Colosseum Credits (CC)</strong>.
              They spend them unlocking tasks and assembling their agent from the{" "}
              <strong className="text-ink">Feature Store</strong> — there is no starter repository. The
              Game Arena offers optional credit top-ups through skill mini-games.
            </p>
            <p>
              Credits count <em>down</em> toward a floor of 100 CC. The objective is to finish as close to
              that threshold as possible while still shipping a complete agent — credit discipline is
              scored, so hoarding costs points and reckless spending carries its own risk.
            </p>
            <p>
              Finally, laptops close. In the <strong className="text-ink">Colosseum Gauntlet</strong>,
              agents are stress-tested live on stage against adversarial payloads — prompt injections,
              rate limits and corrupt schemas — evaluated zero-touch by automated infrastructure.
            </p>
          </div>

          <div className="space-y-4">
            {[
              ["Organizers fix the tracks", "Participants choose their own problem statement within their chosen track."],
              ["Two generic tasks per track", "Written at domain level so they apply to any approved problem statement."],
              ["The Feature Store is the build mechanism", "Tool modules, defensive buffs and offensive sabotage — priced so a competent build fits in 1,000 CC."],
              ["Risk is optional but rewarded", "Casino Royale wagers can multiply your Gauntlet score or torch your credits."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-line bg-white p-5">
                <h3 className="text-sm font-semibold tracking-tight text-ink">{t}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
