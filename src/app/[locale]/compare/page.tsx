import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { prisma, parseInts, parseList } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params: { locale },
  searchParams
}: {
  params: { locale: Locale };
  searchParams: { words?: string };
}) {
  const slugs = (searchParams.words ?? '').split(',').filter(Boolean);
  return {
    title: slugs.length
      ? `Compare ${slugs.join(', ')} — Heruni Dict`
      : 'Compare — Heruni Dict',
    alternates: { canonical: `/${locale}/compare${slugs.length ? `?words=${slugs.join(',')}` : ''}` }
  };
}

// v2 §5.4 — /compare?words=մարդ,կին,հայր renders a column per word with
// Heruni reconstruction, decomposition, classical etymology, pattern,
// usage period. Up to 4 columns; fewer degrades gracefully.

export default async function ComparePage({
  params: { locale },
  searchParams
}: {
  params: { locale: Locale };
  searchParams: { words?: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  // Accept word_hy, transliteration, or slug. Keep user-typed order.
  const tokens = (searchParams.words ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 4);

  const words = tokens.length
    ? await prisma.word.findMany({
        where: {
          status: 'published',
          OR: [
            { slug: { in: tokens } },
            { wordHy: { in: tokens } },
            { transliteration: { in: tokens } }
          ]
        }
      })
    : [];

  // Preserve the user-specified order.
  const byKey = new Map<string, (typeof words)[number]>();
  for (const w of words) {
    byKey.set(w.slug, w);
    byKey.set(w.wordHy, w);
    byKey.set(w.transliteration.toLowerCase(), w);
  }
  const ordered = tokens
    .map((tok) => byKey.get(tok))
    .filter((w): w is NonNullable<typeof w> => !!w);

  const rootIds = Array.from(new Set(ordered.flatMap((w) => parseInts(w.rootSequence))));
  const roots = rootIds.length
    ? await prisma.root.findMany({ where: { id: { in: rootIds } } })
    : [];
  const rootById = new Map(roots.map((r) => [r.id, r]));

  const patternIds = Array.from(
    new Set(ordered.map((w) => w.patternId).filter((x): x is number => !!x))
  );
  const patterns = patternIds.length
    ? await prisma.pattern.findMany({ where: { id: { in: patternIds } } })
    : [];
  const patternById = new Map(patterns.map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t('compare.title')}</h1>

      {ordered.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-heruni-ink/60">
          {t('compare.pickPrompt')}. Example:{' '}
          <Link
            href={`/${locale}/compare?words=մարդ,հայր,իշխանություն`}
            className="text-heruni-sun hover:underline"
            lang="hy"
          >
            /compare?words=մարդ,հայր,իշխանություն
          </Link>
        </p>
      ) : (
        <div
          className="mt-8 grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(ordered.length, 4)}, minmax(0, 1fr))`
          }}
        >
          {ordered.map((w) => {
            const rootTokens = parseInts(w.rootSequence)
              .map((id) => rootById.get(id)?.token)
              .filter((t): t is string => !!t);
            const pattern = w.patternId ? patternById.get(w.patternId) : null;
            const classicalProse = locale === 'hy' ? w.classicalEtymologyHy : w.classicalEtymologyEn;
            return (
              <article
                key={w.id}
                className="rounded-xl border border-heruni-ink/10 bg-white p-4 shadow-sm"
              >
                <Link
                  href={`/${locale}/words/${w.slug}`}
                  className="block hover:text-heruni-sun"
                >
                  <h2 className="text-3xl font-bold" lang="hy">
                    {w.wordHy}
                  </h2>
                </Link>
                <p className="mt-3 font-mono text-xs text-heruni-ink/60" lang="hy">
                  {w.decomposition}
                </p>
                <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-heruni-ink/60">
                  {rootTokens.map((tok) => (
                    <span key={tok} className="rounded bg-heruni-amber/20 px-1.5 py-0.5" lang="hy">
                      {tok}
                    </span>
                  ))}
                </div>

                <div className="mt-4 border-t border-heruni-ink/10 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-heruni-bronze">
                    {t('words.heruniMethod')}
                  </p>
                  <p className="mt-1 text-sm text-heruni-ink" lang={locale}>
                    {locale === 'hy' ? w.meaningHy : w.meaningEn}
                  </p>
                  {pattern && (
                    <p className="mt-2 text-[10px] text-heruni-ink/50">
                      #{pattern.code}
                    </p>
                  )}
                </div>

                <div className="mt-4 border-t border-heruni-ink/10 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-heruni-ink/50">
                    {t('words.classicalEtymology')}
                  </p>
                  {classicalProse ? (
                    <p className="mt-1 text-sm text-heruni-ink" lang={locale}>
                      {classicalProse}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm italic text-heruni-ink/50">
                      {t('words.classicalEmpty')}
                    </p>
                  )}
                  {parseList(w.classicalSourceRef).length > 0 && (
                    <ol className="mt-2 space-y-0.5 text-[10px] text-heruni-ink/50">
                      {parseList(w.classicalSourceRef).map((ref, idx) => (
                        <li key={idx}>
                          <sup className="mr-1 font-mono text-heruni-sun">[{idx + 1}]</sup>
                          {ref}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-1 border-t border-heruni-ink/10 pt-3 text-[10px] text-heruni-ink/60">
                  <span className="rounded bg-heruni-ink/5 px-1.5 py-0.5">
                    {t(`category.${w.category as 'people'}`)}
                  </span>
                  {w.usagePeriod && (
                    <span className="rounded bg-heruni-ink/5 px-1.5 py-0.5">
                      {t(`period.${w.usagePeriod as 'grabar'}`)}
                    </span>
                  )}
                  <span className="rounded bg-heruni-ink/5 px-1.5 py-0.5">
                    conf {w.confidence}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
