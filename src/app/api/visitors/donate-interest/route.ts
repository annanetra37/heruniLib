import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { VISITOR_COOKIE } from '@/lib/visitor';
import { logInfo } from '@/lib/observability';

// POST /api/visitors/donate-interest
// No body. Flags the current visitor as "ready to donate" so admins
// can follow up via email. Idempotent — subsequent clicks bump the
// counter and the timestamp so editors see the level of enthusiasm.
// Returns 401 when the visitor isn't signed in (cookie missing); the
// client shows a "please sign in" thanks-message in that case.

export async function POST() {
  const id = cookies().get(VISITOR_COOKIE)?.value ?? null;
  if (!id) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  try {
    const visitor = await prisma.visitor.update({
      where: { id },
      data: {
        readyToDonate: true,
        readyToDonateAt: new Date(),
        donateClickCount: { increment: 1 }
      },
      select: { id: true, firstName: true, email: true, donateClickCount: true }
    });

    logInfo('visitor.donate_interest', {
      visitorId: visitor.id,
      firstName: visitor.firstName,
      email: visitor.email,
      clicks: visitor.donateClickCount
    });

    return NextResponse.json({ ok: true, clicks: visitor.donateClickCount });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
