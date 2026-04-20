import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma, parseList, parseInts } from '@/lib/prisma';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export default async function RootDetailPage({
  params: { locale, token }
}: {
  params: { locale: Locale; token: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const decoded = decodeURIComponent(token).toLowerCase();
  const root = await prisma.root.findUnique({ where: { token: decoded } });
  if (!root) notFound();

  const meanings = locale === 'hy' ? parseList(root.meaningHy) : parseList(root.meaningEn);
  const seeAlsoIds = parseInts(root.seeAlso);
  const seeAlsoRoots = seeAlsoIds.length
    ? await prisma.root.findMany({ where: { id: { in: seeAlsoIds } } })
    : [];

  // Find words whose rootSequence (JSON array of ints) contains this root.id.
  // In SQLite there's no `@>` operator, so we match on a JSON-formatted fragment.
  // When porting to Postgres with int[], replace with `rootSequence && ARRAY[id]`.
  const marker = `${root.id}`;
  const candidateWords = await prisma.word.findMany({
    where: {
      status: 'published',
      rootSequence: { contains: marker }
    },
    orderBy: { wordHy: 'asc' },
    take: 30
  });
  const wordsContaining = candidateWords.filter((w) => parseInts(w.rootSequence).includes(root.id));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <nav className="mb-6 text-sm text-heruni-ink/60">
        <Link href={`/${locale}/roots`} className="hover:underline">
          {t('nav.roots')}
        </Link>{' '}
        / <span className="font-mono">{root.token}</span>
      </nav>

      <header className="flex items-baseline gap-6 border-b border-heruni-ink/10 pb-6">
        <span className="text-7xl font-bold text-heruni-ink">{root.token}</span>
        <div>
          <p className="text-xs uppercase tracking-wider text-heruni-ink/50">
            {root.length === 1
              ? t('roots.filterLen1')
              : root.length === 2
              ? t('roots.filterLen2')
              : t('roots.filterLen3')}
          </p>
          {root.symbol && (
            <p className="mt-1 text-xl text-heruni-sun">
              {t('roots.symbolLabel')}: <span className="font-semibold">{root.symbol}</span>
            </p>
          )}
          <p className="mt-1 text-xs text-heruni-ink/60">
            {t('roots.pageLabel')}: {root.bookPage}
          </p>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-heruni-ink/50">
          {t('roots.meaningLabel')}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {meanings.map((m, i) => (
            <li
              key={i}
              className="rounded-full border border-heruni-ink/10 bg-white px-3 py-1 text-sm"
            >
              {m}
            </li>
          ))}
        </ul>
      </section>

      {(root.notesHy || root.notesEn) && (
        <section className="mt-6 rounded-lg bg-heruni-amber/10 p-4 text-sm text-heruni-ink/70">
          {(locale === 'hy' ? root.notesHy : root.notesEn) ?? root.notesEn ?? root.notesHy}
        </section>
      )}

      {seeAlsoRoots.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-heruni-ink/50">
            {t('roots.seeAlso')}
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {seeAlsoRoots.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/${locale}/roots/${encodeURIComponent(r.token)}`}
                  className="root-pill"
                >
                  {r.token}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-heruni-ink/50">
          {t('roots.wordsContaining')}
        </h3>
        {wordsContaining.length === 0 ? (
          <p className="mt-3 text-sm text-heruni-ink/60">{t('roots.noWordsYet')}</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {wordsContaining.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/${locale}/words/${w.slug}`}
                  className="block rounded-xl bg-white p-3 shadow-sm transition hover:shadow-md"
                >
                  <span className="text-lg font-semibold">{w.wordHy}</span>
                  <p className="mt-1 text-xs text-heruni-ink/50">{w.decomposition}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
