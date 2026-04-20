// Minimal markdown → HTML converter used for editor-entered prose fields
// (classical_etymology, historical_usage, cultural_notes). Supports:
//   **bold** / __bold__
//   *italic* / _italic_
//   inline `code`
//   [link](href) — external links only; href is html-escaped and checked
//   blank line → paragraph break
//   single newline → <br>
//
// We intentionally do NOT pull in a full markdown library: editorial prose
// here is short, bounded, and the output is server-rendered so the cost of
// a real parser isn't justified. The converter escapes HTML first, so user
// input can never inject tags.

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ESCAPE[c] ?? c);
}

function safeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^(https?:|\/|#|mailto:)/i.test(trimmed)) return null;
  return escapeHtml(trimmed);
}

function applyInline(text: string): string {
  // Order matters — bold before italic, else the single-char forms would
  // gobble the double-char markers.
  let out = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links: we do this on already-escaped text; re-escape is fine since we
  // only emit known-safe characters.
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => {
    const h = safeHref(href);
    if (!h) return `[${label}](${href})`;
    return `<a href="${h}" target="_blank" rel="noopener noreferrer" class="underline decoration-heruni-sun/60 hover:decoration-heruni-sun">${label}</a>`;
  });
  return out;
}

export function markdownToHtml(input: string | null | undefined): string {
  if (!input) return '';
  const escaped = escapeHtml(input.trim());
  const paragraphs = escaped.split(/\n\s*\n/);
  return paragraphs
    .map((p) => {
      const withBreaks = p.replace(/\n/g, '<br/>');
      return `<p class="mb-3 last:mb-0 leading-relaxed">${applyInline(withBreaks)}</p>`;
    })
    .join('');
}
