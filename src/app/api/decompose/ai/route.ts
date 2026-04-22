import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { generateAdHocCombined, logGenerationCost } from '@/lib/claude';
import { VISITOR_COOKIE } from '@/lib/visitor';

// POST /api/decompose/ai — public on-demand rich reconstruction.
// Returns Heruni draft + classical draft + related words (computed from
// ՏԲ-root overlap). Logs the per-generation cost to AiGenerationCost
// attributed to the current visitor (cookie) when present.

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

    // Cost attribution — use the visitor cookie if present. Fire and
    // forget; cost rows must not block the response.
    const visitorId = cookies().get(VISITOR_COOKIE)?.value ?? null;
    const model = process.env.AI_MODEL ?? 'claude-opus-4-7';

    // Log the Heruni call cost (classical's usage isn't surfaced by the
    // combined helper; the admin panel sums rows across kinds anyway).
    void logGenerationCost({
      wordHy: word,
      kind: 'ad-hoc',
      model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cacheReadTokens: result.usage.cacheReadInputTokens,
      cacheWriteTokens: result.usage.cacheCreationInputTokens,
      visitorId
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = (err as Error).message ?? 'generation failed';
    const status = message.startsWith('No SSB roots matched') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
