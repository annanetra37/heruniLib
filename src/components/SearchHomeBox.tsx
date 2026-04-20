'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';

export default function SearchHomeBox({ locale }: { locale: Locale }) {
  const t = useTranslations();
  const router = useRouter();
  const [q, setQ] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/${locale}/decompose?w=${encodeURIComponent(term)}`);
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('home.searchPlaceholder')}
        className="flex-1 rounded-full border border-heruni-ink/20 bg-white px-5 py-3 text-lg shadow-sm focus:border-heruni-sun focus:outline-none"
        autoFocus
        lang={locale}
      />
      <button
        type="submit"
        className="rounded-full bg-heruni-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-heruni-sun"
      >
        {t('home.searchButton')}
      </button>
    </form>
  );
}
