'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';

// WelcomeGate
//   - On mount asks `/api/visitors` whether we already know the caller
//     (cookie-based); if yes, briefly flashes a "welcome back, X" toast.
//   - If no, shows a modal over the page asking for a first name
//     (and optional last name). Submit POSTs to /api/visitors which
//     creates the Visitor row + sets the cookie.
//   - Users who close / skip the modal get remembered as "skipped" via
//     a session-scoped flag so we don't re-nag on every navigation.

type Visitor = { id: string; firstName: string; lastName: string | null } | null;

const SKIPPED_KEY = 'heruni.welcomeSkipped';

export default function WelcomeGate({ locale }: { locale: Locale }) {
  const t = useTranslations('welcome');
  const [mounted, setMounted] = useState(false);
  const [visitor, setVisitor] = useState<Visitor>(null);
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    fetch('/api/visitors')
      .then((r) => r.json())
      .then((d: { visitor: Visitor }) => {
        if (cancelled) return;
        if (d.visitor) {
          setVisitor(d.visitor);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 4000);
        } else if (!sessionStorage.getItem(SKIPPED_KEY)) {
          setShowModal(true);
        }
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          locale
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? r.statusText);
      setVisitor({ id: data.id, firstName: data.firstName, lastName: data.lastName });
      setShowModal(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    sessionStorage.setItem(SKIPPED_KEY, '1');
    setShowModal(false);
  };

  if (!mounted) return null;

  return (
    <>
      {showToast && visitor && (
        <div
          className="pointer-events-none fixed bottom-5 right-5 z-40 rounded-2xl border border-heruni-amber/40 bg-white px-4 py-3 text-sm text-heruni-ink shadow-[0_10px_40px_-10px_rgba(198,135,42,0.45)] transition"
          role="status"
        >
          <p className="font-semibold" lang={locale}>
            {t('welcomeBack', { name: visitor.firstName })}
          </p>
        </div>
      )}

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="heruni-welcome-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-heruni-ink/40 px-4 backdrop-blur-sm"
        >
          <div className="heruni-ornament w-full max-w-md overflow-hidden rounded-3xl border border-heruni-amber/40 bg-white shadow-[0_20px_60px_-20px_rgba(198,135,42,0.45)]">
            <div
              aria-hidden="true"
              className="h-[3px] bg-gradient-to-r from-transparent via-heruni-sun to-transparent"
            />
            <div className="relative p-6 md:p-8">
              <h2
                id="heruni-welcome-title"
                className="font-serif text-2xl font-bold text-heruni-ink"
                lang={locale}
              >
                {t('title')}
              </h2>
              <p className="mt-2 text-sm text-heruni-ink/75" lang={locale}>
                {t('lead')}
              </p>

              <form onSubmit={submit} className="mt-5 space-y-3">
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
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving || !firstName.trim()}
                    className="rounded-full bg-heruni-ink px-5 py-2 text-sm font-semibold text-white transition hover:bg-heruni-sun disabled:opacity-50"
                  >
                    {saving ? '…' : t('submit')}
                  </button>
                  <button
                    type="button"
                    onClick={skip}
                    className="text-xs text-heruni-ink/60 underline decoration-heruni-sun/40 hover:decoration-heruni-sun"
                  >
                    {t('skip')}
                  </button>
                </div>
                <p className="pt-2 text-[11px] text-heruni-ink/50">{t('privacy')}</p>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
