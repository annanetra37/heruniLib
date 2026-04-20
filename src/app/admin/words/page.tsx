import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function AdminWordsList() {
  const words = await prisma.word.findMany({ orderBy: { updatedAt: 'desc' } });
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Words</h1>
        <Link
          href="/admin/words/new"
          className="rounded-full bg-heruni-ink px-4 py-2 text-sm font-semibold text-white hover:bg-heruni-sun"
        >
          + New word
        </Link>
      </div>
      <table className="mt-6 w-full divide-y rounded-xl border bg-white text-sm">
        <thead className="bg-heruni-amber/10 text-xs uppercase tracking-wider text-heruni-ink/60">
          <tr>
            <th className="p-2 text-left">Word</th>
            <th className="p-2 text-left">Decomposition</th>
            <th className="p-2 text-left">Cat</th>
            <th className="p-2 text-left">Conf</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {words.map((w) => (
            <tr key={w.id}>
              <td className="p-2 text-base font-semibold">{w.wordHy}</td>
              <td className="p-2 font-mono text-xs">{w.decomposition}</td>
              <td className="p-2 text-xs">{w.category}</td>
              <td className="p-2 text-xs">{w.confidence}</td>
              <td className="p-2 text-xs">{w.status}</td>
              <td className="p-2 text-right">
                <Link
                  href={`/admin/words/${w.id}`}
                  className="text-xs font-semibold text-heruni-sun"
                >
                  Edit →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
