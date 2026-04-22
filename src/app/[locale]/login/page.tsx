import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { prisma } from '@/lib/prisma';
import { VISITOR_COOKIE } from '@/lib/visitor';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

// /{locale}/login — sign-in / sign-up entry point. Anonymous visitors
// (those with a tracking cookie but no account) still see the form —
// we only bounce away full-account visitors.
export default async function LoginPage({
  params: { locale },
  searchParams
}: {
  params: { locale: Locale };
  searchParams: { from?: string };
}) {
  setRequestLocale(locale);

  const cookieId = cookies().get(VISITOR_COOKIE)?.value;
  if (cookieId) {
    const v = await prisma.visitor
      .findUnique({ where: { id: cookieId }, select: { email: true } })
      .catch(() => null);
    if (v?.email) redirect(safeNext(searchParams.from, locale));
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
