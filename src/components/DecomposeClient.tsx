'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import DecompositionRenderer, { type DecompPart } from './DecompositionRenderer';

type Candidate = {
  rootId: number;
  token: string;
  length: 1 | 2 | 3;
  meaningHy: string[];
  meaningEn: string[];
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
  confidence?: number;
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
  };
}) {
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<APIResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/decompose?w=${encodeURIComponent(term.trim())}`);
      const data = (await r.json()) as APIResult;
      setRes(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initial) run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parts: DecompPart[] = (res?.parts ?? []).map((p) => ({ token: p.token, length: p.length }));
  const isAuto = res?.source === 'automatic';

  return (
    <div>
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

      {res && (
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-3xl font-bold">{res.word}</h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isAuto ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isAuto ? labels.badgeAutomatic : labels.badgeReviewed}
            </span>
          </div>
          <div className="mt-4">
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
          {!isAuto && (res.meaningHy || res.meaningEn) && (
            <p className="mt-4 text-lg leading-relaxed">
              {locale === 'hy' ? res.meaningHy : res.meaningEn}
            </p>
          )}
          {isAuto && (
            <p className="mt-4 text-sm italic text-heruni-ink/60">{labels.automatic}</p>
          )}
          {isAuto && (
            <Link
              href={`/${locale}/contribute?w=${encodeURIComponent(res.word)}`}
              className="mt-3 inline-block text-sm font-semibold text-heruni-sun underline"
            >
              {labels.suggest}
            </Link>
          )}
          {!isAuto && res.slug && (
            <Link
              href={`/${locale}/words/${res.slug}`}
              className="mt-3 inline-block text-sm font-semibold text-heruni-sun underline"
            >
              →
            </Link>
          )}

          {res.parts.length > 0 && (
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {res.parts.map((p, i) => (
                <li key={`${p.token}-${i}`}>
                  <Link
                    href={`/${locale}/roots/${encodeURIComponent(p.token)}`}
                    className="flex items-baseline gap-3 rounded-lg border border-heruni-ink/10 px-3 py-2 hover:bg-heruni-amber/10"
                  >
                    <span className="text-2xl font-bold">{p.token}</span>
                    <span className="text-xs text-heruni-ink/60">
                      {(locale === 'hy' ? p.meaningHy : p.meaningEn).slice(0, 3).join(', ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
