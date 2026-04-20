import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import SubmissionForm from '@/components/SubmissionForm';

export default async function ContributePage({
  params: { locale },
  searchParams
}: {
  params: { locale: Locale };
  searchParams: { w?: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t('submission.title')}</h1>
      <p className="mt-2 text-sm text-heruni-ink/70">{t('submission.intro')}</p>
      <div className="mt-6">
        <SubmissionForm
          locale={locale}
          initialWord={searchParams.w ?? ''}
          labels={{
            word: t('submission.wordLabel'),
            decomp: t('submission.proposedDecompLabel'),
            meaning: t('submission.proposedMeaningLabel'),
            email: t('submission.emailLabel'),
            submit: t('submission.submit'),
            thanks: t('submission.thanks')
          }}
        />
      </div>
    </div>
  );
}
