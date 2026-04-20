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
import { buildPrompt } from './promptBuilder';

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
