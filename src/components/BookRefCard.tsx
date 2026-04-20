'use client';

import { useState } from 'react';

export type BookRef = {
  id: number;
  bookPage: number;
  chapter: string | null;
  excerptHy: string;
  excerptEn: string | null;
  imageUrl: string | null;
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
        {ref.imageUrl && (
          <span className="ml-2 rounded-full bg-heruni-amber/20 px-2 py-0.5 text-[10px] font-semibold text-heruni-bronze">
            {locale === 'hy' ? 'էջի նկար' : 'page image'}
          </span>
        )}
        <span className="ml-2 text-xs text-heruni-sun">{open ? '−' : '+'}</span>
        {open && (
          <div className="mt-3 space-y-3">
            <blockquote
              className="border-l-2 border-heruni-amber pl-3 text-sm leading-relaxed text-heruni-ink"
              lang={locale}
            >
              {excerpt}
            </blockquote>
            {ref.imageUrl && (
              <a
                href={ref.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg border border-heruni-ink/10 hover:border-heruni-sun"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ref.imageUrl}
                  alt={
                    locale === 'hy'
                      ? `Գրքի էջ ${ref.bookPage}`
                      : `Book page ${ref.bookPage}`
                  }
                  className="w-full max-w-lg bg-heruni-parchment object-contain"
                  loading="lazy"
                />
              </a>
            )}
          </div>
        )}
      </button>
    </li>
  );
}
