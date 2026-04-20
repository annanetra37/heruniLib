import Link from 'next/link';
import type { Locale } from '@/i18n/config';

export default function RootPill({
  token,
  length,
  locale,
  size = 'md'
}: {
  token: string;
  length: 1 | 2 | 3;
  locale: Locale;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass =
    size === 'lg' ? 'text-2xl px-4 py-2' : size === 'sm' ? 'text-sm px-2 py-0.5' : 'text-lg';
  return (
    <Link
      href={`/${locale}/roots/${encodeURIComponent(token)}`}
      className={`root-pill root-pill--len${length} ${sizeClass}`}
      aria-label={`Root ${token}`}
    >
      {token}
    </Link>
  );
}
