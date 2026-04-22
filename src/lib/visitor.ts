import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';
import { logInfo, reportError } from './observability';

// Lightweight visitor identity (v2 post-launch request):
//   - First-time visitors see a modal asking "how can I call you?"
//   - On submit we create a Visitor row and set a long-lived cookie.
//   - On every public page render we upsert a PageView row and log a
//     structured JSON line to stdout so operators can see real-time
//     activity with `railway logs` / `docker logs -f`.

export const VISITOR_COOKIE = 'heruni_visitor_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function firstHeader(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export function extractIp(h: Headers): string | null {
  return (
    firstHeader(h.get('x-forwarded-for')) ??
    h.get('x-real-ip') ??
    h.get('cf-connecting-ip') ??
    null
  );
}

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
  const h = headers();
  const ip = extractIp(h);
  const userAgent = h.get('user-agent');
  const referer = h.get('referer');
  const visitorId = cookies().get(VISITOR_COOKIE)?.value ?? null;

  // Stdout — visible in `railway logs` / terminal tail.
  logInfo('pageview', {
    path,
    locale,
    ip,
    visitorId,
    referer,
    ua: userAgent?.slice(0, 120) ?? null
  });

  try {
    await prisma.pageView.create({
      data: { path, locale, ip, userAgent, referer, visitorId }
    });
    if (visitorId) {
      await prisma.visitor
        .update({ where: { id: visitorId }, data: { lastSeenAt: new Date() } })
        .catch(() => null);
    }
  } catch (err) {
    reportError(err, { where: 'logPageView', path });
  }
}
