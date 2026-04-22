import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { VISITOR_COOKIE } from '@/lib/visitor';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

// /{locale}/login — mandatory sign-in gate for public users.
// Returns directly to `from` if the visitor cookie is already set.
export default function LoginPage({
  params: { locale },
  searchParams
}: {
  params: { locale: Locale };
  searchParams: { from?: string };
}) {
  setRequestLocale(locale);

  // Already signed in → bounce back to their target immediately.
  const alreadySignedIn = cookies().get(VISITOR_COOKIE)?.value;
  if (alreadySignedIn) {
    redirect(safeNext(searchParams.from, locale));
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-10">
      <LoginForm locale={locale} nextPath={safeNext(searchParams.from, locale)} />
    </div>
  );
}

function safeNext(from: string | undefined, locale: Locale): string {
  if (!from) return `/${locale}`;
  if (!from.startsWith('/')) return `/${locale}`;
  // Disallow loops through /login itself or escape to an external host.
  if (from.startsWith(`/${locale}/login`) || from.startsWith('//')) return `/${locale}`;
  return from;
}
