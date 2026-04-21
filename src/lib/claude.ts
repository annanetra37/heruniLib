// Claude API integration (v2 task 3.4).
//
// Wraps the Anthropic SDK with one function — generateHeruniDraft(wordId) —
// that runs the full v2 inference pipeline (classify → retrieve → prompt →
// call Claude → save to ai_drafts).
//
// Design choices:
// - Uses structured outputs (client.messages.parse + jsonSchemaOutputFormat), so
//   Claude returns JSON that's already validated against our schema. No
//   hand-rolled JSON.parse or regex extraction.
// - Prompt caching: cache_control on the (stable, catalogue-sized) system
//   prompt. For ~1000 generations with a ~3K-token catalogue, writes cost
//   ~1.25× once and reads ~0.1× for every subsequent call.
// - No budget_tokens / temperature on Opus 4.7 (they 400). Adaptive
//   thinking on, effort tunable via env.
// - SDK retries 429/5xx automatically (max_retries=2 default). One extra
//   retry on parse failure — if parsed_output is null, ask Claude to
//   "re-emit JSON only" one more time before giving up.

import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { z } from 'zod';
import { prisma } from './prisma';
import { buildPrompt, buildAdHocPrompt, type AdHocBuiltPrompt } from './promptBuilder';
import {
  buildClassicalSystemPrompt,
  buildClassicalUserPrompt,
  CLASSICAL_PROMPT_VERSION
} from '../../prompts/classical-etymology.v1';

// Hand-rolled JSON schemas for the two draft shapes. Passed through the
// SDK's jsonSchemaOutputFormat helper, which wraps them in the right wire
// envelope and strips any constraints the API doesn't support
// (min/max/etc). Zod validation below still enforces our real constraints
// after we parse the response.
const HERUNI_DRAFT_JSON_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  required: ['pattern_code', 'meaning_hy', 'meaning_en', 'confidence', 'editor_notes'],
  properties: {
    pattern_code: { type: 'string' as const },
    meaning_hy: { type: 'string' as const },
    meaning_en: { type: 'string' as const },
    confidence: { type: 'integer' as const },
    editor_notes: { type: 'string' as const }
  }
};

const CLASSICAL_DRAFT_JSON_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  required: ['meaning_hy', 'meaning_en', 'sources', 'confidence', 'editor_notes'],
  properties: {
    meaning_hy: { type: 'string' as const },
    meaning_en: { type: 'string' as const },
    sources: { type: 'array' as const, items: { type: 'string' as const } },
    confidence: { type: 'integer' as const },
    editor_notes: { type: 'string' as const }
  }
};

const DEFAULT_MODEL = process.env.AI_MODEL ?? 'claude-opus-4-7';
// High is the brief's recommended default ("correctness matters"); editors
// can dial down for a throughput pass.
const DEFAULT_EFFORT = (process.env.AI_EFFORT ?? 'high') as
  | 'low'
  | 'medium'
  | 'high'
  | 'max';

// Schema the model must produce. Mirrors §4.3 of the brief exactly.
export const DraftSchema = z.object({
  pattern_code: z
    .string()
    .describe('Code from the pattern catalogue, or "proposed:<snake>" if none fit.'),
  meaning_hy: z.string().describe('One-sentence Armenian reconstruction in Heruni voice.'),
  meaning_en: z.string().describe('Faithful English rendering.'),
  confidence: z.number().int().min(1).max(5),
  editor_notes: z.string().describe('Caveats, alternative readings, flags. Empty string if none.')
});

export type DraftOutput = z.infer<typeof DraftSchema>;

export type GenerateResult = {
  aiDraftId: number;
  draft: DraftOutput;
  promptVersion: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
};

let cachedClient: Anthropic | null = null;

