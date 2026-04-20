import { prisma, parseInts, parseList } from '@/lib/prisma';

// GET /api/export/words.json — v2 brief §4.5.
// Public snapshot of every published word. Small cache + s-maxage so
// scrapers / open-dataset consumers don't hammer the DB. In prod, a
// nightly cron (Railway schedule) that GETs this and lifts to S3 is how
// the "dump lands in S3 every night at 02:00" acceptance criterion gets
// satisfied — endpoint is the source, cron is the lifter.

export const dynamic = 'force-dynamic';

export async function GET() {
  const [words, patternsRaw] = await Promise.all([
    prisma.word.findMany({
      where: { status: 'published' },
      orderBy: { wordHy: 'asc' },
      include: { pattern: { select: { code: true, nameEn: true } } }
    }),
    prisma.pattern.findMany({ select: { id: true, code: true } })
  ]);
  const patternById = new Map(patternsRaw.map((p) => [p.id, p.code]));

  const payload = {
    generatedAt: new Date().toISOString(),
    count: words.length,
    words: words.map((w) => ({
      id: w.id,
      word_hy: w.wordHy,
      transliteration: w.transliteration,
      slug: w.slug,
      decomposition: w.decomposition,
      root_sequence: parseInts(w.rootSequence),
      suffix: w.suffix,
      meaning_hy: w.meaningHy,
      meaning_en: w.meaningEn,
      category: w.category,
      source: w.source,
      confidence: w.confidence,
      first_attestation: w.firstAttestation,
      usage_period: w.usagePeriod,
      pattern_code: w.patternId ? patternById.get(w.patternId) ?? null : null,
      classical_etymology_hy: w.classicalEtymologyHy,
      classical_etymology_en: w.classicalEtymologyEn,
      classical_sources: parseList(w.classicalSourceRef),
      historical_usage_hy: w.historicalUsageHy,
      historical_usage_en: w.historicalUsageEn,
      cultural_notes_hy: w.culturalNotesHy,
      cultural_notes_en: w.culturalNotesEn,
      updated_at: w.updatedAt.toISOString()
    }))
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=900',
      'content-disposition': `attachment; filename="heruni-dict-words.json"`
    }
  });
}
