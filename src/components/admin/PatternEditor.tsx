'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Initial = {
  id: number;
  code: string;
  nameHy: string;
  nameEn: string;
  templateHy: string;
  templateEn: string;
  descriptionHy: string;
  descriptionEn: string;
  exampleWordIds: number[];
  appliesWhen: string; // raw JSON string
};

type WordLite = { id: number; wordHy: string; slug: string };

export default function PatternEditor({
  initial,
  words
}: {
  initial?: Initial;
  words: WordLite[];
}) {
  const router = useRouter();
  const [code, setCode] = useState(initial?.code ?? '');
  const [nameHy, setNameHy] = useState(initial?.nameHy ?? '');
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? '');
  const [templateHy, setTemplateHy] = useState(initial?.templateHy ?? '');
  const [templateEn, setTemplateEn] = useState(initial?.templateEn ?? '');
  const [descriptionHy, setDescriptionHy] = useState(initial?.descriptionHy ?? '');
  const [descriptionEn, setDescriptionEn] = useState(initial?.descriptionEn ?? '');
  const [exampleIds, setExampleIds] = useState<number[]>(initial?.exampleWordIds ?? []);
  const [exampleQuery, setExampleQuery] = useState('');
  const [appliesWhen, setAppliesWhen] = useState(initial?.appliesWhen ?? '{}');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordsById = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const exampleWords = exampleIds.map((id) => wordsById.get(id)).filter(Boolean) as WordLite[];

  const suggestions = useMemo(() => {
    const q = exampleQuery.trim().toLowerCase();
    if (!q) return [];
    return words
      .filter(
        (w) =>
          !exampleIds.includes(w.id) &&
          (w.wordHy.toLowerCase().includes(q) || w.slug.includes(q))
      )
      .slice(0, 6);
  }, [words, exampleIds, exampleQuery]);

  const addExample = (id: number) => {
    if (exampleIds.includes(id)) return;
    setExampleIds([...exampleIds, id]);
    setExampleQuery('');
  };
  const removeExample = (id: number) => setExampleIds(exampleIds.filter((x) => x !== id));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      try {
        JSON.parse(appliesWhen);
      } catch {
        throw new Error('applies_when must be valid JSON');
      }
      const r = await fetch(initial ? `/api/admin/patterns/${initial.id}` : '/api/admin/patterns', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code,
          nameHy,
          nameEn,
          templateHy,
          templateEn,
          descriptionHy: descriptionHy || null,
          descriptionEn: descriptionEn || null,
          exampleWordIds: exampleIds,
          appliesWhen
        })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? r.statusText);
      }
      const { id } = (await r.json()) as { id: number };
      router.push(`/admin/patterns/${id}?saved=1`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!initial) return;
    if (!confirm('Delete this pattern? Words already linked will be un-linked.')) return;
    const r = await fetch(`/api/admin/patterns/${initial.id}`, { method: 'DELETE' });
    if (r.ok) router.push('/admin/patterns');
  };

  const field = 'mt-1 w-full rounded-lg border border-heruni-ink/20 bg-white px-3 py-2 text-sm';

  return (
    <form onSubmit={save} className="mt-6 space-y-4 text-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Code</span>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
            className={`${field} font-mono`}
            placeholder="possessive_owner"
          />
        </label>
        <div />
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Name (hy)</span>
          <input
            required
            value={nameHy}
            onChange={(e) => setNameHy(e.target.value)}
            className={field}
            lang="hy"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Name (en)</span>
          <input
            required
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            className={field}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Template (hy)</span>
          <input
            required
            value={templateHy}
            onChange={(e) => setTemplateHy(e.target.value)}
            className={field}
            lang="hy"
            placeholder="{ADJ} {NOUN}-ի տեր"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Template (en)</span>
          <input
            required
            value={templateEn}
            onChange={(e) => setTemplateEn(e.target.value)}
            className={field}
            placeholder="owner of the {ADJ} {NOUN}"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">Description (hy)</span>
        <textarea
          value={descriptionHy}
          onChange={(e) => setDescriptionHy(e.target.value)}
          className={field}
          rows={2}
          lang="hy"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">Description (en)</span>
        <textarea
          value={descriptionEn}
          onChange={(e) => setDescriptionEn(e.target.value)}
          className={field}
          rows={2}
        />
      </label>

      <div className="rounded-xl border bg-heruni-amber/10 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">
            Example words ({exampleWords.length})
          </span>
          <span className="text-xs text-heruni-ink/50">
            Aim for 3–5 per pattern — these seed the algorithm prompts.
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {exampleWords.map((w) => (
            <button
              type="button"
              key={w.id}
              onClick={() => removeExample(w.id)}
              className="rounded-full bg-white border px-3 py-1 text-xs hover:bg-red-50 hover:border-red-200"
              lang="hy"
              title="Click to remove"
            >
              {w.wordHy} ×
            </button>
          ))}
          {exampleWords.length === 0 && (
            <span className="text-xs text-heruni-ink/60">No examples attached yet.</span>
          )}
        </div>
        <div className="relative mt-3">
          <input
            value={exampleQuery}
            onChange={(e) => setExampleQuery(e.target.value)}
            className={field}
            placeholder="Search words to attach…"
            lang="hy"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
              {suggestions.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => addExample(w.id)}
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

      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">
          Applies-when rules (JSON)
        </span>
        <textarea
          value={appliesWhen}
          onChange={(e) => setAppliesWhen(e.target.value)}
          className={`${field} font-mono text-xs`}
          rows={4}
          placeholder='{"suffixes":["ություն"],"categories":["abstract"]}'
        />
        <span className="mt-1 block text-xs text-heruni-ink/50">
          Used by the Sprint 3 pattern retriever (§4.2) to rank candidates.
        </span>
      </label>

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
