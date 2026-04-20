import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { authOptions } from '@/lib/auth';
import '../globals.css';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const pathname = ''; // handled by route; login page doesn't use this layout

  return (
    <html lang="en">
      <body>
        {session ? (
          <div className="flex min-h-screen">
            <aside className="w-60 border-r bg-white p-5">
              <h2 className="text-xl font-bold">Heruni CMS</h2>
              <p className="mt-1 text-xs text-heruni-ink/60">
                {(session.user as { name?: string }).name} —{' '}
                {(session.user as { role?: string }).role}
              </p>
              <nav className="mt-6 flex flex-col gap-2 text-sm">
                <Link href="/admin" className="hover:text-heruni-sun">
                  Dashboard
                </Link>
                <Link href="/admin/roots" className="hover:text-heruni-sun">
                  Roots
                </Link>
                <Link href="/admin/words" className="hover:text-heruni-sun">
                  Words
                </Link>
                <Link href="/admin/patterns" className="hover:text-heruni-sun">
                  Patterns
                </Link>
                <Link href="/admin/sources" className="hover:text-heruni-sun">
                  Sources
                </Link>
                <Link href="/admin/ai-drafts" className="hover:text-heruni-sun">
                  AI drafts
                </Link>
                <Link href="/admin/ai-drafts/diff" className="pl-4 text-xs hover:text-heruni-sun">
                  ↳ diff gallery
                </Link>
                <Link href="/admin/prompt-health" className="pl-4 text-xs hover:text-heruni-sun">
                  ↳ prompt health
                </Link>
                <Link href="/admin/lists" className="hover:text-heruni-sun">
                  Lists
                </Link>
                <Link href="/admin/submissions" className="hover:text-heruni-sun">
                  Submissions
                </Link>
                <Link href="/admin/help" className="hover:text-heruni-sun">
                  Editor handbook
                </Link>
                <form action="/api/auth/signout" method="post" className="mt-4">
                  <button
                    type="submit"
                    className="text-xs text-heruni-ink/60 hover:text-heruni-sun"
                  >
                    Sign out
                  </button>
                </form>
                <Link href="/hy" className="mt-6 text-xs text-heruni-ink/60 hover:text-heruni-sun">
                  ← back to site
                </Link>
              </nav>
            </aside>
            <main className="flex-1 p-8">{children}</main>
          </div>
        ) : (
          <main className="min-h-screen p-8">{children}</main>
        )}
      </body>
    </html>
  );
}
