import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';

export default async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale });
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-heruni-ink/10 bg-white/40">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 md:flex-row md:items-center">
        <p className="text-xs text-heruni-ink/70">{t('footer.rights', { year })}</p>
        <nav className="flex gap-4 text-xs text-heruni-ink/70">
          <Link href={`/${locale}/privacy`}>{t('footer.privacy')}</Link>
          <Link href={`/${locale}/terms`}>{t('footer.terms')}</Link>
          <Link href={`/${locale}/credits`}>{t('footer.credits')}</Link>
          <Link href={`/${locale}/methodology`}>{t('nav.methodology')}</Link>
        </nav>
      </div>
    </footer>
  );
}
