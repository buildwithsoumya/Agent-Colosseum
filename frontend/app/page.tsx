import Link from "next/link";
import { SiteFooter, SiteNav } from "@/components/site/nav";
import { SectionLabel } from "@/components/ui/typography";

const PHASES = [
  { n: "0", name: "Onboarding", desc: "Pick a track, write your problem statement, receive 1,000 CC.", state: "COMPLETED" },
  { n: "1", name: "Integration", desc: "Task 1 revealed. Unlock it, buy components in the Feature Store.", state: "CURRENT" },
  { n: "2", name: "Orchestration & Chaos", desc: "Task 2. Schema drifts and corrupt inputs hit live.", state: "UPCOMING" },
  { n: "3", name: "Casino Royale", desc: "Code freezes. Wager your remaining credits on three risk tiers.", state: "UPCOMING" },
  { n: "4", name: "The Gauntlet", desc: "Laptops closed. Agents face 10 adversarial payloads, zero-touch.", state: "UPCOMING" },
  { n: "5", name: "Podium", desc: "Final scores land. One team takes the colosseum.", state: "UPCOMING" },
];

export default function Home() {
  return (
    <div className="min-h-screen tech-grid">
      <SiteNav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(700px 360px at 78% 8%, rgba(168,85,247,0.12), transparent), radial-gradient(560px 300px at 10% 90%, rgba(168,85,247,0.07), transparent)",
            }}
          />
          <div className="relative mx-auto max-w-[1280px] px-4 py-20 sm:px-6 sm:py-28">
            <span className="absolute left-4 top-6 hidden font-mono text-[10px] text-line-strong md:block">
              [ + ]
            </span>
            <span className="absolute right-4 top-6 hidden font-mono text-[10px] text-line-strong md:block">
              [ + ]
            </span>
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                <span className="h-2 w-2 rounded-full bg-accent led-pulse" />
                NEXT EVENT: OCT 24 — NOV 02
              </div>
              <h1 className="mt-8 max-w-4xl font-display text-5xl font-bold leading-[1.05] tracking-tight text-ink sm:text-7xl">
                AGENT COLOSSEUM
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
                The premier arena for competitive AI orchestration. Teams build autonomous agents under a
                spendable credit economy, live chaos injections, a risk-wagering Casino — and finish in an
                automated adversarial Gauntlet where only the strongest survive.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/login"
                  className="btn-glow inline-flex h-11 items-center rounded-[0.25rem] bg-accent px-8 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-accent-strong"
                >
                  Register Now
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex h-11 items-center rounded-[0.25rem] border border-line bg-transparent px-8 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink transition-all hover:border-white hover:bg-white/5"
                >
                  View Tracks
                </Link>
              </div>
              <dl className="mt-16 grid w-full max-w-3xl grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
                {[
                  ["1,000 CC", "opening balance"],
                  ["2 tasks", "same for every team in a track"],
                  ["10 payloads", "in the final Gauntlet"],
                  ["×2.5", "High-Roller score multiplier"],
                ].map(([v, l]) => (
                  <div key={l} className="bg-void px-5 py-4">
                    <dt className="font-display text-xl font-bold tracking-tight text-ink tabular-nums">{v}</dt>
                    <dd className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Phases strip */}
        <section className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6">
          <SectionLabel>System run</SectionLabel>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">
            Six phases. No mercy.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PHASES.map((p) => (
              <div
                key={p.n}
                className="module module-hover group relative p-5"
              >
                <span className="absolute right-4 top-4 font-mono text-[10px] text-ink-faint">
                  [ P.{p.n} ]
                </span>
                <div
                  className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                    p.state === "CURRENT"
                      ? "text-accent"
                      : p.state === "COMPLETED"
                        ? "text-good"
                        : "text-ink-faint"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 ${
                      p.state === "CURRENT" ? "bg-accent led-pulse" : p.state === "COMPLETED" ? "bg-good" : "bg-ink-faint"
                    }`}
                  />
                  {p.state}
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold tracking-tight text-ink">
                  {p.name}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link
              href="/timeline"
              className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-accent hover:text-accent-strong"
            >
              See the full timeline →
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-line bg-module">
          <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-6 px-4 py-16 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
                Think your agent can survive?
              </h2>
              <p className="mt-1 font-mono text-xs uppercase tracking-wider text-ink-soft">
                Log in with a demo account or create a team to explore the full event platform.
              </p>
            </div>
            <Link
              href="/login"
              className="btn-glow inline-flex h-11 shrink-0 items-center rounded-[0.25rem] bg-accent px-6 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-accent-strong"
            >
              Enter the Arena
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