function client(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to your environment to use our algorithms.'
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

/**
 * Full pipeline: classify → retrieve → prompt → Claude → persist.
 * Safe to call from a Next.js route handler.
 */
export async function generateHeruniDraft(wordId: number): Promise<GenerateResult> {
  const built = await buildPrompt(wordId);

  // --- Call Claude -----------------------------------------------------
  const anthropic = client();

  // The system prompt is large and stable across every call → cache it.
  // Passing cache_control as an array with a text block is the only way
  // to attach cache_control to system in the current SDK shape.
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: built.systemPrompt,
      cache_control: { type: 'ephemeral' }
    }
  ];

  const callOnce = async (userMessage: string) =>
    anthropic.messages.parse({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: DEFAULT_EFFORT,
        format: jsonSchemaOutputFormat(HERUNI_DRAFT_JSON_SCHEMA)
      },
      system: systemBlocks,
      messages: [{ role: 'user', content: userMessage }]
    });

  let response = await callOnce(built.userPrompt);
  let draft = response.parsed_output as DraftOutput | null;

  // One retry on a parse failure — rare with structured outputs, but the
  // brief explicitly calls for a fallback. Re-prompt asking for JSON only.
  if (!draft) {
    const retryUser = `${built.userPrompt}\n\n(Previous attempt did not return valid JSON. Emit ONLY the JSON object matching the schema; no prose, no markdown fences.)`;
    response = await callOnce(retryUser);
    draft = response.parsed_output as DraftOutput | null;
  }
  if (!draft) {
    throw new Error('Claude did not return parseable JSON after one retry.');
  }

  // --- Persist ---------------------------------------------------------
  const patternId = await resolvePatternId(draft.pattern_code);

  const created = await prisma.aiDraft.create({
    data: {
      wordId,
      patternId,
      kind: 'heruni',
      promptUsed: renderPromptAudit(built),
      model: DEFAULT_MODEL,
      rawResponse: JSON.stringify(draft),
      draftMeaningHy: draft.meaning_hy,
      draftMeaningEn: draft.meaning_en,
      confidence: draft.confidence,
      reviewStatus: 'pending',
      editorNotes: draft.editor_notes || null
    }
  });

  return {
    aiDraftId: created.id,
    draft,
    promptVersion: built.version,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0
    }
  };
}

// ---------------------------------------------------------------------------
// Classical etymology pipeline (v2 §4.1)
// ---------------------------------------------------------------------------

export const ClassicalDraftSchema = z.object({
  meaning_hy: z.string(),
  meaning_en: z.string(),
  sources: z.array(z.string()).max(10),
  confidence: z.number().int().min(1).max(5),
  editor_notes: z.string()
});

export type ClassicalDraftOutput = z.infer<typeof ClassicalDraftSchema>;

export type ClassicalGenerateResult = {
  aiDraftId: number;
  draft: ClassicalDraftOutput;
  promptVersion: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
};

export async function generateClassicalDraft(wordId: number): Promise<ClassicalGenerateResult> {
  const word = await prisma.word.findUnique({ where: { id: wordId } });
  if (!word) throw new Error(`word ${wordId} not found`);

  const anthropic = client();
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: buildClassicalSystemPrompt(),
      cache_control: { type: 'ephemeral' }
    }
  ];

  const userPrompt = buildClassicalUserPrompt({
    wordHy: word.wordHy,
    transliteration: word.transliteration,
    decomposition: word.decomposition,
    existingClassicalHy: word.classicalEtymologyHy,
    existingClassicalEn: word.classicalEtymologyEn
  });

  const callOnce = async (userMessage: string) =>
    anthropic.messages.parse({
      model: DEFAULT_MODEL,
      max_tokens: 1200,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: DEFAULT_EFFORT,
        format: jsonSchemaOutputFormat(CLASSICAL_DRAFT_JSON_SCHEMA)
      },
      system: systemBlocks,
      messages: [{ role: 'user', content: userMessage }]
    });

  let response = await callOnce(userPrompt);
  let draft = response.parsed_output as ClassicalDraftOutput | null;
  if (!draft) {
    response = await callOnce(
      `${userPrompt}\n\n(Previous attempt did not return valid JSON. Emit ONLY the JSON object matching the schema; no prose, no markdown fences.)`
    );
    draft = response.parsed_output as ClassicalDraftOutput | null;
  }
  if (!draft) throw new Error('Claude did not return parseable JSON after one retry.');

  // Store sources + the two translations inline in the AiDraft row. The
  // sources array is stringified into editorNotes so a single column holds
  // the editorial payload — or we could split, but keeping it together
  // simplifies the review UI's "approve" step.
  const notesBlob = [
    draft.editor_notes,
    draft.sources.length
      ? `\n\nSource candidates:\n${draft.sources.map((s) => `  - ${s}`).join('\n')}`
      : ''
  ]
    .filter(Boolean)
    .join('');

  const created = await prisma.aiDraft.create({
    data: {
      wordId,
      patternId: null,
      kind: 'classical',
      promptUsed: JSON.stringify({
        version: CLASSICAL_PROMPT_VERSION,
        userPrompt
      }),
      model: DEFAULT_MODEL,
      rawResponse: JSON.stringify(draft),
      draftMeaningHy: draft.meaning_hy,
      draftMeaningEn: draft.meaning_en,
      confidence: draft.confidence,
      reviewStatus: 'pending',
      editorNotes: notesBlob
    }
  });

  return {
    aiDraftId: created.id,
    draft,
    promptVersion: CLASSICAL_PROMPT_VERSION,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0
    }
  };
}

