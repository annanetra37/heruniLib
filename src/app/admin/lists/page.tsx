import Link from 'next/link';
import { prisma, parseInts } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminListsIndex() {
  const lists = await prisma.wordList.findMany({ orderBy: { updatedAt: 'desc' } });
  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Curated lists</h1>
        <Link
          href="/admin/lists/new"
          className="rounded-full bg-heruni-ink px-4 py-2 text-sm font-semibold text-white hover:bg-heruni-sun"
        >
          + New list
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-heruni-ink/60">
        Named groups like &ldquo;Governance terms&rdquo; or &ldquo;Kinship&rdquo; (v2 brief §4.2).
        Open a list to bulk-queue Heruni or classical drafts for every word it contains.
      </p>
      <table className="mt-6 w-full divide-y rounded-xl border bg-white text-sm">
        <thead className="bg-heruni-amber/10 text-xs uppercase tracking-wider text-heruni-ink/60">
          <tr>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Words</th>
            <th className="p-2 text-left">Updated</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lists.map((l) => (
            <tr key={l.id}>
              <td className="p-2 font-semibold">{l.name}</td>
              <td className="p-2 text-xs text-heruni-ink/60">{parseInts(l.wordIds).length}</td>
              <td className="p-2 text-xs text-heruni-ink/50">
                {new Date(l.updatedAt).toLocaleDateString()}
              </td>
              <td className="p-2 text-right">
                <Link href={`/admin/lists/${l.id}`} className="text-xs font-semibold text-heruni-sun">
                  Open →
                </Link>
              </td>
            </tr>
          ))}
          {lists.length === 0 && (
            <tr>
              <td colSpan={4} className="p-4 text-center text-xs text-heruni-ink/60">
                No curated lists yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
