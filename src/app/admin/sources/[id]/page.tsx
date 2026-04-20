import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma, parseList } from '@/lib/prisma';
import SourceEditor from '@/components/admin/SourceEditor';

export const dynamic = 'force-dynamic';

export default async function EditSourcePage({ params: { id } }: { params: { id: string } }) {
  const src = await prisma.source.findUnique({ where: { id: Number(id) } });
  if (!src) notFound();

  const mentioned = parseList(src.mentionedWords);
  // Find existing words that reference this source via heruniBookRefs.
  // Helpers stringify ids as JSON arrays so a substring match on the id is
  // good enough for an indicator list (real schema lookups in Postgres).
  const needle = `"${src.id}"`;
  const candidates = await prisma.word.findMany({
    where: { heruniBookRefs: { contains: `${src.id}` } },
    select: { id: true, wordHy: true, status: true },
    take: 50
  });
  const linked = candidates.filter((w) => {
    // Belt-and-suspenders: ensure the id is actually in the parsed array.
    const raw = (w as unknown as { heruniBookRefs?: string }).heruniBookRefs;
    try {
      const arr = raw ? (JSON.parse(raw) as number[]) : [];
      return arr.includes(src.id);
    } catch {
      return raw?.includes(needle) ?? false;
    }
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold">
        Source · p. {src.bookPage}{' '}
        <span className="text-sm font-normal text-heruni-ink/60">id {src.id}</span>
      </h1>
      <SourceEditor
        initial={{
          id: src.id,
          bookPage: src.bookPage,
          chapter: src.chapter ?? '',
          excerptHy: src.excerptHy,
          excerptEn: src.excerptEn ?? '',
          mentionedWords: mentioned,
          imageUrl: src.imageUrl ?? ''
        }}
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Words currently linking this source ({linked.length})
        </h2>
        {linked.length === 0 ? (
          <p className="mt-2 text-xs text-heruni-ink/60">No word yet references this source.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {linked.map((w) => (
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
