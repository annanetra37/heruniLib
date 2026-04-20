import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma, parseInts } from '@/lib/prisma';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params: { locale }
}: {
  params: { locale: Locale };
}) {
  const t = await getTranslations({ locale });
  return {
    title: `${t('patterns.title')} — Heruni Dict`,
    description: t('patterns.subtitle'),
    alternates: {
      canonical: `/${locale}/patterns`,
      languages: { hy: '/hy/patterns', en: '/en/patterns' }
    }
  };
}

export default async function PatternsIndex({
  params: { locale }
}: {
  params: { locale: Locale };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const patterns = await prisma.pattern.findMany({ orderBy: { code: 'asc' } });

  // Count words per pattern for display badges.
  const counts = await prisma.word.groupBy({
    by: ['patternId'],
    _count: { patternId: true },
    where: { status: 'published', patternId: { not: null } }
  });
  const countsByPattern = new Map<number, number>();
  for (const c of counts) {
    if (c.patternId != null) countsByPattern.set(c.patternId, c._count.patternId);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">{t('patterns.title')}</h1>
        <p className="mt-2 max-w-2xl text-heruni-ink/70">{t('patterns.subtitle')}</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {patterns.map((p) => {
          const name = locale === 'hy' ? p.nameHy : p.nameEn;
          const template = locale === 'hy' ? p.templateHy : p.templateEn;
          const description = locale === 'hy' ? p.descriptionHy : p.descriptionEn;
          const examplesCount = parseInts(p.exampleWords).length;
          const wordsCount = countsByPattern.get(p.id) ?? 0;
          return (
            <li key={p.id}>
              <Link
                href={`/${locale}/patterns/${p.code}`}
                className="block h-full rounded-xl border border-heruni-ink/10 bg-white p-5 transition hover:border-heruni-sun hover:shadow-md"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-xl font-semibold">{name}</h2>
                  <span className="font-mono text-xs text-heruni-ink/50">#{p.code}</span>
                </div>
                <p className="mt-2 font-mono text-sm text-heruni-bronze" lang="hy">
                  {template}
                </p>
                {description && (
                  <p className="mt-3 text-sm text-heruni-ink/70 line-clamp-3">{description}</p>
                )}
                <p className="mt-4 text-xs text-heruni-ink/50">
                  {examplesCount} {t('patterns.examples').toLowerCase()} · {wordsCount}{' '}
                  {t('words.title').toLowerCase()}
                </p>
              </Link>
            </li>
          );
        })}
        {patterns.length === 0 && (
          <li className="col-span-full rounded-xl border border-dashed border-heruni-ink/20 p-8 text-center text-sm text-heruni-ink/50">
            —
          </li>
        )}
      </ul>
    </div>
  );
}
