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
    // Three cases we need to handle:
    //   (a) cookie points at an anonymous Visitor (no email, no
    //       password) — upgrade it in place. This is THE common
    //       post-freemium signup path and preserves all of the
    //       visitor's earlier SearchEvent / PageView rows.
    //   (b) email already has a full account → 409.
    //   (c) email has a legacy row (no password) → upgrade it.
    //   (d) fresh email + no cookie → new create.
    const cookieId = cookies().get(VISITOR_COOKIE)?.value;
    const cookieVisitor = cookieId
      ? await prisma.visitor.findUnique({ where: { id: cookieId } })
      : null;
    const byEmail = await prisma.visitor.findFirst({ where: { email } });

    if (byEmail && byEmail.passwordHash && byEmail.id !== cookieVisitor?.id) {
      return NextResponse.json(
        { error: 'account already exists — please sign in instead' },
        { status: 409 }
      );
    }

    let visitor;

    if (cookieVisitor && !cookieVisitor.passwordHash) {
      // (a) Anonymous-cookie upgrade — attach email/password/names to
      // the existing row. Search history stays attributed by id.
      visitor = await prisma.visitor.update({
        where: { id: cookieVisitor.id },
        data: {
          email,
          passwordHash,
          firstName: parsed.data.firstName.trim(),
          lastName: parsed.data.lastName?.trim() || cookieVisitor.lastName,
          locale: parsed.data.locale || ctx.locale || cookieVisitor.locale,
          ip: ctx.ip ?? cookieVisitor.ip,
          country: ctx.country ?? cookieVisitor.country,
          city: ctx.city ?? cookieVisitor.city,
          region: ctx.region ?? cookieVisitor.region,
          timezone: ctx.timezone ?? cookieVisitor.timezone,
          userAgent: ctx.userAgent ?? cookieVisitor.userAgent,
          device: ctx.device ?? cookieVisitor.device,
          browser: ctx.browser ?? cookieVisitor.browser,
          os: ctx.os ?? cookieVisitor.os,
          referer: ctx.referer ?? cookieVisitor.referer,
          lastSeenAt: new Date()
        }
      });

      // Edge case: same email already exists on a DIFFERENT row (the
      // user tried to sign up earlier from another browser that left a
      // legacy no-password row). Absorb that row's history too.
      if (byEmail && byEmail.id !== visitor.id && !byEmail.passwordHash) {
        await prisma.searchEvent.updateMany({
          where: { visitorId: byEmail.id },
          data: { visitorId: visitor.id }
        });
        await prisma.pageView.updateMany({
          where: { visitorId: byEmail.id },
          data: { visitorId: visitor.id }
        });
        await prisma.aiGenerationCost.updateMany({
          where: { visitorId: byEmail.id },
          data: { visitorId: visitor.id }
        });
        await prisma.visitor.delete({ where: { id: byEmail.id } });
      }
    } else if (byEmail && !byEmail.passwordHash) {
      // (c) Legacy visitor by email — upgrade in place + absorb any
      // anonymous cookie visitor we have on this device.
      visitor = await prisma.visitor.update({
        where: { id: byEmail.id },
        data: {
          passwordHash,
          firstName: parsed.data.firstName.trim(),
          lastName: parsed.data.lastName?.trim() || byEmail.lastName,
          locale: parsed.data.locale || ctx.locale || byEmail.locale,
          ip: ctx.ip ?? byEmail.ip,
          country: ctx.country ?? byEmail.country,
          city: ctx.city ?? byEmail.city,
          region: ctx.region ?? byEmail.region,
          timezone: ctx.timezone ?? byEmail.timezone,
          userAgent: ctx.userAgent ?? byEmail.userAgent,
          device: ctx.device ?? byEmail.device,
          browser: ctx.browser ?? byEmail.browser,
          os: ctx.os ?? byEmail.os,
          referer: ctx.referer ?? byEmail.referer,
          lastSeenAt: new Date()
        }
      });
      if (cookieVisitor && cookieVisitor.id !== visitor.id) {
        await prisma.searchEvent.updateMany({
          where: { visitorId: cookieVisitor.id },
          data: { visitorId: visitor.id }
        });
        await prisma.pageView.updateMany({
          where: { visitorId: cookieVisitor.id },
          data: { visitorId: visitor.id }
        });
        await prisma.aiGenerationCost.updateMany({
          where: { visitorId: cookieVisitor.id },
          data: { visitorId: visitor.id }
        });
        await prisma.visitor.delete({ where: { id: cookieVisitor.id } });
      }
    } else {
      // (d) Fresh create.
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
      upgradedFromAnonymous: cookieVisitor?.id === visitor.id,
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
