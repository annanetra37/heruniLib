import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { prisma } from '@/lib/prisma';
import { snippet } from '@/lib/searchSnippet';
import { logSearchQuery } from '@/lib/observability';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params: { locale },
  searchParams
}: {
  params: { locale: Locale };
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? '').trim();
  return {
    title: q ? `"${q}" — Heruni Dict` : 'Search — Heruni Dict',
    alternates: {
      canonical: `/${locale}/search${q ? `?q=${encodeURIComponent(q)}` : ''}`
    }
  };
}

// Server-rendered search page (v2 §5.1). Re-implements the API's ranking
// locally so the page is one DB round-trip and every result ships its own
// pre-highlighted snippet — no client fetch, no hydration flash.

type Match = { field: string; html: string };

export default async function SearchPage({
  params: { locale },
  searchParams
}: {
  params: { locale: Locale };
  searchParams: { q?: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const q = (searchParams.q ?? '').trim();

  let ranked: {
    id: number;
    wordHy: string;
    slug: string;
    transliteration: string;
    decomposition: string;
    meaning: string;
    category: string;
    score: number;
    matches: Match[];
  }[] = [];

  if (q) {
    const candidates = await prisma.word.findMany({
      where: {
        status: 'published',
        OR: [
          { wordHy: { contains: q, mode: 'insensitive' } },
          { transliteration: { contains: q, mode: 'insensitive' } },
          { meaningHy: { contains: q, mode: 'insensitive' } },
          { meaningEn: { contains: q, mode: 'insensitive' } },
          { classicalEtymologyHy: { contains: q, mode: 'insensitive' } },
          { classicalEtymologyEn: { contains: q, mode: 'insensitive' } },
          { historicalUsageHy: { contains: q, mode: 'insensitive' } },
          { historicalUsageEn: { contains: q, mode: 'insensitive' } },
          { classicalSourceRef: { contains: q, mode: 'insensitive' } }
        ]
      },
      take: 200
    });

    const lower = q.toLowerCase();
    ranked = candidates
      .map((w) => {
        const hy = w.wordHy.toLowerCase();
        let score = 0;
        const matches: Match[] = [];
        if (hy.startsWith(lower)) score += 10;
        else if (hy.includes(lower)) score += 8;
        if (w.transliteration.toLowerCase().includes(lower)) score += 7;
        const push = (field: string, text: string | null | undefined, weight: number) => {
          const html = snippet(text, q);
          if (html) {
            matches.push({ field, html });
            score += weight;
          }
        };
        push('meaningHy', w.meaningHy, 5);
        push('meaningEn', w.meaningEn, 5);
        push('classicalEtymologyHy', w.classicalEtymologyHy, 4);
        push('classicalEtymologyEn', w.classicalEtymologyEn, 4);
        push('historicalUsageHy', w.historicalUsageHy, 3);
        push('historicalUsageEn', w.historicalUsageEn, 3);
        push('classicalSourceRef', w.classicalSourceRef, 6);
        return {
          id: w.id,
          wordHy: w.wordHy,
          slug: w.slug,
          transliteration: w.transliteration,
          decomposition: w.decomposition,
          meaning: locale === 'hy' ? w.meaningHy : w.meaningEn,
          category: w.category,
          score,
          matches
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);

    // Log the query for the §6.7 content-gap dashboard. Don't await — we
    // shouldn't block render on logging, and it must not fail the page.
    void logSearchQuery(q, locale, ranked.length);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold">{t('search.title')}</h1>
        <form className="mt-4" action={`/${locale}/search`} method="GET">
          <input
            name="q"
            defaultValue={q}
            placeholder={t('search.placeholder')}
            className="w-full rounded-full border border-heruni-ink/20 bg-white px-5 py-3 text-lg shadow-sm focus:border-heruni-sun focus:outline-none"
            lang={locale}
            autoFocus
          />
        </form>
      </header>

      {q ? (
        <section className="mt-6">
          <p className="text-xs text-heruni-ink/60">
            {t('search.resultCount', { count: ranked.length })}
          </p>
          {ranked.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-heruni-ink/60">
              {t('search.empty', { q })}
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {ranked.map((r) => (
                <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <Link
                    href={`/${locale}/words/${r.slug}`}
                    className="block hover:text-heruni-sun"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="text-xl font-semibold" lang="hy">
                        {r.wordHy}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-heruni-ink/50" lang="hy">
                      {r.decomposition}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-heruni-ink/80">{r.meaning}</p>
                  </Link>
                  {r.matches.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {r.matches.map((m, idx) => (
                        <li key={idx} className="text-xs text-heruni-ink/70">
                          <span className="mr-2 rounded bg-heruni-ink/5 px-1.5 py-0.5 font-mono text-[10px] text-heruni-ink/50">
                            {m.field}
                          </span>
                          <span dangerouslySetInnerHTML={{ __html: m.html }} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="mt-6 text-sm text-heruni-ink/60">{t('search.hint')}</p>
      )}
    </div>
  );
}
