import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { VISITOR_COOKIE } from '@/lib/visitor';
import { getRequestContext } from '@/lib/requestContext';
import { logInfo } from '@/lib/observability';

// POST /api/visitor-auth/reset-password
// Body: { email, password }
//
// No OTP / no email verification by design — this is a lightweight
// dictionary, not a bank. The user enters their email plus a NEW
// password, and if the account exists we replace the bcrypt hash and
// sign them in with the same cookie as /login. Attribution (Visitor.id,
// past SearchEvents, PageViews, AiGenerationCosts) is preserved.
//
// 404 if no account exists for the email. Any visitor who knows an
// email CAN reset the password for it — accept that trade-off per the
// product call.

const schema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(6).max(200)
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.visitor.findFirst({ where: { email } });
  if (!existing) return NextResponse.json({ error: 'no account with that email' }, { status: 404 });

  const ctx = getRequestContext(headers());
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const visitor = await prisma.visitor.update({
    where: { id: existing.id },
    data: {
      passwordHash,
      lastSeenAt: new Date(),
      ip: ctx.ip ?? existing.ip,
      country: ctx.country ?? existing.country,
      city: ctx.city ?? existing.city,
      region: ctx.region ?? existing.region,
      timezone: ctx.timezone ?? existing.timezone,
      locale: ctx.locale ?? existing.locale,
      userAgent: ctx.userAgent ?? existing.userAgent,
      device: ctx.device ?? existing.device,
      browser: ctx.browser ?? existing.browser,
      os: ctx.os ?? existing.os,
      referer: ctx.referer ?? existing.referer
    }
  });

  cookies().set(VISITOR_COOKIE, visitor.id, {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: 'lax',
    path: '/'
  });

  logInfo('visitor.password_reset', {
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
