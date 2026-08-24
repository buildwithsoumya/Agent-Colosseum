import { SiteFooter, SiteNav } from "@/components/site/nav";
import { PageTitle, SectionLabel } from "@/components/ui/typography";
import { api } from "@/lib/api";

interface TrackRow {
  key: string;
  name: string;
  description: string;
  task1Title: string;
  task1Body: string;
  task2Title: string;
  task2Body: string;
}

export const revalidate = 0;

export default async function TracksPage() {
  let tracks: TrackRow[] = [];
  try {
    const data = await api.get<{ tracks: TrackRow[] }>("/api/tracks");
    tracks = data.tracks;
  } catch {
    tracks = [];
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionLabel>Tracks</SectionLabel>
        <PageTitle sub="Organizers fix the tracks. You choose the problem statement inside yours — every team in a track gets the same two generic tasks.">
          Pick your battlefield
        </PageTitle>

        {tracks.length === 0 ? (
          <p className="mt-10 text-sm text-ink-soft">
            Tracks load from the live event backend. Start the platform locally to see them here.
          </p>
        ) : (
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            {tracks.map((t) => (
              <div key={t.key} className="rounded-2xl border border-line bg-white p-6 transition-colors hover:border-violet-300">
                <h3 className="text-lg font-bold tracking-tight">{t.name}</h3>
                <p className="mt-1 text-[13px] text-ink-soft">{t.description}</p>
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">{t.task1Title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{t.task1Body}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">{t.task2Title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{t.task2Body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
