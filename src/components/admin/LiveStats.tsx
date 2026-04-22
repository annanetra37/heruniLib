'use client';

import { useEffect, useRef, useState } from 'react';

// LiveStats — polls /api/admin/live-stats every 5 seconds and renders:
//   • a hero strip of rolling counts (active visitors, views/5m,
//     generations/5m, $/5m)
//   • a reverse-chronological event feed merging pageviews + algorithm
//     generations
// Pulsing dot in the header signals "connected + refreshing".

type FeedItem =
  | {
      type: 'view';
      id: string;
      at: string;
      path: string;
      locale: string | null;
      visitor: string | null;
      ip: string | null;
    }
  | {
      type: 'gen';
      id: string;
      at: string;
      word: string;
      kind: string;
      costUsd: number;
      visitor: string | null;
      editorId: number | null;
    };

type Snapshot = {
  activeNow: number;
  activeAnonymous: number;
  pageViews5m: number;
  generations5m: number;
  costUsd5m: number;
  lastMinuteViews: number;
  feed: FeedItem[];
};

const POLL_MS = 5000;

function relTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function LiveStats() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const tickRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await fetch('/api/admin/live-stats', { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as Snapshot;
        if (!cancelled) {
          setSnap(data);
          setErr(null);
          setLastRefresh(Date.now());
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, POLL_MS);
    // Tick a small counter so the "X seconds ago" labels update
    // between polls without refetching.
    const tickId = setInterval(() => {
      tickRef.current += 1;
      setLastRefresh((v) => v); // forces re-render of relTime output
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearInterval(tickId);
    };
  }, []);

  if (!snap && !err) {
    return (
      <div className="rounded-2xl border border-heruni-ink/10 bg-white p-4 text-xs text-heruni-ink/50">
        Loading live stats…
      </div>
    );
  }
  if (!snap) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        Live stats unavailable: {err}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-heruni-amber/40 bg-gradient-to-br from-heruni-amber/10 via-white to-white p-5 shadow-[0_10px_40px_-20px_rgba(198,135,42,0.35)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="heruni-pulse-dot h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <h2 className="text-sm font-semibold text-heruni-ink">Live · updates every 5s</h2>
        </div>
        <span className="text-[10px] text-heruni-ink/50">
          refreshed {relTime(new Date(lastRefresh).toISOString())}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <LiveStat
          label="Active visitors"
          value={snap.activeNow}
          sub={`${snap.activeAnonymous} anonymous`}
          accent="emerald"
        />
        <LiveStat
          label="Page views · last 5 min"
          value={snap.pageViews5m}
          sub={`${snap.lastMinuteViews} in last 60s`}
          accent="sun"
        />
        <LiveStat
          label="Generations · last 5 min"
          value={snap.generations5m}
          sub="heruni + classical"
          accent="bronze"
        />
        <LiveStat
          label="$ spend · last 5 min"
          value={`$${snap.costUsd5m.toFixed(3)}`}
          sub="estimated"
          accent="moss"
        />
      </div>

      <div className="mt-6">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-heruni-ink/60">
          Activity feed
        </h3>
        {snap.feed.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed p-4 text-center text-xs text-heruni-ink/50">
            Nothing yet — open the public site in another tab.
          </p>
        ) : (
          <ul className="mt-2 max-h-96 divide-y overflow-auto rounded-xl border bg-white text-xs">
            {snap.feed.map((ev) => (
              <li key={ev.id} className="flex items-center gap-3 px-3 py-1.5">
                {ev.type === 'view' ? (
                  <>
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
                      👁
                    </span>
                    <span className="flex-1 truncate font-mono text-[11px]" title={ev.path}>
                      {ev.path}
                    </span>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${
                        ev.visitor
                          ? 'bg-heruni-sun/20 text-heruni-bronze'
                          : 'bg-heruni-ink/5 text-heruni-ink/60'
                      }`}
                    >
                      {ev.visitor ?? 'anon'}
                    </span>
                    {ev.ip && (
                      <span className="hidden shrink-0 font-mono text-[10px] text-heruni-ink/40 md:inline">
                        {ev.ip}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-heruni-sun/25 text-[10px] font-bold text-heruni-bronze">
                      ✦
                    </span>
                    <span className="flex-1 truncate" lang="hy">
                      <strong>{ev.word}</strong>
                      <span className="ml-2 font-mono text-[10px] text-heruni-ink/50">
                        {ev.kind}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-heruni-bronze">
                      ${ev.costUsd.toFixed(4)}
                    </span>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${
                        ev.visitor
                          ? 'bg-heruni-sun/20 text-heruni-bronze'
                          : ev.editorId
                            ? 'bg-heruni-moss/20 text-heruni-moss'
                            : 'bg-heruni-ink/5 text-heruni-ink/60'
                      }`}
                    >
                      {ev.visitor ?? (ev.editorId ? `editor#${ev.editorId}` : 'anon')}
                    </span>
                  </>
                )}
                <span className="shrink-0 text-[10px] text-heruni-ink/40">
                  {relTime(ev.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LiveStat({
  label,
  value,
  sub,
  accent
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: 'sun' | 'moss' | 'bronze' | 'emerald';
}) {
  const accentClass =
    accent === 'sun'
      ? 'text-heruni-sun'
      : accent === 'moss'
        ? 'text-heruni-moss'
        : accent === 'bronze'
          ? 'text-heruni-bronze'
          : 'text-emerald-600';
  return (
    <div className="rounded-xl border border-heruni-ink/10 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-heruni-ink/50">
        {label}
      </p>
      <p className={`mt-1 text-3xl font-bold ${accentClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-heruni-ink/50">{sub}</p>}
    </div>
  );
}
