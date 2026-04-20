'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Initial = {
  id: number;
  wordHy: string;
  transliteration: string;
  decomposition: string;
  rootSequence: number[];
  suffix: string;
  meaningHy: string;
  meaningEn: string;
  category: string;
  source: string;
  confidence: number;
  status: string;
  slug: string;
};

const CATEGORIES = [
  'people',
  'animals',
  'astronomy',
  'nature',
  'names',
  'geography',
  'abstract',
  'tools',
  'other'
];

const STATUSES = ['draft', 'review', 'published'];

export default function WordEditor({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const [wordHy, setWordHy] = useState(initial?.wordHy ?? '');
  const [transliteration, setTransliteration] = useState(initial?.transliteration ?? '');
  const [decomposition, setDecomposition] = useState(initial?.decomposition ?? '');
  const [rootSequence, setRootSequence] = useState<number[]>(initial?.rootSequence ?? []);
  const [suffix, setSuffix] = useState(initial?.suffix ?? '');
  const [meaningHy, setMeaningHy] = useState(initial?.meaningHy ?? '');
  const [meaningEn, setMeaningEn] = useState(initial?.meaningEn ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'other');
  const [source, setSource] = useState(initial?.source ?? 'editor');
  const [confidence, setConfidence] = useState(initial?.confidence ?? 2);
  const [status, setStatus] = useState(initial?.status ?? 'draft');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [saving, setSaving] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propose = async () => {
    if (!wordHy.trim()) return;
    setProposing(true);
    try {
      const r = await fetch(`/api/admin/propose-decomposition?w=${encodeURIComponent(wordHy)}`);
      const data = (await r.json()) as {
        decomposition: string;
        rootSequence: number[];
        suffix: string | null;
        transliteration: string;
        slug: string;
      };
      setDecomposition(data.decomposition);
      setRootSequence(data.rootSequence);
      setSuffix(data.suffix ?? '');
      if (!transliteration) setTransliteration(data.transliteration);
      if (!slug) setSlug(data.slug);
    } finally {
      setProposing(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(initial ? `/api/admin/words/${initial.id}` : '/api/admin/words', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          wordHy,
          transliteration,
          decomposition,
          rootSequence,
          suffix: suffix || null,
          meaningHy,
          meaningEn,
          category,
          source,
          confidence,
          status,
          slug
        })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? r.statusText);
      }
      const result = (await r.json()) as { id: number };
      router.push(`/admin/words/${result.id}?saved=1`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!initial) return;
    if (!confirm('Soft-delete this word?')) return;
    await fetch(`/api/admin/words/${initial.id}`, { method: 'DELETE' });
    router.push('/admin/words');
  };

  const field = 'mt-1 w-full rounded-lg border border-heruni-ink/20 bg-white px-3 py-2 text-sm';

  return (
    <form onSubmit={save} className="mt-6 space-y-4 text-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Word (hy)</span>
          <input
            required
            value={wordHy}
            onChange={(e) => setWordHy(e.target.value.toLowerCase())}
            className={field}
            lang="hy"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Transliteration</span>
          <input
            value={transliteration}
            onChange={(e) => setTransliteration(e.target.value)}
            className={field}
          />
        </label>
      </div>

      <div className="rounded-xl border bg-heruni-amber/10 p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={propose}
            disabled={!wordHy || proposing}
            className="rounded-full bg-heruni-ink px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {proposing ? '…' : 'Propose split'}
          </button>
          <span className="text-xs text-heruni-ink/60">
            Runs greedy 3→2→1 match on the roots table.
          </span>
        </div>
        <label className="mt-3 block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Decomposition</span>
          <input
            value={decomposition}
            onChange={(e) => setDecomposition(e.target.value)}
            className={field}
            lang="hy"
            placeholder="ի • շ • խ • ան"
          />
        </label>
        <label className="mt-2 block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">
            Root sequence (ids)
          </span>
          <input
            value={rootSequence.join(', ')}
            onChange={(e) =>
              setRootSequence(
                e.target.value
                  .split(',')
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isFinite(n) && n > 0)
              )
            }
            className={`${field} font-mono text-xs`}
          />
        </label>
        <label className="mt-2 block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Suffix</span>
          <input
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            className={field}
            placeholder="ություն"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">
          Meaning (Armenian)
        </span>
        <textarea
          value={meaningHy}
          onChange={(e) => setMeaningHy(e.target.value)}
          className={field}
          rows={2}
          lang="hy"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">
          Meaning (English)
        </span>
        <textarea
          value={meaningEn}
          onChange={(e) => setMeaningEn(e.target.value)}
          className={field}
          rows={2}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={field}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Confidence</span>
          <select
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className={field}
          >
            <option value={1}>1 — from book</option>
            <option value={2}>2 — editor certain</option>
            <option value={3}>3 — editor tentative</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={field}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Source</span>
          <input value={source} onChange={(e) => setSource(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Slug</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={field} />
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-heruni-ink px-5 py-2 font-semibold text-white hover:bg-heruni-sun disabled:opacity-50"
        >
          {saving ? '…' : 'Save'}
        </button>
        {initial && (
          <button
            type="button"
            onClick={del}
            className="rounded-full border border-red-200 px-4 py-2 text-xs text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
