import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma, parseInts } from '@/lib/prisma';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params: { locale, code }
}: {
  params: { locale: Locale; code: string };
}) {
  const p = await prisma.pattern.findUnique({ where: { code } });
  if (!p) return {};
  return {
    title: `${locale === 'hy' ? p.nameHy : p.nameEn} — Heruni Dict`,
    description: (locale === 'hy' ? p.descriptionHy : p.descriptionEn) ?? undefined,
    alternates: {
      canonical: `/${locale}/patterns/${p.code}`,
      languages: {
        hy: `/hy/patterns/${p.code}`,
        en: `/en/patterns/${p.code}`
      }
    }
  };
}

export default async function PatternDetail({
  params: { locale, code }
}: {
  params: { locale: Locale; code: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const pattern = await prisma.pattern.findUnique({ where: { code } });
  if (!pattern) notFound();

  const exampleIds = parseInts(pattern.exampleWords);
  const [examples, wordsUsing] = await Promise.all([
    exampleIds.length
      ? prisma.word.findMany({
          where: { id: { in: exampleIds } },
          select: {
            id: true,
            wordHy: true,
            slug: true,
            decomposition: true,
            meaningHy: true,
            meaningEn: true
          }
        })
      : Promise.resolve([] as const),
    prisma.word.findMany({
      where: { patternId: pattern.id, status: 'published' },
      select: {
        id: true,
        wordHy: true,
        slug: true,
        decomposition: true,
        meaningHy: true,
        meaningEn: true
      },
      orderBy: { wordHy: 'asc' }
    })
  ]);

  // Examples preserve the editor-chosen ordering from exampleIds.
  const exampleMap = new Map(examples.map((w) => [w.id, w]));
  const orderedExamples = exampleIds
    .map((id) => exampleMap.get(id))
    .filter((w): w is NonNullable<typeof w> => !!w);

  const name = locale === 'hy' ? pattern.nameHy : pattern.nameEn;
  const template = locale === 'hy' ? pattern.templateHy : pattern.templateEn;
  const description = locale === 'hy' ? pattern.descriptionHy : pattern.descriptionEn;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <nav className="mb-6 text-sm text-heruni-ink/60">
        <Link href={`/${locale}/patterns`} className="hover:underline">
          {t('patterns.title')}
        </Link>{' '}
        / <span className="font-mono">{pattern.code}</span>
      </nav>

      <header className="border-b border-heruni-ink/10 pb-6">
        <h1 className="text-3xl font-bold">{name}</h1>
        <p className="mt-2 font-mono text-heruni-bronze" lang="hy">
          {template}
        </p>
        <p className="mt-2 font-mono text-xs text-heruni-ink/50">#{pattern.code}</p>
      </header>

      {description && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-heruni-ink/50">
            {t('patterns.description')}
          </h2>
          <p className="mt-3 text-heruni-ink" lang={locale}>
            {description}
          </p>
        </section>
      )}

      {orderedExamples.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-heruni-ink/50">
            {t('patterns.examples')}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {orderedExamples.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/${locale}/words/${w.slug}`}
                  className="block rounded-xl border border-heruni-amber/40 bg-heruni-amber/10 p-4 transition hover:border-heruni-sun hover:shadow-sm"
                >
                  <p className="text-xl font-semibold" lang="hy">
                    {w.wordHy}
                  </p>
                  <p className="mt-1 font-mono text-xs text-heruni-ink/60" lang="hy">
                    {w.decomposition}
                  </p>
                  <p className="mt-2 text-sm text-heruni-ink/80 line-clamp-2" lang={locale}>
                    {locale === 'hy' ? w.meaningHy : w.meaningEn}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-heruni-ink/50">
          {t('patterns.wordsUsing')} ({wordsUsing.length})
        </h2>
        {wordsUsing.length === 0 ? (
          <p className="mt-3 text-sm text-heruni-ink/60">{t('patterns.noWordsYet')}</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {wordsUsing.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/${locale}/words/${w.slug}`}
                  className="block rounded-lg border bg-white p-3 text-sm transition hover:border-heruni-sun"
                >
                  <span className="text-lg font-semibold" lang="hy">
                    {w.wordHy}
                  </span>
                  <p className="mt-1 font-mono text-xs text-heruni-ink/60" lang="hy">
                    {w.decomposition}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
