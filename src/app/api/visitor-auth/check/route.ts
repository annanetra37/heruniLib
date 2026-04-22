import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// POST /api/visitor-auth/check
// Body: { email }
// Response: { exists: bool, firstName: string|null, hasPassword: bool }
//
// The LoginForm uses this for its first stage — the server tells it
// whether to show "password" (existing account) or "create account"
// (new email) in stage two.

const schema = z.object({
  email: z.string().email().max(120)
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'bad email' }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();

  const v = await prisma.visitor.findFirst({
    where: { email },
    select: { id: true, firstName: true, passwordHash: true }
  });

  return NextResponse.json({
    exists: !!v,
    firstName: v?.firstName ?? null,
    hasPassword: !!v?.passwordHash
  });
}
