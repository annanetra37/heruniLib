'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await signIn('credentials', { email, password, callbackUrl });
  };

  const field = 'w-full rounded-lg border border-heruni-ink/20 bg-white px-3 py-2 mt-1';

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 text-sm">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
          Email
        </span>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
          Password
        </span>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-heruni-ink py-2 font-semibold text-white transition hover:bg-heruni-sun disabled:opacity-50"
      >
        Sign in
      </button>
    </form>
  );
}
