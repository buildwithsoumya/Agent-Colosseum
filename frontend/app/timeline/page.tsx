import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";
import { PHASE_META } from "@ac/shared";

const ORDER = ["PHASE_0", "PHASE_1", "PHASE_2", "PHASE_3", "PHASE_4", "PHASE_5"] as const;

export default function TimelinePage() {
  return (
    <div className="min-h-screen tech-grid">
      <SiteNav />
      <main className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6">
        <SectionLabel>Timeline</SectionLabel>
        <PageTitle sub="Three and a half hours, six phases, server-controlled clocks. The whole event runs on one shared heartbeat.">
          The master schedule
        </PageTitle>

        <div className="mx-auto mt-12 max-w-3xl">
          <div className="relative">
            <div className="absolute bottom-6 left-[27px] top-6 w-px bg-line" />
            <div className="space-y-4">
              {ORDER.map((phase, i) => {
                const meta = PHASE_META[phase];
                const last = i === ORDER.length - 1;
                const active = i === 1;
                return (
                  <div
                    key={phase}
                    className={`module relative flex items-start gap-6 p-6 ${
                      active ? "border-accent bg-accent/5" : ""
                    }`}
                  >
                    <div
                      className={`z-10 grid h-14 w-14 shrink-0 place-items-center border font-mono text-sm font-bold ${
                        active
                          ? "border-accent bg-accent text-white glow-text"
                          : "border-line bg-void text-ink-soft"
                      }`}
                    >
                      P.{i}
                    </div>
                    <div className="flex-grow">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3
                          className={`font-display text-lg font-semibold tracking-tight ${
                            active ? "text-accent" : "text-ink"
                          }`}
                        >
                          {meta.label}
                        </h3>
                        <span
                          className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                            active ? "text-accent led-pulse" : last ? "text-good" : "text-ink-faint"
                          }`}
                        >
                          {active ? "CURRENT" : last ? "FINALE" : `${meta.defaultMinutes} MIN`}
                        </span>
                      </div>
                      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
                        {meta.objective}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