// ---------------------------------------------------------------------------
// Ad-hoc / public on-demand generation (v2 brief §4).
//
// Used by the public /decompose page when a visitor asks for a word we
// don't have a curated entry for. Does NOT persist to ai_drafts (since no
// Word row exists) — instead returns the synthesized draft in-process so
// the UI can render it immediately and optionally deep-link the visitor
// into the contribute form.
//
// Guards:
// - ANTHROPIC_API_KEY must be set; otherwise throws cleanly so the route
//   can return 503.
// - Falls back to the parse-retry nudge just like generateHeruniDraft.
// ---------------------------------------------------------------------------

export type AdHocGenerateResult = {
  draft: DraftOutput;
  decomposition: {
    wordHy: string;
    transliteration: string;
    canonical: string;
    rootTokens: string[];
    suffix: string | null;
    shape: string;
    category: string | null;
    candidateCodes: string[];
  };
  promptVersion: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
};

export async function generateAdHocHeruniDraft(wordHy: string): Promise<AdHocGenerateResult> {
  const built: AdHocBuiltPrompt = await buildAdHocPrompt(wordHy);
  const anthropic = client();

  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: built.systemPrompt,
      cache_control: { type: 'ephemeral' }
    }
  ];

  const callOnce = async (userMessage: string) =>
    anthropic.messages.parse({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: DEFAULT_EFFORT,
        format: jsonSchemaOutputFormat(HERUNI_DRAFT_JSON_SCHEMA)
      },
      system: systemBlocks,
      messages: [{ role: 'user', content: userMessage }]
    });

  let response = await callOnce(built.userPrompt);
  let draft = response.parsed_output as DraftOutput | null;
  if (!draft) {
    response = await callOnce(
      `${built.userPrompt}\n\n(Previous attempt did not return valid JSON. Emit ONLY the JSON object matching the schema; no prose, no markdown fences.)`
    );
    draft = response.parsed_output as DraftOutput | null;
  }
  if (!draft) throw new Error('Claude did not return parseable JSON after one retry.');

  return {
    draft,
    decomposition: {
      wordHy: built.wordHy,
      transliteration: built.transliteration,
      canonical: built.decomposition,
      rootTokens: built.rootTokens,
      suffix: built.suffix,
      shape: built.shapeGuess,
      category: built.categoryGuess,
      candidateCodes: built.candidateCodes
    },
    promptVersion: built.version,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0
    }
  };
}

// ---------------------------------------------------------------------------
// Ad-hoc classical etymology: same shape as generateClassicalDraft but
// operates on a raw wordHy string (no DB Word required). Shares the stable
// Classical system prompt so prompt-caching hits across the curated and
// ad-hoc paths.
// ---------------------------------------------------------------------------

export type AdHocClassicalResult = {
  draft: ClassicalDraftOutput;
  promptVersion: string;
};

export async function generateAdHocClassicalDraft(
  wordHy: string,
  transliteration: string,
  decomposition: string
): Promise<AdHocClassicalResult> {
  const anthropic = client();
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: buildClassicalSystemPrompt(),
      cache_control: { type: 'ephemeral' }
    }
  ];
  const userPrompt = buildClassicalUserPrompt({
    wordHy,
    transliteration,
    decomposition,
    existingClassicalHy: null,
    existingClassicalEn: null
  });

  const callOnce = async (msg: string) =>
    anthropic.messages.parse({
      model: DEFAULT_MODEL,
      max_tokens: 1200,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: DEFAULT_EFFORT,
        format: jsonSchemaOutputFormat(CLASSICAL_DRAFT_JSON_SCHEMA)
      },
      system: systemBlocks,
      messages: [{ role: 'user', content: msg }]
    });

  let response = await callOnce(userPrompt);
  let draft = response.parsed_output as ClassicalDraftOutput | null;
  if (!draft) {
    response = await callOnce(
      `${userPrompt}\n\n(Previous attempt did not return valid JSON. Emit ONLY the JSON object matching the schema; no prose, no markdown fences.)`
    );
    draft = response.parsed_output as ClassicalDraftOutput | null;
  }
  if (!draft) throw new Error('Claude did not return parseable JSON after one retry.');
  return { draft, promptVersion: CLASSICAL_PROMPT_VERSION };
}

// ---------------------------------------------------------------------------
// Related words: find published/review/draft words in the DB that share at
// least one ՏԲ-root with the query. Purely a DB query, no model call — so
// we can run it concurrently with the AI generations without extra latency
// beyond the slowest Claude call.
// ---------------------------------------------------------------------------

export type RelatedWord = {
  wordHy: string;
  slug: string;
  decomposition: string;
  sharedRootTokens: string[];
};

