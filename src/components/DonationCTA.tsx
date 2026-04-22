'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

// Floating donation-interest CTA.
//
//   Desktop (≥lg): fixed on the left side of the viewport, vertically
//                  anchored below the header. Light pink "pay-attention"
//                  palette and a blinking halo on the heart dot.
//   Mobile/tablet: inline at the top of the page flow so it isn't
//                  stuck off-screen on a small device.
//
// One click POSTs /api/visitors/donate-interest which flips
// Visitor.readyToDonate = true. The banner morphs in place to a
// thank-you message. The × button dismisses it for the current session
// only (sessionStorage) — the server flag stays regardless so admins
// keep their outreach list.

type Mode = 'prompt' | 'thanks' | 'thanks-anon' | 'error';

const DISMISS_KEY = 'heruni.donateCtaDismissed';

export default function DonationCTA() {
  const t = useTranslations('donate');
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [mode, setMode] = useState<Mode>('prompt');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY)) {
      setVisible(false);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
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

  if (!mounted || !visible) return null;

  const card =
    mode === 'thanks' || mode === 'thanks-anon' ? (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-[0_20px_50px_-20px_rgba(244,114,182,0.45)]">
        <span aria-hidden="true" className="mr-2">
          ♡
        </span>
        {mode === 'thanks' ? t('thanks') : t('thanksAnon')}
        <button
          type="button"
          onClick={dismiss}
          aria-label="dismiss"
          className="float-right text-rose-400 transition hover:text-rose-700"
        >
          ×
        </button>
      </div>
    ) : (
      <div className="relative overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-rose-50 to-white p-4 shadow-[0_20px_50px_-20px_rgba(244,114,182,0.45)]">
        <button
          type="button"
          onClick={dismiss}
          aria-label="dismiss"
          className="absolute right-2 top-2 text-rose-300 transition hover:text-rose-700"
        >
          ×
        </button>
        <div className="flex items-start gap-3">
          {/* Blinking pink halo dot — the attention grabber */}
          <span
            aria-hidden="true"
            className="heruni-blink-dot mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500 text-rose-500"
          />
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-[13px] leading-relaxed text-rose-900">{t('prompt')}</p>
            {mode === 'error' && (
              <p className="mt-2 text-[11px] text-red-600">{t('error')}</p>
            )}
            <button
              type="button"
              onClick={signal}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50"
            >
              {busy ? '…' : t('cta')} →
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <>
      {/* Desktop (≥lg): fixed on the left, below the header, always in
          view while scrolling. Narrow width so it doesn't dominate. */}
      <aside
        className="pointer-events-auto fixed left-4 top-28 z-30 hidden w-64 lg:block"
        role="complementary"
        aria-label="Donation interest"
      >
        {card}
      </aside>

      {/* Mobile/tablet: inline, shown in-flow at the top of the
          decompose page so it isn't hidden off-screen. */}
      <div className="mb-5 lg:hidden">{card}</div>
    </>
  );
}
