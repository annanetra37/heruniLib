// Minimal word-level diff for editor prose.
//
// The v2 brief (§4.3) wants a side-by-side draft/final view with
// highlighting. Full LCS is overkill for one-sentence reconstructions —
// we compute token-level matches via the O(mn) LCS DP, then walk the
// tables to produce a sequence of {type, text} segments suitable for
// rendering.
//
// Tokens include punctuation and whitespace so the rendered diff looks
// exactly like the originals with only the changed words coloured.

export type DiffSegment = {
  type: 'equal' | 'removed' | 'added';
  text: string;
};

const TOKEN_REGEX = /[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu;

function tokenize(s: string): string[] {
  return s.match(TOKEN_REGEX) ?? [];
}

export function diffWords(a: string | null | undefined, b: string | null | undefined): DiffSegment[] {
  const A = tokenize(a ?? '');
  const B = tokenize(b ?? '');
  const m = A.length;
  const n = B.length;

  // LCS length table.
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack.
  const out: DiffSegment[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (A[i - 1] === B[j - 1]) {
      out.push({ type: 'equal', text: A[i - 1] });
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      out.push({ type: 'removed', text: A[i - 1] });
      i -= 1;
    } else {
      out.push({ type: 'added', text: B[j - 1] });
      j -= 1;
    }
  }
  while (i > 0) out.push({ type: 'removed', text: A[(i -= 1)] });
  while (j > 0) out.push({ type: 'added', text: B[(j -= 1)] });
  out.reverse();

  // Coalesce adjacent segments of the same type for tighter markup.
  const coalesced: DiffSegment[] = [];
  for (const seg of out) {
    const last = coalesced[coalesced.length - 1];
    if (last && last.type === seg.type) last.text += seg.text;
    else coalesced.push({ ...seg });
  }
  return coalesced;
}

/** Ratio 0..1 of how much the editor changed — 0 = rubber-stamped, 1 = rewritten. */
export function editDistance(a: string | null | undefined, b: string | null | undefined): number {
  const segs = diffWords(a, b);
  let kept = 0;
  let changed = 0;
  for (const s of segs) {
    if (s.type === 'equal') kept += s.text.length;
    else changed += s.text.length;
  }
  const total = kept + changed;
  return total === 0 ? 0 : changed / total;
}
