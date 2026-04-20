// Word classifier (v2 task 3.1).
//
// Given an Armenian word plus whatever editor context we have, return a
// plain classification object the AI inference engine and pattern retriever
// can reason about:
//
//   { suffix, shapeGuess, categoryGuess }
//
// Heuristic-only — no DB calls. Deliberately conservative: we prefer null
// over guessing when signals are weak, because downstream code already
// treats absent fields as "no hint" rather than a hard constraint.

import { stripSuffix } from './decompose';

export type ShapeGuess =
  | 'abstract-noun' //   ends in -ություն
  | 'agent-noun' //      ends in -իչ / -ող / -ցան / -արար
  | 'place-noun' //      ends in -անոց / -արան / -ենիք / -ստան
  | 'descriptor-noun' // ends in -ական / -ային
  | 'diminutive' //      ends in -իկ / -ակ
  | 'compound' //        multi-root stem, no known suffix
  | 'proper-name' //     initial capital letter
  | 'simple'; //         single- or two-root stem with no known suffix

export type CategoryGuess =
  | 'people'
  | 'animals'
  | 'astronomy'
  | 'nature'
  | 'names'
  | 'geography'
  | 'abstract'
  | 'tools'
  | 'other';

export type WordClassification = {
  suffix: string | null;
  shapeGuess: ShapeGuess;
  categoryGuess: CategoryGuess | null;
  rootTokenCount: number;
  isProperName: boolean;
};

// Suffix → canonical shape. Captures the cases the brief explicitly calls out
// (§4.1: "-ություն → abstract, -իչ → agent, -ական → descriptor, -արան →
// place, -անոց → place").
const SUFFIX_SHAPE: Record<string, ShapeGuess> = {
  'ություն': 'abstract-noun',
  'ություններ': 'abstract-noun',
  'իչ': 'agent-noun',
  'ող': 'agent-noun',
  'ցան': 'agent-noun',
  'արար': 'agent-noun',
  'անոց': 'place-noun',
  'արան': 'place-noun',
  'ենիք': 'place-noun',
  'ստան': 'place-noun',
  'ական': 'descriptor-noun',
  'ային': 'descriptor-noun',
  'իկ': 'diminutive',
  'ակ': 'diminutive'
};

// Suffix → category hint (feeds into pattern retriever).
const SUFFIX_CATEGORY: Record<string, CategoryGuess> = {
  'ություն': 'abstract',
  'ություններ': 'abstract',
  'իչ': 'people',
  'ող': 'people',
  'ցան': 'people',
  'անոց': 'geography',
  'արան': 'geography',
  'ենիք': 'geography',
  'ստան': 'geography'
};

// Check whether the FIRST character of the word is an uppercase Armenian
// letter. Armenian has distinct upper/lower forms; a proper name is usually
// written with the initial character in capital (Ա, Տ, Հ…) when taken out
// of a sentence. In DB storage we lowercase aggressively, so this check is
// mostly useful when an editor passes the raw surface form.
function startsWithCapital(word: string): boolean {
  const first = word[0];
  if (!first) return false;
  // Armenian uppercase block: U+0531..U+0556
  const code = first.codePointAt(0) ?? 0;
  return code >= 0x0531 && code <= 0x0556;
}

/**
 * Classify a word. `rootTokenCount` is required (best signal for "compound"
 * vs "simple") — callers usually already have the decomposition handy.
 * Pass `category` when an editor has set one; it's a strong prior.
 */
export function classify(input: {
  word: string;
  rootTokenCount: number;
  category?: string | null;
}): WordClassification {
  const { word, rootTokenCount } = input;
  const { suffix } = stripSuffix(word);

  // Shape: suffix wins, then compound-vs-simple, then proper-name fallback.
  let shapeGuess: ShapeGuess;
  if (suffix && SUFFIX_SHAPE[suffix]) {
    shapeGuess = SUFFIX_SHAPE[suffix];
  } else if (startsWithCapital(word)) {
    shapeGuess = 'proper-name';
  } else if (rootTokenCount >= 3) {
    shapeGuess = 'compound';
  } else {
    shapeGuess = 'simple';
  }

  // Category guess: editor-provided wins; otherwise derive from suffix or
  // fall back to null (better to admit ignorance than guess "other").
  let categoryGuess: CategoryGuess | null = null;
  const rawCat = (input.category ?? '').toLowerCase().trim();
  if (isCategory(rawCat)) {
    categoryGuess = rawCat;
  } else if (suffix && SUFFIX_CATEGORY[suffix]) {
    categoryGuess = SUFFIX_CATEGORY[suffix];
  } else if (shapeGuess === 'proper-name') {
    categoryGuess = 'names';
  }

  return {
    suffix,
    shapeGuess,
    categoryGuess,
    rootTokenCount,
    isProperName: shapeGuess === 'proper-name'
  };
}

function isCategory(s: string): s is CategoryGuess {
  return (
    s === 'people' ||
    s === 'animals' ||
    s === 'astronomy' ||
    s === 'nature' ||
    s === 'names' ||
    s === 'geography' ||
    s === 'abstract' ||
    s === 'tools' ||
    s === 'other'
  );
}
