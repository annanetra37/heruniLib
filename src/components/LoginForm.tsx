'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';

// Two-stage login/signup:
//   Stage 1 — email input. On submit, POST /api/visitor-auth/check.
//     Response classifies the email into one of three states:
//       (a) exists + hasPassword  → show password field, call /login
//       (b) exists + !hasPassword → legacy row, show name+password to
//                                    upgrade it via /signup
//       (c) !exists               → show firstName + lastName + password
//                                    to register via /signup
//   Stage 2 — whichever form the check classified into.
// "Change" button returns to stage 1 without losing the typed email.

type Stage =
  | { kind: 'email' }
  | { kind: 'signin'; email: string; firstName: string }
  | { kind: 'signup'; email: string; firstName?: string; lastName?: string | null; legacy: boolean };

export default function LoginForm({
  locale,
  nextPath
}: {
  locale: Locale;
  nextPath: string;
}) {
  const t = useTranslations('login');
  const [stage, setStage] = useState<Stage>({ kind: 'email' });
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetError = () => setError(null);

  const checkEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    setBusy(true);
    try {
      const r = await fetch('/api/visitor-auth/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = (await r.json()) as {
        exists: boolean;
        firstName: string | null;
        hasPassword: boolean;
      };
      if (data.exists && data.hasPassword) {
        setStage({
          kind: 'signin',
          email: email.trim(),
          firstName: data.firstName ?? ''
        });
      } else if (data.exists && !data.hasPassword) {
        // Legacy account — upgrade via /signup with existing name prefilled.
        setFirstName(data.firstName ?? '');
        setStage({
          kind: 'signup',
          email: email.trim(),
          firstName: data.firstName ?? '',
          legacy: true
        });
      } else {
        setStage({ kind: 'signup', email: email.trim(), legacy: false });
      }
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const submitSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    setBusy(true);
    try {
      const r = await fetch('/api/visitor-auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (r.status === 401) {
        setError(t('errorWrongPassword'));
        return;
      }
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.error ?? t('errorGeneric'));
        return;
      }
      window.location.href = nextPath;
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    setBusy(true);
    try {
      const r = await fetch('/api/visitor-auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          locale
        })
      });
      if (r.status === 409) {
        setError(t('errorAccountExists'));
        return;
      }
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.error ?? t('errorGeneric'));
        return;
      }
      window.location.href = nextPath;
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const backToEmail = () => {
    setStage({ kind: 'email' });
    setPassword('');
    resetError();
  };

  const input =
    'mt-1 w-full rounded-xl border border-heruni-ink/20 bg-white px-4 py-2 text-base text-heruni-ink focus:border-heruni-sun focus:outline-none';
  const label = 'block text-xs font-semibold uppercase tracking-wider text-heruni-ink/60';

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

        {stage.kind === 'email' && (
          <form onSubmit={checkEmail} className="mt-6 space-y-4">
            <label className={label}>
              {t('email')}
              <input
                autoFocus
                required
                type="email"
                maxLength={120}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={input}
              />
              <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-heruni-ink/50">
                {t('emailHelp')}
              </span>
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="w-full rounded-full bg-heruni-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-heruni-sun disabled:opacity-50"
            >
              {busy ? '…' : t('continue')}
            </button>
          </form>
        )}

        {stage.kind === 'signin' && (
          <form onSubmit={submitSignin} className="mt-6 space-y-4">
            <p className="rounded-xl border border-heruni-amber/40 bg-heruni-amber/10 px-3 py-2 text-sm">
              {t('welcomeBack', { name: stage.firstName || stage.email })}
              <button
                type="button"
                onClick={backToEmail}
                className="ml-2 text-xs underline decoration-heruni-sun/60"
              >
                ({t('change')})
              </button>
            </p>
            <label className={label}>
              {t('password')}
              <input
                autoFocus
                required
                type="password"
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input}
              />
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy || password.length < 6}
              className="w-full rounded-full bg-heruni-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-heruni-sun disabled:opacity-50"
            >
              {busy ? '…' : t('signIn')}
            </button>
          </form>
        )}

        {stage.kind === 'signup' && (
          <form onSubmit={submitSignup} className="mt-6 space-y-4">
            <p className="rounded-xl border border-heruni-amber/40 bg-heruni-amber/10 px-3 py-2 text-sm">
              {stage.legacy
                ? t('legacyWelcome', { name: stage.firstName ?? stage.email })
                : t('newAccount', { email: stage.email })}
              <button
                type="button"
                onClick={backToEmail}
                className="ml-2 text-xs underline decoration-heruni-sun/60"
              >
                ({t('change')})
              </button>
            </p>
            <label className={label}>
              {t('firstName')}
              <input
                autoFocus={!stage.legacy}
                required
                maxLength={60}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={input}
                lang={locale}
              />
            </label>
            <label className={label}>
              {t('lastName')}
              <input
                maxLength={60}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={input}
                lang={locale}
              />
            </label>
            <label className={label}>
              {t('password')}
              <input
                autoFocus={stage.legacy}
                required
                type="password"
                minLength={6}
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input}
              />
              <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-heruni-ink/50">
                {t('passwordHelp')}
              </span>
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy || !firstName.trim() || password.length < 6}
              className="w-full rounded-full bg-heruni-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-heruni-sun disabled:opacity-50"
            >
              {busy ? '…' : t('createAccount')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
