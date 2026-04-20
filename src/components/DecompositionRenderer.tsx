import RootPill from './RootPill';
import type { Locale } from '@/i18n/config';

export type DecompPart = { token: string; length: 1 | 2 | 3 };

export default function DecompositionRenderer({
  parts,
  suffix,
  locale,
  size = 'lg'
}: {
  parts: DecompPart[];
  suffix?: string | null;
  locale: Locale;
  size?: 'md' | 'lg';
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {parts.map((p, i) => (
        <div key={`${p.token}-${i}`} className="flex items-center gap-2">
          <RootPill token={p.token} length={p.length} locale={locale} size={size} />
          {i < parts.length - 1 && <span className="text-heruni-ink/40">•</span>}
        </div>
      ))}
      {suffix ? (
        <>
          <span className="text-heruni-ink/30">+</span>
          <span className={`suffix-pill ${size === 'lg' ? 'text-2xl px-4 py-2' : ''}`}>
            -{suffix}
          </span>
        </>
      ) : null}
    </div>
  );
}
