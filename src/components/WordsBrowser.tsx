'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';

type WordRow = {
  id: number;
  wordHy: string;
  slug: string;
  category: string;
  decomposition: string;
  transliteration: string;
  meaning: string;
  confidence: number;
  createdAt: string;
};

export default function WordsBrowser({
  locale,
  words,
  categories,
  catLabels,
  labels,
  initial
}: {
  locale: Locale;
  words: WordRow[];
  categories: string[];
  catLabels: Record<string, string>;
  labels: { search: string; all: string; sortAlpha: string; sortRecent: string };
  initial: { cat: string; q: string; sort: 'alpha' | 'recent' };
}) {
  const [cat, setCat] = useState(initial.cat);
  const [q, setQ] = useState(initial.q);
  const [sort, setSort] = useState<'alpha' | 'recent'>(initial.sort);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = words.filter(
      (w) =>
        (!cat || w.category === cat) &&
        (!query || w.wordHy.toLowerCase().startsWith(query) || w.transliteration.includes(query))
    );
    if (sort === 'recent') return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list.sort((a, b) => a.wordHy.localeCompare(b.wordHy, 'hy'));
  }, [words, cat, q, sort]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          placeholder={labels.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded-full border border-heruni-ink/20 bg-white px-4 py-2 text-sm focus:border-heruni-sun focus:outline-none"
          lang={locale}
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="rounded-full border border-heruni-ink/20 bg-white px-3 py-2 text-sm"
        >
          <option value="">{labels.all}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {catLabels[c] ?? c}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as 'alpha' | 'recent')}
          className="rounded-full border border-heruni-ink/20 bg-white px-3 py-2 text-sm"
        >
          <option value="alpha">{labels.sortAlpha}</option>
          <option value="recent">{labels.sortRecent}</option>
        </select>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {filtered.map((w) => (
          <li key={w.id}>
            <Link
              href={`/${locale}/words/${w.slug}`}
              className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xl font-semibold">{w.wordHy}</span>
                <span className="rounded-full bg-heruni-amber/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-heruni-bronze">
                  {catLabels[w.category] ?? w.category}
                </span>
              </div>
              <p className="mt-1 text-xs text-heruni-ink/40">{w.decomposition}</p>
              <p className="mt-2 line-clamp-2 text-sm text-heruni-ink/70">{w.meaning}</p>
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
