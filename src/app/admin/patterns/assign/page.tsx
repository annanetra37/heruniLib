import { prisma, parseInts } from '@/lib/prisma';
import { suggestPatternCode } from '@/lib/patternHint';
import AssignPatternsClient from '@/components/admin/AssignPatternsClient';

export const dynamic = 'force-dynamic';

export default async function AssignPatternsPage() {
  const [patterns, unassignedWords] = await Promise.all([
    prisma.pattern.findMany({
      select: { id: true, code: true, nameHy: true, nameEn: true },
      orderBy: { code: 'asc' }
    }),
    prisma.word.findMany({
      where: { patternId: null },
      select: {
        id: true,
        wordHy: true,
        slug: true,
        suffix: true,
        category: true,
        rootSequence: true,
        status: true,
        source: true
      },
      orderBy: [{ status: 'asc' }, { wordHy: 'asc' }]
    })
  ]);

  const patternsByCode = new Map(patterns.map((p) => [p.code, p]));

  const rows = unassignedWords.map((w) => {
    const suggested = suggestPatternCode({
      wordHy: w.wordHy,
      suffix: w.suffix,
      category: w.category,
      rootTokenCount: parseInts(w.rootSequence).length
    });
    const pat = suggested ? patternsByCode.get(suggested) ?? null : null;
    return {
      id: w.id,
      wordHy: w.wordHy,
      slug: w.slug,
      status: w.status,
      category: w.category,
      suffix: w.suffix,
      source: w.source,
      suggestedPatternId: pat?.id ?? null,
      suggestedPatternCode: pat?.code ?? null
    };
  });

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-bold">Assign patterns (tentative)</h1>
      <p className="mt-2 max-w-2xl text-sm text-heruni-ink/60">
        Words currently without a <code>pattern_id</code>. The suggestion column runs the
        shared heuristic (<code>src/lib/patternHint.ts</code>) — same rules the seed uses.
        Editors confirm or reassign from the word detail page; this view is a bulk shortcut.
      </p>

      <AssignPatternsClient rows={rows} patterns={patterns} />
    </div>
  );
}
