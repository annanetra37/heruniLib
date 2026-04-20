import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  wordHy: z.string().min(1).max(100),
  proposedDecomposition: z.string().max(200).optional().nullable(),
  proposedMeaningHy: z.string().max(500).optional().nullable(),
  proposedMeaningEn: z.string().max(500).optional().nullable(),
  submitterEmail: z.string().email().optional().nullable(),
  turnstileToken: z.string().optional() // Sprint 4 — verified when TURNSTILE_SECRET_KEY set
});

async function verifyTurnstile(token?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured in dev
  if (!token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token })
  });
  const j = (await r.json()) as { success: boolean };
  return j.success === true;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const ok = await verifyTurnstile(parsed.data.turnstileToken);
  if (!ok) return NextResponse.json({ error: 'captcha failed' }, { status: 403 });

  const created = await prisma.submission.create({
    data: {
      wordHy: parsed.data.wordHy.trim().toLowerCase(),
      proposedDecomposition: parsed.data.proposedDecomposition ?? null,
      proposedMeaningHy: parsed.data.proposedMeaningHy ?? null,
      proposedMeaningEn: parsed.data.proposedMeaningEn ?? null,
      submitterEmail: parsed.data.submitterEmail ?? null
    }
  });
  return NextResponse.json({ ok: true, id: created.id });
}
