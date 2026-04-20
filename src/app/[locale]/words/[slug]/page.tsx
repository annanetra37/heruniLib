import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma, parseInts } from '@/lib/prisma';
import type { Locale } from '@/i18n/config';
import DecompositionRenderer, { type DecompPart } from '@/components/DecompositionRenderer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params: { locale, slug }
}: {
  params: { locale: Locale; slug: string };
}) {
  const word = await prisma.word.findUnique({ where: { slug } });
  if (!word) return {};
  return {
    title: `${word.wordHy} — Heruni Dict`,
    description: locale === 'hy' ? word.meaningHy : word.meaningEn,
    alternates: {
      canonical: `/${locale}/words/${slug}`,
      languages: { hy: `/hy/words/${slug}`, en: `/en/words/${slug}` }
    },
    openGraph: {
      title: word.wordHy,
      description: locale === 'hy' ? word.meaningHy : word.meaningEn,
      locale
    }
  };
}

export default async function WordDetailPage({
  params: { locale, slug }
}: {
  params: { locale: Locale; slug: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const word = await prisma.word.findUnique({ where: { slug } });
  if (!word) notFound();

  const rootIds = parseInts(word.rootSequence);
  const roots = rootIds.length
    ? await prisma.root.findMany({ where: { id: { in: rootIds } } })
    : [];
  const byId = new Map(roots.map((r) => [r.id, r]));
  const parts: DecompPart[] = rootIds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ token: r.token, length: r.length as 1 | 2 | 3 }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="mb-6 text-sm text-heruni-ink/60">
        <Link href={`/${locale}/words`} className="hover:underline">
          {t('nav.words')}
        </Link>{' '}
        / <span className="font-mono">{word.wordHy}</span>
      </nav>

      <header className="border-b border-heruni-ink/10 pb-6">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-5xl font-bold">{word.wordHy}</h1>
          <span className="text-sm uppercase tracking-widest text-heruni-ink/50">
            {word.transliteration}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {word.status === 'published' && word.confidence <= 2 ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">
              {t('words.badgeReviewed')}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
              {t('words.badgeAutomatic')}
            </span>
          )}
          <span className="rounded-full bg-heruni-amber/20 px-3 py-1 text-heruni-bronze">
            {t(`category.${word.category as 'people'}`)}
          </span>
          <span className="rounded-full border border-heruni-ink/10 px-3 py-1 text-heruni-ink/60">
            {t(`confidence.${word.confidence as 1}`)}
          </span>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-heruni-ink/50">
          {t('words.decomposition')}
        </h2>
        <div className="mt-3">
          <DecompositionRenderer parts={parts} suffix={word.suffix} locale={locale} size="lg" />
        </div>
        <p className="mt-3 text-xs text-heruni-ink/50">{word.decomposition}</p>
      </section>

      <section className="mt-8 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-heruni-ink/50">
          {t('words.meaning')}
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-heruni-ink">
          {locale === 'hy' ? word.meaningHy : word.meaningEn}
        </p>
      </section>

      <dl className="mt-8 grid gap-4 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-heruni-ink/50">
            {t('words.source')}
          </dt>
          <dd className="mt-1">{word.source}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-heruni-ink/50">
            {t('words.transliteration')}
          </dt>
          <dd className="mt-1 font-mono">{word.transliteration}</dd>
        </div>
      </dl>

      {parts.length > 0 && (
        <section className="mt-10">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-heruni-ink/50">
            {t('nav.roots')}
          </h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {roots.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/${locale}/roots/${encodeURIComponent(r.token)}`}
                  className="flex items-baseline gap-3 rounded-lg bg-white px-3 py-2 shadow-sm hover:shadow-md"
                >
                  <span className="text-2xl font-bold">{r.token}</span>
                  <span className="text-xs text-heruni-ink/60">
                    {(locale === 'hy'
                      ? JSON.parse(r.meaningHy)
                      : JSON.parse(r.meaningEn)
                    ).slice(0, 3).join(', ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
