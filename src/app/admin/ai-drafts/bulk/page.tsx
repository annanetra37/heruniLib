import Link from 'next/link';
import { prisma, parseInts } from '@/lib/prisma';
import BulkGenerateClient from '@/components/admin/BulkGenerateClient';

export const dynamic = 'force-dynamic';

export default async function BulkGeneratePage({
  searchParams
}: {
  searchParams: { listId?: string; kind?: string };
}) {
  const listId = Number(searchParams.listId);
  const preselectList =
    Number.isFinite(listId) && listId > 0
      ? await prisma.wordList.findUnique({ where: { id: listId } })
      : null;

  const kind = searchParams.kind === 'classical' ? 'classical' : 'heruni';

  // Eligible pool depends on kind. For Heruni we exclude words with a
  // pending heruni draft; for classical we exclude words with a pending
  // classical draft. We do NOT exclude words that already have approved
  // drafts — regenerating is a valid editorial move.
  const pending = await prisma.aiDraft.findMany({
    where: { kind, reviewStatus: 'pending' },
    select: { wordId: true }
  });
  const pendingWordIds = new Set(pending.map((r) => r.wordId));

  const candidates = await prisma.word.findMany({
    select: {
      id: true,
      wordHy: true,
      slug: true,
      status: true,
      confidence: true,
      aiDraftId: true,
      decomposition: true
    },
    orderBy: [{ status: 'asc' }, { wordHy: 'asc' }],
    take: 500
  });

  const eligible = candidates
    .filter((w) => !pendingWordIds.has(w.id))
    .map((w) => ({
      id: w.id,
      wordHy: w.wordHy,
      slug: w.slug,
      status: w.status,
      confidence: w.confidence,
      hasApprovedDraft: w.aiDraftId !== null,
      decomposition: w.decomposition
    }));

  const preselectIds = preselectList
    ? parseInts(preselectList.wordIds).filter((id) => eligible.some((w) => w.id === id))
    : [];

  return (
    <div className="max-w-4xl">
      <nav className="text-sm text-heruni-ink/60">
        <Link href="/admin/ai-drafts" className="hover:underline">
          Algorithm drafts
        </Link>{' '}
        / bulk
      </nav>
      <h1 className="mt-2 text-3xl font-bold">Bulk generate drafts</h1>
      <p className="mt-2 max-w-2xl text-sm text-heruni-ink/60">
        Select up to 100 words and pick a pipeline. Each word runs through classify → retrieve
        patterns → prompt Claude → persist, and shows in the review queue when done. Target:
        100 drafts in under 10 minutes (v2 brief §3.6).
      </p>
      {preselectList && (
        <p className="mt-3 rounded-lg border border-heruni-amber/40 bg-heruni-amber/10 px-3 py-2 text-xs text-heruni-bronze">
          Pre-selected {preselectIds.length} words from list{' '}
          <Link href={`/admin/lists/${preselectList.id}`} className="font-semibold hover:underline">
            &ldquo;{preselectList.name}&rdquo;
          </Link>
          .
        </p>
      )}
      <BulkGenerateClient
        rows={eligible}
        initialKind={kind as 'heruni' | 'classical'}
        initialSelection={preselectIds}
      />
    </div>
  );
}
