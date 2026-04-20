// Prompt builder (v2 task 3.3).
//
// One-liner API per the brief: buildPrompt(wordId) returns a complete,
// valid prompt (system + user) ≤ 4000 tokens.
//
// Keeps the classifier / retriever / prompt template wired together so
// callers (the Claude pipeline, the admin preview page) don't have to
// re-implement the glue.

import { prisma, parseList, parseInts } from './prisma';
import { classify } from './classify';
import { retrieveCandidates } from './patternRetriever';
import { buildLookup, decompose } from './decompose';
import { transliterate } from './transliterate';
import {
  buildSystemPrompt,
  buildUserPrompt,
  PROMPT_VERSION,
  type PatternContext,
  type WordContext
} from '../../prompts/heruni-reconstruction.v1';

export type BuiltPrompt = {
  version: string;
  systemPrompt: string;
  userPrompt: string;
  /** The candidate patterns in rank order (first is the strongest fit). */
  candidateCodes: string[];
  /** Every pattern the model sees in its system block. Used for audit. */
  patternCodesInSystem: string[];
  /** Classification snapshot — stored for reproducibility. */
  classification: {
    suffix: string | null;
    shapeGuess: string;
    categoryGuess: string | null;
  };
};

export async function buildPrompt(wordId: number): Promise<BuiltPrompt> {
  const word = await prisma.word.findUnique({ where: { id: wordId } });
  if (!word) throw new Error(`word ${wordId} not found`);

  const rootIds = parseInts(word.rootSequence);
  const [roots, allPatterns] = await Promise.all([
    rootIds.length
      ? prisma.root.findMany({ where: { id: { in: rootIds } } })
      : Promise.resolve([] as Awaited<ReturnType<typeof prisma.root.findMany>>),
    prisma.pattern.findMany({ orderBy: { code: 'asc' } })
  ]);

  // Preserve rootSequence ordering.
  const rootById = new Map(roots.map((r) => [r.id, r]));
  const orderedRoots = rootIds
    .map((id) => rootById.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r);

  // Classification + candidate pattern ranking.
  const classification = classify({
    word: word.wordHy,
    rootTokenCount: rootIds.length,
    category: word.category
  });
  const candidates = retrieveCandidates(classification, allPatterns, 3);
  const candidateCodes = candidates.map((c) => c.pattern.code);

  // Gather example reconstructions for every pattern in the system block.
  // Examples live in Pattern.exampleWords as Word.id arrays. We fetch them
  // in a single query keyed by id.
  const exampleIdSet = new Set<number>();
  for (const p of allPatterns) parseInts(p.exampleWords).forEach((id) => exampleIdSet.add(id));
  const exampleWords = exampleIdSet.size
    ? await prisma.word.findMany({
        where: { id: { in: Array.from(exampleIdSet) } },
        select: {
          id: true,
          wordHy: true,
          decomposition: true,
          meaningHy: true,
          meaningEn: true
        }
      })
    : [];
  const exampleById = new Map(exampleWords.map((w) => [w.id, w]));

  // System prompt sees every pattern — stable across all generations → cache hit.
  const patternCtx: PatternContext[] = allPatterns.map((p) => {
    const ids = parseInts(p.exampleWords);
    const exampleReconstructions = ids
      .map((id) => exampleById.get(id))
      .filter((w): w is NonNullable<typeof w> => !!w)
      .map((w) => ({
        wordHy: w.wordHy,
        decomposition: w.decomposition,
        meaningHy: w.meaningHy,
        meaningEn: w.meaningEn
      }));
    return {
      code: p.code,
      nameHy: p.nameHy,
      nameEn: p.nameEn,
      templateHy: p.templateHy,
      templateEn: p.templateEn,
      descriptionEn: p.descriptionEn,
      exampleReconstructions
    };
  });

  // User prompt — per-word content.
  const userCtx: WordContext = {
    wordHy: word.wordHy,
    transliteration: word.transliteration,
    decomposition: word.decomposition,
    suffix: classification.suffix,
    shape: classification.shapeGuess,
    category: classification.categoryGuess,
    rootMeanings: orderedRoots.map((r) => ({
      token: r.token,
      glossesHy: parseList(r.meaningHy),
      glossesEn: parseList(r.meaningEn)
    })),
    candidatePatternCodes: candidateCodes
  };

  return {
    version: PROMPT_VERSION,
    systemPrompt: buildSystemPrompt(patternCtx),
    userPrompt: buildUserPrompt(userCtx),
    candidateCodes,
    patternCodesInSystem: allPatterns.map((p) => p.code),
    classification: {
      suffix: classification.suffix,
      shapeGuess: classification.shapeGuess,
      categoryGuess: classification.categoryGuess
    }
  };
}

