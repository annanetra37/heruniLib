import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma, parseInts } from '@/lib/prisma';
import WordListEditor from '@/components/admin/WordListEditor';

export const dynamic = 'force-dynamic';

export default async function ListDetail({ params: { id } }: { params: { id: string } }) {
  const list = await prisma.wordList.findUnique({ where: { id: Number(id) } });
  if (!list) notFound();

  const wordIds = parseInts(list.wordIds);
  const [allWords, members] = await Promise.all([
    prisma.word.findMany({
      select: { id: true, wordHy: true, slug: true },
      orderBy: { wordHy: 'asc' }
    }),
    wordIds.length
      ? prisma.word.findMany({
          where: { id: { in: wordIds } },
          select: { id: true, wordHy: true, slug: true, decomposition: true, status: true }
        })
      : Promise.resolve([] as const)
  ]);

  // Preserve the editor-chosen ordering from wordIds.
  const byId = new Map(members.map((w) => [w.id, w]));
  const orderedMembers = wordIds
    .map((id) => byId.get(id))
    .filter((w): w is NonNullable<typeof w> => !!w);

  return (
    <div className="max-w-3xl">
      <nav className="text-sm text-heruni-ink/60">
        <Link href="/admin/lists" className="hover:underline">
          Lists
        </Link>{' '}
        / <span className="font-mono">#{list.id}</span>
      </nav>
      <h1 className="mt-2 text-3xl font-bold">{list.name}</h1>

      <WordListEditor
        allWords={allWords}
        initial={{
          id: list.id,
          name: list.name,
          description: list.description ?? '',
          wordIds
        }}
      />

      {orderedMembers.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Queue for algorithm drafts ({orderedMembers.length} words)
            </h2>
            <div className="flex gap-2">
              <Link
                href={`/admin/ai-drafts/bulk?listId=${list.id}&kind=heruni`}
                className="rounded-full bg-heruni-ink px-3 py-1 text-xs font-semibold text-white hover:bg-heruni-sun"
              >
                Queue Heruni drafts →
              </Link>
              <Link
                href={`/admin/ai-drafts/bulk?listId=${list.id}&kind=classical`}
                className="rounded-full border border-heruni-ink/20 px-3 py-1 text-xs font-semibold hover:bg-heruni-amber/10"
              >
                Queue classical drafts →
              </Link>
            </div>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {orderedMembers.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/admin/words/${w.id}`}
                  className="block rounded-lg border bg-white p-2 text-xs hover:border-heruni-sun"
                >
                  <span className="text-sm font-semibold" lang="hy">
                    {w.wordHy}
                  </span>
                  <span className="ml-2 text-[10px] text-heruni-ink/40">{w.status}</span>
                  <p className="font-mono text-[10px] text-heruni-ink/50" lang="hy">
                    {w.decomposition}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
