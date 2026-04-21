import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/config';

export default function CreditsPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const content = locale === 'hy' ? HY : EN;
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-heruni">
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </article>
  );
}

const HY = `
<h1>Մասնակցություն</h1>

<h2>Աղբյուր</h2>
<blockquote>
  Հերունի, Պարիս Մ. <strong>«Հայերը և հնագույն Հայաստանը»</strong>.
  Առաջին հրատարակություն, 2004. Գլուխ 2 (էջեր 109–119) — ՏԲ մեթոդը:
</blockquote>
<p>Այս բառարանի ամբողջ իմաստային կառուցվածքը՝ 162 միավոր ՏԲ աղյուսակը, ~80 օրինակ վերծանումները և Հերունի-ոճով ընդարձակման սկզբունքները, գալիս են այդ գրքից: Մենք կիրառում ենք Հերունիի մեթոդը. մեթոդը հեղինակին է, բառարանի ընտրությունը՝ խմբագիրներին:</p>

<h2>Դասական ստուգաբանություն</h2>
<ul>
  <li>Հր. Աճառյան, <em>Հայերեն արմատական բառարան</em> (HAB), 1971-1979:</li>
  <li>Նոր Հայկազեան Բառարան (NHB), 1837:</li>
</ul>
<p>Դասական ստուգաբանության սյունակի բոլոր մեջբերումները գալիս են այս երկու աղբյուրներից, որոնք Հայաստանում հանրային տիրույթում են:</p>

<h2>Նկարներ և բովանդակություն</h2>
<p>Հերունիի գրքից քաղված հատվածներն ու էջերի պատկերները ներկայացվում են մեջբերման ծավալով, ակադեմիական օգտագործման շրջանակում:</p>

<h2>ԱԻ-ի օգնությունը</h2>
<p>V2-ում խմբագիրները օգտագործում են Anthropic-ի Claude ԱԻ մոդելը՝ սկզբնական սևագրեր ստանալու համար, որոնք հետո մարդ-խմբագիրները գնահատում, խմբագրում կամ մերժում են: Ոչ մի ԱԻ-արդյունք չի հրապարակվում առանց խմբագրի ստուգման:</p>

<h2>Թիմ</h2>
<p>Կառուցված՝ Digishot-ում, սիրով հայերեն լեզվի և հայկական մշակույթի նկատմամբ:</p>
`;

const EN = `
<h1>Credits</h1>

<h2>Source</h2>
<blockquote>
  Heruni, Paris M. <strong>«Հայերը և հնագույն Հայաստանը»</strong> (<em>Armenians and Ancient Armenia</em>). First edition, 2004. Chapter 2 (pp. 109–119) — the ՏԲ method.
</blockquote>
<p>The entire semantic backbone of this dictionary — the 162-entry ՏԲ table, the ~80 worked example reconstructions, and the Heruni-voiced expansion rhythms — comes from that book. We are applying Heruni's method; the method belongs to its author, the dictionary's curation to its editors.</p>

<h2>Classical etymology</h2>
<ul>
  <li>Hr. Ačaṙyan, <em>Hayerēn Armatakan Baṙaran</em> (HAB, 1971–1979).</li>
  <li>Nor Haykazian Baṙaran (NHB, 1837).</li>
</ul>
<p>All citations in the "Classical etymology" column draw on these two works, both in the public domain in Armenia.</p>

<h2>Book excerpts</h2>
<p>Excerpts from Heruni's book and page-scan images are reproduced at citation length, within academic-use norms.</p>

<h2>AI assistance</h2>
<p>In v2, editors use Anthropic's Claude AI model to produce initial drafts, which are then reviewed, edited, or rejected by a human editor before publication. No AI output is published without human review.</p>

<h2>Team</h2>
<p>Built at Digishot, out of love for the Armenian language and Armenian culture.</p>
`;
