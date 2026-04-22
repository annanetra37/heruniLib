'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

// Shows an unobtrusive donation-interest banner below the decompose
// result. One click flips Visitor.readyToDonate so admins can email
// the user later. Thanks-state replaces the prompt in place after
// click; component keeps session-state only, so a fresh search renders
// the prompt again — but the server-side flag persists, which is what
// matters for outreach.

type Mode = 'prompt' | 'thanks' | 'thanks-anon' | 'error';

export default function DonationCTA() {
  const t = useTranslations('donate');
  const [mode, setMode] = useState<Mode>('prompt');
  const [busy, setBusy] = useState(false);

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

  if (mode === 'thanks' || mode === 'thanks-anon') {
    return (
      <div className="mt-6 rounded-2xl border border-heruni-moss/40 bg-heruni-moss/10 px-5 py-4 text-sm text-heruni-moss">
        <span aria-hidden="true" className="mr-2">
          ✦
        </span>
        {mode === 'thanks' ? t('thanks') : t('thanksAnon')}
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-heruni-amber/40 bg-gradient-to-br from-heruni-amber/15 via-white to-white p-5">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-heruni-sun/20 text-lg text-heruni-bronze"
        >
          ♡
        </span>
        <div className="flex-1">
          <p className="text-sm leading-relaxed text-heruni-ink/85">{t('prompt')}</p>
          {mode === 'error' && (
            <p className="mt-2 text-xs text-red-600">{t('error')}</p>
          )}
          <button
            type="button"
            onClick={signal}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-heruni-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-heruni-sun disabled:opacity-50"
          >
            {busy ? '…' : t('cta')} →
          </button>
        </div>
      </div>
    </div>
  );
}
