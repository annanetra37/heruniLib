import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma, parseList } from '@/lib/prisma';
import type { Locale } from '@/i18n/config';
import RootPill from '@/components/RootPill';
import SearchHomeBox from '@/components/SearchHomeBox';

export default async function Home({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  const [featuredRoots, featuredWords] = await Promise.all([
    prisma.root.findMany({
      where: { token: { in: ['ա', 'ձ', 'ար', 'այր', 'իկա'] } },
      orderBy: { length: 'asc' }
    }),
    prisma.word.findMany({
      where: { status: 'published' },
      orderBy: { wordHy: 'asc' },
      take: 8
    })
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-2xl bg-gradient-to-br from-heruni-amber/30 via-heruni-parchment to-white p-10 shadow-sm">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{t('home.title')}</h1>
        <p className="mt-3 max-w-2xl text-lg text-heruni-ink/80">{t('home.subtitle')}</p>
        <div className="mt-6">
          <SearchHomeBox locale={locale} />
        </div>
        <p className="mt-4 text-xs text-heruni-ink/60">{t('home.disclaimer')}</p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{t('home.featuredRoots')}</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {featuredRoots.map((r) => (
            <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
              <RootPill token={r.token} length={r.length as 1 | 2 | 3} locale={locale} size="lg" />
              <p className="mt-2 text-sm text-heruni-ink/70">
                {(locale === 'hy' ? parseList(r.meaningHy) : parseList(r.meaningEn))
                  .slice(0, 3)
                  .join(', ')}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{t('home.featuredWords')}</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {featuredWords.map((w) => (
            <li key={w.id}>
              <Link
                href={`/${locale}/words/${w.slug}`}
                className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-semibold">{w.wordHy}</span>
                  <span className="text-xs uppercase tracking-wider text-heruni-ink/50">
                    {w.transliteration}
                  </span>
                </div>
                <p className="mt-1 text-sm text-heruni-ink/70">
                  {locale === 'hy' ? w.meaningHy : w.meaningEn}
                </p>
                <p className="mt-1 text-xs text-heruni-ink/50">{w.decomposition}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
