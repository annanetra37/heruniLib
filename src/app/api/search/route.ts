import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10) || 10, 50);
  if (!q) return NextResponse.json({ results: [] });

  // SQLite-friendly prefix/substring match. For Postgres, swap to
  // `word_hy % :q` + `similarity(word_hy,:q) DESC` with pg_trgm.
  const [wordStarts, wordContains, trans] = await Promise.all([
    prisma.word.findMany({
      where: { status: 'published', wordHy: { startsWith: q } },
      take: limit
    }),
    prisma.word.findMany({
      where: { status: 'published', wordHy: { contains: q } },
      take: limit
    }),
    prisma.word.findMany({
      where: { status: 'published', transliteration: { contains: q } },
      take: limit
    })
  ]);

  const seen = new Set<number>();
  const merged = [...wordStarts, ...wordContains, ...trans].filter((w) => {
    if (seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });

  return NextResponse.json({
    results: merged.slice(0, limit).map((w) => ({
      id: w.id,
      slug: w.slug,
      wordHy: w.wordHy,
      transliteration: w.transliteration,
      decomposition: w.decomposition,
      meaningHy: w.meaningHy,
      meaningEn: w.meaningEn,
      category: w.category
    }))
  });
}
