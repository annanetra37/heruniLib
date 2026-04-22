import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import LanguageSwitcher from './LanguageSwitcher';
import { getCurrentVisitor } from '@/lib/visitor';
import HeaderSignoutButton from './HeaderSignoutButton';

export default async function Header({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale });
  const visitor = await getCurrentVisitor();
  const link = (href: string, label: string) => (
    <Link
      key={href}
      href={`/${locale}${href}`}
      className="text-sm font-medium text-heruni-ink/80 transition hover:text-heruni-sun"
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b border-heruni-ink/10 bg-heruni-parchment/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <span className="inline-block h-8 w-8 rounded-full bg-heruni-sun/90 text-center leading-8 text-white">
            Հ
          </span>
          <span className="text-lg font-semibold tracking-tight">{t('brand.name')}</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {link('/roots', t('nav.roots'))}
          {link('/words', t('nav.words'))}
          {link('/patterns', t('nav.patterns'))}
          {link('/decompose', t('nav.home') === 'Home' ? 'Decompose' : 'Վերծանել')}
          {link('/search', t('search.title'))}
          {link('/methodology', t('nav.methodology'))}
          {link('/contribute', t('nav.contribute'))}
        </nav>
        <div className="flex items-center gap-3">
          {visitor && visitor.firstName && (
            <HeaderSignoutButton
              locale={locale}
              firstName={visitor.firstName}
              signedInAsLabel={t('login.signedInAs', { name: visitor.firstName })}
              signOutLabel={t('login.signOut')}
            />
          )}
          <LanguageSwitcher currentLocale={locale} />
        </div>
      </div>
    </header>
  );
}
