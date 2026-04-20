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

type AiDraft = {
  pattern_code: string;
  meaning_hy: string;
  meaning_en: string;
  confidence: number;
  editor_notes: string;
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
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<APIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [ai, setAi] = useState<AiDraft | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const run = async (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    setAi(null);
    setAiError(null);
    try {
      const r = await fetch(`/api/decompose?w=${encodeURIComponent(term.trim())}`);
      const data = (await r.json()) as APIResult;
      setRes(data);
    } finally {
      setLoading(false);
    }
  };

  const generateAi = async () => {
    if (!res?.word) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const r = await fetch('/api/decompose/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ word: res.word })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? r.statusText);
      setAi(data.draft as AiDraft);
    } catch (err) {
      setAiError((err as Error).message || labels.aiError);
    } finally {
      setAiLoading(false);
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
            <h2 className="text-3xl font-bold" lang="hy">
              {res.word}
            </h2>
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

          {!isAuto && res.slug && (
            <Link
              href={`/${locale}/words/${res.slug}`}
              className="mt-4 inline-flex items-center gap-1 rounded-full bg-heruni-ink px-4 py-2 text-sm font-semibold text-white hover:bg-heruni-sun"
            >
              {labels.openFullEntry} →
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
                    <span className="text-2xl font-bold" lang="hy">
                      {p.token}
                    </span>
                    <span className="text-xs text-heruni-ink/60" lang={locale}>
                      {(locale === 'hy' ? p.meaningHy : p.meaningEn).slice(0, 3).join(', ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* On-demand AI reconstruction for unseen words. Only show when
              the result is automatic — for curated words we already have
              a full entry behind "Open the full entry". */}
          {isAuto && res.parts.length > 0 && (
            <section className="mt-6 rounded-xl border border-heruni-amber/40 bg-heruni-amber/10 p-4">
              {!ai ? (
                <>
                  <p className="text-sm italic text-heruni-ink/70">{labels.automatic}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={generateAi}
                      className="rounded-full bg-heruni-ink px-4 py-2 text-sm font-semibold text-white hover:bg-heruni-sun disabled:opacity-50"
                    >
                      {aiLoading ? labels.aiRunning : `✨ ${labels.aiButton}`}
                    </button>
                    <Link
                      href={`/${locale}/contribute?w=${encodeURIComponent(res.word)}`}
                      className="rounded-full border border-heruni-ink/20 px-4 py-2 text-sm font-semibold hover:bg-white"
                    >
                      {labels.suggest}
                    </Link>
                  </div>
                  {aiError && <p className="mt-3 text-xs text-red-600">{aiError}</p>}
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-heruni-bronze">
                      ✨ {labels.aiHeader}
                    </span>
                    <span className="rounded-full bg-heruni-amber/30 px-2 py-0.5 font-mono text-[10px]">
                      {ai.pattern_code}
                    </span>
                    <span className="text-[10px] text-heruni-ink/60">
                      {labels.aiConfidence}: {ai.confidence} / 5
                    </span>
                  </div>
                  <p className="mt-3 text-lg leading-relaxed" lang={locale}>
                    {locale === 'hy' ? ai.meaning_hy : ai.meaning_en}
                  </p>
                  {(locale === 'hy' ? ai.meaning_en : ai.meaning_hy) && (
                    <p className="mt-1 text-sm text-heruni-ink/60" lang={locale === 'hy' ? 'en' : 'hy'}>
                      {locale === 'hy' ? ai.meaning_en : ai.meaning_hy}
                    </p>
                  )}
                  {ai.editor_notes && (
                    <p className="mt-3 border-t border-heruni-amber/30 pt-2 text-xs text-heruni-ink/70">
                      <strong>{labels.aiNotes}:</strong> {ai.editor_notes}
                    </p>
                  )}
                  <p className="mt-3 text-[11px] italic text-heruni-ink/60">{labels.aiDisclaimer}</p>
                  <Link
                    href={`/${locale}/contribute?w=${encodeURIComponent(res.word)}&hy=${encodeURIComponent(
                      ai.meaning_hy
                    )}&en=${encodeURIComponent(ai.meaning_en)}`}
                    className="mt-3 inline-block text-sm font-semibold text-heruni-sun hover:underline"
                  >
                    {labels.suggest} →
                  </Link>
                </>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
