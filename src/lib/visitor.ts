import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';
import { logInfo, reportError } from './observability';
import { getRequestContext } from './requestContext';

// Visitor identity + behaviour tracking.
//
// - Cookie `heruni_visitor_id` tracks a visitor across sessions.
// - First-time visitors who search get an anonymous Visitor row auto-
//   created by ensureVisitor() + cookie set.
// - Anonymous (email-less) visitors can search up to FREE_SEARCH_LIMIT
//   times. Endpoint enforcement lives in /api/decompose* routes.
// - logPageView() and logSearchEvent() write to the DB + stdout so
//   operators can tail traffic via `railway logs --follow | jq`.

export const VISITOR_COOKIE = 'heruni_visitor_id';
export const FREE_SEARCH_LIMIT = 5;

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

/** Ensure a Visitor row exists for this request. Creates an anonymous
 *  row (firstName=null, email=null) and sets the cookie when the caller
 *  is fresh. Safe to call from any Route Handler (but NOT from RSCs —
 *  cookies().set() only works in route handlers / server actions). */
export async function ensureVisitor(): Promise<{
  id: string;
  isAnonymous: boolean;
  searchCount: number;
}> {
  const cookieId = cookies().get(VISITOR_COOKIE)?.value;
  if (cookieId) {
    const v = await prisma.visitor.findUnique({
      where: { id: cookieId },
      select: { id: true, email: true, searchCount: true }
    });
    if (v) return { id: v.id, isAnonymous: !v.email, searchCount: v.searchCount };
    // stale cookie (visitor deleted) — fall through to create a new one
  }

  const ctx = getRequestContext(headers());
  try {
    const created = await prisma.visitor.create({
      data: {
        firstName: null,
        email: null,
        locale: ctx.locale,
        ip: ctx.ip,
        country: ctx.country,
        city: ctx.city,
        region: ctx.region,
        timezone: ctx.timezone,
        userAgent: ctx.userAgent,
        device: ctx.device,
        browser: ctx.browser,
        os: ctx.os,
        referer: ctx.referer
      }
    });
    cookies().set(VISITOR_COOKIE, created.id, {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });
    logInfo('visitor.anonymous_init', {
      visitorId: created.id,
      ip: ctx.ip,
      country: ctx.country,
      device: ctx.device
    });
    return { id: created.id, isAnonymous: true, searchCount: 0 };
  } catch (err) {
    reportError(err, { where: 'ensureVisitor' });
    throw err;
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

/** Log a word lookup. Writes a SearchEvent row + stdout line. Awaited
 *  by callers so the row lands before the response is finalized. */
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
