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

  // /api routes don't go through the locale middleware.
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  // Public routes are open to anonymous visitors. The FREE_SEARCH_LIMIT
  // gate is enforced inside the search endpoints (/api/decompose +
  // /api/decompose/ai) — no login wall at the page level.
  return intl(req);
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)']
};
