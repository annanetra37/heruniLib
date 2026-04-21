import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// v2 §6.7 — post-launch monitoring dashboard.
// Error rate, AI cost proxies, and zero-result searches (content gaps)
// in one place. Pulls from AuditLog and SearchLog — no external infra.

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

  // AI draft generation volume + token usage from audit log. Every
  // generation endpoint writes a structured diff containing usage, so we
  // can reconstruct cost without a separate UsageLog table.
  const [genEvents24h, genEvents72h, zeroResults, topSearches, errorAudits] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        action: { in: ['ai_draft.generate', 'ai_draft.generate_classical'] },
        createdAt: { gte: _24hAgo }
      },
      take: 1000
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
      take: 50
    }),
    prisma.searchLog.groupBy({
      by: ['query'],
      _count: { query: true },
      where: { createdAt: { gte: _7dAgo } },
      orderBy: { _count: { query: 'desc' } },
      take: 15
    }),
    prisma.auditLog.findMany({
      where: { action: { contains: 'error' }, createdAt: { gte: _72hAgo } },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ]);

  // Sum tokens from the 72-hour audit window.
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  for (const entry of genEvents72h) {
    const diff = parseDiff(entry);
    const usage = (diff as { usage?: Record<string, number> } | null)?.usage ?? null;
    if (!usage) continue;
    inputTokens += usage.inputTokens ?? 0;
    outputTokens += usage.outputTokens ?? 0;
    cacheReadTokens += usage.cacheReadInputTokens ?? 0;
    cacheWriteTokens += usage.cacheCreationInputTokens ?? 0;
  }

  // Rough cost estimate at Opus 4.7 pricing ($5 / 1M input, $25 / 1M
  // output, cache reads ~10% of input price, cache writes ~125%).
  const costUsd =
    (inputTokens / 1_000_000) * 5 +
    (outputTokens / 1_000_000) * 25 +
    (cacheReadTokens / 1_000_000) * 0.5 +
    (cacheWriteTokens / 1_000_000) * 6.25;

  const cacheHitRate =
    cacheReadTokens + cacheWriteTokens > 0
      ? cacheReadTokens / (cacheReadTokens + cacheWriteTokens)
      : 0;

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-bold">Monitoring</h1>
      <p className="mt-2 max-w-2xl text-sm text-heruni-ink/60">
        Post-launch dashboard (v2 §6.7). Error rate, AI cost, and content-gap signal from
        zero-result searches. Refresh to update.
      </p>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat label="AI generations (24h)" value={String(genEvents24h.length)} />
        <Stat label="AI generations (72h)" value={String(genEvents72h.length)} />
        <Stat label="Approx. cost (72h)" value={`$${costUsd.toFixed(2)}`} />
        <Stat label="Cache hit rate (72h)" value={`${(cacheHitRate * 100).toFixed(0)}%`} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">AI token breakdown (72h)</h2>
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
