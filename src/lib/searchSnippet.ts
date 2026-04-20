// Snippet extraction with highlighting — used by the v2 search API (§5.1).
//
// Takes a field text and the search query; returns a short excerpt around
// the first match with <mark> tags wrapping every case-insensitive
// occurrence. Returns null when no match (caller decides whether to skip
// the field or fall back to the untruncated text).

const MAX_SNIPPET_LEN = 160;
const CONTEXT_CHARS = 50;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function snippet(text: string | null | undefined, q: string): string | null {
  if (!text || !q) return null;
  const hay = text;
  const lower = hay.toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx === -1) return null;

  const start = Math.max(0, idx - CONTEXT_CHARS);
  const end = Math.min(hay.length, idx + needle.length + CONTEXT_CHARS);
  let slice = hay.slice(start, end);
  if (start > 0) slice = '…' + slice;
  if (end < hay.length) slice = slice + '…';
  if (slice.length > MAX_SNIPPET_LEN + 2) {
    slice = slice.slice(0, MAX_SNIPPET_LEN) + '…';
  }

  const escaped = escapeHtml(slice);
  const highlighted = escaped.replace(
    new RegExp(escapeRegex(escapeHtml(q)), 'gi'),
    (m) => `<mark class="bg-heruni-amber/40 text-heruni-ink rounded px-0.5">${m}</mark>`
  );
  return highlighted;
}
