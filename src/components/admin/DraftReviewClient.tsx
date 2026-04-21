'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Initial = {
  reviewStatus: string;
  draftMeaningHy: string;
  draftMeaningEn: string;
  finalMeaningHy: string;
  finalMeaningEn: string;
};

export default function DraftReviewClient({
  draftId,
  wordSlug,
  initial
}: {
  draftId: number;
  wordSlug: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [finalHy, setFinalHy] = useState(initial.finalMeaningHy);
  const [finalEn, setFinalEn] = useState(initial.finalMeaningEn);
  const [busy, setBusy] = useState<null | 'approve' | 'edit' | 'reject'>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const terminal =
    initial.reviewStatus === 'approved' ||
    initial.reviewStatus === 'edited' ||
    initial.reviewStatus === 'rejected';

  const call = async (action: 'approve' | 'edit' | 'reject') => {
    setBusy(action);
    setError(null);
    setDone(null);
    try {
      const body: Record<string, unknown> = { action };
      if (action === 'edit') {
        body.finalMeaningHy = finalHy.trim();
        body.finalMeaningEn = finalEn.trim();
        if (!body.finalMeaningHy || !body.finalMeaningEn) {
          throw new Error('Both Armenian and English final meanings are required.');
        }
      }
      const r = await fetch(`/api/admin/ai-drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? r.statusText);
      }
      setDone(
        action === 'approve'
          ? 'Approved. The word page now shows this meaning.'
          : action === 'edit'
          ? 'Saved your edit and published it to the word page.'
          : 'Rejected. The word page is unchanged.'
      );
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (terminal) {
    return (
      <section className="mt-8 rounded-xl border bg-emerald-50 p-4 text-sm text-emerald-900">
        <p>
          This draft is <code>{initial.reviewStatus}</code>. No further action needed.
        </p>
        <a
          href={`/admin/words?slug=${encodeURIComponent(wordSlug)}`}
          className="mt-2 inline-block text-xs font-semibold text-heruni-sun hover:underline"
        >
          Open the word in the CMS →
        </a>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border bg-white p-4">
      <h2 className="text-sm font-semibold">Review actions</h2>
      <p className="mt-1 text-xs text-heruni-ink/60">
        <strong>Approve</strong> copies the algorithm-generated draft directly onto the word.{' '}
        <strong>Edit</strong>{' '}
        lets you tweak the prose before publishing. <strong>Reject</strong> marks the draft
        unusable — the word page is left untouched.
      </p>

      {editing && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase text-heruni-ink/60">
              Final meaning (hy)
            </span>
            <textarea
              value={finalHy}
              onChange={(e) => setFinalHy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-heruni-ink/20 px-3 py-2 text-sm"
              rows={3}
              lang="hy"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase text-heruni-ink/60">
              Final meaning (en)
            </span>
            <textarea
              value={finalEn}
              onChange={(e) => setFinalEn(e.target.value)}
              className="mt-1 w-full rounded-lg border border-heruni-ink/20 px-3 py-2 text-sm"
              rows={3}
            />
          </label>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {done && <p className="mt-3 text-xs text-emerald-700">{done}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => call('approve')}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy === 'approve' ? '…' : 'Approve (use as-is)'}
        </button>
        {!editing ? (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => setEditing(true)}
            className="rounded-full border border-heruni-ink/20 px-4 py-2 text-sm font-semibold hover:bg-heruni-amber/10"
          >
            Edit then approve
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => call('edit')}
              className="rounded-full bg-heruni-ink px-4 py-2 text-sm font-semibold text-white hover:bg-heruni-sun disabled:opacity-50"
            >
              {busy === 'edit' ? '…' : 'Save edit & approve'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => {
                setEditing(false);
                setFinalHy(initial.finalMeaningHy);
                setFinalEn(initial.finalMeaningEn);
              }}
              className="text-xs text-heruni-ink/60 hover:text-heruni-ink"
            >
              Cancel edit
            </button>
          </>
        )}
        <button
          type="button"
          disabled={!!busy}
          onClick={() => call('reject')}
          className="ml-auto rounded-full border border-red-200 px-4 py-2 text-xs text-red-700 hover:bg-red-50"
        >
          {busy === 'reject' ? '…' : 'Reject'}
        </button>
      </div>
    </section>
  );
}
