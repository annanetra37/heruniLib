'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import DecompositionRenderer, { type DecompPart } from './DecompositionRenderer';
import AiLoader from './AiLoader';
import DonationCTA from './DonationCTA';
import { markdownToHtml } from '@/lib/markdown';

// v2 rich /decompose view. Whatever the input — curated, in-review, or
// unseen — this renders the same multi-layer layout:
//   header  →  decomposition pills  →  inline root-glosses table  →
//   Heruni reconstruction  →  classical etymology  →  historical usage  →
//   related words
//
// For curated words (any status) we use the DB content. For unseen words
// we auto-fire the AI pipeline the moment the decomposition resolves, so
// visitors never see a "letter-only" dead end.

type Candidate = {
  rootId: number;
  token: string;
  length: 1 | 2 | 3;
  meaningHy: string[];
  meaningEn: string[];
};

type RelatedWord = { wordHy: string; slug: string; decomposition: string };
type BookRef = {
  id: number;
  bookPage: number;
  chapter: string | null;
  excerptHy: string;
  excerptEn: string | null;
  imageUrl: string | null;
};

type APIResult = {
  source: 'curated' | 'automatic';
  word: string;
  slug?: string;
  transliteration?: string;
  decomposition: string;
  parts: Candidate[];
  suffix: string | null;
  unmatched: string;
  meaningHy?: string;
  meaningEn?: string;
  category?: string;
  confidence?: number;
  status?: string;
  shapeGuess?: string;
  categoryGuess?: string | null;
  classicalEtymologyHy?: string | null;
  classicalEtymologyEn?: string | null;
  classicalSourceRef?: string[];
  firstAttestation?: string | null;
  usagePeriod?: string | null;
  historicalUsageHy?: string | null;
  historicalUsageEn?: string | null;
  culturalNotesHy?: string | null;
  culturalNotesEn?: string | null;
  relatedWords?: RelatedWord[];
  bookRefs?: BookRef[];
  pattern?: { code: string; nameHy: string; nameEn: string } | null;
};

type AiDraft = {
  pattern_code: string;
  meaning_hy: string;
  meaning_en: string;
  confidence: number;
  editor_notes: string;
};

type ClassicalDraft = {
  meaning_hy: string;
  meaning_en: string;
  sources: string[];
  confidence: number;
  editor_notes: string;
};

type RelatedFromAi = {
  wordHy: string;
  slug: string;
  decomposition: string;
  sharedRootTokens: string[];
};

const SHAPE_LABEL_HY: Record<string, string> = {
  'abstract-noun': 'վերացական գոյական',
  'agent-noun': 'գործողի գոյական',
  'place-noun': 'տեղի գոյական',
  'descriptor-noun': 'նկարագրող գոյական',
  diminutive: 'փոքրացուցիչ ձև',
  compound: 'բարդ բառ',
  'proper-name': 'հատուկ անուն',
  simple: 'պարզ բառ'
};
const SHAPE_LABEL_EN: Record<string, string> = {
  'abstract-noun': 'abstract noun',
  'agent-noun': 'agent noun',
  'place-noun': 'place noun',
  'descriptor-noun': 'descriptor',
  diminutive: 'diminutive',
  compound: 'compound',
  'proper-name': 'proper name',
  simple: 'simple form'
};

