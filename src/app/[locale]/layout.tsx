import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { locales, type Locale } from '@/i18n/config';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WelcomeGate from '@/components/WelcomeGate';
import { logPageView } from '@/lib/visitor';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  // Log the pageview. Awaited intentionally so the row is guaranteed
  // committed before the response finalizes — previously a void call
  // could be torn down with the request context, silently dropping
  // inserts. ~5ms overhead per render is fine.
  const h = headers();
  const pathHeader =
    h.get('x-invoke-path') ?? h.get('next-url') ?? `/${locale}`;
  await logPageView(pathHeader, locale);

  return (
    <html lang={locale}>
      <body className={locale === 'hy' ? 'arm' : ''}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-heruni-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
          >
            {locale === 'hy' ? 'Անցնել գլխավոր բովանդակությանը' : 'Skip to main content'}
          </a>
          <div className="flex min-h-screen flex-col">
            <Header locale={locale as Locale} />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer locale={locale as Locale} />
          </div>
          <WelcomeGate locale={locale as Locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
