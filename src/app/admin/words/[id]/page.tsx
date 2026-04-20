import { notFound } from 'next/navigation';
import { prisma, parseInts } from '@/lib/prisma';
import WordEditor from '@/components/admin/WordEditor';

export default async function EditWordPage({ params: { id } }: { params: { id: string } }) {
  const word = await prisma.word.findUnique({ where: { id: Number(id) } });
  if (!word) notFound();
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold">
        {word.wordHy}{' '}
        <span className="text-sm font-normal text-heruni-ink/60">
          id {word.id} · {word.status}
        </span>
      </h1>
      <WordEditor
        initial={{
          id: word.id,
          wordHy: word.wordHy,
          transliteration: word.transliteration,
          decomposition: word.decomposition,
          rootSequence: parseInts(word.rootSequence),
          suffix: word.suffix ?? '',
          meaningHy: word.meaningHy,
          meaningEn: word.meaningEn,
          category: word.category,
          source: word.source,
          confidence: word.confidence,
          status: word.status,
          slug: word.slug
        }}
      />
    </div>
  );
}
