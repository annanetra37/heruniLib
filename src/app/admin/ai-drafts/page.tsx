import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const STATUSES = ['pending', 'approved', 'edited', 'rejected'] as const;
const KINDS = ['heruni', 'classical'] as const;

export default async function AiDraftsQueue({
  searchParams
}: {
  searchParams: { status?: string; page?: string; kind?: string };
}) {
  const status = STATUSES.includes(searchParams.status as (typeof STATUSES)[number])
    ? (searchParams.status as (typeof STATUSES)[number])
    : 'pending';
  const kind = KINDS.includes(searchParams.kind as (typeof KINDS)[number])
    ? (searchParams.kind as (typeof KINDS)[number])
    : 'heruni';
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 25;

  const [drafts, total, counts] = await Promise.all([
    prisma.aiDraft.findMany({
      where: { reviewStatus: status, kind },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize
    }),
    prisma.aiDraft.count({ where: { reviewStatus: status, kind } }),
    prisma.aiDraft.groupBy({
      by: ['reviewStatus'],
      _count: { reviewStatus: true },
      where: { kind }
    })
  ]);

  const countBy = new Map<string, number>();
  for (const c of counts) countBy.set(c.reviewStatus, c._count.reviewStatus);

  const wordIds = Array.from(new Set(drafts.map((d) => d.wordId)));
  const patternIds = Array.from(
    new Set(drafts.map((d) => d.patternId).filter((x): x is number => x !== null))
  );
  const [words, patterns] = await Promise.all([
    wordIds.length
      ? prisma.word.findMany({
          where: { id: { in: wordIds } },
          select: { id: true, wordHy: true, slug: true, meaningHy: true }
        })
      : Promise.resolve([] as const),
    patternIds.length
      ? prisma.pattern.findMany({
          where: { id: { in: patternIds } },
          select: { id: true, code: true }
        })
      : Promise.resolve([] as const)
  ]);
  const wordById = new Map(words.map((w) => [w.id, w]));
  const patternById = new Map(patterns.map((p) => [p.id, p]));

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">AI drafts</h1>
        <Link
          href="/admin/ai-drafts/bulk"
          className="rounded-full bg-heruni-ink px-4 py-2 text-sm font-semibold text-white hover:bg-heruni-sun"
        >
          Bulk generate
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-heruni-ink/60">
        Every reconstruction Claude produces lands here as <code>pending</code>. Editors
        approve, edit, or reject — nothing is ever auto-published (v2 brief §4.4).
      </p>

      <nav className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex gap-1 rounded-full border bg-white p-1 text-xs">
          {KINDS.map((k) => (
            <Link
              key={k}
              href={`/admin/ai-drafts?kind=${k}&status=${status}`}
              className={`rounded-full px-3 py-1 font-semibold ${
                kind === k ? 'bg-heruni-ink text-white' : 'text-heruni-ink/60 hover:bg-heruni-amber/20'
              }`}
            >
              {k === 'heruni' ? 'Heruni method' : 'Classical etymology'}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/ai-drafts?kind=${kind}&status=${s}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                status === s
                  ? 'bg-heruni-ink text-white'
                  : 'bg-white text-heruni-ink/60 hover:bg-heruni-amber/20'
              }`}
            >
              {s} ({countBy.get(s) ?? 0})
            </Link>
          ))}
        </div>
      </nav>

      {drafts.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-heruni-ink/20 p-8 text-center text-sm text-heruni-ink/50">
          No <code>{status}</code> drafts.
        </p>
      ) : (
        <table className="mt-6 w-full divide-y rounded-xl border bg-white text-sm">
          <thead className="bg-heruni-amber/10 text-xs uppercase tracking-wider text-heruni-ink/60">
            <tr>
              <th className="p-2 text-left">Word</th>
              <th className="p-2 text-left">Pattern</th>
              <th className="p-2 text-left">Draft (hy)</th>
              <th className="p-2 text-left">Conf</th>
              <th className="p-2 text-left">Model</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {drafts.map((d) => {
              const w = wordById.get(d.wordId);
              const p = d.patternId ? patternById.get(d.patternId) : null;
              return (
                <tr key={d.id}>
                  <td className="p-2" lang="hy">
                    {w ? (
                      <Link href={`/admin/words/${w.id}`} className="font-semibold hover:text-heruni-sun">
                        {w.wordHy}
                      </Link>
                    ) : (
                      <span className="text-heruni-ink/40">word #{d.wordId}</span>
                    )}
                  </td>
                  <td className="p-2 font-mono text-xs">{p?.code ?? '—'}</td>
                  <td className="p-2 max-w-md truncate text-xs" lang="hy" title={d.draftMeaningHy ?? ''}>
                    {d.draftMeaningHy}
                  </td>
                  <td className="p-2 text-xs">{d.confidence ?? '—'}</td>
                  <td className="p-2 font-mono text-[10px] text-heruni-ink/50">{d.model}</td>
                  <td className="p-2 text-right">
                    <Link
                      href={`/admin/ai-drafts/${d.id}`}
                      className="text-xs font-semibold text-heruni-sun"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-heruni-ink/60">
          <span>
            Page {page} of {pageCount} · {total} total
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/ai-drafts?kind=${kind}&status=${status}&page=${page - 1}`}
                className="rounded-full border px-3 py-1 hover:bg-heruni-amber/10"
              >
                ← Prev
              </Link>
            )}
            {page < pageCount && (
              <Link
                href={`/admin/ai-drafts?kind=${kind}&status=${status}&page=${page + 1}`}
                className="rounded-full border px-3 py-1 hover:bg-heruni-amber/10"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