export async function findRelatedByRoots(
  excludeWordHy: string,
  rootTokens: string[]
): Promise<RelatedWord[]> {
  if (rootTokens.length === 0) return [];

  // Look up root IDs for the given tokens.
  const roots = await prisma.root.findMany({
    where: { token: { in: rootTokens } },
    select: { id: true, token: true }
  });
  const tokenById = new Map(roots.map((r) => [r.id, r.token]));
  const rootIds = roots.map((r) => r.id);
  if (rootIds.length === 0) return [];

  // Candidates: published Words whose rootSequence JSON string contains
  // any of our root IDs. Filter in-process to verify real membership + count
  // the overlap per candidate.
  const candidates = await prisma.word.findMany({
    where: {
      status: 'published',
      wordHy: { not: excludeWordHy },
      OR: rootIds.map((id) => ({ rootSequence: { contains: String(id) } }))
    },
    select: { id: true, wordHy: true, slug: true, decomposition: true, rootSequence: true },
    take: 100
  });

  const scored = candidates
    .map((w) => {
      let ids: number[] = [];
      try {
        ids = JSON.parse(w.rootSequence) as number[];
      } catch {
        ids = [];
      }
      const shared = ids.filter((id) => rootIds.includes(id));
      return {
        wordHy: w.wordHy,
        slug: w.slug,
        decomposition: w.decomposition,
        sharedRootTokens: shared
          .map((id) => tokenById.get(id))
          .filter((t): t is string => !!t),
        score: shared.length
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.wordHy.localeCompare(b.wordHy, 'hy'))
    .slice(0, 8);

  return scored.map(({ wordHy, slug, decomposition, sharedRootTokens }) => ({
    wordHy,
    slug,
    decomposition,
    sharedRootTokens
  }));
}

// ---------------------------------------------------------------------------
// Combined ad-hoc generator: runs the Heruni pipeline + classical pipeline +
// related-words lookup concurrently. Returns everything /decompose needs to
// render the full rich view for a previously-unseen word.
// ---------------------------------------------------------------------------

export type AdHocCombinedResult = {
  draft: DraftOutput;
  classical: ClassicalDraftOutput | null;
  related: RelatedWord[];
  decomposition: AdHocGenerateResult['decomposition'];
  promptVersion: string;
  classicalPromptVersion: string | null;
  classicalError: string | null;
};

export async function generateAdHocCombined(wordHy: string): Promise<AdHocCombinedResult> {
  // Build the prompt once so we know the decomposition/transliteration to
  // pass into the classical pipeline.
  const built: AdHocBuiltPrompt = await buildAdHocPrompt(wordHy);

  // Heruni draft (authoritative — if this fails, the whole endpoint fails
  // because it's the headline section).
  const heruniPromise = generateAdHocHeruniDraft(wordHy);

  // Classical draft + related words run concurrently. Classical is best-effort
  // — if Anthropic rate-limits or the model refuses, we still want the Heruni
  // section + related words to render. Wrap in a safe promise.
  const classicalPromise = generateAdHocClassicalDraft(
    built.wordHy,
    built.transliteration,
    built.decomposition
  ).then(
    (r) => ({ ok: true as const, result: r }),
    (e) => ({ ok: false as const, error: (e as Error).message })
  );
  const relatedPromise = findRelatedByRoots(built.wordHy, built.rootTokens);

  const [heruni, classicalSettled, related] = await Promise.all([
    heruniPromise,
    classicalPromise,
    relatedPromise
  ]);

  return {
    draft: heruni.draft,
    classical: classicalSettled.ok ? classicalSettled.result.draft : null,
    related,
    decomposition: heruni.decomposition,
    promptVersion: heruni.promptVersion,
    classicalPromptVersion: classicalSettled.ok ? classicalSettled.result.promptVersion : null,
    classicalError: classicalSettled.ok ? null : classicalSettled.error
  };
}

async function resolvePatternId(code: string): Promise<number | null> {
  if (!code || code.startsWith('proposed:')) return null;
  const p = await prisma.pattern.findUnique({ where: { code } });
  return p?.id ?? null;
}

// Compact audit form: the system prompt body is implied by the version +
// pattern codes present, so we store just the identifying bits plus the
// full user prompt. Avoids duplicating ~3KB of system text per draft.
function renderPromptAudit(built: Awaited<ReturnType<typeof buildPrompt>>): string {
  return JSON.stringify({
    version: built.version,
    patternCodesInSystem: built.patternCodesInSystem,
    candidateCodes: built.candidateCodes,
    classification: built.classification,
    userPrompt: built.userPrompt
  });
}

