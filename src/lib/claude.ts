// Claude API integration (v2 task 3.4).
//
// Wraps the Anthropic SDK with one function — generateHeruniDraft(wordId) —
// that runs the full v2 inference pipeline (classify → retrieve → prompt →
// call Claude → save to ai_drafts).
//
// Design choices:
// - Uses structured outputs (client.messages.parse + zodOutputFormat), so
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
import { z } from 'zod';
import { prisma } from './prisma';
import { buildPrompt, buildAdHocPrompt, type AdHocBuiltPrompt } from './promptBuilder';
import {
  buildClassicalSystemPrompt,
  buildClassicalUserPrompt,
  CLASSICAL_PROMPT_VERSION
} from '../../prompts/classical-etymology.v1';

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
      'ANTHROPIC_API_KEY is not set. Add it to your environment to use the AI inference engine.'
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
        format: {
          type: 'json_schema',
          name: 'heruni_reconstruction',
          schema: zodToJson(DraftSchema)
        }
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
        format: {
          type: 'json_schema',
          name: 'classical_etymology',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['meaning_hy', 'meaning_en', 'sources', 'confidence', 'editor_notes'],
            properties: {
              meaning_hy: { type: 'string' },
              meaning_en: { type: 'string' },
              sources: { type: 'array', items: { type: 'string' } },
              confidence: { type: 'integer', minimum: 1, maximum: 5 },
              editor_notes: { type: 'string' }
            }
          }
        }
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
        format: {
          type: 'json_schema',
          name: 'heruni_reconstruction',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['pattern_code', 'meaning_hy', 'meaning_en', 'confidence', 'editor_notes'],
            properties: {
              pattern_code: { type: 'string' },
              meaning_hy: { type: 'string' },
              meaning_en: { type: 'string' },
              confidence: { type: 'integer', minimum: 1, maximum: 5 },
              editor_notes: { type: 'string' }
            }
          }
        }
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

// Minimal Zod → JSON Schema for our narrow DraftSchema. A full converter
// isn't worth pulling a dependency in — we own every field here.
function zodToJson(_schema: typeof DraftSchema) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['pattern_code', 'meaning_hy', 'meaning_en', 'confidence', 'editor_notes'],
    properties: {
      pattern_code: { type: 'string' },
      meaning_hy: { type: 'string' },
      meaning_en: { type: 'string' },
      confidence: { type: 'integer', minimum: 1, maximum: 5 },
      editor_notes: { type: 'string' }
    }
  } as const;
}
