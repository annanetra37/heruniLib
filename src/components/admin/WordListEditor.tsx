'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type WordLite = { id: number; wordHy: string; slug: string };

type Initial = {
  id: number;
  name: string;
  description: string;
  wordIds: number[];
};

export default function WordListEditor({
  allWords,
  initial
}: {
  allWords: WordLite[];
  initial?: Initial;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [wordIds, setWordIds] = useState<number[]>(initial?.wordIds ?? []);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(allWords.map((w) => [w.id, w])), [allWords]);
  const members = wordIds.map((id) => byId.get(id)).filter((w): w is WordLite => !!w);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allWords
      .filter((w) => !wordIds.includes(w.id) && (w.wordHy.toLowerCase().includes(q) || w.slug.includes(q)))
      .slice(0, 8);
  }, [allWords, wordIds, query]);

  const add = (id: number) => {
    if (!wordIds.includes(id)) setWordIds([...wordIds, id]);
    setQuery('');
  };
  const remove = (id: number) => setWordIds(wordIds.filter((x) => x !== id));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(initial ? `/api/admin/lists/${initial.id}` : '/api/admin/lists', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          wordIds
        })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? r.statusText);
      }
      const { id } = (await r.json()) as { id: number };
      router.push(`/admin/lists/${id}?saved=1`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!initial) return;
    if (!confirm('Delete this list? Words themselves are unaffected.')) return;
    const r = await fetch(`/api/admin/lists/${initial.id}`, { method: 'DELETE' });
    if (r.ok) router.push('/admin/lists');
  };

  const field = 'mt-1 w-full rounded-lg border border-heruni-ink/20 bg-white px-3 py-2 text-sm';

  return (
    <form onSubmit={save} className="mt-6 space-y-4 text-sm">
      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">
          Description (optional)
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={field}
          rows={2}
        />
      </label>

      <div className="rounded-xl border bg-heruni-amber/10 p-3">
        <p className="text-xs font-semibold uppercase text-heruni-ink/60">
          Members ({members.length})
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {members.map((w) => (
            <button
              type="button"
              key={w.id}
              onClick={() => remove(w.id)}
              className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-red-50 hover:border-red-200"
              lang="hy"
              title="Click to remove"
            >
              {w.wordHy} ×
            </button>
          ))}
          {members.length === 0 && (
            <span className="text-xs text-heruni-ink/60">No words added yet.</span>
          )}
        </div>
        <div className="relative mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={field}
            placeholder="Search words to add…"
            lang="hy"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
              {suggestions.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => add(w.id)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-heruni-amber/20"
                    lang="hy"
                  >
                    {w.wordHy}{' '}
                    <span className="text-xs text-heruni-ink/50">/{w.slug}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
