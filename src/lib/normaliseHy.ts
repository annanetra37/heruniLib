// Canonical normalisation for Armenian input.
//
// Used at every Word-table read site so user input always matches what
// the admin CMS stored, even when the two differ in:
//   - Case            (Ա vs ա)
//   - Unicode form    (composed NFC vs decomposed NFD — Armenian letters
//                      rarely decompose but macOS text input can produce
//                      decomposed combining sequences)
//   - Surrounding whitespace / zero-width spaces pasted from docx sources
//
// Also applied at admin write sites (admin/words POST + PATCH) so the DB
// stores the canonical form too — new rows can't diverge from the input
// the decompose endpoint will look for.

const ZERO_WIDTH_RE = /[​‌‍‎‏﻿]/g;

export function normaliseHy(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(ZERO_WIDTH_RE, '')
    .normalize('NFC')
    .trim()
    .toLowerCase();
}
