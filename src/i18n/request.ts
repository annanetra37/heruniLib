import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, defaultLocale, type Locale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = locales.includes(requested as Locale)
    ? (requested as Locale)
    : defaultLocale;
  if (!locales.includes(locale)) notFound();
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
