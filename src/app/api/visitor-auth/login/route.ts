import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { VISITOR_COOKIE } from '@/lib/visitor';
import { getRequestContext } from '@/lib/requestContext';
import { logInfo } from '@/lib/observability';

// POST /api/visitor-auth/login
// Body: { email, password }
// Verifies bcrypt hash and sets the session cookie. 401 on wrong
// password, 404 if the email doesn't exist, 409 if the visitor exists
// but has no password yet (legacy row — client should call /signup
// instead to set one).

const schema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(6).max(200)
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const email = parsed.data.email.trim().toLowerCase();
  const visitor = await prisma.visitor.findFirst({ where: { email } });

  if (!visitor) return NextResponse.json({ error: 'no account with that email' }, { status: 404 });
  if (!visitor.passwordHash) {
    return NextResponse.json(
      { error: 'this account has no password yet; please set one via signup' },
      { status: 409 }
    );
  }

  const ok = await bcrypt.compare(parsed.data.password, visitor.passwordHash);
  if (!ok) return NextResponse.json({ error: 'wrong password' }, { status: 401 });

  // Backfill IP/geo/device from the current request — users often sign
  // in from a different device than where they first created the
  // account, and the latest values are more useful for analytics than
  // frozen first-visit values.
  const ctx = getRequestContext(headers());
  await prisma.visitor.update({
    where: { id: visitor.id },
    data: {
      lastSeenAt: new Date(),
      ip: ctx.ip ?? visitor.ip,
      country: ctx.country ?? visitor.country,
      city: ctx.city ?? visitor.city,
      region: ctx.region ?? visitor.region,
      timezone: ctx.timezone ?? visitor.timezone,
      locale: ctx.locale ?? visitor.locale,
      userAgent: ctx.userAgent ?? visitor.userAgent,
      device: ctx.device ?? visitor.device,
      browser: ctx.browser ?? visitor.browser,
      os: ctx.os ?? visitor.os,
      referer: ctx.referer ?? visitor.referer
    }
  });

  cookies().set(VISITOR_COOKIE, visitor.id, {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: 'lax',
    path: '/'
  });

  logInfo('visitor.login', {
    visitorId: visitor.id,
    email: visitor.email,
    firstName: visitor.firstName,
    ip: ctx.ip,
    country: ctx.country
  });

  return NextResponse.json({
    id: visitor.id,
    firstName: visitor.firstName,
    lastName: visitor.lastName
  });
}
