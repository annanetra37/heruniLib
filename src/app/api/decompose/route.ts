import { NextResponse } from 'next/server';
import { prisma, parseList, parseInts } from '@/lib/prisma';
import { buildLookup, decompose } from '@/lib/decompose';
import { classify } from '@/lib/classify';
import { logSearchEvent } from '@/lib/visitor';

// GET /api/decompose?w=… — the public on-the-fly decomposer.
//
// v2 rewrite: when we have a Word row for this input (any status, not just
// published), we return the full rich entry — decomposition + root
// glosses + Heruni reconstruction + classical etymology + historical
// usage + related words + pattern — so /decompose can render the
// multi-layer view instead of just letters. When we don't, we return the
// greedy letter decomposition plus a classification the client can use to
// kick off AI generation.

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const w = (url.searchParams.get('w') ?? '').trim().toLowerCase();
  if (!w) return NextResponse.json({ error: 'missing w' }, { status: 400 });

  const roots = await prisma.root.findMany();
  const rootMap = new Map(roots.map((r) => [r.id, r]));
  const lookup = buildLookup(
    roots.map((r) => ({
      id: r.id,
      token: r.token,
      length: r.length,
      meaningHy: parseList(r.meaningHy),
      meaningEn: parseList(r.meaningEn)
    }))
  );

  // Curated lookup: any status. We want editors' in-progress drafts
  // ("review") to surface through /decompose too — they're more useful
  // than raw letter-only output, and the UI makes the draft status clear.
  const curated = await prisma.word.findFirst({
    where: {
      OR: [{ wordHy: w }, { slug: w }, { transliteration: w }]
    }
  });

  if (curated) {
    void logSearchEvent({ wordHy: w, source: 'decompose-plain', outcome: 'curated' });
    const ids = parseInts(curated.rootSequence);
    const parts = ids
      .map((id) => rootMap.get(id))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => ({
        rootId: r.id,
        token: r.token,
        length: r.length,
        meaningHy: parseList(r.meaningHy),
        meaningEn: parseList(r.meaningEn)
      }));

    // Enrich with v2 fields.
    const [relatedWords, bookRefs, pattern] = await Promise.all([
      (parseInts(curated.relatedWordIds).length
        ? prisma.word.findMany({
            where: { id: { in: parseInts(curated.relatedWordIds) } },
            select: { id: true, wordHy: true, slug: true, decomposition: true }
          })
        : Promise.resolve([])),
      (parseInts(curated.heruniBookRefs).length
        ? prisma.source.findMany({
            where: { id: { in: parseInts(curated.heruniBookRefs) } },
            orderBy: { bookPage: 'asc' }
          })
        : Promise.resolve([])),
      curated.patternId
        ? prisma.pattern.findUnique({ where: { id: curated.patternId } })
        : Promise.resolve(null)
    ]);

    const classification = classify({
      word: curated.wordHy,
      rootTokenCount: ids.length,
      category: curated.category
    });

    return NextResponse.json({
      source: 'curated',
      word: curated.wordHy,
      slug: curated.slug,
      transliteration: curated.transliteration,
      decomposition: curated.decomposition,
      parts,
      suffix: curated.suffix,
      unmatched: '',
      meaningHy: curated.meaningHy,
      meaningEn: curated.meaningEn,
      category: curated.category,
      confidence: curated.confidence,
      status: curated.status,
      shapeGuess: classification.shapeGuess,
      // v2 editorial fields — all optional. Client renders collapsibles
      // only for the ones that are non-empty.
      classicalEtymologyHy: curated.classicalEtymologyHy,
      classicalEtymologyEn: curated.classicalEtymologyEn,
      classicalSourceRef: parseList(curated.classicalSourceRef),
      firstAttestation: curated.firstAttestation,
      usagePeriod: curated.usagePeriod,
      historicalUsageHy: curated.historicalUsageHy,
      historicalUsageEn: curated.historicalUsageEn,
      culturalNotesHy: curated.culturalNotesHy,
      culturalNotesEn: curated.culturalNotesEn,
      relatedWords: relatedWords.map((r) => ({
        wordHy: r.wordHy,
        slug: r.slug,
        decomposition: r.decomposition
      })),
      bookRefs: bookRefs.map((s) => ({
        id: s.id,
        bookPage: s.bookPage,
        chapter: s.chapter,
        excerptHy: s.excerptHy,
        excerptEn: s.excerptEn,
        imageUrl: s.imageUrl
      })),
      pattern: pattern
        ? { code: pattern.code, nameHy: pattern.nameHy, nameEn: pattern.nameEn }
        : null
    });
  }

  // Automatic fallback — greedy SSB match. Add a classification so the
  // client can show an "abstract noun" / "agent noun" / etc. badge even
  // before AI runs.
  const result = decompose(w, lookup);
  const classification = classify({
    word: w,
    rootTokenCount: result.parts.length,
    category: null
  });
  void logSearchEvent({
    wordHy: w,
    source: 'decompose-plain',
    outcome: result.parts.length === 0 ? 'no_match' : 'automatic'
  });
  return NextResponse.json({
    source: 'automatic',
    word: w,
    decomposition: result.canonical,
    parts: result.parts,
    suffix: result.suffix,
    unmatched: result.unmatched,
    shapeGuess: classification.shapeGuess,
    categoryGuess: classification.categoryGuess
  });
}
