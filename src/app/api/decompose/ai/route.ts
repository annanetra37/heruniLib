import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  generateAdHocCombined,
  logGenerationCost,
  findRelatedByRoots
} from '@/lib/claude';
import { prisma, parseInts, parseList } from '@/lib/prisma';
import { VISITOR_COOKIE, logSearchEvent } from '@/lib/visitor';
import { logInfo } from '@/lib/observability';
import { normaliseHy } from '@/lib/normaliseHy';

// POST /api/decompose/ai — public on-demand rich reconstruction.
//
// Three-layer cost-protection:
//   1. Word table (curated editorial entries) — if found, never call
//      Claude. Editor-written meaning is canonical and free.
//   2. AdHocCache — if the word was previously generated, replay the
//      stored JSON. Still zero cost.
//   3. Only if neither layer has the word: run the Claude pipeline and
//      persist the result so every subsequent search hits layer 2.

const schema = z.object({
  word: z.string().min(2).max(50)
});

const ARMENIAN_ONLY = /^[԰-և'\-\s]+$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const word = normaliseHy(parsed.data.word);
  if (!ARMENIAN_ONLY.test(word)) {
    return NextResponse.json({ error: 'Only Armenian letters are accepted.' }, { status: 400 });
  }

  const visitorId = cookies().get(VISITOR_COOKIE)?.value ?? null;
  const model = process.env.AI_MODEL ?? 'claude-opus-4-7';

  // ---------------- Layer 1: curated Word entry ---------------------
  // An editor wrote the meaning by hand. Any status (published,
  // review, draft) is treated as authoritative — we don't pay Claude
  // to re-interpret a word a human has already interpreted.
  //
  // Case-insensitive match on wordHy / slug / transliteration so the
  // user typing "Արա" with capital A still hits a row stored as
  // "արա". Prisma compiles mode:'insensitive' into ILIKE-style
  // matching against Postgres's citext-aware collation.
  const curated = await prisma.word.findFirst({
    where: {
      OR: [
        { wordHy: { equals: word, mode: 'insensitive' } },
        { slug: { equals: word, mode: 'insensitive' } },
        { transliteration: { equals: word, mode: 'insensitive' } }
      ]
    }
  });
  if (curated && curated.meaningHy) {
    const rootIds = parseInts(curated.rootSequence);
    const tokenRows = rootIds.length
      ? await prisma.root.findMany({
          where: { id: { in: rootIds } },
          select: { id: true, token: true }
        })
      : [];
    const byId = new Map(tokenRows.map((r) => [r.id, r.token]));
    const rootTokens = rootIds
      .map((id) => byId.get(id))
      .filter((t): t is string => !!t);
    const related = await findRelatedByRoots(curated.wordHy, rootTokens);

    logInfo('ai.word_table_hit', {
      word,
      visitorId,
      slug: curated.slug,
      status: curated.status
    });
    await logSearchEvent({ wordHy: word, source: 'decompose-ai', outcome: 'curated' });

    return NextResponse.json({
      draft: {
        pattern_code: 'curated',
        meaning_hy: curated.meaningHy,
        meaning_en: curated.meaningEn,
        confidence: Math.max(1, 6 - curated.confidence), // 1-book→5, 2-certain→4, 3-tentative→3
        editor_notes: curated.source ?? ''
      },
      classical: curated.classicalEtymologyHy
        ? {
            meaning_hy: curated.classicalEtymologyHy,
            meaning_en: curated.classicalEtymologyEn ?? '',
            sources: parseList(curated.classicalSourceRef),
            confidence: 5,
            editor_notes: ''
          }
        : null,
      related,
      decomposition: {
        wordHy: curated.wordHy,
        transliteration: curated.transliteration,
        canonical: curated.decomposition,
        rootTokens,
        suffix: curated.suffix,
        shape: 'curated',
        category: curated.category,
        candidateCodes: []
      },
      promptVersion: 'curated',
      classicalPromptVersion: null,
      classicalError: null,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0
      },
      fromCache: false,
      fromCurated: true
    });
  }

  // Layer-1 miss observability — easy to diagnose "why did AI run for
  // a curated word?" complaints. Logs the exact normalised input we
  // looked for + whether a partial match existed (wrong status / etc).
  if (!curated) {
    logInfo('ai.word_table_miss', {
      word,
      rawInput: parsed.data.word,
      visitorId,
      hint: 'no Word row matched wordHy / slug / transliteration'
    });
  } else if (!curated.meaningHy) {
    logInfo('ai.word_table_empty', {
      word,
      matchedId: curated.id,
      status: curated.status,
      hint: 'Word row found but meaningHy is empty — AI will fill the gap'
    });
  }

  // ---------------- Layer 2: ad-hoc cache ---------------------------
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

  // ---------------- Layer 3: run the algorithms ---------------------
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
