import { notFound } from 'next/navigation';
import { prisma, parseInts, parseList } from '@/lib/prisma';
import WordEditor from '@/components/admin/WordEditor';

export const dynamic = 'force-dynamic';

export default async function EditWordPage({ params: { id } }: { params: { id: string } }) {
  const word = await prisma.word.findUnique({ where: { id: Number(id) } });
  if (!word) notFound();

  const [patterns, allWords] = await Promise.all([
    prisma.pattern.findMany({
      select: { id: true, code: true, nameHy: true },
      orderBy: { code: 'asc' }
    }),
    prisma.word.findMany({
      select: { id: true, wordHy: true, slug: true },
      orderBy: { wordHy: 'asc' }
    })
  ]);

  // Suggestion sidebar (§1.6): sources whose mentionedWords array contains
  // this word. We fetch a candidate set via string-contains on the JSON blob
  // then validate the parsed list.
  const candidateSources = await prisma.source.findMany({
    where: { mentionedWords: { contains: word.wordHy } },
    take: 200
  });
  const suggestedSources = candidateSources
    .filter((s) => parseList(s.mentionedWords).includes(word.wordHy))
    .map((s) => ({
      id: s.id,
      bookPage: s.bookPage,
      chapter: s.chapter,
      excerptHy: s.excerptHy
    }));

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">
        {word.wordHy}{' '}
        <span className="text-sm font-normal text-heruni-ink/60">
          id {word.id} · {word.status}
        </span>
      </h1>
      <WordEditor
        patterns={patterns}
        allWords={allWords}
        suggestedSources={suggestedSources}
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
          slug: word.slug,
          classicalEtymologyHy: word.classicalEtymologyHy ?? '',
          classicalEtymologyEn: word.classicalEtymologyEn ?? '',
          classicalSourceRef: parseList(word.classicalSourceRef),
          firstAttestation: word.firstAttestation ?? '',
          usagePeriod: word.usagePeriod ?? '',
          historicalUsageHy: word.historicalUsageHy ?? '',
          historicalUsageEn: word.historicalUsageEn ?? '',
          culturalNotesHy: word.culturalNotesHy ?? '',
          culturalNotesEn: word.culturalNotesEn ?? '',
          relatedWordIds: parseInts(word.relatedWordIds),
          heruniBookRefs: parseInts(word.heruniBookRefs),
          patternId: word.patternId
        }}
      />
    </div>
  );
}
