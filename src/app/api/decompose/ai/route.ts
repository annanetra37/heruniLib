import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateAdHocHeruniDraft } from '@/lib/claude';

// POST /api/decompose/ai  —  public on-demand Heruni reconstruction.
//
// Runs the v2 AI pipeline on an arbitrary Armenian word without requiring
// a DB Word row (v2 brief §4: "on-demand generation for queries on words
// not yet seen"). No persistence — this is a transient synthesis the UI
// shows immediately and lets the visitor suggest as a dictionary entry.
//
// This IS unauthenticated. Abuse protection strategy, in order of
// aggressiveness (add as traffic warrants):
//   1. Normalise + shape-check the input (done here — Armenian chars only,
//      ≤ 50 chars, ≥ 2 chars). Blocks the most obvious LLM-prompt abuse.
//   2. If ANTHROPIC_API_KEY isn't set, returns 503 before burning any
//      compute. Ops can toggle the feature off by removing the key.
//   3. Cache by wordHy + prompt version in an AdHocDraft table (Batch 9
//      polish — sits nicely with the Redis cache from §6.1).
//   4. Add Turnstile challenge on the submit button (the site already has
//      Turnstile wired for the public submission form).

const schema = z.object({
  word: z.string().min(2).max(50)
});

// Armenian letters (U+0531–U+0556 uppercase, U+0561–U+0587 lowercase) plus
// common modifiers (apostrophe, hyphen). Anything else gets rejected so
// nobody passes "ignore previous instructions" as a word.
const ARMENIAN_ONLY = /^[\u0530-\u0587'\-\s]+$/;

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
      { error: 'AI inference is not configured on this deployment.' },
      { status: 503 }
    );
  }

  try {
    const result = await generateAdHocHeruniDraft(word);
    return NextResponse.json(result);
  } catch (err) {
    const message = (err as Error).message ?? 'generation failed';
    const status = message.startsWith('No SSB roots matched') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
