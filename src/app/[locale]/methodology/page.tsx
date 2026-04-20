import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/config';

export default function MethodologyPage({
  params: { locale }
}: {
  params: { locale: Locale };
}) {
  setRequestLocale(locale);
  const content = locale === 'hy' ? HY : EN;
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-heruni">
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </article>
  );
}

const HY = `
<h1>Հերունիի մեթոդ</h1>
<p class="text-sm text-heruni-ink/60">Աղբյուր՝ Պարիս Հերունի, «Հայերը և հնագույն Հայաստանը», գլուխ 2, էջեր 109–119։</p>

<h2>Մեթոդ №1 (էջ 109)</h2>
<p>Տառի իմաստը որոշելու համար՝ հավաքել կարճ, հին բառերի մի ամբողջություն, որոնք պարունակում են այդ տառը, գտնել նրանց իմաստային ընդհանուր հայտարարը. դա է տառի իմաստը։ Հերունին օրինակ է բերում <strong>ձ</strong> տառը, որն օգտագործվում է 15 բառերում (ձի, ձու, ձայն, ձող, ձուկ, ձեռք, ձոր, օձ, ձգել, ձոն, ձագար, տանձ, ընձուղտ, սանձ, բարձր) և եզրակացնում՝ «երկար, երկարավուն»։</p>

<h2>ՏԲ աղյուսակ (էջեր 110–113)</h2>
<p><strong>ՏԲ</strong> (անգլերեն՝ <strong>SSB</strong>) Հերունիի հապավումն է «Տառերի բազմություն»–ի համար՝ նրա իմաստային հիմնարմատների աղյուսակը։ Դա կազմված է 162 միավորից՝ 39 միատառ + 86 երկտառ + 37 եռատառ։ Յուրաքանչյուրին համապատասխանում է հայերեն իմաստների ոչ մեծ բառախումբ:</p>

<h2>Կիրառում (գլուխ 2.7, էջեր 114–119)</h2>
<p>Բառը գրվում է որպես ՏԲ-արմատների հաջորդականություն՝ <strong>•</strong> (գնդիկով) բաժանված, և նրա իմաստը կազմվում է արմատների իմաստներից:</p>

<h2>Կարևոր ծանոթագրություն</h2>
<p>Հերունիի մեթոդը այլընտրանքային ստուգաբանական տեսություն է։ Այն ընդունված չէ հիմնական ակադեմիական ստուգաբանության կողմից։ Յուրաքանչյուր վերականգնված իմաստ ներկայացվում է որպես Հերունիի մեթոդով վերակառուցում, ոչ թե որպես հաստատուն ստուգաբանություն։</p>
`;

const EN = `
<h1>Heruni's Method</h1>
<p class="text-sm text-heruni-ink/60">Source: Paris Heruni, <em>Armenians and Ancient Armenia</em>, Chapter 2, pp. 109–119.</p>

<h2>Method №1 (p. 109)</h2>
<p>To determine the meaning of a letter, collect a set of short, ancient words that contain it and find their common semantic denominator — that is the letter's meaning. Heruni demonstrates with the letter <strong>ձ</strong> across 15 words (ձի, ձու, ձայն, ձող, ձուկ, ձեռք, ձոր, օձ, ձգել, ձոն, ձագար, տանձ, ընձուղտ, սանձ, բարձր), concluding: "long, elongated".</p>

<h2>The SSB Table (pp. 110–113)</h2>
<p><strong>ՏԲ</strong> in Armenian — short for <em>«Տառերի բազմություն»</em>, a "letter-set" — is Heruni's abbreviation for the table of semantic-base letters his method is built on. We translate it as <strong>SSB</strong> (Semantic-Base Set). The table contains 162 entries: 39 single letters + 86 two-letter combinations + 37 three-letter combinations. Each maps to a small cluster of Armenian glosses.</p>

<h2>Application (Chapter 2.7, pp. 114–119)</h2>
<p>A word is written as a sequence of SSB roots separated by <strong>•</strong>; its meaning is composed from the root meanings.</p>

<h2>A note on standing</h2>
<p>Heruni's method is an alternative etymological theory and is <em>not</em> part of mainstream academic etymology. Every reconstructed meaning on this site is labelled as a Heruni-method reconstruction, not a settled etymology.</p>
`;
