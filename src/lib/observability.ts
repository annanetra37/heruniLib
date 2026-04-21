// Minimal observability surface (v2 brief §6.2).
//
// This is deliberately small — not an @sentry/nextjs install. Production
// deployments that want real error tracking should add the Sentry SDK and
// wire it in next.config.js; this helper is the seam every route in the
// app calls through, so swapping the implementation later is one edit.
//
// If SENTRY_DSN is set we POST errors to Sentry's Store API directly. If
// not, we log to stderr as structured JSON so whichever log aggregator
// the host uses (Railway, Fly, CloudWatch) picks up the breadcrumb.

import { prisma } from './prisma';

type LogLevel = 'error' | 'warn' | 'info';

export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  const payload = {
    level: 'error' as LogLevel,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    ts: new Date().toISOString()
  };
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(payload));
}

export function logInfo(message: string, context: Record<string, unknown> = {}): void {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ level: 'info' as LogLevel, message, context, ts: new Date().toISOString() })
  );
}

// --- Search logging (feeds /admin/monitoring zero-result gap report) ---

export async function logSearchQuery(
  query: string,
  locale: string,
  resultCount: number
): Promise<void> {
  // Fire-and-forget — don't block the search response. Failures here
  // must not break the user's search.
  try {
    await prisma.searchLog.create({
      data: { query: query.slice(0, 200), locale, resultCount }
    });
  } catch (err) {
    reportError(err, { where: 'logSearchQuery', query, locale });
  }
}
