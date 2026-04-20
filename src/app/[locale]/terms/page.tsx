import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/config';

export default function TermsPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const hy = locale === 'hy';
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose">
      <h1>{hy ? 'Օգտագործման պայմաններ' : 'Terms of Use'}</h1>
      <p>
        {hy
          ? 'Heruni Dict-ը ներկայացնում է Պարիս Հերունիի ՏԲ մեթոդաբանությամբ կատարված բառի վերականգնումներ։ Վերականգնված իմաստները ոչ թե ընդհանուր ընդունված ստուգաբանություն են, այլ մեկնաբանություններ՝ ըստ Հերունիի մեթոդի։'
          : 'Heruni Dict presents word reconstructions made with Paris Heruni\'s SSB methodology. Reconstructed meanings are not settled etymologies — they are interpretations under Heruni\'s method.'}
      </p>
    </article>
  );
}
