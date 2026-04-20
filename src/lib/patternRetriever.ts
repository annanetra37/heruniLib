// Pattern retriever (v2 task 3.2).
//
// Given a word's classification and the catalogue of editor-curated Pattern
// rows, return the 2-4 best-fit candidates ranked by a transparent score.
// The ranking rules live here — NOT in the DB — so editors can change
// pattern applies_when rules without a code change and see results reflect.
//
// Score components (summed; higher wins):
//   suffix match    +6  (strongest signal; e.g. -ություն → state_holder)
//   shape match     +4
//   category match  +3
//   pattern has >= 3 examples  +1  (tiebreak: more-exampled patterns are
//                                   safer for the AI because we can ground
//                                   the prompt in them)

import type { Pattern } from '@prisma/client';
import { parseInts } from './prisma';
import type { WordClassification } from './classify';

export type RankedPattern = {
  pattern: Pattern;
  score: number;
  reasons: string[];
};

// The JSON we store in Pattern.appliesWhen. Nothing in the DB enforces this
// shape — editors write free-form JSON in the admin — so we parse
// defensively and treat unknown fields as absent.
type AppliesWhen = {
  suffixes?: unknown;
  categories?: unknown;
  shapes?: unknown;
};

function parseAppliesWhen(raw: string | null | undefined): AppliesWhen {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === 'object') return j as AppliesWhen;
  } catch {
    /* fall through */
  }
  return {};
}

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function rankPatterns(
  classification: WordClassification,
  patterns: Pattern[]
): RankedPattern[] {
  const ranked: RankedPattern[] = patterns.map((p) => {
    const rules = parseAppliesWhen(p.appliesWhen);
    const suffixes = stringArray(rules.suffixes);
    const categories = stringArray(rules.categories);
    const shapes = stringArray(rules.shapes);
    const examples = parseInts(p.exampleWords);

    let score = 0;
    const reasons: string[] = [];

    if (classification.suffix && suffixes.includes(classification.suffix)) {
      score += 6;
      reasons.push(`suffix "${classification.suffix}" matches`);
    }
    if (shapes.includes(classification.shapeGuess)) {
      score += 4;
      reasons.push(`shape "${classification.shapeGuess}" matches`);
    }
    if (
      classification.categoryGuess &&
      categories.includes(classification.categoryGuess)
    ) {
      score += 3;
      reasons.push(`category "${classification.categoryGuess}" matches`);
    }
    if (examples.length >= 3) {
      score += 1;
      reasons.push(`well-exampled (${examples.length})`);
    }

    return { pattern: p, score, reasons };
  });

  // Sort: score desc, then code asc for deterministic ordering.
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.pattern.code.localeCompare(b.pattern.code);
  });

  return ranked;
}

/**
 * Retrieve the top candidate patterns. Always returns at least one entry
 * (falls back to the top-ranked pattern even when score == 0) so the AI
 * engine has *something* to follow; the model's `editor_notes` output can
 * flag "none of these fit".
 */
export function retrieveCandidates(
  classification: WordClassification,
  patterns: Pattern[],
  max = 3
): RankedPattern[] {
  const ranked = rankPatterns(classification, patterns);
  if (ranked.length === 0) return [];
  const strong = ranked.filter((r) => r.score > 0).slice(0, max);
  return strong.length > 0 ? strong : [ranked[0]];
}
