'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';

export default function LoginForm({
  locale,
  nextPath
}: {
  locale: Locale;
  nextPath: string;
}) {
  const t = useTranslations('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/visitors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          email: email.trim(),
          locale
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? t('errorGeneric'));
      // Hard navigation so the server re-reads the cookie.
      window.location.href = nextPath;
    } catch (err) {
      setError((err as Error).message || t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="heruni-ornament w-full overflow-hidden rounded-3xl border border-heruni-amber/40 bg-white shadow-[0_20px_60px_-20px_rgba(198,135,42,0.45)]">
      <div
        aria-hidden="true"
        className="h-[3px] bg-gradient-to-r from-transparent via-heruni-sun to-transparent"
      />
      <div className="relative p-6 md:p-8">
        <h1 className="font-serif text-3xl font-bold text-heruni-ink" lang={locale}>
          {t('title')}
        </h1>
        <p className="mt-2 text-sm text-heruni-ink/75" lang={locale}>
          {t('lead')}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
            {t('firstName')}
            <input
              autoFocus
              required
              maxLength={60}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-heruni-ink/20 bg-white px-4 py-2 text-base text-heruni-ink focus:border-heruni-sun focus:outline-none"
              lang={locale}
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
            {t('lastName')}
            <input
              maxLength={60}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-heruni-ink/20 bg-white px-4 py-2 text-base text-heruni-ink focus:border-heruni-sun focus:outline-none"
              lang={locale}
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
            {t('email')}
            <input
              required
              type="email"
              maxLength={120}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-heruni-ink/20 bg-white px-4 py-2 text-base text-heruni-ink focus:border-heruni-sun focus:outline-none"
            />
            <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-heruni-ink/50">
              {t('emailHelp')}
            </span>
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving || !firstName.trim() || !email.trim()}
            className="w-full rounded-full bg-heruni-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-heruni-sun disabled:opacity-50"
          >
            {saving ? '…' : t('submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
