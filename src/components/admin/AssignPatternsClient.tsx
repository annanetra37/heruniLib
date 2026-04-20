'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Row = {
  id: number;
  wordHy: string;
  slug: string;
  status: string;
  category: string;
  suffix: string | null;
  source: string;
  suggestedPatternId: number | null;
  suggestedPatternCode: string | null;
};

type PatternLite = { id: number; code: string; nameHy: string; nameEn: string };

export default function AssignPatternsClient({
  rows,
  patterns
}: {
  rows: Row[];
  patterns: PatternLite[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());

  const assign = async (wordId: number, patternId: number | null) => {
    setBusyId(wordId);
    setError(null);
    try {
      const r = await fetch(`/api/admin/words/${wordId}/pattern`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patternId })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? r.statusText);
      }
      setDone((s) => new Set(s).add(wordId));
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-xl border bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Every word has a pattern assigned.
      </p>
    );
  }

  return (
    <div className="mt-6">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <table className="w-full divide-y rounded-xl border bg-white text-sm">
        <thead className="bg-heruni-amber/10 text-xs uppercase tracking-wider text-heruni-ink/60">
          <tr>
            <th className="p-2 text-left">Word</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Cat · suffix</th>
            <th className="p-2 text-left">Suggested</th>
            <th className="p-2 text-left">Assign</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <RowEditor
              key={r.id}
              row={r}
              patterns={patterns}
              busy={busyId === r.id}
              done={done.has(r.id)}
              onAssign={(pid) => assign(r.id, pid)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowEditor({
  row,
  patterns,
  busy,
  done,
  onAssign
}: {
  row: Row;
  patterns: PatternLite[];
  busy: boolean;
  done: boolean;
  onAssign: (patternId: number | null) => void;
}) {
  const [choice, setChoice] = useState<number | ''>(row.suggestedPatternId ?? '');

  return (
    <tr className={done ? 'bg-emerald-50/40' : ''}>
      <td className="p-2" lang="hy">
        <a href={`/admin/words/${row.id}`} className="font-semibold hover:text-heruni-sun">
          {row.wordHy}
        </a>
        <span className="ml-2 text-xs text-heruni-ink/40">{row.source}</span>
      </td>
      <td className="p-2 text-xs">{row.status}</td>
      <td className="p-2 text-xs">
        {row.category}
        {row.suffix ? (
          <span className="ml-1 font-mono text-heruni-bronze" lang="hy">
            -{row.suffix}
          </span>
        ) : null}
      </td>
      <td className="p-2 text-xs">
        {row.suggestedPatternCode ? (
          <code className="rounded bg-heruni-amber/20 px-2 py-0.5 text-heruni-bronze">
            {row.suggestedPatternCode}
          </code>
        ) : (
          <span className="text-heruni-ink/40">—</span>
        )}
      </td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value === '' ? '' : Number(e.target.value))}
            className="rounded-lg border border-heruni-ink/20 bg-white px-2 py-1 text-xs"
          >
            <option value="">— choose —</option>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || choice === ''}
            onClick={() => onAssign(choice === '' ? null : choice)}
            className="rounded-full bg-heruni-ink px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
          >
            {busy ? '…' : done ? '✓' : 'Assign'}
          </button>
        </div>
      </td>
    </tr>
  );
}
