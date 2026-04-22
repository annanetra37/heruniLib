import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma, parseInts, parseList } from '@/lib/prisma';
import type { Locale } from '@/i18n/config';
import DecompositionRenderer, { type DecompPart } from '@/components/DecompositionRenderer';
import BookRefCard, { type BookRef } from '@/components/BookRefCard';
import { markdownToHtml } from '@/lib/markdown';
import { cached, tags } from '@/lib/cache';

// v2 §6.1 — word detail page is a prime cache target: heavy DB load + low
// churn. Tags flush on editor save (see api/admin/words/[id]/route.ts).
const loadWord = (slug: string) =>
  cached(
    async () => prisma.word.findUnique({ where: { slug } }),
    ['word', slug],
    [tags.word(slug)]
  )();

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
  const word = await loadWord(slug);
  if (!word) notFound();

  // --- Roots & decomposition --------------------------------------------
  const rootIds = parseInts(word.rootSequence);
  const roots = rootIds.length
    ? await prisma.root.findMany({ where: { id: { in: rootIds } } })
    : [];
  const rootsById = new Map(roots.map((r) => [r.id, r]));
  const parts: DecompPart[] = rootIds
    .map((id) => rootsById.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ token: r.token, length: r.length as 1 | 2 | 3 }));

  // --- v2: related words, book refs, pattern ----------------------------
  const relatedIds = parseInts(word.relatedWordIds);
  const bookRefIds = parseInts(word.heruniBookRefs);
  const classicalSourceRefs = parseList(word.classicalSourceRef);

  const [relatedWords, bookRefs, pattern] = await Promise.all([
    relatedIds.length
      ? prisma.word.findMany({
          where: { id: { in: relatedIds } },
          select: {
            id: true,
            wordHy: true,
            slug: true,
            decomposition: true,
            transliteration: true
          }
        })
      : Promise.resolve([] as const),
    bookRefIds.length
      ? prisma.source.findMany({
          where: { id: { in: bookRefIds } },
          orderBy: { bookPage: 'asc' }
        })
      : Promise.resolve([] as const),
    word.patternId
      ? prisma.pattern.findUnique({ where: { id: word.patternId } })
      : Promise.resolve(null)
  ]);

  const refsForClient: BookRef[] = bookRefs.map((s) => ({
    id: s.id,
    bookPage: s.bookPage,
    chapter: s.chapter,
    excerptHy: s.excerptHy,
    excerptEn: s.excerptEn,
    imageUrl: s.imageUrl
  }));

  const heruniProse = locale === 'hy' ? word.meaningHy : word.meaningEn;
  const classicalProse =
    locale === 'hy' ? word.classicalEtymologyHy : word.classicalEtymologyEn;
  const historicalProse =
    locale === 'hy' ? word.historicalUsageHy : word.historicalUsageEn;
  const culturalProse = locale === 'hy' ? word.culturalNotesHy : word.culturalNotesEn;

  // --- JSON-LD DefinedTerm (v2 §5.6) ---
  // Validates in Google's Rich Results Test. inDefinedTermSet points at
  // the dictionary homepage so crawlers treat each word as a member of a
  // named vocabulary.
  const site =
    process.env.SITE_URL?.replace(/\/$/, '') ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ??
    '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': `${site}/${locale}/words/${word.slug}`,
    name: word.wordHy,
    alternateName: word.transliteration,
    description: locale === 'hy' ? word.meaningHy : word.meaningEn,
    inLanguage: locale,
    url: `${site}/${locale}/words/${word.slug}`,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: 'Heruni Dict',
      url: site || `/${locale}`
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="mb-6 text-sm text-heruni-ink/60">
        <Link href={`/${locale}/words`} className="hover:underline">
          {t('nav.words')}
        </Link>{' '}
        / <span className="font-mono" lang="hy">
          {word.wordHy}
        </span>
      </nav>

      {/* Header --------------------------------------------------------- */}
      <header className="heruni-ornament relative overflow-hidden rounded-3xl border border-heruni-amber/30 bg-gradient-to-br from-heruni-amber/15 via-heruni-parchment to-white px-6 py-7 shadow-[0_10px_40px_-20px_rgba(198,135,42,0.35)] md:px-10 md:py-9">
        <div
          aria-hidden="true"
          className="absolute left-0 right-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-heruni-sun to-transparent"
        />
        <div className="flex items-baseline gap-4">
          <h1 className="font-serif text-5xl font-bold leading-none tracking-tight md:text-6xl" lang="hy">
            {word.wordHy}
          </h1>
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
          {word.usagePeriod && (
            <span className="rounded-full border border-heruni-ink/10 px-3 py-1 text-heruni-ink/60">
              {t(`period.${word.usagePeriod as 'grabar'}`)}
            </span>
          )}
          {pattern && (
            <Link
              href={`/${locale}/patterns/${pattern.code}`}
              className="rounded-full bg-heruni-ink/5 px-3 py-1 font-mono text-heruni-ink/70 hover:bg-heruni-ink/10"
              title={locale === 'hy' ? pattern.nameHy : pattern.nameEn}
            >
              #{pattern.code}
            </Link>
          )}
        </div>
      </header>

      {/* Decomposition -------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-heruni-ink/50">
          {t('words.decomposition')}
        </h2>
        <div className="mt-3">
          <DecompositionRenderer parts={parts} suffix={word.suffix} locale={locale} size="lg" />
        </div>
        <p className="mt-3 text-xs text-heruni-ink/50" lang="hy">
          {word.decomposition}
        </p>
      </section>

      {/* Side-by-side Heruni method vs. Classical etymology ------------- */}
      <section className="mt-10 grid gap-6 md:grid-cols-2">
        {/* Heruni method (always present) */}
        <article className="rounded-xl border border-heruni-amber/40 bg-heruni-amber/10 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-heruni-bronze">
            <span aria-hidden="true">◆</span>
            {t('words.heruniMethod')}
          </h2>
          <p
            className="mt-3 text-lg leading-relaxed text-heruni-ink"
            lang={locale}
          >
            {heruniProse}
          </p>
          {pattern && (
            <p className="mt-4 text-xs text-heruni-ink/60">
              {t('words.pattern')}:{' '}
              <Link
                href={`/${locale}/patterns/${pattern.code}`}
                className="font-semibold hover:text-heruni-sun"
              >
                {locale === 'hy' ? pattern.nameHy : pattern.nameEn}
              </Link>{' '}
              <span className="font-mono" lang="hy">
                · {locale === 'hy' ? pattern.templateHy : pattern.templateEn}
              </span>
            </p>
          )}
        </article>

        {/* Classical etymology */}
        <article className="rounded-xl border border-heruni-ink/10 bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-heruni-ink/60">
            <span aria-hidden="true">◇</span>
            {t('words.classicalEtymology')}
          </h2>
          {classicalProse ? (
            <div
              className="mt-3 text-sm text-heruni-ink"
              lang={locale}
              dangerouslySetInnerHTML={{ __html: markdownToHtml(classicalProse) }}
            />
          ) : (
            <p className="mt-3 text-sm italic text-heruni-ink/50">
              {t('words.classicalEmpty')}
            </p>
          )}
          {classicalSourceRefs.length > 0 && (
            <div className="mt-4 border-t border-heruni-ink/10 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-heruni-ink/50">
                {t('words.sourcesLabel')}
              </p>
              <ol className="mt-1 space-y-1 text-xs text-heruni-ink/60">
                {classicalSourceRefs.map((ref, idx) => (
                  <li key={idx}>
                    <sup className="mr-1 font-mono text-heruni-sun">[{idx + 1}]</sup>
                    {ref}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </article>
      </section>

      {/* Historical usage + cultural notes ------------------------------ */}
      {(historicalProse || culturalProse || word.firstAttestation) && (
        <section className="mt-10 space-y-4">
          {(word.firstAttestation || word.usagePeriod) && (
            <dl className="grid gap-4 text-sm md:grid-cols-2">
              {word.firstAttestation && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-heruni-ink/50">
                    {t('words.firstAttestation')}
                  </dt>
                  <dd className="mt-1" lang={locale}>
                    {word.firstAttestation}
                  </dd>
                </div>
              )}
              {word.usagePeriod && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-heruni-ink/50">
                    {t('words.usagePeriod')}
                  </dt>
                  <dd className="mt-1">
                    {t(`period.${word.usagePeriod as 'grabar'}`)}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {historicalProse && (
            <details className="rounded-xl border bg-white p-5" open>
              <summary className="cursor-pointer select-none text-sm font-semibold uppercase tracking-wider text-heruni-ink/60">
                {t('words.historicalUsage')}
              </summary>
              <div
                className="mt-3 text-sm text-heruni-ink"
                lang={locale}
                dangerouslySetInnerHTML={{ __html: markdownToHtml(historicalProse) }}
              />
            </details>
          )}

          {culturalProse && (
            <details className="rounded-xl border bg-white p-5">
              <summary className="cursor-pointer select-none text-sm font-semibold uppercase tracking-wider text-heruni-ink/60">
                {t('words.culturalNotes')}
              </summary>
              <div
                className="mt-3 text-sm text-heruni-ink"
                lang={locale}
                dangerouslySetInnerHTML={{ __html: markdownToHtml(culturalProse) }}
              />
            </details>
          )}
        </section>
      )}

      {/* Related-words section removed from public UI — noisy output on
          short ՏԲ roots. DB columns remain for editors; admin word-editor
          still lets them curate a list per word. */}

      {/* Heruni book references ---------------------------------------- */}
      {refsForClient.length > 0 && (
        <section className="mt-10">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-heruni-ink/50">
            {t('words.bookReferences')}
          </h3>
          <ul className="mt-3 space-y-2">
            {refsForClient.map((r) => (
              <BookRefCard
                key={r.id}
                ref={r}
                locale={locale}
                labels={{ page: t('words.bookPageLabel'), chapter: t('words.chapterLabel') }}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Roots ---------------------------------------------------------- */}
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
                  <span className="text-2xl font-bold" lang="hy">
                    {r.token}
                  </span>
                  <span className="text-xs text-heruni-ink/60" lang={locale}>
                    {(locale === 'hy'
                      ? (JSON.parse(r.meaningHy) as string[])
                      : (JSON.parse(r.meaningEn) as string[])
                    )
                      .slice(0, 3)
                      .join(', ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Source label -------------------------------------------------- */}
      <dl className="mt-10 border-t border-heruni-ink/10 pt-6 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wider text-heruni-ink/50">
            {t('words.source')}
          </dt>
          <dd className="mt-1">{word.source}</dd>
        </div>
      </dl>

      {/* v2 §6.4 — link to methodology from every word page. The brief calls
          this out explicitly: users who want to understand why the Heruni
          method produces what it does should be one click away. */}
      <p className="mt-8 text-center text-xs text-heruni-ink/60">
        <Link
          href={`/${locale}/methodology`}
          className="underline decoration-heruni-sun/60 hover:decoration-heruni-sun"
        >
          {locale === 'hy'
            ? 'Ինչպե՞ս են ստեղծվում այս վերծանումները'
            : 'How do we derive these meanings?'}
        </Link>
      </p>
    </div>
  );
}
