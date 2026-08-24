import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";
import { PHASE_META } from "@ac/shared";

const ORDER = ["PHASE_0", "PHASE_1", "PHASE_2", "PHASE_3", "PHASE_4", "PHASE_5"] as const;

export default function TimelinePage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionLabel>Timeline</SectionLabel>
        <PageTitle sub="Three and a half hours, six phases, server-controlled clocks. The whole event runs on one shared heartbeat.">
          The master schedule
        </PageTitle>

        <div className="mt-12">
          {ORDER.map((phase, i) => {
            const meta = PHASE_META[phase];
            const last = i === ORDER.length - 1;
            return (
              <div key={phase} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-violet-200 bg-accent-soft font-mono text-xs font-bold text-accent-strong">
                    P{i}
                  </div>
                  {!last && <div className="w-px flex-1 bg-line" />}
                </div>
                <div className={`pb-10 ${last ? "" : ""}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-bold tracking-tight">{meta.label}</h3>
                    <span className="rounded-full border border-line bg-paper-dim px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft tabular-nums">
                      {meta.defaultMinutes} min
                    </span>
                  </div>
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">{meta.objective}</p>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
