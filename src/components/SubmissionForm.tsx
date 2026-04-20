'use client';

import { useState } from 'react';
import type { Locale } from '@/i18n/config';

export default function SubmissionForm({
  locale,
  initialWord,
  labels
}: {
  locale: Locale;
  initialWord: string;
  labels: {
    word: string;
    decomp: string;
    meaning: string;
    email: string;
    submit: string;
    thanks: string;
  };
}) {
  const [wordHy, setWordHy] = useState(initialWord);
  const [decomp, setDecomp] = useState('');
  const [meaningHy, setMeaningHy] = useState('');
  const [meaningEn, setMeaningEn] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      const r = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          wordHy,
          proposedDecomposition: decomp || null,
          proposedMeaningHy: meaningHy || null,
          proposedMeaningEn: meaningEn || null,
          submitterEmail: email || null
        })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
      setState('done');
    } catch (err) {
      setState('error');
      setError((err as Error).message);
    }
  };

  if (state === 'done') {
    return (
      <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{labels.thanks}</div>
    );
  }

  const field = 'w-full rounded-lg border border-heruni-ink/20 bg-white px-3 py-2 focus:border-heruni-sun focus:outline-none';

  return (
    <form onSubmit={submit} className="space-y-4 text-sm">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
          {labels.word} *
        </span>
        <input
          required
          value={wordHy}
          onChange={(e) => setWordHy(e.target.value)}
          className={field}
          lang={locale}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
          {labels.decomp}
        </span>
        <input
          value={decomp}
          onChange={(e) => setDecomp(e.target.value)}
          className={field}
          placeholder="ի • շ • խ • ան"
          lang={locale}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
          {labels.meaning} (hy)
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
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
          {labels.meaning} (en)
        </span>
        <textarea
          value={meaningEn}
          onChange={(e) => setMeaningEn(e.target.value)}
          className={field}
          rows={2}
          lang="en"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
          {labels.email}
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={state === 'sending'}
        className="rounded-full bg-heruni-ink px-5 py-2 font-semibold text-white transition hover:bg-heruni-sun disabled:opacity-50"
      >
        {labels.submit}
      </button>
    </form>
  );
}
