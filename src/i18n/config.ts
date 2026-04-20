export const locales = ['hy', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'hy';
