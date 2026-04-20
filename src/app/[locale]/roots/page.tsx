import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma, parseList } from '@/lib/prisma';
import type { Locale } from '@/i18n/config';
import RootsBrowser from '@/components/RootsBrowser';

export const dynamic = 'force-dynamic';

export default async function RootsPage({
  params: { locale }
}: {
  params: { locale: Locale };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  const roots = await prisma.root.findMany({ orderBy: [{ length: 'asc' }, { token: 'asc' }] });
  const payload = roots.map((r) => ({
    id: r.id,
    token: r.token,
    length: r.length,
    symbol: r.symbol,
    meaning: (locale === 'hy' ? parseList(r.meaningHy) : parseList(r.meaningEn)).slice(0, 5),
    bookPage: r.bookPage
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">
          <abbr
            title={locale === 'hy' ? 'Տառերի Բազմություն (SSB)' : 'Semantic-Base Set (SSB)'}
            className="no-underline"
          >
            ՏԲ
          </abbr>{' '}
          {t('roots.title').replace(/^ՏԲ\s*/, '')}
        </h1>
        <p className="mt-2 text-heruni-ink/70">{t('roots.subtitle')}</p>
      </header>

      <aside className="mb-8 rounded-xl border border-heruni-ink/10 bg-white px-5 py-4">
        <h2 className="text-sm font-semibold text-heruni-ink">{t('roots.ssbAbbrevTitle')}</h2>
        <p className="mt-1 text-sm text-heruni-ink/70">{t('roots.ssbAbbrevBody')}</p>
        <Link
          href={`/${locale}/methodology`}
          className="mt-2 inline-block text-xs font-semibold text-heruni-sun hover:underline"
        >
          {t('roots.ssbAbbrevLink')} →
        </Link>
      </aside>

      <RootsBrowser locale={locale} roots={payload} />
    </div>
  );
}
