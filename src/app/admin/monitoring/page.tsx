import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// v2 §6.7 — post-launch monitoring dashboard, expanded.
// Visitors + pageviews + AI cost + zero-result searches in one place.

type AuditWithDiff = Awaited<ReturnType<typeof prisma.auditLog.findMany>>[number];

function parseDiff(entry: AuditWithDiff): Record<string, unknown> | null {
  if (!entry.diff) return null;
  try {
    return JSON.parse(entry.diff);
  } catch {
    return null;
  }
}

export default async function MonitoringPage() {
  const now = new Date();
  const _24hAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const _72hAgo = new Date(now.getTime() - 72 * 3600 * 1000);
  const _7dAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [
    pageViews24h,
    pageViews72h,
    uniqueVisitors7d,
    totalVisitors,
    recentVisitors,
    costs72h,
    topCostWords,
    topCostVisitors,
    genEvents72h,
    zeroResults,
    topSearches,
    errorAudits
  ] = await Promise.all([
    prisma.pageView.count({ where: { createdAt: { gte: _24hAgo } } }),
    prisma.pageView.count({ where: { createdAt: { gte: _72hAgo } } }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: _7dAgo }, visitorId: { not: null } },
      select: { visitorId: true },
      distinct: ['visitorId']
    }),
    prisma.visitor.count(),
    prisma.visitor.findMany({
      orderBy: { lastSeenAt: 'desc' },
      take: 15
    }),
    prisma.aiGenerationCost.findMany({
      where: { createdAt: { gte: _72hAgo } },
      take: 5000
    }),
    prisma.aiGenerationCost.groupBy({
      by: ['wordHy'],
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { wordHy: true },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: 15
    }),
    prisma.aiGenerationCost.groupBy({
      by: ['visitorId'],
      _sum: { costUsd: true },
      _count: { visitorId: true },
      where: { visitorId: { not: null } },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: 10
    }),
    prisma.auditLog.findMany({
      where: {
        action: { in: ['ai_draft.generate', 'ai_draft.generate_classical'] },
        createdAt: { gte: _72hAgo }
      },
      take: 5000
    }),
    prisma.searchLog.findMany({
      where: { resultCount: 0, createdAt: { gte: _7dAgo } },
      orderBy: { createdAt: 'desc' },
      take: 30
    }),
    prisma.searchLog.groupBy({
      by: ['query'],
      _count: { query: true },
      where: { createdAt: { gte: _7dAgo } },
      orderBy: { _count: { query: 'desc' } },
      take: 12
    }),
    prisma.auditLog.findMany({
      where: { action: { contains: 'error' }, createdAt: { gte: _72hAgo } },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ]);

  // Totals from the cost rows.
  const totalCost72h = costs72h.reduce((acc, r) => acc + r.costUsd, 0);
  const inputTokens = costs72h.reduce((a, r) => a + r.inputTokens, 0);
  const outputTokens = costs72h.reduce((a, r) => a + r.outputTokens, 0);
  const cacheReadTokens = costs72h.reduce((a, r) => a + r.cacheReadTokens, 0);
  const cacheWriteTokens = costs72h.reduce((a, r) => a + r.cacheWriteTokens, 0);
  const cacheHitRate =
    cacheReadTokens + cacheWriteTokens > 0
      ? cacheReadTokens / (cacheReadTokens + cacheWriteTokens)
      : 0;

  // Fetch visitor names for top-cost visitors.
  const visitorIds = topCostVisitors
    .map((t) => t.visitorId)
    .filter((v): v is string => !!v);
  const visitorsById = visitorIds.length
    ? new Map(
        (
          await prisma.visitor.findMany({
            where: { id: { in: visitorIds } },
            select: { id: true, firstName: true, lastName: true }
          })
        ).map((v) => [v.id, v])
      )
    : new Map<string, { id: string; firstName: string; lastName: string | null }>();

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-bold">Monitoring</h1>
      <p className="mt-2 max-w-2xl text-sm text-heruni-ink/60">
        Post-launch dashboard. Visitor activity, pipeline cost, zero-result searches, recent
        errors. Every row here also prints to the terminal as a structured JSON line, so you can
        tail Railway / docker logs and see traffic in real time.
      </p>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat label="Page views (24h)" value={String(pageViews24h)} />
        <Stat label="Page views (72h)" value={String(pageViews72h)} />
        <Stat label="Unique visitors (7d)" value={String(uniqueVisitors7d.length)} />
        <Stat label="Named visitors (all-time)" value={String(totalVisitors)} />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat label="Algorithm cost (72h)" value={`$${totalCost72h.toFixed(3)}`} />
        <Stat label="Generations (72h)" value={String(costs72h.length)} />
        <Stat label="Audit events (72h)" value={String(genEvents72h.length)} />
        <Stat label="Cache hit rate (72h)" value={`${(cacheHitRate * 100).toFixed(0)}%`} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Recent visitors (most-recent 15)</h2>
        {recentVisitors.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed p-4 text-center text-xs text-heruni-ink/50">
            No named visitors yet.
          </p>
        ) : (
          <table className="mt-2 w-full divide-y rounded-xl border bg-white text-sm">
            <thead className="bg-heruni-amber/10 text-xs uppercase tracking-wider text-heruni-ink/60">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Locale</th>
                <th className="p-2 text-left">IP</th>
                <th className="p-2 text-left">First seen</th>
                <th className="p-2 text-left">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentVisitors.map((v) => (
                <tr key={v.id}>
                  <td className="p-2 font-semibold" lang={v.locale ?? undefined}>
                    {v.firstName} {v.lastName ?? ''}
                  </td>
                  <td className="p-2 text-xs">{v.locale ?? '—'}</td>
                  <td className="p-2 font-mono text-xs text-heruni-ink/60">
                    {v.ip ?? '—'}
                  </td>
                  <td className="p-2 text-xs text-heruni-ink/50">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-2 text-xs text-heruni-ink/50">
                    {new Date(v.lastSeenAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Algorithm token breakdown (72h)</h2>
        <table className="mt-2 w-full divide-y rounded-xl border bg-white text-sm">
          <tbody className="divide-y">
            <TokenRow label="Fresh input tokens" value={inputTokens} />
            <TokenRow label="Output tokens" value={outputTokens} />
            <TokenRow label="Cache-read tokens (discounted)" value={cacheReadTokens} />
            <TokenRow label="Cache-creation tokens (premium)" value={cacheWriteTokens} />
          </tbody>
        </table>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold">Top words by cost (72h)</h2>
          {topCostWords.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed p-4 text-center text-xs text-heruni-ink/50">
              No generations logged yet.
            </p>
          ) : (
            <table className="mt-2 w-full divide-y rounded-xl border bg-white text-sm">
              <thead className="bg-heruni-amber/10 text-[10px] uppercase tracking-wider text-heruni-ink/60">
                <tr>
                  <th className="p-2 text-left">Word</th>
                  <th className="p-2 text-left">Runs</th>
                  <th className="p-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topCostWords.map((w) => (
                  <tr key={w.wordHy}>
                    <td className="p-2" lang="hy">
                      {w.wordHy}
                    </td>
                    <td className="p-2 text-xs">{w._count.wordHy}</td>
                    <td className="p-2 text-right font-mono text-xs">
                      ${(w._sum.costUsd ?? 0).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold">Top visitors by cost (72h+)</h2>
          {topCostVisitors.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed p-4 text-center text-xs text-heruni-ink/50">
              No visitor-triggered generations yet.
            </p>
          ) : (
            <table className="mt-2 w-full divide-y rounded-xl border bg-white text-sm">
              <thead className="bg-heruni-amber/10 text-[10px] uppercase tracking-wider text-heruni-ink/60">
                <tr>
                  <th className="p-2 text-left">Visitor</th>
                  <th className="p-2 text-left">Runs</th>
                  <th className="p-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topCostVisitors.map((row) => {
                  const v = row.visitorId ? visitorsById.get(row.visitorId) : null;
                  return (
                    <tr key={row.visitorId ?? 'anon'}>
                      <td className="p-2 text-xs">
                        {v ? (
                          <>
                            <span className="font-semibold">
                              {v.firstName} {v.lastName ?? ''}
                            </span>
                            <span className="ml-2 font-mono text-[10px] text-heruni-ink/40">
                              {v.id.slice(0, 8)}
                            </span>
                          </>
                        ) : (
                          <span className="text-heruni-ink/50">anon</span>
                        )}
                      </td>
                      <td className="p-2 text-xs">{row._count.visitorId}</td>
                      <td className="p-2 text-right font-mono text-xs">
                        ${(row._sum.costUsd ?? 0).toFixed(4)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold">
            Zero-result searches (last 7 days — content gaps)
          </h2>
          {zeroResults.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed p-4 text-center text-xs text-heruni-ink/50">
              No zero-result searches yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y rounded-xl border bg-white text-sm">
              {zeroResults.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-3 py-2">
                  <span lang={s.locale}>{s.query}</span>
                  <span className="text-[10px] text-heruni-ink/40">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold">Top searches (last 7 days)</h2>
          {topSearches.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed p-4 text-center text-xs text-heruni-ink/50">
              No searches logged yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y rounded-xl border bg-white text-sm">
              {topSearches.map((s) => (
                <li key={s.query} className="flex items-center justify-between px-3 py-2">
                  <Link
                    href={`/hy/search?q=${encodeURIComponent(s.query)}`}
                    className="hover:text-heruni-sun"
                  >
                    {s.query}
                  </Link>
                  <span className="text-xs text-heruni-ink/60">× {s._count.query}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {errorAudits.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Recent error-tagged audit events (72h)</h2>
          <ul className="mt-2 divide-y rounded-xl border bg-white text-sm">
            {errorAudits.map((e) => (
              <li key={e.id} className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{e.action}</span>
                  <span className="text-[10px] text-heruni-ink/40">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </div>
                {e.diff && (
                  <pre className="mt-1 overflow-hidden whitespace-pre-wrap text-[10px] text-heruni-ink/60">
                    {e.diff.slice(0, 200)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 rounded-xl border border-heruni-ink/10 bg-white px-4 py-3 text-xs text-heruni-ink/60">
        <strong>Terminal tip:</strong> every pageview, visitor signup, and generation prints a
        structured JSON line to stdout with fields like <code>{'{level,message,path,visitorId,costUsd}'}</code>.
        Tail <code>railway logs --follow</code> (or <code>docker logs -f</code>) to watch
        activity in real time, or pipe through <code>jq</code> for pretty-printing.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-heruni-ink/50">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

function TokenRow({ label, value }: { label: string; value: number }) {
  return (
    <tr>
      <td className="p-2 text-xs text-heruni-ink/70">{label}</td>
      <td className="p-2 text-right font-mono text-sm">{value.toLocaleString()}</td>
    </tr>
  );
}
