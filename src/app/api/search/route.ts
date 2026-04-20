import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { snippet } from '@/lib/searchSnippet';

// GET /api/search?q=…&limit=10 — v2 brief §5.1.
//
// Multi-field search across v2 editorial columns, ranked by field weight.
// Postgres pg_trgm would be a drop-in speedup (see migration note below),
// but ILIKE + in-process ranking is adequate up to a few thousand words
// and keeps the code portable. For the 1000-word launch corpus this is
// well within latency budget.
//
//     Field                       Weight
//     ---------------------------------
//     wordHy starts-with             10
//     wordHy contains                 8
//     transliteration                 7
//     classical sources (citation)    6
//     meaningHy / meaningEn           5
//     classicalEtymologyHy / En       4
//     historicalUsageHy / En          3
//
// Snippets are extracted from whichever field matched, with <mark> tags
// around the query. UI renders the HTML directly via dangerouslySetInnerHTML
// — see /components/SearchResults.tsx.

export const dynamic = 'force-dynamic';

type Word = Awaited<ReturnType<typeof prisma.word.findFirst>>;

function scoreAndSnippet(w: NonNullable<Word>, q: string) {
  const lower = q.toLowerCase();
  const hy = w.wordHy.toLowerCase();
  let score = 0;
  const matches: { field: string; html: string }[] = [];

  if (hy.startsWith(lower)) score += 10;
  else if (hy.includes(lower)) score += 8;

  if (w.transliteration.toLowerCase().includes(lower)) score += 7;

  const push = (field: string, text: string | null | undefined, weight: number) => {
    const html = snippet(text, q);
    if (html) {
      matches.push({ field, html });
      score += weight;
    }
  };

  push('meaningHy', w.meaningHy, 5);
  push('meaningEn', w.meaningEn, 5);
  push('classicalEtymologyHy', w.classicalEtymologyHy, 4);
  push('classicalEtymologyEn', w.classicalEtymologyEn, 4);
  push('historicalUsageHy', w.historicalUsageHy, 3);
  push('historicalUsageEn', w.historicalUsageEn, 3);
  push('classicalSourceRef', w.classicalSourceRef, 6);

  return { score, matches };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10) || 10, 50);
  if (!q) return NextResponse.json({ results: [] });

  // Fetch candidate rows via OR-of-contains on each searchable column.
  // Prisma compiles this to a single SQL statement with ILIKE predicates.
  const candidates = await prisma.word.findMany({
    where: {
      status: 'published',
      OR: [
        { wordHy: { contains: q, mode: 'insensitive' } },
        { transliteration: { contains: q, mode: 'insensitive' } },
        { meaningHy: { contains: q, mode: 'insensitive' } },
        { meaningEn: { contains: q, mode: 'insensitive' } },
        { classicalEtymologyHy: { contains: q, mode: 'insensitive' } },
        { classicalEtymologyEn: { contains: q, mode: 'insensitive' } },
        { historicalUsageHy: { contains: q, mode: 'insensitive' } },
        { historicalUsageEn: { contains: q, mode: 'insensitive' } },
        { classicalSourceRef: { contains: q, mode: 'insensitive' } }
      ]
    },
    take: 200
  });

  const ranked = candidates
    .map((w) => ({ w, ...scoreAndSnippet(w, q) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json({
    results: ranked.map(({ w, score, matches }) => ({
      id: w.id,
      slug: w.slug,
      wordHy: w.wordHy,
      transliteration: w.transliteration,
      decomposition: w.decomposition,
      meaningHy: w.meaningHy,
      meaningEn: w.meaningEn,
      category: w.category,
      score,
      matches
    }))
  });
}