export default function DecomposeClient({
  locale,
  initial,
  labels
}: {
  locale: Locale;
  initial: string;
  labels: {
    placeholder: string;
    button: string;
    result: string;
    unmatched: string;
    automatic: string;
    badgeReviewed: string;
    badgeAutomatic: string;
    suggest: string;
    openFullEntry: string;
    aiButton: string;
    aiRunning: string;
    aiHeader: string;
    aiDisclaimer: string;
    aiConfidence: string;
    aiNotes: string;
    aiError: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<APIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [ai, setAi] = useState<AiDraft | null>(null);
  const [aiClassical, setAiClassical] = useState<ClassicalDraft | null>(null);
  const [aiRelated, setAiRelated] = useState<RelatedFromAi[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const autoFiredFor = useRef<string | null>(null);

  const run = async (term: string, opts: { updateUrl?: boolean } = { updateUrl: true }) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setLoading(true);
    setAi(null);
    setAiClassical(null);
    setAiRelated([]);
    setAiError(null);
    setLimitReached(false);
    autoFiredFor.current = null;
    // Keep the address bar in sync so every search is bookmarkable /
    // shareable. Use pushState so the browser back button restores the
    // previous query; router.replace() would swallow history.
    if (opts.updateUrl) {
      const target = `${pathname}?w=${encodeURIComponent(trimmed)}`;
      if (typeof window !== 'undefined' && window.location) {
        const current = window.location.pathname + window.location.search;
        if (current !== target) {
          window.history.pushState(null, '', target);
        }
      }
    }
    try {
      const r = await fetch(`/api/decompose?w=${encodeURIComponent(trimmed)}`);
      if (r.status === 402) {
        // Freemium wall — anonymous visitor has used all their free
        // searches. Surface the sign-up prompt and drop the stale result.
        setLimitReached(true);
        setRes(null);
        return;
      }
      const data = (await r.json()) as APIResult;
      setRes(data);
    } finally {
      setLoading(false);
    }
  };

  const generateAi = async (word: string) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const r = await fetch('/api/decompose/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ word })
      });
      if (r.status === 402) {
        setLimitReached(true);
        return;
      }
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? r.statusText);
      setAi(data.draft as AiDraft);
      setAiClassical((data.classical as ClassicalDraft | null) ?? null);
      setAiRelated(Array.isArray(data.related) ? (data.related as RelatedFromAi[]) : []);
    } catch (err) {
      setAiError((err as Error).message || labels.aiError);
    } finally {
      setAiLoading(false);
    }
  };

  // When we land on an automatic (unseen) result, auto-fire the AI
  // pipeline once per word so the user doesn't have to click a button
  // just to see a reconstruction.
  useEffect(() => {
    if (!res) return;
    if (res.source !== 'automatic') return;
    if (res.parts.length === 0) return;
    if (autoFiredFor.current === res.word) return;
    autoFiredFor.current = res.word;
    generateAi(res.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);

  useEffect(() => {
    if (initial) run(initial, { updateUrl: false });
    // Back/forward navigation: read ?w= from the current URL and re-run.
    const onPop = () => {
      const url = new URL(window.location.href);
      const next = (url.searchParams.get('w') ?? '').trim();
      if (!next) {
        setRes(null);
        setAi(null);
        setAiClassical(null);
        setAiRelated([]);
        setQ('');
        return;
      }
      setQ(next);
      run(next, { updateUrl: false });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parts: DecompPart[] = (res?.parts ?? []).map((p) => ({ token: p.token, length: p.length }));
  const isAuto = res?.source === 'automatic';

  // --- Composed content that can come from either curated or AI ---
  const heruniHy =
    (locale === 'hy' ? res?.meaningHy : res?.meaningEn) ||
    (ai ? (locale === 'hy' ? ai.meaning_hy : ai.meaning_en) : '');
  const heruniEn =
    (locale === 'hy' ? res?.meaningEn : res?.meaningHy) ||
    (ai ? (locale === 'hy' ? ai.meaning_en : ai.meaning_hy) : '');
  // Prefer curated DB content; fall back to what the algorithms produced.
  const classicalProse =
    (locale === 'hy' ? res?.classicalEtymologyHy : res?.classicalEtymologyEn) ||
    (aiClassical ? (locale === 'hy' ? aiClassical.meaning_hy : aiClassical.meaning_en) : null);
  const classicalSources =
    (res?.classicalSourceRef && res.classicalSourceRef.length > 0 && res.classicalSourceRef) ||
    (aiClassical?.sources ?? []);
  const classicalFromAlgorithms = !classicalProse
    ? false
    : !(locale === 'hy' ? res?.classicalEtymologyHy : res?.classicalEtymologyEn);
  const historicalProse = locale === 'hy' ? res?.historicalUsageHy : res?.historicalUsageEn;
  const culturalProse = locale === 'hy' ? res?.culturalNotesHy : res?.culturalNotesEn;

  // Related: curated wins; otherwise use the algorithm's DB-overlap list.
  const curatedRelated = res?.relatedWords ?? [];
  const relatedForRender =
    curatedRelated.length > 0
      ? curatedRelated.map((r) => ({ wordHy: r.wordHy, slug: r.slug, decomposition: r.decomposition, sharedRootTokens: [] as string[] }))
      : aiRelated.map((r) => ({
          wordHy: r.wordHy,
          slug: r.slug,
          decomposition: r.decomposition,
          sharedRootTokens: r.sharedRootTokens
        }));
  const relatedFromAlgorithms = curatedRelated.length === 0 && aiRelated.length > 0;

  const shapeLabel = res?.shapeGuess
    ? locale === 'hy'
      ? SHAPE_LABEL_HY[res.shapeGuess] ?? res.shapeGuess
      : SHAPE_LABEL_EN[res.shapeGuess] ?? res.shapeGuess
    : null;

  const inference = isAuto || (res?.source === 'curated' && res?.status !== 'published');
  const quickGlosses = res?.parts
    .flatMap((p) => (locale === 'hy' ? p.meaningHy : p.meaningEn).slice(0, 2))
    .slice(0, 6)
    .filter(Boolean);

  return (
    <div>
      {/* Floating donation-interest CTA — fixed left sidebar on desktop,
          inline at the top on mobile. Renders on every /decompose view
          (not tied to whether the user has searched yet), since the
          appeal is about the overall project, not the specific word. */}
      <DonationCTA />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={labels.placeholder}
          className="flex-1 rounded-full border border-heruni-ink/20 bg-white px-5 py-3 text-lg focus:border-heruni-sun focus:outline-none"
          lang={locale}
          autoFocus
        />
        <button
          type="submit"
          className="rounded-full bg-heruni-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-heruni-sun disabled:opacity-50"
          disabled={loading}
        >
          {labels.button}
        </button>
      </form>

      {limitReached && (
        <div className="mt-8 overflow-hidden rounded-3xl border border-heruni-amber/40 bg-gradient-to-br from-heruni-amber/15 via-heruni-parchment to-white p-6 text-center shadow-[0_10px_40px_-20px_rgba(198,135,42,0.35)] md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-heruni-bronze">
            {locale === 'hy' ? '✦ անվճար որոնումներն սպառվեցին' : '✦ free searches used'}
          </p>
          <h2 className="mt-3 font-serif text-2xl font-bold text-heruni-ink md:text-3xl" lang={locale}>
            {locale === 'hy'
              ? 'Շարունակե՞լ Հերունիի ՏԲ մեթոդի ուսումնասիրությունը։'
              : 'Keep exploring Heruni’s ՏԲ method.'}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-heruni-ink/75" lang={locale}>
            {locale === 'hy'
              ? 'Ստեղծեք անվճար հաշիվ՝ անսահմանափակ որոնումների, խորը վերծանումների և ձեր որոնման պատմության պահպանման համար։'
              : 'Create a free account for unlimited searches, deeper reconstructions, and to keep your search history.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={`/${locale}/login`}
              className="rounded-full bg-heruni-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-heruni-sun"
            >
              {locale === 'hy' ? 'Ստեղծել հաշիվ կամ մուտք գործել' : 'Create account or sign in'} →
            </Link>
          </div>
        </div>
      )}

      {res && !limitReached && (
        <article className="heruni-ornament heruni-ornament-lg relative mt-8 overflow-hidden rounded-3xl border border-heruni-amber/30 bg-white shadow-[0_10px_40px_-20px_rgba(198,135,42,0.35)] md:p-0">
          {/* --- HERO --- */}
          <header className="relative overflow-hidden bg-gradient-to-br from-heruni-amber/15 via-heruni-parchment to-white px-6 pb-6 pt-7 md:px-10 md:pt-9">
            {/* Thin amber rule at the very top for the "manuscript header" feel */}
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-heruni-sun to-transparent"
            />
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <h2
                className="font-serif text-5xl font-bold leading-none tracking-tight text-heruni-ink md:text-6xl"
                lang="hy"
              >
                {res.word}
              </h2>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {shapeLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-heruni-moss/15 px-3 py-1 text-xs font-semibold text-heruni-moss">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-heruni-moss"
                  />
                  {shapeLabel}
                </span>
              )}
              {inference && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-heruni-sun/20 px-3 py-1 text-xs font-semibold text-heruni-bronze">
                  <span aria-hidden="true">✦</span>
                  {locale === 'hy' ? 'Հերունի ենթադրություն' : 'heruni inference'}
                </span>
              )}
              {res.status === 'published' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <span aria-hidden="true">✓</span>
                  {labels.badgeReviewed}
                </span>
              )}
            </div>
            {quickGlosses && quickGlosses.length > 0 && (
              <p
                className="mt-4 max-w-2xl text-base text-heruni-ink/75"
                lang={locale}
              >
                {quickGlosses.join(' · ')}
              </p>
            )}
          </header>

          <div className="space-y-7 px-6 pb-6 pt-6 md:px-10 md:pb-10">

          {/* --- DECOMPOSITION --- */}
          <section>
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-heruni-bronze"><span aria-hidden="true" className="text-heruni-sun">◆</span>
              {locale === 'hy' ? 'Հերունի վերծանում' : 'Heruni decomposition'}
            </h3>
            <div className="mt-3">
              <DecompositionRenderer
                parts={parts}
                suffix={res.suffix ?? null}
                locale={locale}
                size="lg"
              />
            </div>
            {res.unmatched && (
              <p className="mt-3 text-xs text-amber-700">
                {labels.unmatched}: <span className="font-mono">{res.unmatched}</span>
              </p>
            )}

            {/* Inline root-glosses table (the two-column layout from the
                mockup). Using <dl> so screen readers read "token: gloss". */}
            {res.parts.length > 0 && (
              <dl className="mt-5 overflow-hidden rounded-2xl border border-heruni-amber/30 bg-white shadow-sm">
                {res.parts.map((p, i) => {
                  const glossesHy = (p.meaningHy ?? []).slice(0, 4).join(', ');
                  const glossesEn = (p.meaningEn ?? []).slice(0, 4).join(', ');
                  const lenTint =
                    p.length === 1
                      ? 'border-heruni-sun/60 bg-heruni-sun/10 text-heruni-sun'
                      : p.length === 2
                        ? 'border-heruni-moss/60 bg-heruni-moss/10 text-heruni-moss'
                        : 'border-heruni-bronze/60 bg-heruni-bronze/10 text-heruni-bronze';
                  return (
                    <div
                      key={`${p.token}-${i}`}
                      className={`flex items-center gap-4 border-b border-heruni-amber/15 px-4 py-3 text-sm transition last:border-b-0 hover:bg-heruni-amber/5 ${
                        i % 2 === 0 ? 'bg-white' : 'bg-heruni-parchment/30'
                      }`}
                    >
                      <dt className="w-14 shrink-0">
                        <Link
                          href={`/${locale}/roots/${encodeURIComponent(p.token)}`}
                          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-2 text-xl font-bold shadow-sm transition hover:scale-105 ${lenTint}`}
                          lang="hy"
                          title={`${p.length}-letter root`}
                        >
                          {p.token}
                        </Link>
                      </dt>
                      <dd className="min-w-0 flex-1 text-heruni-ink/80">
                        <span lang="hy">{glossesHy}</span>
                        {glossesEn && (
                          <>
                            {' — '}
                            <strong className="font-semibold text-heruni-ink">{glossesEn}</strong>
                          </>
                        )}
                      </dd>
                    </div>
                  );
                })}
                {res.suffix && (
                  <div className="flex items-baseline gap-4 bg-heruni-ink/5 px-4 py-2.5 text-sm">
                    <dt className="w-12 shrink-0 text-heruni-ink/50" lang="hy">
                      -{res.suffix}
                    </dt>
                    <dd className="text-xs italic text-heruni-ink/60">
                      {locale === 'hy' ? 'վերջածանց' : 'suffix'}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </section>

          {/* --- HERUNI RECONSTRUCTION --- */}
          <section>
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-heruni-bronze"><span aria-hidden="true" className="text-heruni-sun">◆</span>
              {locale === 'hy' ? 'Հերունի վերակառուցում' : 'Heruni reconstruction'}
            </h3>
            {heruniHy ? (
              <>
                <blockquote
                  className="relative mt-4 rounded-2xl border-l-4 border-heruni-sun bg-gradient-to-r from-heruni-amber/15 via-heruni-amber/5 to-transparent px-5 py-4"
                  lang={locale}
                >
                  <p className="font-serif text-xl font-semibold leading-relaxed text-heruni-ink md:text-2xl">
                    {heruniHy}
                  </p>
                </blockquote>
                {locale !== 'en' && heruniEn && (
                  <p className="mt-2 text-sm italic text-heruni-ink/60" lang="en">
                    {heruniEn}
                  </p>
                )}
                <p className="mt-3 text-xs text-heruni-ink/50">
                  {ai
                    ? (locale === 'hy'
                        ? `Ստեղծված մեր ալգորիթմներով՝ Հերունիի ՏԲ մեթոդով (գլ. 2.5-2.7)։ Գիրքում ուղղակի չի վերլուծված։ Ձևանմուշ՝ ${ai.pattern_code}, վստահություն՝ ${ai.confidence}/5.`
                        : `Inferred by our algorithms using Heruni's ՏԲ method (Ch. 2.5-2.7). Not analyzed directly in the book. Pattern: ${ai.pattern_code}, confidence ${ai.confidence}/5.`)
                    : res.source === 'curated' && res.status === 'published'
                      ? (locale === 'hy' ? 'Խմբագիրների կողմից ստուգված:' : 'Editor-reviewed.')
                      : (locale === 'hy'
                          ? 'Ենթադրված Հերունիի ՏԲ մեթոդով (գլ. 2.5-2.7)։ Գիրքում ուղղակի չի վերլուծված։'
                          : "Inferred by Heruni's ՏԲ method (Ch. 2.5-2.7). Not analyzed directly in the book.")}
                </p>
                {ai?.editor_notes && (
                  <p className="mt-3 rounded-lg border border-heruni-amber/40 bg-heruni-amber/10 p-3 text-xs text-heruni-ink/70">
                    <strong>{labels.aiNotes}:</strong> {ai.editor_notes}
                  </p>
                )}
              </>
            ) : aiLoading ? (
              <div className="mt-4">
                <AiLoader locale={locale as 'hy' | 'en'} />
              </div>
            ) : aiError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <p>{aiError}</p>
                <button
                  type="button"
                  onClick={() => res && generateAi(res.word)}
                  className="mt-2 rounded-full bg-heruni-ink px-3 py-1 text-white"
                >
                  {labels.aiButton}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => res && generateAi(res.word)}
                className="mt-3 rounded-full bg-heruni-ink px-4 py-2 text-sm font-semibold text-white hover:bg-heruni-sun"
              >
                ✨ {labels.aiButton}
              </button>
            )}
          </section>

          {/* --- CLASSICAL ETYMOLOGY --- */}
          {(classicalProse || classicalSources.length > 0) && (
            <details className="group rounded-xl border border-heruni-ink/10 bg-heruni-parchment/40 px-4 py-3" open>
              <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-[0.2em] text-heruni-bronze">
                ▼ {locale === 'hy' ? 'Դասական ստուգաբանություն (Աճառյան)' : 'Classical etymology (Ačaṙyan)'}
                {classicalFromAlgorithms && (
                  <span className="ml-2 rounded-full bg-heruni-sun/20 px-2 py-0.5 text-[10px] font-semibold text-heruni-bronze">
                    ✦ {locale === 'hy' ? 'մեր ալգորիթմները, չստուգված' : 'our algorithms, unreviewed'}
                  </span>
                )}
              </summary>
              {classicalProse && (
                <div
                  className="mt-3 text-sm leading-relaxed text-heruni-ink"
                  lang={locale}
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(classicalProse) }}
                />
              )}
              {classicalSources.length > 0 && (
                <ol className="mt-3 space-y-0.5 text-xs text-heruni-ink/60">
                  {classicalSources.map((ref, idx) => (
                    <li key={idx}>
                      <sup className="mr-1 font-mono text-heruni-sun">[{idx + 1}]</sup>
                      {ref}
                    </li>
                  ))}
                </ol>
              )}
              {classicalFromAlgorithms && aiClassical?.editor_notes && (
                <p className="mt-3 border-t border-heruni-ink/10 pt-2 text-xs italic text-heruni-ink/60">
                  <strong>
                    {locale === 'hy' ? 'Խմբագրական նշումներ' : 'Editor notes'}:
                  </strong>{' '}
                  {aiClassical.editor_notes}
                </p>
              )}
            </details>
          )}

          {/* --- HISTORICAL USAGE --- */}
          {(historicalProse || res.firstAttestation || res.usagePeriod) && (
            <details className="group rounded-xl border border-heruni-ink/10 bg-heruni-parchment/40 px-4 py-3" open>
              <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-[0.2em] text-heruni-bronze">
                ▼ {locale === 'hy' ? 'Պատմական կիրառում' : 'Historical usage'}
              </summary>
              {(res.firstAttestation || res.usagePeriod) && (
                <p className="mt-3 text-xs text-heruni-ink/70">
                  {res.firstAttestation && (
                    <>
                      {locale === 'hy' ? 'Առաջին վկայություն' : 'First attested'}:{' '}
                      <strong>{res.firstAttestation}</strong>
                    </>
                  )}
                  {res.firstAttestation && res.usagePeriod && ' · '}
                  {res.usagePeriod && <>{res.usagePeriod}</>}
                </p>
              )}
              {historicalProse && (
                <div
                  className="mt-3 text-sm leading-relaxed text-heruni-ink"
                  lang={locale}
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(historicalProse) }}
                />
              )}
            </details>
          )}

          {/* --- CULTURAL NOTES --- */}
          {culturalProse && (
            <details className="group rounded-xl border border-heruni-ink/10 bg-heruni-parchment/40 px-4 py-3">
              <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-[0.2em] text-heruni-bronze">
                ▼ {locale === 'hy' ? 'Մշակութային նշումներ' : 'Cultural notes'}
              </summary>
              <div
                className="mt-3 text-sm leading-relaxed text-heruni-ink"
                lang={locale}
                dangerouslySetInnerHTML={{ __html: markdownToHtml(culturalProse) }}
              />
            </details>
          )}

          {/* Related-words section removed — algorithmic overlap gave
              misleading results on short Armenian roots. Editors can still
              populate relatedWordIds via the CMS; we'll re-enable public
              rendering when the data is reliable. */}
          {false && relatedForRender.length > 0 && (
            <section style={{ display: 'none' }}>
              <ul>
                {relatedForRender.map((w) => (
                  <li key={w.slug}>
                    <Link href={`/${locale}/words/${w.slug}`} lang="hy">
                      <span>{w.wordHy}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* --- BOOK REFERENCES --- */}
          {res.bookRefs && res.bookRefs.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-heruni-bronze"><span aria-hidden="true" className="text-heruni-sun">◆</span>
                {locale === 'hy' ? 'Գրքի վկայություններ' : 'Book references'}
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {res.bookRefs.map((b) => (
                  <li key={b.id} className="rounded-lg border border-heruni-ink/10 bg-white p-3">
                    <p className="text-xs font-mono text-heruni-ink/60">
                      p.{b.bookPage}
                      {b.chapter ? ` · §${b.chapter}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-heruni-ink" lang="hy">
                      {b.excerptHy}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* --- FOOTER CTAs --- */}
          <footer className="flex flex-wrap gap-2 border-t border-heruni-ink/10 pt-5">
            {res.source === 'curated' && res.slug && (
              <Link
                href={`/${locale}/words/${res.slug}`}
                className="rounded-full bg-heruni-ink px-4 py-2 text-sm font-semibold text-white hover:bg-heruni-sun"
              >
                {labels.openFullEntry} →
              </Link>
            )}
            {isAuto && (
              <Link
                href={`/${locale}/contribute?w=${encodeURIComponent(res.word)}${
                  ai
                    ? `&hy=${encodeURIComponent(ai.meaning_hy)}&en=${encodeURIComponent(ai.meaning_en)}`
                    : ''
                }`}
                className="rounded-full border border-heruni-ink/20 px-4 py-2 text-sm font-semibold hover:bg-heruni-amber/10"
              >
                {labels.suggest}
              </Link>
            )}
            <Link
              href={`/${locale}/methodology`}
              className="ml-auto text-xs text-heruni-ink/60 underline decoration-heruni-sun/60 hover:decoration-heruni-sun"
            >
              {locale === 'hy'
                ? 'Ինչպե՞ս են ստեղծվում այս վերծանումները'
                : 'How do we derive these meanings?'}
            </Link>
          </footer>

          </div>
        </article>
      )}
    </div>
  );
}
