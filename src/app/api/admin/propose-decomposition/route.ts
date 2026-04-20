import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, parseList } from '@/lib/prisma';
import { buildLookup, decompose } from '@/lib/decompose';
import { toSlug, transliterate } from '@/lib/transliterate';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const w = (url.searchParams.get('w') ?? '').trim().toLowerCase();
  if (!w) return NextResponse.json({ error: 'missing w' }, { status: 400 });

  const roots = await prisma.root.findMany();
  const lookup = buildLookup(
    roots.map((r) => ({
      id: r.id,
      token: r.token,
      length: r.length,
      meaningHy: parseList(r.meaningHy),
      meaningEn: parseList(r.meaningEn)
    }))
  );
  const result = decompose(w, lookup);
  return NextResponse.json({
    word: w,
    decomposition: result.canonical,
    rootSequence: result.parts.map((p) => p.rootId),
    suffix: result.suffix,
    unmatched: result.unmatched,
    transliteration: transliterate(w),
    slug: toSlug(w)
  });
}
