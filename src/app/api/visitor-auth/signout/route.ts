import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { VISITOR_COOKIE } from '@/lib/visitor';
import { logInfo } from '@/lib/observability';

// POST /api/visitor-auth/signout
// Clears the session cookie. Visitor row is kept so their search
// history remains attributed; they can sign back in with the same
// email + password.

export async function POST() {
  const id = cookies().get(VISITOR_COOKIE)?.value ?? null;
  cookies().set(VISITOR_COOKIE, '', { maxAge: 0, path: '/' });
  logInfo('visitor.signout', { visitorId: id });
  return NextResponse.json({ ok: true });
}
