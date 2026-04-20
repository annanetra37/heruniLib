import { NextResponse } from 'next/server';
import { prisma, parseList, parseInts } from '@/lib/prisma';
import { buildLookup, decompose } from '@/lib/decompose';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const w = (url.searchParams.get('w') ?? '').trim().toLowerCase();
  if (!w) return NextResponse.json({ error: 'missing w' }, { status: 400 });

  // First, try a curated match.
  const curated = await prisma.word.findFirst({
    where: {
      status: 'published',
      OR: [{ wordHy: w }, { slug: w }, { transliteration: w }]
    }
  });

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

  if (curated) {
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
      confidence: curated.confidence
    });
  }

  const result = decompose(w, lookup);
  return NextResponse.json({
    source: 'automatic',
    word: w,
    decomposition: result.canonical,
    parts: result.parts,
    suffix: result.suffix,
    unmatched: result.unmatched
  });
}
