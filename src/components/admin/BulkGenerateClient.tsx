'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = {
  id: number;
  wordHy: string;
  slug: string;
  status: string;
  confidence: number;
  hasApprovedDraft: boolean;
  decomposition: string;
};

type ProgressEvent =
  | { type: 'started'; total: number }
  | {
      type: 'result';
      wordId: number;
      index: number;
      ok: true;
      aiDraftId: number;
      patternCode: string;
      confidence: number;
    }
  | { type: 'result'; wordId: number; index: number; ok: false; error: string }
  | { type: 'done'; generated: number; failed: number };

export default function BulkGenerateClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [doneSummary, setDoneSummary] = useState<{ generated: number; failed: number } | null>(
    null
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.wordHy.toLowerCase().includes(q) || r.slug.includes(q));
  }, [rows, query]);

  const LIMIT = 100;
  const toggle = (id: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < LIMIT) next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((s) => {
      const next = new Set(s);
      for (const r of filtered) {
        if (next.size >= LIMIT) break;
        next.add(r.id);
      }
      return next;
    });
  };

  const clear = () => setSelected(new Set());

  const run = async () => {
    if (running || selected.size === 0) return;
    setRunning(true);
    setEvents([]);
    setError(null);
    setDoneSummary(null);
    try {
      const resp = await fetch('/api/admin/ai/bulk-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wordIds: Array.from(selected) })
      });
      if (!resp.ok || !resp.body) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? resp.statusText);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // NDJSON: one JSON object per line.
        let nl = buffer.indexOf('\n');
        while (nl !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) {
            try {
              const ev = JSON.parse(line) as ProgressEvent;
              setEvents((prev) => [...prev, ev]);
              if (ev.type === 'done') setDoneSummary({ generated: ev.generated, failed: ev.failed });
            } catch {
              /* ignore malformed partial */
            }
          }
          nl = buffer.indexOf('\n');
        }
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const total = events.find((e) => e.type === 'started')?.type === 'started'
    ? (events.find((e) => e.type === 'started') as { total: number }).total
    : selected.size;
  const completed = events.filter((e) => e.type === 'result').length;
  const ok = events.filter((e) => e.type === 'result' && e.ok === true).length;
  const failed = events.filter((e) => e.type === 'result' && e.ok === false).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3">
        <input
          type="text"
          placeholder="Filter words…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[200px] rounded-full border border-heruni-ink/20 bg-white px-4 py-1.5 text-sm"
          lang="hy"
        />
        <button
          type="button"
          onClick={selectAllVisible}
          disabled={running}
          className="rounded-full border px-3 py-1 text-xs font-semibold hover:bg-heruni-amber/10"
        >
          Select visible (up to {LIMIT})
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={running || selected.size === 0}
          className="rounded-full border px-3 py-1 text-xs hover:bg-heruni-amber/10 disabled:opacity-40"
        >
          Clear
        </button>
        <span className="text-xs text-heruni-ink/60">
          {selected.size} selected · {filtered.length} shown · {rows.length} eligible
        </span>
        <button
          type="button"
          onClick={run}
          disabled={running || selected.size === 0}
          className="ml-auto rounded-full bg-heruni-ink px-4 py-2 text-sm font-semibold text-white hover:bg-heruni-sun disabled:opacity-40"
        >
          {running ? `Generating… ${completed}/${total}` : `Generate ${selected.size} draft${selected.size === 1 ? '' : 's'}`}
        </button>
      </div>

      {(running || events.length > 0) && (
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-heruni-ink/60">
            <span>
              Progress: {completed}/{total} · {ok} ok · {failed} failed
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-heruni-amber/20">
            <div
              className="h-full rounded-full bg-heruni-sun transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <ul className="mt-3 max-h-64 space-y-1 overflow-auto text-xs">
            {events
              .filter((e): e is Extract<ProgressEvent, { type: 'result' }> => e.type === 'result')
              .slice(-50)
              .reverse()
              .map((e, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  {e.ok ? (
                    <>
                      <span className="rounded-full bg-emerald-100 px-2 text-[10px] font-semibold text-emerald-800">
                        ok
                      </span>
                      <span className="font-mono text-heruni-ink/50">#{e.wordId}</span>
                      <a
                        href={`/admin/ai-drafts/${e.aiDraftId}`}
                        className="text-heruni-sun hover:underline"
                      >
                        draft #{e.aiDraftId}
                      </a>
                      <span className="font-mono text-heruni-ink/50">
                        {e.patternCode} · conf {e.confidence}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="rounded-full bg-red-100 px-2 text-[10px] font-semibold text-red-800">
                        fail
                      </span>
                      <span className="font-mono text-heruni-ink/50">#{e.wordId}</span>
                      <span className="text-red-700">{e.error}</span>
                    </>
                  )}
                </li>
              ))}
          </ul>
          {doneSummary && (
            <p className="mt-3 text-xs text-emerald-800">
              Done. {doneSummary.generated} drafts generated, {doneSummary.failed} failed.{' '}
              <a href="/admin/ai-drafts" className="font-semibold hover:underline">
                Open the review queue →
              </a>
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-xl border bg-white">
        <table className="w-full divide-y text-sm">
          <thead className="bg-heruni-amber/10 text-xs uppercase tracking-wider text-heruni-ink/60">
            <tr>
              <th className="w-8 p-2"></th>
              <th className="p-2 text-left">Word</th>
              <th className="p-2 text-left">Decomposition</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Draft?</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.slice(0, 300).map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? 'bg-heruni-amber/10' : ''}>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    disabled={running || (!selected.has(r.id) && selected.size >= LIMIT)}
                  />
                </td>
                <td className="p-2 font-semibold" lang="hy">
                  {r.wordHy}
                </td>
                <td className="p-2 font-mono text-xs" lang="hy">
                  {r.decomposition}
                </td>
                <td className="p-2 text-xs">{r.status}</td>
                <td className="p-2 text-xs">
                  {r.hasApprovedDraft ? (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800">
                      approved
                    </span>
                  ) : (
                    <span className="text-heruni-ink/40">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 300 && (
          <p className="border-t p-2 text-center text-xs text-heruni-ink/50">
            Showing first 300 of {filtered.length}. Use the filter box to narrow down.
          </p>
        )}
      </div>
    </div>
  );
}
