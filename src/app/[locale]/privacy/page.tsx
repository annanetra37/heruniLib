import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/config';

export default function PrivacyPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const hy = locale === 'hy';
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose">
      <h1>{hy ? 'Գաղտնիության քաղաքականություն' : 'Privacy Policy'}</h1>
      <p>
        {hy
          ? 'Մենք հավաքագրում ենք միայն այն էլ. հասցեն, որն ինքներդ մուտքագրում եք ձեր բառային ներկայացման ձևաթղթում: Այն օգտագործվում է միայն ձեր հետ կապ հաստատելու համար, երբ խմբագիրը վերանայում է ներկայացումը:'
          : 'We collect only the email address you supply on a word-submission form. It is used solely to contact you about your submission.'}
      </p>
      <p>
        {hy
          ? 'Սա v1.0 վարկածի գաղտնիության հակիրճ մտորում է: Պատրաստվում է ամբողջական քաղաքականությունը Sprint 6-ում:'
          : 'This is a brief v1.0 privacy notice. A full policy ships with Sprint 6 launch.'}
      </p>
    </article>
  );
}
