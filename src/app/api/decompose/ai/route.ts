import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateAdHocCombined } from '@/lib/claude';

// POST /api/decompose/ai — public on-demand rich reconstruction.
//
// Runs the full v2 pipeline on an arbitrary Armenian word without requiring
// a DB Word row (v2 brief §4). Returns BOTH:
//   - the Heruni-voiced reconstruction (authoritative)
//   - the classical etymology draft (best-effort; may be null if Anthropic
//     refused or rate-limited)
//   - related words by root overlap (computed from DB, no model call)
//
// Nothing is persisted: this is a transient synthesis that /decompose
// renders immediately.

const schema = z.object({
  word: z.string().min(2).max(50)
});

const ARMENIAN_ONLY = /^[԰-և'\-\s]+$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const word = parsed.data.word.trim().toLowerCase();
  if (!ARMENIAN_ONLY.test(word)) {
    return NextResponse.json({ error: 'Only Armenian letters are accepted.' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Our algorithms are not configured on this deployment.' },
      { status: 503 }
    );
  }

  try {
    const result = await generateAdHocCombined(word);
    return NextResponse.json(result);
  } catch (err) {
    const message = (err as Error).message ?? 'generation failed';
    const status = message.startsWith('No SSB roots matched') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
