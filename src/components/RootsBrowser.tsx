'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';

type RootRow = {
  id: number;
  token: string;
  length: number;
  symbol: string | null;
  meaning: string[];
  bookPage: number;
};

const THEORETICAL = { 1: 39, 2: 86, 3: 37 } as const;

export default function RootsBrowser({
  locale,
  roots
}: {
  locale: Locale;
  roots: RootRow[];
}) {
  const t = useTranslations('roots');
  const [len, setLen] = useState<0 | 1 | 2 | 3>(0);
  const [q, setQ] = useState('');

  const counts = useMemo(
    () => ({
      1: roots.filter((r) => r.length === 1).length,
      2: roots.filter((r) => r.length === 2).length,
      3: roots.filter((r) => r.length === 3).length
    }),
    [roots]
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return roots.filter(
      (r) => (len === 0 || r.length === len) && (!query || r.token.includes(query))
    );
  }, [roots, len, q]);

  const btn = (v: 0 | 1 | 2 | 3, label: string) => {
    const caption =
      v === 0
        ? `${label} (${roots.length})`
        : `${label} (${counts[v]}/${THEORETICAL[v]})`;
    return (
      <button
        key={v}
        onClick={() => setLen(v)}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
          len === v
            ? 'bg-heruni-ink text-white'
            : 'bg-white text-heruni-ink/70 hover:bg-heruni-amber/20'
        }`}
      >
        {caption}
      </button>
    );
  };

  const activeLen = len === 0 ? null : len;
  const gap =
    activeLen !== null && counts[activeLen] < THEORETICAL[activeLen]
      ? { have: counts[activeLen], total: THEORETICAL[activeLen] }
      : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {btn(0, t('filterAll'))}
        {btn(1, t('filterLen1'))}
        {btn(2, t('filterLen2'))}
        {btn(3, t('filterLen3'))}
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="ml-auto w-full max-w-xs rounded-full border border-heruni-ink/20 bg-white px-4 py-1.5 text-sm focus:border-heruni-sun focus:outline-none"
          lang={locale}
        />
      </div>

      {gap && (
        <p className="mb-4 rounded-lg border border-heruni-amber/40 bg-heruni-amber/10 px-4 py-2 text-xs text-heruni-bronze">
          {t('transcribingNote', { have: gap.have, total: gap.total })}
        </p>
      )}

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
