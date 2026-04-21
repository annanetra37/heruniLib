import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { editDistance } from '@/lib/diffWords';

export const dynamic = 'force-dynamic';

// v2 §4.4 — prompt health.
// Ranks approved/edited drafts by how much the editor had to change the AI
// draft. High edit rate = the prompt (or pattern catalogue examples) needs
// work. Groups by kind so heruni and classical are tuned independently.

export default async function PromptHealthPage({
  searchParams
}: {
  searchParams: { kind?: string };
}) {
  const kind = searchParams.kind === 'classical' ? 'classical' : 'heruni';

  const drafts = await prisma.aiDraft.findMany({
    where: { kind, reviewStatus: { in: ['edited', 'approved'] } },
    orderBy: { updatedAt: 'desc' },
    take: 200
  });

  const wordIds = Array.from(new Set(drafts.map((d) => d.wordId)));
  const patternIds = Array.from(
    new Set(drafts.map((d) => d.patternId).filter((x): x is number => x !== null))
  );
  const [words, patterns] = await Promise.all([
    wordIds.length
      ? prisma.word.findMany({
          where: { id: { in: wordIds } },
          select: { id: true, wordHy: true, slug: true }
        })
      : Promise.resolve([] as const),
    patternIds.length
      ? prisma.pattern.findMany({ where: { id: { in: patternIds } }, select: { id: true, code: true } })
      : Promise.resolve([] as const)
  ]);
  const wordById = new Map(words.map((w) => [w.id, w]));
  const patternById = new Map(patterns.map((p) => [p.id, p]));

  const rows = drafts.map((d) => {
    const hyRate = editDistance(d.draftMeaningHy, d.finalMeaningHy ?? d.draftMeaningHy);
    const enRate = editDistance(d.draftMeaningEn, d.finalMeaningEn ?? d.draftMeaningEn);
    const avg = (hyRate + enRate) / 2;
    return { draft: d, avg, hyRate, enRate };
  });
  rows.sort((a, b) => b.avg - a.avg);

  // Per-pattern aggregate (only meaningful for heruni).
  const perPattern = new Map<number, { code: string; n: number; sumEdit: number }>();
  if (kind === 'heruni') {
    for (const r of rows) {
      const pid = r.draft.patternId;
      if (!pid) continue;
      const pat = patternById.get(pid);
      if (!pat) continue;
      const cur = perPattern.get(pid) ?? { code: pat.code, n: 0, sumEdit: 0 };
      cur.n += 1;
      cur.sumEdit += r.avg;
      perPattern.set(pid, cur);
    }
  }
  const perPatternArr = Array.from(perPattern.values())
    .filter((p) => p.n >= 2)
    .map((p) => ({ ...p, avg: p.sumEdit / p.n }))
    .sort((a, b) => b.avg - a.avg);

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-bold">Prompt health</h1>
      <div className="mt-3 flex gap-1 rounded-full border bg-white p-1 text-xs w-fit">
        {(['heruni', 'classical'] as const).map((k) => (
          <Link
            key={k}
            href={`/admin/prompt-health?kind=${k}`}
            className={`rounded-full px-3 py-1 font-semibold ${
              kind === k ? 'bg-heruni-ink text-white' : 'text-heruni-ink/60 hover:bg-heruni-amber/20'
            }`}
          >
            {k === 'heruni' ? 'Heruni method' : 'Classical etymology'}
          </Link>
        ))}
      </div>
      <p className="mt-3 max-w-2xl text-sm text-heruni-ink/60">
        Edit rate = how much of the algorithm-generated draft an editor rewrote before
        publishing. High numbers are a signal that either the prompt or the pattern examples
        need attention.
      </p>

      {kind === 'heruni' && perPatternArr.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Edit rate by pattern (n ≥ 2)</h2>
          <table className="mt-2 w-full divide-y rounded-xl border bg-white text-sm">
            <thead className="bg-heruni-amber/10 text-xs uppercase tracking-wider text-heruni-ink/60">
              <tr>
                <th className="p-2 text-left">Pattern</th>
                <th className="p-2 text-left">Drafts</th>
                <th className="p-2 text-left">Avg edit rate</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {perPatternArr.map((p) => (
                <tr key={p.code}>
                  <td className="p-2 font-mono text-xs">
                    <Link href={`/admin/patterns?code=${p.code}`} className="hover:text-heruni-sun">
                      #{p.code}
                    </Link>
                  </td>
                  <td className="p-2 text-xs">{p.n}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-heruni-amber/20">
                        <div
                          className="h-full rounded-full bg-heruni-sun"
                          style={{ width: `${Math.min(100, p.avg * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-heruni-ink/60">
                        {(p.avg * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Most-edited drafts (top 50)</h2>
        <table className="mt-2 w-full divide-y rounded-xl border bg-white text-sm">
          <thead className="bg-heruni-amber/10 text-xs uppercase tracking-wider text-heruni-ink/60">
            <tr>
              <th className="p-2 text-left">Word</th>
              <th className="p-2 text-left">Pattern</th>
              <th className="p-2 text-left">Edit rate (hy / en / avg)</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.slice(0, 50).map((r) => {
              const w = wordById.get(r.draft.wordId);
              const pat = r.draft.patternId ? patternById.get(r.draft.patternId) : null;
              return (
                <tr key={r.draft.id}>
                  <td className="p-2" lang="hy">
                    {w ? (
                      <Link href={`/admin/words/${w.id}`} className="font-semibold hover:text-heruni-sun">
                        {w.wordHy}
                      </Link>
                    ) : (
                      <span className="text-heruni-ink/40">word #{r.draft.wordId}</span>
                    )}
                  </td>
                  <td className="p-2 font-mono text-xs">{pat?.code ?? '—'}</td>
                  <td className="p-2 text-xs">
                    {(r.hyRate * 100).toFixed(0)}% / {(r.enRate * 100).toFixed(0)}% /{' '}
                    <strong>{(r.avg * 100).toFixed(0)}%</strong>
                  </td>
                  <td className="p-2 text-right">
                    <Link
                      href={`/admin/ai-drafts/${r.draft.id}`}
                      className="text-xs font-semibold text-heruni-sun"
                    >
                      open →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
