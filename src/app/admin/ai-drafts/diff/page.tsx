import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { diffWords, editDistance } from '@/lib/diffWords';
import DiffRenderer from '@/components/admin/DiffRenderer';

export const dynamic = 'force-dynamic';

// v2 brief §4.3 — diff gallery.
// Shows the most-recent 50 approved/edited drafts with AI version vs. the
// editor's published version side-by-side. Highlights additions / removals.
// Useful signal for prompt iteration — complements §4.4 prompt-health.

export default async function DiffGallery({
  searchParams
}: {
  searchParams: { kind?: string };
}) {
  const kind = searchParams.kind === 'classical' ? 'classical' : 'heruni';
  const drafts = await prisma.aiDraft.findMany({
    where: { kind, reviewStatus: { in: ['approved', 'edited'] } },
    orderBy: { updatedAt: 'desc' },
    take: 50
  });

  const wordIds = Array.from(new Set(drafts.map((d) => d.wordId)));
  const words = wordIds.length
    ? await prisma.word.findMany({
        where: { id: { in: wordIds } },
        select: { id: true, wordHy: true, slug: true }
      })
    : [];
  const wordById = new Map(words.map((w) => [w.id, w]));

  return (
    <div>
      <h1 className="text-3xl font-bold">Draft diffs · last 50</h1>
      <div className="mt-3 flex gap-1 rounded-full border bg-white p-1 text-xs w-fit">
        {(['heruni', 'classical'] as const).map((k) => (
          <Link
            key={k}
            href={`/admin/ai-drafts/diff?kind=${k}`}
            className={`rounded-full px-3 py-1 font-semibold ${
              kind === k ? 'bg-heruni-ink text-white' : 'text-heruni-ink/60 hover:bg-heruni-amber/20'
            }`}
          >
            {k === 'heruni' ? 'Heruni method' : 'Classical etymology'}
          </Link>
        ))}
      </div>
      <p className="mt-3 max-w-2xl text-sm text-heruni-ink/60">
        Every approved or edited draft in this pipeline. Words shaded red were in the AI output
        but cut by the editor; green words were added. Heavy editing → prompt needs work.
      </p>

      {drafts.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed p-8 text-center text-sm text-heruni-ink/50">
          No approved or edited <code>{kind}</code> drafts yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-6">
          {drafts.map((d) => {
            const w = wordById.get(d.wordId);
            const hyDiff = diffWords(d.draftMeaningHy, d.finalMeaningHy ?? d.draftMeaningHy);
            const enDiff = diffWords(d.draftMeaningEn, d.finalMeaningEn ?? d.draftMeaningEn);
            const editRate = editDistance(
              d.draftMeaningHy,
              d.finalMeaningHy ?? d.draftMeaningHy
            );
            return (
              <li key={d.id} className="rounded-xl border bg-white p-5">
                <header className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-xl font-semibold" lang="hy">
                    {w ? (
                      <Link href={`/admin/words/${w.id}`} className="hover:text-heruni-sun">
                        {w.wordHy}
                      </Link>
                    ) : (
                      `word #${d.wordId}`
                    )}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-heruni-ink/60">
                    <span className="rounded-full bg-heruni-amber/20 px-2 py-0.5 font-mono">
                      {d.reviewStatus}
                    </span>
                    <span>edit rate: {(editRate * 100).toFixed(0)}%</span>
                    <Link
                      href={`/admin/ai-drafts/${d.id}`}
                      className="text-heruni-sun hover:underline"
                    >
                      open →
                    </Link>
                  </div>
                </header>
                <div className="grid gap-4 md:grid-cols-2 text-sm">
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-heruni-ink/50">
                      AI draft
                    </p>
                    <p lang="hy">
                      <DiffRenderer segments={hyDiff} side="draft" />
                    </p>
                    <p className="mt-2">
                      <DiffRenderer segments={enDiff} side="draft" />
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-heruni-ink/50">
                      Editor final
                    </p>
                    <p lang="hy">
                      <DiffRenderer segments={hyDiff} side="final" />
                    </p>
                    <p className="mt-2">
                      <DiffRenderer segments={enDiff} side="final" />
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
