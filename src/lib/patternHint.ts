// Lightweight, synchronous heuristic that picks a starter pattern code for
// a word based on suffix + category + shape. Intentionally conservative —
// it exists to seed the editorial queue, not to replace editor judgment.
// The full classifier (v2 brief §4.1, task 3.1) will build on this.
//
// Used at two call-sites:
//   - prisma/seed.ts — assign pattern_id to the 80 book-sourced words
//   - admin "Propose pattern" actions — offer a default for unsorted words

export type PatternCode =
  | 'possessive_owner'
  | 'descended_from'
  | 'elevated_status'
  | 'state_holder'
  | 'action_agent'
  | 'place_of'
  | 'descriptive_compound';

export type WordShape = {
  wordHy: string;
  suffix?: string | null;
  category?: string | null;
  rootTokenCount?: number;
};

const STATE_SUFFIXES = new Set(['ություն']);
const AGENT_SUFFIXES = new Set(['իչ', 'ող', 'ցան', 'արար']);
const PLACE_SUFFIXES = new Set(['անոց', 'արան', 'ենիք', 'ստան']);

export function suggestPatternCode(word: WordShape): PatternCode | null {
  const suffix = (word.suffix ?? '').trim();

  if (suffix && STATE_SUFFIXES.has(suffix)) return 'state_holder';
  if (suffix && AGENT_SUFFIXES.has(suffix)) return 'action_agent';
  if (suffix && PLACE_SUFFIXES.has(suffix)) return 'place_of';

  const cat = (word.category ?? '').toLowerCase();
  if (cat === 'abstract') return 'state_holder';
  if (cat === 'geography') return 'place_of';
  if (cat === 'names') return 'descended_from';

  // Multi-root stacks with no suffix look like compounds
  // (արևելք = ԱՐ-ի ելք). One-or-two-root people/things default to
  // elevated_status (հայր, իշխան) which is the book's most common shape.
  if ((word.rootTokenCount ?? 0) >= 3 && !suffix) return 'descriptive_compound';
  if (cat === 'people') return 'elevated_status';

  return null;
}
