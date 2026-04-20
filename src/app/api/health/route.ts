import { NextResponse } from 'next/server';

// Liveness endpoint for Railway / uptime monitors.
// Intentionally does not touch the DB so it stays responsive during
// cold-boot schema sync + seed on the very first deploy.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ ok: true, service: 'heruni-dict' });
}
