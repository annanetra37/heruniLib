import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { locales, defaultLocale } from './i18n/config';

const intl = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  // Always send first-time visitors to Armenian regardless of
  // Accept-Language. Heruni Dict is an Armenian dictionary — hy is the
  // editorial canonical locale, en is a translation layer on top.
  localeDetection: false
});

const VISITOR_COOKIE = 'heruni_visitor_id';

// Paths every public visitor can hit without being signed in.
// Regex matches a leading locale prefix when present.
function isPublicPath(pathname: string): boolean {
  // Login itself must be reachable so the user can sign in.
  if (/^\/(hy|en)\/login\b/.test(pathname)) return true;
  // Legal pages stay open in case a visitor is reviewing them before
  // deciding to sign in.
  if (/^\/(hy|en)\/(privacy|terms|credits|methodology)\b/.test(pathname)) return true;
  // Feeds + sitemap + health must stay open for crawlers / uptime checks.
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') return true;
  if (pathname === '/feed.xml' || pathname === '/feed.json') return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /admin/** — NextAuth JWT (unchanged).
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login' || pathname.startsWith('/api/auth')) {
      return NextResponse.next();
    }
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL('/admin/login', req.url);
      loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // /api routes — sign-in status is checked inside each handler where it
  // matters (e.g. /api/decompose/ai logs the visitorId). Keep /api/auth
  // and /api/visitors (the sign-in submit endpoint) open.
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  // Public site: bounce un-authed visitors to /login, preserving where
  // they were trying to go so the login form can send them back.
  const hasVisitor = req.cookies.get(VISITOR_COOKIE)?.value;
  if (!hasVisitor && !isPublicPath(pathname)) {
    // Extract the locale from the URL (or fall back) so the login page
    // renders in the right language.
    const loc =
      locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)) ??
      defaultLocale;
    const loginUrl = new URL(`/${loc}/login`, req.url);
    loginUrl.searchParams.set('from', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return intl(req);
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)']
};
