import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { VISITOR_COOKIE } from '@/lib/visitor';
import { getRequestContext } from '@/lib/requestContext';
import { logInfo, reportError } from '@/lib/observability';

// POST /api/visitors  — creates a Visitor row on first visit + sets
// the `heruni_visitor_id` cookie (1-year). Captures IP, geolocation,
// device/browser/OS so we know where traffic is coming from.

const schema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().max(60).optional(),
  email: z.string().email().max(120).optional(),
  locale: z.string().max(5).optional()
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const ctx = getRequestContext(headers());
  const email = parsed.data.email?.trim().toLowerCase() || null;

  try {
    // When an email is supplied we prefer find-or-create: the same user
    // signing in from a different browser / after a cookie reset still
    // reuses their Visitor row, keeping search history attributed
    // correctly.
    let visitor;
    if (email) {
      const existing = await prisma.visitor.findFirst({ where: { email } });
      if (existing) {
        visitor = await prisma.visitor.update({
          where: { id: existing.id },
          data: {
            firstName: parsed.data.firstName.trim(),
            lastName: parsed.data.lastName?.trim() || existing.lastName,
            ip: ctx.ip ?? existing.ip,
            country: ctx.country ?? existing.country,
            city: ctx.city ?? existing.city,
            region: ctx.region ?? existing.region,
            timezone: ctx.timezone ?? existing.timezone,
            locale: parsed.data.locale || ctx.locale || existing.locale,
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
            firstName: parsed.data.firstName.trim(),
            lastName: parsed.data.lastName?.trim() || null,
            email,
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
    } else {
      // Anonymous (no email) — happens from the old welcome-modal flow.
      visitor = await prisma.visitor.create({
        data: {
          firstName: parsed.data.firstName.trim(),
          lastName: parsed.data.lastName?.trim() || null,
          email: null,
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
      httpOnly: false, // client components read it to decide greeting
      sameSite: 'lax',
      path: '/'
    });

    logInfo('visitor.signed_in', {
      visitorId: visitor.id,
      firstName: visitor.firstName,
      lastName: visitor.lastName,
      ip: ctx.ip,
      country: ctx.country,
      city: ctx.city,
      device: ctx.device,
      browser: ctx.browser,
      os: ctx.os
    });

    return NextResponse.json({
      id: visitor.id,
      firstName: visitor.firstName,
      lastName: visitor.lastName
    });
  } catch (err) {
    reportError(err, { where: '/api/visitors POST' });
    return NextResponse.json({ error: 'could not create visitor' }, { status: 500 });
  }
}

// GET /api/visitors  — returns the current visitor (or null) so the
// client can decide whether to show the welcome modal on mount.
export async function GET() {
  const id = cookies().get(VISITOR_COOKIE)?.value;
  if (!id) return NextResponse.json({ visitor: null });
  try {
    const v = await prisma.visitor.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true }
    });
    return NextResponse.json({ visitor: v ?? null });
  } catch {
    return NextResponse.json({ visitor: null });
  }
}
