import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  generateAdHocCombined,
  logGenerationCost,
  findRelatedByRoots
} from '@/lib/claude';
import { prisma } from '@/lib/prisma';
import { VISITOR_COOKIE, logSearchEvent } from '@/lib/visitor';
import { logInfo } from '@/lib/observability';

// POST /api/decompose/ai — public on-demand rich reconstruction.
//
// Cache-first: every unique wordHy gets sent to Claude exactly once.
// All subsequent requests replay the stored response from AdHocCache,
// so repeat searches cost $0.00. Related-word lookup is recomputed on
// each hit so the list tracks the growing corpus.

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

  const visitorId = cookies().get(VISITOR_COOKIE)?.value ?? null;
  const model = process.env.AI_MODEL ?? 'claude-opus-4-7';

  // ---------------- Cache lookup ------------------------------------
  const cached = await prisma.adHocCache.findUnique({ where: { wordHy: word } });
  if (cached) {
    // Bump hit count (best-effort; don't block).
    await prisma.adHocCache
      .update({
        where: { id: cached.id },
        data: { hitCount: { increment: 1 } }
      })
      .catch(() => null);

    // Recompute related on every hit (cheap DB query, keeps results
    // fresh as editors add more words).
    let rootTokens: string[] = [];
    try {
      rootTokens = JSON.parse(cached.rootTokens) as string[];
    } catch {
      rootTokens = [];
    }
    const related = await findRelatedByRoots(word, rootTokens);

    let draft, classical, decomposition;
    try {
      draft = JSON.parse(cached.heruniDraft);
    } catch {
      draft = null;
    }
    try {
      classical = cached.classicalDraft ? JSON.parse(cached.classicalDraft) : null;
    } catch {
      classical = null;
    }
    try {
      decomposition = JSON.parse(cached.decomposition);
    } catch {
      decomposition = null;
    }

    logInfo('ai.cache_hit', {
      word,
      hitCount: cached.hitCount + 1,
      visitorId,
      model: cached.model,
      cachedAt: cached.createdAt.toISOString()
    });
    await logSearchEvent({ wordHy: word, source: 'decompose-ai', outcome: 'cache_hit' });

    return NextResponse.json({
      draft,
      classical,
      related,
      decomposition,
      promptVersion: cached.promptVersion,
      classicalPromptVersion: cached.classicalPromptVersion,
      classicalError: null,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0
      },
      fromCache: true
    });
  }

  // ---------------- Cache miss — run the algorithms -----------------
  if (!process.env.ANTHROPIC_API_KEY) {
    await logSearchEvent({ wordHy: word, source: 'decompose-ai', outcome: 'error' });
    return NextResponse.json(
      { error: 'Our algorithms are not configured on this deployment.' },
      { status: 503 }
    );
  }

  logInfo('ai.cache_miss', { word, visitorId });
  await logSearchEvent({ wordHy: word, source: 'decompose-ai', outcome: 'cache_miss' });

  try {
    const result = await generateAdHocCombined(word);

    // Persist — upsert so two concurrent first-time hits don't collide
    // on the UNIQUE(wordHy) constraint.
    await prisma.adHocCache
      .upsert({
        where: { wordHy: word },
        update: {
          model,
          promptVersion: result.promptVersion,
          classicalPromptVersion: result.classicalPromptVersion,
          heruniDraft: JSON.stringify(result.draft),
          classicalDraft: result.classical ? JSON.stringify(result.classical) : null,
          decomposition: JSON.stringify(result.decomposition),
          rootTokens: JSON.stringify(result.decomposition.rootTokens)
        },
        create: {
          wordHy: word,
          model,
          promptVersion: result.promptVersion,
          classicalPromptVersion: result.classicalPromptVersion,
          heruniDraft: JSON.stringify(result.draft),
          classicalDraft: result.classical ? JSON.stringify(result.classical) : null,
          decomposition: JSON.stringify(result.decomposition),
          rootTokens: JSON.stringify(result.decomposition.rootTokens)
        }
      })
      .catch(() => null);

    // Log the cost for THIS call (cache misses are the only time we
    // actually bill Claude for ad-hoc searches).
    await logGenerationCost({
      wordHy: word,
      kind: 'ad-hoc',
      model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cacheReadTokens: result.usage.cacheReadInputTokens,
      cacheWriteTokens: result.usage.cacheCreationInputTokens,
      visitorId
    });

    return NextResponse.json({ ...result, fromCache: false });
  } catch (err) {
    const message = (err as Error).message ?? 'generation failed';
    const status = message.startsWith('No SSB roots matched') ? 400 : 500;
    await logSearchEvent({
      wordHy: word,
      source: 'decompose-ai',
      outcome: message.startsWith('No SSB roots matched') ? 'no_match' : 'error'
    });
    return NextResponse.json({ error: message }, { status });
  }
}
