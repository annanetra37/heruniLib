import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import type { Locale } from '@/i18n/config';
import WordsBrowser, { type WordRow, type PatternLite } from '@/components/WordsBrowser';

export const dynamic = 'force-dynamic';

export default async function WordsPage({
  params: { locale },
  searchParams
}: {
  params: { locale: Locale };
  searchParams: {
    cat?: string;
    q?: string;
    sort?: string;
    period?: string;
    pattern?: string;
    classical?: string;
    minConf?: string;
  };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  const [words, patterns] = await Promise.all([
    prisma.word.findMany({
      where: { status: 'published' },
      orderBy: { wordHy: 'asc' },
      include: { pattern: { select: { code: true, nameHy: true, nameEn: true } } }
    }),
    prisma.pattern.findMany({
      select: { code: true, nameHy: true, nameEn: true },
      orderBy: { code: 'asc' }
    })
  ]);

  const rows: WordRow[] = words.map((w) => ({
    id: w.id,
    wordHy: w.wordHy,
    slug: w.slug,
    category: w.category,
    decomposition: w.decomposition,
    transliteration: w.transliteration,
    meaning: locale === 'hy' ? w.meaningHy : w.meaningEn,
    confidence: w.confidence,
    createdAt: w.createdAt.toISOString(),
    usagePeriod: w.usagePeriod,
    patternCode: w.pattern?.code ?? null,
    hasClassical: !!(w.classicalEtymologyHy || w.classicalEtymologyEn)
  }));

  const categories = Array.from(new Set(words.map((w) => w.category))).sort();
  const catLabels: Record<string, string> = Object.fromEntries(
    categories.map((c) => [c, t(`category.${c as 'people'}`)])
  );
  const periods = Array.from(
    new Set(words.map((w) => w.usagePeriod).filter((p): p is string => !!p))
  ).sort();
  const periodLabels: Record<string, string> = Object.fromEntries(
    periods.map((p) => [p, t(`period.${p as 'grabar'}`)])
  );

  const patternsLite: PatternLite[] = patterns.map((p) => ({
    code: p.code,
    name: locale === 'hy' ? p.nameHy : p.nameEn
  }));

  const minConf = Number(searchParams.minConf ?? 0);
  const minConfidence: 0 | 1 | 2 | 3 = [0, 1, 2, 3].includes(minConf)
    ? (minConf as 0 | 1 | 2 | 3)
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{t('words.title')}</h1>
        <p className="mt-2 text-heruni-ink/70">{t('words.subtitle')}</p>
      </header>
      <WordsBrowser
        locale={locale}
        words={rows}
        categories={categories}
        catLabels={catLabels}
        periods={periods}
        periodLabels={periodLabels}
        patterns={patternsLite}
        labels={{
          search: t('words.searchPlaceholder'),
          all: t('words.categoryAll'),
          sortAlpha: t('words.sortAlpha'),
          sortRecent: t('words.sortRecent'),
          category: t('facets.category'),
          period: t('facets.period'),
          pattern: t('facets.pattern'),
          hasClassical: t('facets.hasClassical'),
          minConfidence: t('facets.minConfidence'),
          clear: t('facets.clear'),
          anyCategory: t('facets.anyCategory'),
          anyPeriod: t('facets.anyPeriod'),
          anyPattern: t('facets.anyPattern')
        }}
        initial={{
          cat: searchParams.cat ?? '',
          q: searchParams.q ?? '',
          sort: (searchParams.sort as 'alpha' | 'recent') ?? 'alpha',
          period: searchParams.period ?? '',
          pattern: searchParams.pattern ?? '',
          hasClassical: searchParams.classical === '1',
          minConfidence
        }}
      />
    </div>
  );
}