// ---------------------------------------------------------------------------
// Ad-hoc prompt (public on-demand generation — v2 brief §4 "on-demand
// generation for queries on words not yet seen"). Same pipeline, but takes
// a raw Armenian string rather than a DB Word row: decomposes on the fly,
// classifies, retrieves patterns, builds a prompt. Used by the public
// /decompose page when the user asks for a word we don't have an entry for.
// ---------------------------------------------------------------------------

export type AdHocBuiltPrompt = {
  version: string;
  systemPrompt: string;
  userPrompt: string;
  candidateCodes: string[];
  wordHy: string;
  transliteration: string;
  decomposition: string;
  rootTokens: string[];
  suffix: string | null;
  shapeGuess: string;
  categoryGuess: string | null;
};

export async function buildAdHocPrompt(wordHy: string): Promise<AdHocBuiltPrompt> {
  const cleaned = wordHy.trim().toLowerCase();
  if (!cleaned) throw new Error('empty word');

  const [roots, allPatterns] = await Promise.all([
    prisma.root.findMany({}),
    prisma.pattern.findMany({ orderBy: { code: 'asc' } })
  ]);

  const lookup = buildLookup(
    roots.map((r) => ({
      id: r.id,
      token: r.token,
      length: r.length,
      meaningHy: parseList(r.meaningHy),
      meaningEn: parseList(r.meaningEn)
    }))
  );
  const decomp = decompose(cleaned, lookup);
  if (decomp.parts.length === 0) {
    throw new Error('No SSB roots matched — word cannot be decomposed.');
  }

  const classification = classify({
    word: cleaned,
    rootTokenCount: decomp.parts.length,
    category: null
  });
  const candidates = retrieveCandidates(classification, allPatterns, 3);
  const candidateCodes = candidates.map((c) => c.pattern.code);

  // Pull example reconstructions for every pattern, same way as buildPrompt.
  const exampleIdSet = new Set<number>();
  for (const p of allPatterns) parseInts(p.exampleWords).forEach((id) => exampleIdSet.add(id));
  const exampleWords = exampleIdSet.size
    ? await prisma.word.findMany({
        where: { id: { in: Array.from(exampleIdSet) } },
        select: {
          id: true,
          wordHy: true,
          decomposition: true,
          meaningHy: true,
          meaningEn: true
        }
      })
    : [];
  const exampleById = new Map(exampleWords.map((w) => [w.id, w]));

  const patternCtx: PatternContext[] = allPatterns.map((p) => {
    const ids = parseInts(p.exampleWords);
    return {
      code: p.code,
      nameHy: p.nameHy,
      nameEn: p.nameEn,
      templateHy: p.templateHy,
      templateEn: p.templateEn,
      descriptionEn: p.descriptionEn,
      exampleReconstructions: ids
        .map((id) => exampleById.get(id))
        .filter((w): w is NonNullable<typeof w> => !!w)
        .map((w) => ({
          wordHy: w.wordHy,
          decomposition: w.decomposition,
          meaningHy: w.meaningHy,
          meaningEn: w.meaningEn
        }))
    };
  });

  const userCtx: WordContext = {
    wordHy: cleaned,
    transliteration: transliterate(cleaned),
    decomposition: decomp.canonical,
    suffix: classification.suffix,
    shape: classification.shapeGuess,
    category: classification.categoryGuess,
    rootMeanings: decomp.parts.map((p) => ({
      token: p.token,
      glossesHy: p.meaningHy,
      glossesEn: p.meaningEn
    })),
    candidatePatternCodes: candidateCodes
  };

  return {
    version: PROMPT_VERSION,
    systemPrompt: buildSystemPrompt(patternCtx),
    userPrompt: buildUserPrompt(userCtx),
    candidateCodes,
    wordHy: cleaned,
    transliteration: transliterate(cleaned),
    decomposition: decomp.canonical,
    rootTokens: decomp.parts.map((p) => p.token),
    suffix: classification.suffix,
    shapeGuess: classification.shapeGuess,
    categoryGuess: classification.categoryGuess
  };
}
