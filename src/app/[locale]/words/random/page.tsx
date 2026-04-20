import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// v2 §5.5 — /{locale}/words/random picks a random published word and
// 302s to its detail page. Cheapest possible implementation: COUNT + one
// SKIP/TAKE in a single request. No caching so users get a genuinely
// different word each click.
export default async function RandomWord({
  params: { locale }
}: {
  params: { locale: Locale };
}) {
  const count = await prisma.word.count({ where: { status: 'published' } });
  if (count === 0) redirect(`/${locale}/words`);
  const skip = Math.floor(Math.random() * count);
  const [pick] = await prisma.word.findMany({
    where: { status: 'published' },
    orderBy: { id: 'asc' },
    skip,
    take: 1
  });
  if (!pick) redirect(`/${locale}/words`);
  redirect(`/${locale}/words/${pick.slug}`);
}
