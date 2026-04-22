'use client';

import { useState } from 'react';
import type { Locale } from '@/i18n/config';

// Tiny client component because POST + reload can't live in an RSC.
// Shows "Signed in as X · Sign out" with an unobtrusive bronze pill.

export default function HeaderSignoutButton({
  locale,
  firstName,
  signedInAsLabel,
  signOutLabel
}: {
  locale: Locale;
  firstName: string;
  signedInAsLabel: string;
  signOutLabel: string;
}) {
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await fetch('/api/visitor-auth/signout', { method: 'POST' });
    } finally {
      // Middleware will bounce us to /login since the cookie is gone.
      window.location.href = `/${locale}`;
    }
  };

  return (
    <div className="hidden items-center gap-2 md:flex">
      <span
        className="rounded-full bg-heruni-amber/20 px-3 py-1 text-[11px] font-semibold text-heruni-bronze"
        title={firstName}
      >
        {signedInAsLabel}
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="text-[11px] font-medium text-heruni-ink/60 underline decoration-heruni-sun/60 hover:text-heruni-ink hover:decoration-heruni-sun disabled:opacity-50"
      >
        {busy ? '…' : signOutLabel}
      </button>
    </div>
  );
}
