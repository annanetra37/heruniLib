import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import BulkGenerateClient from '@/components/admin/BulkGenerateClient';

export const dynamic = 'force-dynamic';

export default async function BulkGeneratePage() {
  // Eligible pool: words with no pending heruni AiDraft yet AND no approved
  // draft linked (so we don't regenerate drafts the editor already ratified).
  // Includes draft + review + published, so editors can refresh "weak" entries.
  const pending = await prisma.aiDraft.findMany({
    where: { kind: 'heruni', reviewStatus: 'pending' },
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

  return (
    <div className="max-w-4xl">
      <nav className="text-sm text-heruni-ink/60">
        <Link href="/admin/ai-drafts" className="hover:underline">
          AI drafts
        </Link>{' '}
        / bulk
      </nav>
      <h1 className="mt-2 text-3xl font-bold">Bulk generate drafts</h1>
      <p className="mt-2 max-w-2xl text-sm text-heruni-ink/60">
        Select up to 100 words, click <strong>Generate</strong>. Each word goes through the
        full v2 pipeline (classify → retrieve candidate patterns → prompt Claude → persist
        draft) and shows up in the review queue when done. Acceptance: 100 drafts in under
        10 minutes (v2 brief §3.6).
      </p>
      <BulkGenerateClient rows={eligible} />
    </div>
  );
}
