'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Initial = {
  id: number;
  bookPage: number;
  chapter: string;
  excerptHy: string;
  excerptEn: string;
  mentionedWords: string[];
  imageUrl: string;
};

export default function SourceEditor({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const [bookPage, setBookPage] = useState<number>(initial?.bookPage ?? 1);
  const [chapter, setChapter] = useState(initial?.chapter ?? '');
  const [excerptHy, setExcerptHy] = useState(initial?.excerptHy ?? '');
  const [excerptEn, setExcerptEn] = useState(initial?.excerptEn ?? '');
  const [mentionedRaw, setMentionedRaw] = useState((initial?.mentionedWords ?? []).join(', '));
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const mentionedWords = mentionedRaw
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await fetch(initial ? `/api/admin/sources/${initial.id}` : '/api/admin/sources', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bookPage,
          chapter: chapter || null,
          excerptHy,
          excerptEn: excerptEn || null,
          mentionedWords,
          imageUrl: imageUrl || null
        })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? r.statusText);
      }
      const { id } = (await r.json()) as { id: number };
      router.push(`/admin/sources/${id}?saved=1`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!initial) return;
    if (!confirm('Delete this source? Word links to it will be preserved as dead ids.')) return;
    const r = await fetch(`/api/admin/sources/${initial.id}`, { method: 'DELETE' });
    if (r.ok) router.push('/admin/sources');
  };

  const field = 'mt-1 w-full rounded-lg border border-heruni-ink/20 bg-white px-3 py-2 text-sm';

  return (
    <form onSubmit={save} className="mt-6 space-y-4 text-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Book page</span>
          <input
            required
            type="number"
            min={1}
            max={321}
            value={bookPage}
            onChange={(e) => setBookPage(Number(e.target.value))}
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Chapter</span>
          <input
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className={field}
            placeholder="2.7"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">Excerpt (hy)</span>
        <textarea
          required
          value={excerptHy}
          onChange={(e) => setExcerptHy(e.target.value)}
          className={field}
          rows={4}
          lang="hy"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">
          Excerpt (en, editor translation)
        </span>
        <textarea
          value={excerptEn}
          onChange={(e) => setExcerptEn(e.target.value)}
          className={field}
          rows={4}
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">
          Mentioned words (comma- or newline-separated Armenian)
        </span>
        <textarea
          value={mentionedRaw}
          onChange={(e) => setMentionedRaw(e.target.value)}
          className={`${field} font-mono text-xs`}
          rows={2}
          lang="hy"
          placeholder="իշխան, իշխանություն, արքա"
        />
        <span className="mt-1 block text-xs text-heruni-ink/50">
          Populates the sidebar suggestion on those words&apos; edit pages (§1.6).
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">
          Book page screenshot URL (optional)
        </span>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className={field}
          placeholder="https://…/p115.jpg"
        />
        <span className="mt-1 block text-xs text-heruni-ink/50">
          When set, the image renders on public word pages (inside the book-ref card) and on
          the root page for the same book page.
        </span>
      </label>

      {imageUrl && (
        <div className="rounded-xl border bg-heruni-parchment p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Preview"
            className="mx-auto max-h-64 w-auto"
            loading="lazy"
          />
        </div>
      )}

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
