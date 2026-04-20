// Armenian → Latin transliteration.
// Per the brief §5.2, slugs use this so URLs don't get mangled in browsers
// that choke on native Armenian path segments.
// Scheme: loose "Western/Eastern mixed" reading geared at readability, not ISO-9985.
// (An editor can override the `transliteration` and `slug` on any word from the CMS.)

const MAP: Record<string, string> = {
  ա: 'a', բ: 'b', գ: 'g', դ: 'd', ե: 'e', զ: 'z', է: 'e', ը: 'y',
  թ: 't', ժ: 'zh', ի: 'i', լ: 'l', խ: 'kh', ծ: 'ts', կ: 'k', հ: 'h',
  ձ: 'dz', ղ: 'gh', ճ: 'ch', մ: 'm', յ: 'y', ն: 'n', շ: 'sh', ո: 'o',
  չ: 'ch', պ: 'p', ջ: 'j', ռ: 'r', ս: 's', վ: 'v', տ: 't', ր: 'r',
  ց: 'ts', ու: 'u', փ: 'p', ք: 'k', և: 'ev', օ: 'o', ֆ: 'f'
};

export function transliterate(s: string): string {
  const lower = s.toLowerCase();
  let out = '';
  for (let i = 0; i < lower.length; i++) {
    const two = lower.slice(i, i + 2);
    if (two === 'ու') {
      out += 'u';
      i++;
      continue;
    }
    const ch = lower[i];
    out += MAP[ch] ?? ch;
  }
  return out;
}

export function toSlug(s: string): string {
  return transliterate(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
