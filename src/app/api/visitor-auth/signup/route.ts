import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { VISITOR_COOKIE } from '@/lib/visitor';
import { getRequestContext } from '@/lib/requestContext';
import { logInfo } from '@/lib/observability';

// POST /api/visitor-auth/signup
// Body: { email, password, firstName, lastName? }
// Creates a new Visitor row OR upgrades a legacy cookie-only visitor
// by setting their passwordHash for the first time.
//   - Email not in table → full new-account create.
//   - Email in table + passwordHash already set → 409 (use /login).
//   - Email in table + passwordHash null (legacy) → set password,
//     update names, keep the id so search history stays attributed.

const schema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(6).max(200),
  firstName: z.string().min(1).max(60),
  lastName: z.string().max(60).optional(),
  locale: z.string().max(5).optional()
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const email = parsed.data.email.trim().toLowerCase();
  const ctx = getRequestContext(headers());
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  try {
    const existing = await prisma.visitor.findFirst({ where: { email } });
    let visitor;

    if (existing) {
      if (existing.passwordHash) {
        return NextResponse.json(
          { error: 'account already exists — please sign in instead' },
          { status: 409 }
        );
      }
      // Legacy visitor — upgrade in place.
      visitor = await prisma.visitor.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          firstName: parsed.data.firstName.trim(),
          lastName: parsed.data.lastName?.trim() || existing.lastName,
          locale: parsed.data.locale || ctx.locale || existing.locale,
          ip: ctx.ip ?? existing.ip,
          country: ctx.country ?? existing.country,
          city: ctx.city ?? existing.city,
          region: ctx.region ?? existing.region,
          timezone: ctx.timezone ?? existing.timezone,
          userAgent: ctx.userAgent ?? existing.userAgent,
          device: ctx.device ?? existing.device,
          browser: ctx.browser ?? existing.browser,
          os: ctx.os ?? existing.os,
          referer: ctx.referer ?? existing.referer,
          lastSeenAt: new Date()
        }
      });
    } else {
      visitor = await prisma.visitor.create({
        data: {
          email,
          passwordHash,
          firstName: parsed.data.firstName.trim(),
          lastName: parsed.data.lastName?.trim() || null,
          locale: parsed.data.locale || ctx.locale,
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
    }

    cookies().set(VISITOR_COOKIE, visitor.id, {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });

    logInfo('visitor.signup', {
      visitorId: visitor.id,
      email: visitor.email,
      firstName: visitor.firstName,
      lastName: visitor.lastName,
      upgraded: !!existing,
      ip: ctx.ip,
      country: ctx.country
    });

    return NextResponse.json({
      id: visitor.id,
      firstName: visitor.firstName,
      lastName: visitor.lastName
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
