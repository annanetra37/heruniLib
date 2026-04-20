import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma, parseList } from '@/lib/prisma';
import type { Locale } from '@/i18n/config';
import RootsBrowser from '@/components/RootsBrowser';

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
        <h1 className="text-3xl font-bold">{t('roots.title')}</h1>
        <p className="mt-2 text-heruni-ink/70">{t('roots.subtitle')}</p>
      </header>
      <RootsBrowser
        locale={locale}
        roots={payload}
        labels={{
          all: t('roots.filterAll'),
          len1: t('roots.filterLen1'),
          len2: t('roots.filterLen2'),
          len3: t('roots.filterLen3'),
          search: t('roots.searchPlaceholder')
        }}
      />
    </div>
  );
}
