import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';
import { logInfo, reportError } from './observability';
import { getRequestContext } from './requestContext';

// Visitor identity + behaviour tracking.
//
// - Cookie `heruni_visitor_id` tracks a visitor across sessions.
// - logPageView() writes a PageView row enriched with IP + geo + device.
// - logSearchEvent() writes a SearchEvent row per word lookup (even
//   cache hits / curated matches / errors) so the demand signal is
//   complete, independent of whether Claude was actually billed.
// Every helper also prints a structured JSON line to stdout so operators
// can tail real-time traffic with `railway logs --follow | jq`.

export const VISITOR_COOKIE = 'heruni_visitor_id';

/** Server-side: read the visitor cookie (or null when first-time). */
export async function getCurrentVisitor() {
  const c = cookies().get(VISITOR_COOKIE)?.value;
  if (!c) return null;
  try {
    return await prisma.visitor.findUnique({ where: { id: c } });
  } catch {
    return null;
  }
}

/** Log a public page view + bump the visitor's lastSeenAt if known. */
export async function logPageView(path: string, locale: string | null) {
  const ctx = getRequestContext(headers());
  const visitorId = cookies().get(VISITOR_COOKIE)?.value ?? null;

  logInfo('pageview', {
    path,
    locale,
    ip: ctx.ip,
    country: ctx.country,
    city: ctx.city,
    visitorId,
    device: ctx.device,
    browser: ctx.browser,
    os: ctx.os,
    referer: ctx.referer,
    ua: ctx.userAgent?.slice(0, 120) ?? null
  });

  try {
    await prisma.pageView.create({
      data: {
        path,
        locale,
        visitorId,
        ip: ctx.ip,
        country: ctx.country,
        city: ctx.city,
        region: ctx.region,
        userAgent: ctx.userAgent,
        device: ctx.device,
        browser: ctx.browser,
        os: ctx.os,
        referer: ctx.referer
      }
    });
    if (visitorId) {
      await prisma.visitor
        .update({
          where: { id: visitorId },
          data: {
            lastSeenAt: new Date(),
            // Backfill geo on the Visitor row if it was null (first visit
            // came from a proxy without CF/Vercel headers, later one has them).
            ...(ctx.country ? { country: ctx.country } : {}),
            ...(ctx.city ? { city: ctx.city } : {}),
            ...(ctx.region ? { region: ctx.region } : {}),
            ...(ctx.timezone ? { timezone: ctx.timezone } : {})
          }
        })
        .catch(() => null);
    }
  } catch (err) {
    reportError(err, { where: 'logPageView', path });
  }
}

/** Log a word lookup — writes a SearchEvent row AND a stdout line.
 *  Fire-and-forget from callers; errors never surface to users. */
export async function logSearchEvent(params: {
  wordHy: string;
  source: 'decompose-ai' | 'decompose-plain' | 'search-page' | 'words-browser';
  outcome: 'cache_hit' | 'cache_miss' | 'curated' | 'automatic' | 'no_match' | 'error';
  locale?: string | null;
}) {
  try {
    const ctx = getRequestContext(headers());
    const visitorId = cookies().get(VISITOR_COOKIE)?.value ?? null;

    logInfo('search', {
      word: params.wordHy,
      source: params.source,
      outcome: params.outcome,
      locale: params.locale ?? ctx.locale,
      visitorId,
      ip: ctx.ip,
      country: ctx.country,
      city: ctx.city,
      device: ctx.device,
      browser: ctx.browser,
      os: ctx.os
    });

    await prisma.searchEvent.create({
      data: {
        wordHy: params.wordHy,
        source: params.source,
        outcome: params.outcome,
        visitorId,
        ip: ctx.ip,
        country: ctx.country,
        city: ctx.city,
        region: ctx.region,
        locale: params.locale ?? ctx.locale,
        userAgent: ctx.userAgent,
        device: ctx.device,
        browser: ctx.browser,
        os: ctx.os,
        referer: ctx.referer
      }
    });
  } catch (err) {
    reportError(err, { where: 'logSearchEvent', word: params.wordHy });
  }
}
