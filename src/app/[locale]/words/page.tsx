import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import type { Locale } from '@/i18n/config';
import WordsBrowser from '@/components/WordsBrowser';

export const dynamic = 'force-dynamic';

export default async function WordsPage({
  params: { locale },
  searchParams
}: {
  params: { locale: Locale };
  searchParams: { cat?: string; q?: string; sort?: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  const words = await prisma.word.findMany({
    where: { status: 'published' },
    orderBy: { wordHy: 'asc' }
  });

  const rows = words.map((w) => ({
    id: w.id,
    wordHy: w.wordHy,
    slug: w.slug,
    category: w.category,
    decomposition: w.decomposition,
    transliteration: w.transliteration,
    meaning: locale === 'hy' ? w.meaningHy : w.meaningEn,
    confidence: w.confidence,
    createdAt: w.createdAt.toISOString()
  }));

  const categories = Array.from(new Set(words.map((w) => w.category))).sort();
  const catLabels: Record<string, string> = Object.fromEntries(
    categories.map((c) => [c, t(`category.${c as 'people'}`)])
  );

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
        labels={{
          search: t('words.searchPlaceholder'),
          all: t('words.categoryAll'),
          sortAlpha: t('words.sortAlpha'),
          sortRecent: t('words.sortRecent')
        }}
        initial={{
          cat: searchParams.cat ?? '',
          q: searchParams.q ?? '',
          sort: (searchParams.sort as 'alpha' | 'recent') ?? 'alpha'
        }}
      />
    </div>
  );
}
