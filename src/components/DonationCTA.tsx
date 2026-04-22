'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

// Floating donation-interest CTA.
//
// Visibility rules:
//   • Shown only after the visitor has searched at least DONATE_THRESHOLD
//     times (so we don't come across as begging on first contact).
//   • Hidden automatically once Visitor.readyToDonate = true (they've
//     already said yes — no need to nag).
//   • Dismissible for the session via the × button.
//
// Palette: very light lavender (#efe6fa) with violet-500 accents and a
// blinking-halo dot — attention-getting but calm.

type Mode = 'prompt' | 'thanks' | 'thanks-anon' | 'error';

const DISMISS_KEY = 'heruni.donateCtaDismissed';
const DONATE_THRESHOLD = 9;

export default function DonationCTA() {
  const t = useTranslations('donate');
  const [mounted, setMounted] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mode, setMode] = useState<Mode>('prompt');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY)) {
      setDismissed(true);
    }

    // Fetch the visitor's searchCount + donate flag. Only render when
    // the user has crossed the threshold AND hasn't already flagged
    // interest.
    fetch('/api/visitors')
      .then((r) => r.json())
      .then(
        (d: {
          visitor: {
            searchCount?: number;
            readyToDonate?: boolean;
          } | null;
        }) => {
          const count = d.visitor?.searchCount ?? 0;
          const alreadyFlagged = !!d.visitor?.readyToDonate;
          setEligible(count >= DONATE_THRESHOLD && !alreadyFlagged);
        }
      )
      .catch(() => {
        /* stay hidden on error */
      });
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const signal = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/visitors/donate-interest', { method: 'POST' });
      if (r.ok) {
        setMode('thanks');
      } else if (r.status === 401) {
        setMode('thanks-anon');
      } else {
        setMode('error');
      }
    } catch {
      setMode('error');
    } finally {
      setBusy(false);
    }
  };

  if (!mounted || !eligible || dismissed) return null;

  // Very light lavender palette (#efe6fa background + violet-400 border
  // + violet-900 text). Arbitrary hex used because Tailwind's violet-50
  // is a touch darker.
  const card =
    mode === 'thanks' || mode === 'thanks-anon' ? (
      <div
        className="rounded-2xl border border-violet-300 bg-[#efe6fa] px-4 py-3 text-sm text-violet-900 shadow-[0_20px_50px_-20px_rgba(139,92,246,0.4)]"
      >
        <span aria-hidden="true" className="mr-2">
          ♡
        </span>
        {mode === 'thanks' ? t('thanks') : t('thanksAnon')}
        <button
          type="button"
          onClick={dismiss}
          aria-label="dismiss"
          className="float-right text-violet-400 transition hover:text-violet-700"
        >
          ×
        </button>
      </div>
    ) : (
      <div className="relative overflow-hidden rounded-2xl border border-violet-300 bg-[#efe6fa] p-4 shadow-[0_20px_50px_-20px_rgba(139,92,246,0.4)]">
        <button
          type="button"
          onClick={dismiss}
          aria-label="dismiss"
          className="absolute right-2 top-2 text-violet-400 transition hover:text-violet-700"
        >
          ×
        </button>
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="heruni-blink-dot mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-violet-500 text-violet-500"
          />
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-[13px] leading-relaxed text-violet-900">{t('prompt')}</p>
            {mode === 'error' && (
              <p className="mt-2 text-[11px] text-red-600">{t('error')}</p>
            )}
            <button
              type="button"
              onClick={signal}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-600 disabled:opacity-50"
            >
              {busy ? '…' : t('cta')} →
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <>
      <aside
        className="pointer-events-auto fixed left-4 top-28 z-30 hidden w-64 lg:block"
        role="complementary"
        aria-label="Donation interest"
      >
        {card}
      </aside>
      <div className="mb-5 lg:hidden">{card}</div>
    </>
  );
}
