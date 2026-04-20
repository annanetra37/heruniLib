import Link from 'next/link';
import { prisma, parseList } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminRootsList() {
  const roots = await prisma.root.findMany({ orderBy: [{ length: 'asc' }, { token: 'asc' }] });
  const counts = {
    1: roots.filter((r) => r.length === 1).length,
    2: roots.filter((r) => r.length === 2).length,
    3: roots.filter((r) => r.length === 3).length
  };
  return (
    <div>
      <h1 className="text-3xl font-bold">Roots</h1>
      <p className="mt-1 text-sm text-heruni-ink/60">
        Single-letter: {counts[1]} / 39 · Two-letter: {counts[2]} / 86 · Three-letter: {counts[3]} / 37
      </p>
      <p className="mt-1 text-xs text-heruni-ink/50">
        Roots cannot be deleted (Heruni's theory fixes them). Only glosses, notes, see-also, and
        symbol are editable.
      </p>
      <table className="mt-6 w-full divide-y rounded-xl border bg-white text-sm">
        <thead className="bg-heruni-amber/10 text-xs uppercase tracking-wider text-heruni-ink/60">
          <tr>
            <th className="p-2 text-left">Token</th>
            <th className="p-2 text-left">Len</th>
            <th className="p-2 text-left">Meaning (hy)</th>
            <th className="p-2 text-left">Meaning (en)</th>
            <th className="p-2 text-left">Page</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {roots.map((r) => (
            <tr key={r.id}>
              <td className="p-2 text-lg font-bold">{r.token}</td>
              <td className="p-2 font-mono">{r.length}</td>
              <td className="p-2 text-xs">{parseList(r.meaningHy).join(', ')}</td>
              <td className="p-2 text-xs">{parseList(r.meaningEn).join(', ')}</td>
              <td className="p-2 text-xs">{r.bookPage}</td>
              <td className="p-2 text-right">
                <Link
                  href={`/admin/roots/${r.id}`}
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
