'use client';

import { useEffect, useState } from 'react';

// Multi-phase loader for the Heruni reconstruction pipeline.
// The actual flow is one Claude call, but we surface the invisible work
// as three visible steps with timed transitions so the user gets a sense
// that something is happening (~5-8s round trip otherwise feels dead).
//
// Phases:
//   1. 'decompose'  — 0-500ms    — trivially fast in reality
//   2. 'patterns'   — 500-1400ms — retrieve + rank pattern candidates
//   3. 'writing'    — 1400ms+    — model is writing
//
// When the parent's loading state flips off (ai arrives), the loader
// unmounts and is replaced by real content.

type Phase = 'decompose' | 'patterns' | 'writing' | 'classical' | 'done';

export default function AiLoader({ locale }: { locale: 'hy' | 'en' }) {
  const [phase, setPhase] = useState<Phase>('decompose');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('patterns'), 400);
    const t2 = setTimeout(() => setPhase('writing'), 1000);
    const t3 = setTimeout(() => setPhase('classical'), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const steps: { key: Phase; labelHy: string; labelEn: string }[] = [
    {
      key: 'decompose',
      labelHy: 'Վերծանում ենք բառի ՏԲ–արմատները',
      labelEn: 'Decomposing into ՏԲ roots'
    },
    {
      key: 'patterns',
      labelHy: 'Համապատասխանեցնում ենք Հերունիի ձևանմուշները',
      labelEn: 'Matching Heruni rhetorical patterns'
    },
    {
      key: 'writing',
      labelHy: 'Գրում ենք Հերունի-ոճով վերակառուցումը',
      labelEn: 'Composing the Heruni reconstruction'
    },
    {
      key: 'classical',
      labelHy: 'Մշակում ենք Աճառյանի ոճով դասական ստուգաբանությունը',
      labelEn: 'Drafting the Ačaṙyan-style classical etymology'
    }
  ];

  const order: Phase[] = ['decompose', 'patterns', 'writing', 'classical'];
  const activeIdx = order.indexOf(phase);

  return (
    <div className="rounded-2xl border border-heruni-amber/40 bg-gradient-to-br from-heruni-amber/10 via-white to-white p-5">
      <ol className="space-y-2.5">
        {steps.map((s, i) => {
          const isDone = i < activeIdx;
          const isActive = i === activeIdx;
          return (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  isDone
                    ? 'border-heruni-moss bg-heruni-moss text-white'
                    : isActive
                      ? 'border-heruni-sun bg-heruni-sun/20'
                      : 'border-heruni-ink/15 bg-white'
                }`}
              >
                {isDone ? (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                    <path
                      d="M2 6.5L5 9.5L10 3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : isActive ? (
                  <span className="heruni-pulse-dot h-1.5 w-1.5 rounded-full bg-heruni-sun" />
                ) : null}
              </span>
              <span
                className={`${
                  isDone ? 'text-heruni-ink/50 line-through decoration-heruni-moss/40' : isActive ? 'font-semibold text-heruni-ink' : 'text-heruni-ink/50'
                }`}
                lang={locale}
              >
                {locale === 'hy' ? s.labelHy : s.labelEn}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Skeleton preview of the coming text */}
      <div className="mt-5 space-y-2" aria-hidden="true">
        <div className="heruni-skeleton h-5 w-11/12" />
        <div className="heruni-skeleton h-5 w-9/12" />
        <div className="heruni-skeleton h-4 w-7/12" />
      </div>

      <p className="mt-4 text-[11px] italic text-heruni-ink/50" lang={locale}>
        {locale === 'hy'
          ? 'Մեր ալգորիթմները ուսումնասիրում են Հերունիի ~80 օրինակները, նշանակում առավել հարմար ձևանմուշը և գրում վերակառուցումը Հերունիի ոճով՝ սովորաբար 3–8 վայրկյանում:'
          : 'Our algorithms scan Heruni’s ~80 worked examples, pick the closest rhetorical pattern, and compose the reconstruction in Heruni’s voice — usually in 3–8 seconds.'}
      </p>
    </div>
  );
}
