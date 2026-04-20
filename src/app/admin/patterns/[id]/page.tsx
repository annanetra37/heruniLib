import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma, parseInts } from '@/lib/prisma';
import PatternEditor from '@/components/admin/PatternEditor';

export const dynamic = 'force-dynamic';

export default async function EditPatternPage({ params: { id } }: { params: { id: string } }) {
  const pattern = await prisma.pattern.findUnique({ where: { id: Number(id) } });
  if (!pattern) notFound();

  const words = await prisma.word.findMany({
    select: { id: true, wordHy: true, slug: true },
    orderBy: { wordHy: 'asc' }
  });

  const exampleIds = parseInts(pattern.exampleWords);
  const wordsUsingPattern = await prisma.word.findMany({
    where: { patternId: pattern.id },
    select: { id: true, wordHy: true, slug: true, status: true },
    orderBy: { wordHy: 'asc' }
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">
        {pattern.code}{' '}
        <span className="text-sm font-normal text-heruni-ink/60">id {pattern.id}</span>
      </h1>
      <PatternEditor
        words={words}
        initial={{
          id: pattern.id,
          code: pattern.code,
          nameHy: pattern.nameHy,
          nameEn: pattern.nameEn,
          templateHy: pattern.templateHy,
          templateEn: pattern.templateEn,
          descriptionHy: pattern.descriptionHy ?? '',
          descriptionEn: pattern.descriptionEn ?? '',
          exampleWordIds: exampleIds,
          appliesWhen: pattern.appliesWhen ?? '{}'
        }}
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Words currently using this pattern ({wordsUsingPattern.length})
        </h2>
        {wordsUsingPattern.length === 0 ? (
          <p className="mt-2 text-xs text-heruni-ink/60">
            No words have been assigned yet. Editors set <code>pattern_id</code> from the word
            edit form.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {wordsUsingPattern.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/admin/words/${w.id}`}
                  className="rounded-full border px-3 py-1 text-xs hover:bg-heruni-amber/10"
                  lang="hy"
                >
                  {w.wordHy}
                  <span className="ml-1 text-heruni-ink/40">· {w.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
