import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [
    rootCount,
    wordCount,
    pubCount,
    reviewCount,
    draftCount,
    subPending,
    patternCount,
    sourceCount,
    aiDraftsPending,
    listCount,
    recent
  ] = await Promise.all([
    prisma.root.count(),
    prisma.word.count(),
    prisma.word.count({ where: { status: 'published' } }),
    prisma.word.count({ where: { status: 'review' } }),
    prisma.word.count({ where: { status: 'draft' } }),
    prisma.submission.count({ where: { status: 'pending' } }),
    prisma.pattern.count(),
    prisma.source.count(),
    prisma.aiDraft.count({ where: { reviewStatus: 'pending' } }),
    prisma.wordList.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
  ]);

  const stat = (label: string, value: number, href?: string) => {
    const body = (
      <>
        <p className="text-xs uppercase tracking-wider text-heruni-ink/50">{label}</p>
        <p className="mt-1 text-3xl font-bold">{value}</p>
      </>
    );
    return href ? (
      <Link
        href={href}
        className="block rounded-xl border bg-white p-4 shadow-sm transition hover:border-heruni-sun hover:shadow-md"
      >
        {body}
      </Link>
    ) : (
      <div className="rounded-xl border bg-white p-4 shadow-sm">{body}</div>
    );
  };

  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {stat('Roots', rootCount)}
        {stat('Words (total)', wordCount)}
        {stat('Words (published)', pubCount)}
        {stat('Words (review)', reviewCount)}
        {stat('Words (draft)', draftCount)}
        {stat('Submissions pending', subPending, '/admin/submissions')}
        {stat('Patterns', patternCount, '/admin/patterns')}
        {stat('Sources', sourceCount, '/admin/sources')}
        {stat('AI drafts pending', aiDraftsPending, '/admin/ai-drafts')}
        {stat('Curated lists', listCount, '/admin/lists')}
      </div>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Recent edits</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-heruni-ink/60">No audit events yet.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-xl border bg-white">
            {recent.map((e) => (
              <li key={e.id} className="flex justify-between px-4 py-2 text-sm">
                <span>
                  <span className="font-mono text-xs text-heruni-ink/50">{e.action}</span>{' '}
                  <span className="ml-2">
                    {e.entity}#{e.entityId}
                  </span>
                </span>
                <span className="text-xs text-heruni-ink/50">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
