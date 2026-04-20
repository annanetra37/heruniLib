import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/config';

export default function CreditsPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const hy = locale === 'hy';
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose">
      <h1>{hy ? 'Մասնակցություն' : 'Credits'}</h1>
      <p>
        {hy
          ? 'Այս նախագիծը հիմնվում է Պարիս Հերունիի «Հայերը և հնագույն Հայաստանը» գրքի 2-րդ գլխի վրա: Հերունիի ՏԲ մեթոդաբանությունն առաջ է քաշվել 2000-ականների սկզբին:'
          : 'This project is based on Chapter 2 of Paris Heruni\'s book «Armenians and Ancient Armenia». The SSB methodology was put forward in the early 2000s.'}
      </p>
      <p>
        {hy
          ? 'Բառարանը գործիք է, որ մեթոդը դարձնում է ինտերակտիվ: Մեթոդը հեղինակին է, բառարանը՝ խմբագիրներին:'
          : 'The dictionary is a tool that makes the method interactive. The method belongs to its author; the dictionary to its editors.'}
      </p>
      <p>
        {hy ? 'Կառուցվել է Digishot-ում:' : 'Built at Digishot.'}
      </p>
    </article>
  );
}
