import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/config';

export default function TermsPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const content = locale === 'hy' ? HY : EN;
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-heruni">
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </article>
  );
}

const HY = `
<h1>Օգտագործման պայմաններ</h1>
<p class="text-sm text-heruni-ink/60">Թարմացվել է՝ v2 թողարկման համար։</p>

<h2>Ի՞նչ է այս կայքը</h2>
<p>Heruni Dict-ը ներկայացնում է Պարիս Հերունիի ՏԲ («Տառերի կամ Տարրերի Բառարան») մեթոդաբանությամբ կատարված բառի վերականգնումներ: Վերականգնված իմաստները <strong>ոչ թե ընդհանուր ընդունված ստուգաբանություն են</strong>, այլ մեկնաբանություններ՝ ըստ Հերունիի մեթոդի: Յուրաքանչյուր բառի հոդվածում կողք-կողքի ներկայացված է և դասական ստուգաբանությունը, որպեսզի ընթերցողը կարող կազմել իր սեփական կարծիքը:</p>

<h2>Ալգորիթմներով ստեղծված բովանդակություն</h2>
<p>V2-ում բառարանի առաջին սևագիրը մի մասը ստանում է մեր ալգորիթմներով: <strong>Ոչ մի ալգորիթմային սևագիր չի հրապարակվում առանց մարդ-խմբագրի ստուգման:</strong> Սակայն «վերծանել»-ով անհատական բառեր որոնելիս դուք կարող եք ստանալ իրական ժամանակում ստեղծված ալգորիթմային վերծանում, որը դեռ ստուգված չէ և նշված է որպես այդպիսին: Մի՛ օգտագործեք այդ ոչ-ստուգված արդյունքները որպես ակադեմիական աղբյուր:</p>

<h2>Ինչպե՞ս օգտագործել</h2>
<p>Բառարանի պարունակությունը (վերծանումները, իմաստները, դասական ստուգաբանությունները) կարող եք մեջբերել՝ աղբյուրը նշելով <em>Heruni Dict</em> և ամսաթիվը: Խնդրում ենք չօգտագործել մեր տվյալները ինքնաբերական հրապարակման համար առանց /feed.xml կամ /feed.json պաշտոնական սնուցման միջոցով:</p>

<h2>Բառի ներկայացումներ</h2>
<p>Երբ ներկայացնում եք բառ, դուք հաստատում եք, որ նյութը ձերն է, կամ հասանելի է այլ ազատ օգտագործման պայմաններով: Մենք պահում ենք իրավունքը ներկայացումը մերժելու կամ խմբագրելու համար:</p>

<h2>Պատասխանատվության սահմանափակում</h2>
<p>Այս բառարանը ակադեմիական ծառայություն չէ: Մենք չենք երաշխավորում անխափան աշխատանք և չենք կրում պատասխանատվություն այս կայքից ստացված տեղեկության ակադեմիական, իրավական կամ ֆինանսական օգտագործման համար:</p>

<h2>Կապ</h2>
<p>Հարցեր՝ <a href="mailto:hello@heruni-dict.am">hello@heruni-dict.am</a></p>
`;

const EN = `
<h1>Terms of Use</h1>
<p class="text-sm text-heruni-ink/60">Updated for the v2 launch.</p>

<h2>What this site is</h2>
<p>Heruni Dict presents word reconstructions made with Paris Heruni's ՏԲ («Տառերի կամ Տարրերի Բառարան» — Dictionary of Letters or Elements) method. Reconstructed meanings are <strong>not settled etymologies</strong> — they are interpretations under Heruni's method. Every word entry also shows the classical (mainstream) etymology side-by-side so readers can form their own view.</p>

<h2>Algorithm-generated content</h2>
<p>In v2, part of the first-draft writing comes from our algorithms. <strong>No algorithm output is published without editor review.</strong> When you search an ad-hoc word on the Decompose page, however, you may see a real-time algorithmic reconstruction that has not yet been reviewed — it is clearly labelled as such. Do not cite unreviewed algorithmic output as an academic source.</p>

<h2>How to use the content</h2>
<p>You may cite dictionary content (decompositions, meanings, classical etymologies) in other works with attribution to <em>Heruni Dict</em> and the access date. Please do not scrape the site for automated republishing — use the official /feed.xml or /feed.json feeds, or the /api/export/words.{json,csv} endpoints, which are the supported machine-readable surfaces.</p>

<h2>Submissions</h2>
<p>When you submit a word through the contribute form, you confirm the material is yours or otherwise available under terms compatible with free re-use. We reserve the right to reject or edit any submission.</p>

<h2>Disclaimer</h2>
<p>This dictionary is not an academic service. We don't guarantee uptime and we are not liable for academic, legal, or financial decisions made on the basis of content from this site.</p>

<h2>Contact</h2>
<p>Questions: <a href="mailto:hello@heruni-dict.am">hello@heruni-dict.am</a></p>
`;
