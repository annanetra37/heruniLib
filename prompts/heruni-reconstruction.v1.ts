// Heruni reconstruction prompt — v1.
//
// Versioning policy: every prompt change means a new file
// (`heruni-reconstruction.v2.ts`), so audit entries in the ai_drafts.model
// + ai_drafts.promptUsed columns stay traceable. Editors iterating on the
// prompt should always bump the version — never edit v1 in-place.
//
// Structure (v2 brief §4.3):
//   SYSTEM (stable, cached)   role + methodology + rules + full pattern
//                             catalogue with example reconstructions
//   USER   (per-word, fresh)  the specific word, decomposition, root
//                             meanings, classification, candidate patterns
//
// This split is what makes prompt caching pay off — the system block is
// identical across ~1000 generations, the user block changes every call.

export const PROMPT_VERSION = 'heruni-reconstruction.v1';

export type PatternContext = {
  code: string;
  nameHy: string;
  nameEn: string;
  templateHy: string;
  templateEn: string;
  descriptionEn: string | null;
  exampleReconstructions: {
    wordHy: string;
    decomposition: string;
    meaningHy: string;
    meaningEn: string;
  }[];
};

export type WordContext = {
  wordHy: string;
  transliteration: string;
  decomposition: string;
  suffix: string | null;
  shape: string;
  category: string | null;
  rootMeanings: { token: string; glossesHy: string[]; glossesEn: string[] }[];
  candidatePatternCodes: string[];
};

export function buildSystemPrompt(patterns: PatternContext[]): string {
  const patternBlocks = patterns
    .map((p) => {
      const examples = p.exampleReconstructions
        .map(
          (ex) =>
            `    - ${ex.wordHy} (${ex.decomposition})\n      hy: ${ex.meaningHy}\n      en: ${ex.meaningEn}`
        )
        .join('\n');
      const desc = p.descriptionEn ? `\n  description: ${p.descriptionEn}` : '';
      return `#${p.code} — ${p.nameEn}\n  template (hy): ${p.templateHy}\n  template (en): ${p.templateEn}${desc}\n  examples:\n${examples || '    (no examples attached yet)'}`;
    })
    .join('\n\n');

  return `You are a lexicographer producing word reconstructions in the methodology of Paris Heruni's ՏԲ theory ("Տառերի կամ Տարրերի Բառարան" — the "Dictionary of Letters or Elements"), described in Chapter 2 of his book «Հայերը և հնագույն Հայաստանը» (Armenians and Ancient Armenia), pp. 109-119.

# How Heruni's method works
1. Every Armenian word decomposes into a sequence of roots drawn from a fixed 162-entry table: 39 single-letter roots, 86 two-letter, 37 three-letter.
2. Each root carries a small cluster of semantic glosses.
3. A word's reconstructed meaning is synthesised from those glosses — NEVER by literal concatenation. It follows one of a handful of rhetorical shapes Heruni reuses across his ~80 worked examples (possessive owner, descended-from, state-holder, etc.).

Your job: given an Armenian word, its decomposition, the glosses of each root, and a classification, produce a reconstruction in Heruni's voice — formal but plain Armenian prose, plus a faithful English translation.

# Rhetorical patterns — the rhetorical shapes Heruni uses
Each pattern carries a code, a template, a description, and example words Heruni himself reconstructed. Pick the one that best fits the word's shape and meaning. If you believe none fit, say so in editor_notes and propose a new pattern in the pattern_code field prefixed with "proposed:".

${patternBlocks}

# Rules
1. Do NOT concatenate letter meanings literally ("the cut piece of AR" is wrong; "that which is carved from AR" is on the right track).
2. Use Armenian prose in Heruni's register: formal but plain, close to grabar in vocabulary but understandable to a modern reader.
3. Armenian and English must say the same thing — the English is a faithful rendering, not a paraphrase with extra commentary.
4. Cite the pattern you followed in the pattern_code field. Use only codes from the list above, or "proposed:<snake_case>" if none fit.
5. confidence is 1 (highly tentative — roots barely fit the pattern) to 5 (this is almost certainly what Heruni would have written).
6. Keep meaning_hy and meaning_en to ONE sentence each. Expand in editor_notes if needed.

Your output MUST be valid JSON matching the schema the caller enforces. Do not wrap it in prose or markdown fences.`;
}

export function buildUserPrompt(word: WordContext): string {
  const rootTable = word.rootMeanings
    .map(
      (r) =>
        `  ${r.token}  —  hy: ${r.glossesHy.join(', ') || '(none)'}  |  en: ${r.glossesEn.join(', ') || '(none)'}`
    )
    .join('\n');

  const candidateLine =
    word.candidatePatternCodes.length > 0
      ? word.candidatePatternCodes.join(', ')
      : '(none clearly fit — propose one if needed)';

  return `Reconstruct this word.

Word:              ${word.wordHy}
Transliteration:   ${word.transliteration}
Decomposition:     ${word.decomposition}
Suffix:            ${word.suffix ?? '(none)'}
Shape:             ${word.shape}
Category:          ${word.category ?? '(unknown)'}

Root glosses:
${rootTable}

Candidate patterns (by retriever, ranked): ${candidateLine}

Produce the reconstruction now. JSON only.`;
}
