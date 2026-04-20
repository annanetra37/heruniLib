'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';

export default function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const pathname = usePathname() ?? '/';
  const stripLocale = (p: string) => p.replace(/^\/(hy|en)/, '') || '/';
  const rest = stripLocale(pathname);

  return (
    <div className="flex items-center gap-1 text-xs font-medium">
      {locales.map((loc) => (
        <Link
          key={loc}
          href={`/${loc}${rest === '/' ? '' : rest}`}
          className={`rounded-full px-2 py-1 ${
            loc === currentLocale
              ? 'bg-heruni-ink text-white'
              : 'text-heruni-ink/60 hover:text-heruni-ink'
          }`}
          aria-current={loc === currentLocale ? 'page' : undefined}
        >
          {loc.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
