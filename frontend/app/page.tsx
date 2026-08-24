import Link from "next/link";
import { SiteFooter, SiteNav } from "@/components/site/nav";
import { SectionLabel } from "@/components/ui/typography";

const PHASES = [
  { n: "0", name: "Onboarding", desc: "Pick a track, write your problem statement, receive 1,000 CC." },
  { n: "1", name: "Integration", desc: "Task 1 revealed. Unlock it, buy components in the Feature Store." },
  { n: "2", name: "Orchestration & Chaos", desc: "Task 2. Schema drifts and corrupt inputs hit live." },
  { n: "3", name: "Casino Royale", desc: "Code freezes. Wager your remaining credits on three risk tiers." },
  { n: "4", name: "The Gauntlet", desc: "Laptops closed. Agents face 10 adversarial payloads, zero-touch." },
  { n: "5", name: "Podium", desc: "Final scores land. One team takes the colosseum." },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.55]"
            style={{
              background:
                "radial-gradient(600px 300px at 80% 10%, rgba(109,40,217,0.08), transparent), radial-gradient(500px 260px at 12% 85%, rgba(109,40,217,0.06), transparent)",
            }}
          />
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <SectionLabel>3.5 hours · teams of up to four · one winner</SectionLabel>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-ink sm:text-6xl">
              A hackathon that fights back.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
              Agent Colosseum is a real-time strategic game. Teams build autonomous AI agents under a
              spendable credit economy, live chaos injections, a risk-wagering Casino — and finish in an
              automated adversarial Gauntlet where only the strongest agents survive.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-lg bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
              >
                Enter the Arena
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex h-11 items-center rounded-lg border border-line bg-white px-6 text-sm font-semibold text-ink transition-colors hover:border-ink"
              >
                How it works
              </Link>
            </div>
            <dl className="mt-14 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
              {[
                ["1,000 CC", "opening balance"],
                ["2 tasks", "same for every team in a track"],
                ["10 payloads", "in the final Gauntlet"],
                ["×2.5", "High-Roller score multiplier"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-xl font-bold tracking-tight text-ink tabular-nums">{v}</dt>
                  <dd className="mt-1 text-xs leading-snug text-ink-soft">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Phases strip */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <SectionLabel>The gauntlet run</SectionLabel>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Six phases. No mercy.</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PHASES.map((p) => (
              <div key={p.n} className="group rounded-2xl border border-line bg-white p-5 transition-colors hover:border-violet-300">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs font-bold text-accent">P{p.n}</span>
                  <h3 className="text-sm font-semibold tracking-tight">{p.name}</h3>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/timeline" className="text-sm font-semibold text-accent hover:text-accent-strong">
              See the full timeline →
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-line bg-paper-dim">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Think your agent can survive?</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Log in with a demo account or create a team to explore the full event platform.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex h-11 shrink-0 items-center rounded-lg bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              Get started
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
