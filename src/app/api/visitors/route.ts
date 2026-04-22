import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { extractIp, VISITOR_COOKIE } from '@/lib/visitor';
import { logInfo, reportError } from '@/lib/observability';

// POST /api/visitors  — creates a Visitor row on first visit.
// Body: { firstName, lastName?, locale? }
// Response: { id, firstName, lastName }
// Also sets the `heruni_visitor_id` cookie (1-year) so the session
// remembers the user on every subsequent hit.

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

  const h = headers();
  const ip = extractIp(h);
  const userAgent = h.get('user-agent');
  const referer = h.get('referer');

  try {
    const visitor = await prisma.visitor.create({
      data: {
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName?.trim() || null,
        email: parsed.data.email?.trim() || null,
        locale: parsed.data.locale || null,
        ip,
        userAgent,
        referer
      }
    });

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
      ip,
      ua: userAgent?.slice(0, 120) ?? null
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
