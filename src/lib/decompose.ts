// Greedy longest-match decomposer against the SSB root table.
// Implements sprint-plan tasks 3.5 (admin helper) and 4.3 (on-the-fly decomposer).
// Per the brief: prefer 3-letter, then 2-letter, then 1-letter matches.
// Suffix (-ություն, -ոտ, -ային, -ներ, …) is stripped before matching and
// returned separately so the UI can render it in a muted style.

export type Candidate = {
  rootId: number;
  token: string;
  length: number;
  meaningHy: string[];
  meaningEn: string[];
};

export type DecomposeResult = {
  word: string;
  stem: string;
  suffix: string | null;
  parts: Candidate[];
  /** Canonical dotted form of parts, e.g. "ի • շ • խ • ան". */
  canonical: string;
  /** Slice of `word` that the decomposer couldn't match against any root. */
  unmatched: string;
};

// Known inflectional / derivational suffixes to peel first.
// Order matters: longest first.
const SUFFIXES = [
  'ություն',
  'ություններ',
  'ներին',
  'ներից',
  'ներով',
  'ներում',
  'ներուս',
  'ներդ',
  'ներս',
  'ները',
  'ներ',
  'ային',
  'ովին',
  'ությամբ',
  'ական',
  'ակ',
  'իկ',
  'ոտ',
  'ում',
  'ով',
  'ից',
  'ին',
  'ն'
];

export function stripSuffix(word: string): { stem: string; suffix: string | null } {
  const w = word.toLowerCase();
  for (const sfx of SUFFIXES) {
    if (w.length > sfx.length + 1 && w.endsWith(sfx)) {
      return { stem: w.slice(0, -sfx.length), suffix: sfx };
    }
  }
  return { stem: w, suffix: null };
}

type RootLookup = {
  byLength: { 3: Map<string, Candidate>; 2: Map<string, Candidate>; 1: Map<string, Candidate> };
};

export function buildLookup(
  roots: { id: number; token: string; length: number; meaningHy: string[]; meaningEn: string[] }[]
): RootLookup {
  const out: RootLookup = {
    byLength: { 3: new Map(), 2: new Map(), 1: new Map() }
  };
  for (const r of roots) {
    if (r.length !== 1 && r.length !== 2 && r.length !== 3) continue;
    out.byLength[r.length as 1 | 2 | 3].set(r.token.toLowerCase(), {
      rootId: r.id,
      token: r.token,
      length: r.length,
      meaningHy: r.meaningHy,
      meaningEn: r.meaningEn
    });
  }
  return out;
}

export function decompose(word: string, lookup: RootLookup): DecomposeResult {
  const { stem, suffix } = stripSuffix(word);
  const parts: Candidate[] = [];
  let i = 0;
  let unmatched = '';
  while (i < stem.length) {
    let hit: Candidate | undefined;
    for (const len of [3, 2, 1] as const) {
      if (i + len > stem.length) continue;
      const slice = stem.slice(i, i + len);
      const m = lookup.byLength[len].get(slice);
      if (m) {
        hit = m;
        break;
      }
    }
    if (!hit) {
      unmatched += stem[i];
      i += 1;
      continue;
    }
    parts.push(hit);
    i += hit.length;
  }
  const canonical = parts.map((p) => p.token).join(' • ');
  return { word, stem, suffix, parts, canonical, unmatched };
}
