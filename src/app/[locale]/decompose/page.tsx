import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import DecomposeClient from '@/components/DecomposeClient';

export default async function DecomposePage({
  params: { locale },
  searchParams
}: {
  params: { locale: Locale };
  searchParams: { w?: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t('decompose.title')}</h1>
      <p className="mt-2 text-sm text-heruni-ink/60">{t('home.disclaimer')}</p>
      <div className="mt-6">
        <DecomposeClient
          locale={locale}
          initial={searchParams.w ?? ''}
          labels={{
            placeholder: t('decompose.placeholder'),
            button: t('decompose.button'),
            result: t('decompose.result'),
            unmatched: t('decompose.unmatched'),
            automatic: t('decompose.automaticNote'),
            badgeReviewed: t('words.badgeReviewed'),
            badgeAutomatic: t('words.badgeAutomatic'),
            suggest: t('words.suggestCorrection')
          }}
        />
      </div>
    </div>
  );
}
