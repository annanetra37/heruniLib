import { prisma, parseList } from '@/lib/prisma';

// GET /api/export/words.csv — v2 brief §4.5.
// UTF-8 CSV dump. RFC 4180 quoting for fields containing ", commas, or
// newlines. Paired with /api/export/words.json for the nightly backup.

export const dynamic = 'force-dynamic';

function csvField(value: unknown): string {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const words = await prisma.word.findMany({
    where: { status: 'published' },
    orderBy: { wordHy: 'asc' },
    include: { pattern: { select: { code: true } } }
  });

  const header = [
    'id',
    'word_hy',
    'transliteration',
    'slug',
    'decomposition',
    'suffix',
    'meaning_hy',
    'meaning_en',
    'category',
    'source',
    'confidence',
    'first_attestation',
    'usage_period',
    'pattern_code',
    'classical_etymology_hy',
    'classical_etymology_en',
    'classical_sources',
    'historical_usage_hy',
    'historical_usage_en',
    'updated_at'
  ];

  const rows = words.map((w) =>
    [
      w.id,
      w.wordHy,
      w.transliteration,
      w.slug,
      w.decomposition,
      w.suffix ?? '',
      w.meaningHy,
      w.meaningEn,
      w.category,
      w.source,
      w.confidence,
      w.firstAttestation ?? '',
      w.usagePeriod ?? '',
      w.pattern?.code ?? '',
      w.classicalEtymologyHy ?? '',
      w.classicalEtymologyEn ?? '',
      parseList(w.classicalSourceRef).join(' | '),
      w.historicalUsageHy ?? '',
      w.historicalUsageEn ?? '',
      w.updatedAt.toISOString()
    ]
      .map(csvField)
      .join(',')
  );

  const csv = [header.join(','), ...rows].join('\n') + '\n';

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=900',
      'content-disposition': `attachment; filename="heruni-dict-words.csv"`
    }
  });
}
