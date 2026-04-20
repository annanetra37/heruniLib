'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';

export type WordRow = {
  id: number;
  wordHy: string;
  slug: string;
  category: string;
  decomposition: string;
  transliteration: string;
  meaning: string;
  confidence: number;
  createdAt: string;
  usagePeriod: string | null;
  patternCode: string | null;
  hasClassical: boolean;
};

export type PatternLite = { code: string; name: string };

export default function WordsBrowser({
  locale,
  words,
  categories,
  catLabels,
  periods,
  periodLabels,
  patterns,
  labels,
  initial
}: {
  locale: Locale;
  words: WordRow[];
  categories: string[];
  catLabels: Record<string, string>;
  periods: string[];
  periodLabels: Record<string, string>;
  patterns: PatternLite[];
  labels: {
    search: string;
    all: string;
    sortAlpha: string;
    sortRecent: string;
    category: string;
    period: string;
    pattern: string;
    hasClassical: string;
    minConfidence: string;
    clear: string;
    anyCategory: string;
    anyPeriod: string;
    anyPattern: string;
  };
  initial: {
    cat: string;
    q: string;
    sort: 'alpha' | 'recent';
    period: string;
    pattern: string;
    hasClassical: boolean;
    minConfidence: 0 | 1 | 2 | 3;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [cat, setCat] = useState(initial.cat);
  const [q, setQ] = useState(initial.q);
  const [sort, setSort] = useState<'alpha' | 'recent'>(initial.sort);
  const [period, setPeriod] = useState(initial.period);
  const [pattern, setPattern] = useState(initial.pattern);
  const [hasClassical, setHasClassical] = useState(initial.hasClassical);
  const [minConfidence, setMinConfidence] = useState<0 | 1 | 2 | 3>(initial.minConfidence);

  // Reflect filters into the URL (shallow replace). Makes every facet
  // state shareable; back button walks through filter history.
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (cat) params.set('cat', cat);
    if (sort !== 'alpha') params.set('sort', sort);
    if (period) params.set('period', period);
    if (pattern) params.set('pattern', pattern);
    if (hasClassical) params.set('classical', '1');
    if (minConfidence > 0) params.set('minConf', String(minConfidence));
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [q, cat, sort, period, pattern, hasClassical, minConfidence, router, pathname]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = words.filter(
      (w) =>
        (!cat || w.category === cat) &&
        (!period || w.usagePeriod === period) &&
        (!pattern || w.patternCode === pattern) &&
        (!hasClassical || w.hasClassical) &&
        w.confidence <= (minConfidence === 0 ? 3 : minConfidence) &&
        (!query ||
          w.wordHy.toLowerCase().includes(query) ||
          w.transliteration.toLowerCase().includes(query) ||
          w.meaning.toLowerCase().includes(query))
    );
    if (sort === 'recent') return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list.sort((a, b) => a.wordHy.localeCompare(b.wordHy, 'hy'));
  }, [words, cat, q, sort, period, pattern, hasClassical, minConfidence]);

  const clearAll = () => {
    setCat('');
    setQ('');
    setSort('alpha');
    setPeriod('');
    setPattern('');
    setHasClassical(false);
    setMinConfidence(0);
  };

  const activeFilters = [
    cat && labels.category,
    period && labels.period,
    pattern && labels.pattern,
    hasClassical && labels.hasClassical,
    minConfidence > 0 && labels.minConfidence
  ].filter(Boolean).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          placeholder={labels.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded-full border border-heruni-ink/20 bg-white px-4 py-2 text-sm focus:border-heruni-sun focus:outline-none"
          lang={locale}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as 'alpha' | 'recent')}
          className="rounded-full border border-heruni-ink/20 bg-white px-3 py-2 text-sm"
        >
          <option value="alpha">{labels.sortAlpha}</option>
          <option value="recent">{labels.sortRecent}</option>
        </select>
      </div>

      <div className="mb-6 grid gap-3 rounded-xl border bg-white p-3 md:grid-cols-4">
        <label className="block text-xs">
          <span className="font-semibold uppercase text-heruni-ink/60">{labels.category}</span>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="mt-1 w-full rounded-lg border border-heruni-ink/20 bg-white px-2 py-1 text-sm"
          >
            <option value="">{labels.anyCategory}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {catLabels[c] ?? c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase text-heruni-ink/60">{labels.period}</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="mt-1 w-full rounded-lg border border-heruni-ink/20 bg-white px-2 py-1 text-sm"
          >
            <option value="">{labels.anyPeriod}</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {periodLabels[p] ?? p}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase text-heruni-ink/60">{labels.pattern}</span>
          <select
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="mt-1 w-full rounded-lg border border-heruni-ink/20 bg-white px-2 py-1 text-sm"
          >
            <option value="">{labels.anyPattern}</option>
            {patterns.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasClassical}
              onChange={(e) => setHasClassical(e.target.checked)}
            />
            <span>{labels.hasClassical}</span>
          </label>
          <label className="block">
            <span className="font-semibold uppercase text-heruni-ink/60">
              {labels.minConfidence}
            </span>
            <select
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value) as 0 | 1 | 2 | 3)}
              className="mt-1 w-full rounded-lg border border-heruni-ink/20 bg-white px-2 py-1 text-sm"
            >
              <option value={0}>—</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
        </div>
      </div>

      {activeFilters > 0 && (
        <div className="mb-4 flex items-center gap-3 text-xs text-heruni-ink/60">
          <span>
            {filtered.length} / {words.length}
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-full border px-3 py-1 hover:bg-heruni-amber/10"
          >
            {labels.clear}
          </button>
        </div>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {filtered.map((w) => (
          <li key={w.id}>
            <Link
              href={`/${locale}/words/${w.slug}`}
              className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xl font-semibold" lang="hy">
                  {w.wordHy}
                </span>
                <span className="rounded-full bg-heruni-amber/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-heruni-bronze">
                  {catLabels[w.category] ?? w.category}
                </span>
              </div>
              <p className="mt-1 text-xs text-heruni-ink/40" lang="hy">
                {w.decomposition}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-heruni-ink/70">{w.meaning}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-heruni-ink/50">
                {w.usagePeriod && (
                  <span className="rounded bg-heruni-ink/5 px-1.5 py-0.5">
                    {periodLabels[w.usagePeriod] ?? w.usagePeriod}
                  </span>
                )}
                {w.patternCode && (
                  <span className="rounded bg-heruni-ink/5 px-1.5 py-0.5 font-mono">
                    #{w.patternCode}
                  </span>
                )}
                {w.hasClassical && (
                  <span className="rounded bg-heruni-moss/10 px-1.5 py-0.5 text-heruni-moss">
                    ◇
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <p className="mt-12 text-center text-sm text-heruni-ink/60">—</p>
      )}
    </>
  );
}
