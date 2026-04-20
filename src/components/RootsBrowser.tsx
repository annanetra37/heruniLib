'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';

type RootRow = {
  id: number;
  token: string;
  length: number;
  symbol: string | null;
  meaning: string[];
  bookPage: number;
};

export default function RootsBrowser({
  locale,
  roots,
  labels
}: {
  locale: Locale;
  roots: RootRow[];
  labels: { all: string; len1: string; len2: string; len3: string; search: string };
}) {
  const [len, setLen] = useState<0 | 1 | 2 | 3>(0);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return roots.filter(
      (r) => (len === 0 || r.length === len) && (!query || r.token.includes(query))
    );
  }, [roots, len, q]);

  const btn = (v: 0 | 1 | 2 | 3, label: string) => (
    <button
      key={v}
      onClick={() => setLen(v)}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        len === v
          ? 'bg-heruni-ink text-white'
          : 'bg-white text-heruni-ink/70 hover:bg-heruni-amber/20'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {btn(0, labels.all)}
        {btn(1, labels.len1)}
        {btn(2, labels.len2)}
        {btn(3, labels.len3)}
        <input
          type="text"
          placeholder={labels.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="ml-auto w-full max-w-xs rounded-full border border-heruni-ink/20 bg-white px-4 py-1.5 text-sm focus:border-heruni-sun focus:outline-none"
          lang={locale}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {filtered.map((r) => (
          <Link
            key={r.id}
            href={`/${locale}/roots/${encodeURIComponent(r.token)}`}
            className={`group flex flex-col rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              r.length === 1
                ? 'border-heruni-sun/40'
                : r.length === 2
                ? 'border-heruni-moss/40'
                : 'border-heruni-bronze/40'
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-heruni-ink">{r.token}</span>
              {r.symbol && <span className="text-xl text-heruni-sun">{r.symbol}</span>}
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-heruni-ink/60">
              {r.meaning.join(', ')}
            </p>
            <p className="mt-auto pt-3 text-[10px] uppercase tracking-wider text-heruni-ink/40">
              p.{r.bookPage}
            </p>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="mt-12 text-center text-sm text-heruni-ink/60">—</p>
      )}
    </div>
  );
}
