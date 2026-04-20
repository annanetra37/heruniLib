'use client';

import { useState } from 'react';

export type BookRef = {
  id: number;
  bookPage: number;
  chapter: string | null;
  excerptHy: string;
  excerptEn: string | null;
};

export default function BookRefCard({
  ref,
  locale,
  labels
}: {
  ref: BookRef;
  locale: 'hy' | 'en';
  labels: { page: string; chapter: string };
}) {
  const [open, setOpen] = useState(false);
  const excerpt = locale === 'hy' ? ref.excerptHy : ref.excerptEn ?? ref.excerptHy;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-left text-sm transition hover:border-heruni-sun ${
          open ? 'border-heruni-sun shadow-sm' : 'border-heruni-ink/10'
        }`}
      >
        <span className="font-mono text-xs text-heruni-ink/70">
          {labels.page} {ref.bookPage}
        </span>
        {ref.chapter && (
          <span className="ml-2 font-mono text-xs text-heruni-ink/50">
            {labels.chapter} {ref.chapter}
          </span>
        )}
        <span className="ml-2 text-xs text-heruni-sun">{open ? '−' : '+'}</span>
        {open && (
          <blockquote
            className="mt-3 border-l-2 border-heruni-amber pl-3 text-sm leading-relaxed text-heruni-ink"
            lang={locale}
          >
            {excerpt}
          </blockquote>
        )}
      </button>
    </li>
  );
}
