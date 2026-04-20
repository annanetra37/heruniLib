import Link from 'next/link';
import { prisma, parseList } from '@/lib/prisma';
import SourceImport from '@/components/admin/SourceImport';

export const dynamic = 'force-dynamic';

export default async function AdminSourcesList() {
  const sources = await prisma.source.findMany({ orderBy: { bookPage: 'asc' }, take: 500 });
  const total = await prisma.source.count();
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sources</h1>
        <Link
          href="/admin/sources/new"
          className="rounded-full bg-heruni-ink px-4 py-2 text-sm font-semibold text-white hover:bg-heruni-sun"
        >
          + New source
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-heruni-ink/60">
        Each row is a page in Heruni&apos;s book that analyses specific words. Editors link words
        into sources via <code>heruni_book_refs</code> on the word edit page (v2 brief §3.2).
      </p>

      <div className="mt-6">
        <SourceImport />
      </div>

      <p className="mt-6 text-xs text-heruni-ink/60">
        Showing {sources.length} of {total} sources.
      </p>
      <table className="mt-2 w-full divide-y rounded-xl border bg-white text-sm">
        <thead className="bg-heruni-amber/10 text-xs uppercase tracking-wider text-heruni-ink/60">
          <tr>
            <th className="p-2 text-left">Page</th>
            <th className="p-2 text-left">Chapter</th>
            <th className="p-2 text-left">Excerpt (hy)</th>
            <th className="p-2 text-left">Mentions</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sources.map((s) => {
            const mentioned = parseList(s.mentionedWords);
            return (
              <tr key={s.id}>
                <td className="p-2 font-mono text-xs">p. {s.bookPage}</td>
                <td className="p-2 font-mono text-xs">{s.chapter ?? '—'}</td>
                <td className="p-2 max-w-md truncate text-xs" lang="hy" title={s.excerptHy}>
                  {s.excerptHy}
                </td>
                <td className="p-2 text-xs" lang="hy">
                  {mentioned.slice(0, 3).join(', ')}
                  {mentioned.length > 3 ? ` +${mentioned.length - 3}` : ''}
                </td>
                <td className="p-2 text-right">
                  <Link
                    href={`/admin/sources/${s.id}`}
                    className="text-xs font-semibold text-heruni-sun"
                  >
                    Edit →
                  </Link>
                </td>
              </tr>
            );
          })}
          {sources.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-xs text-heruni-ink/60">
                No sources yet. Use CSV import or create one manually.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
