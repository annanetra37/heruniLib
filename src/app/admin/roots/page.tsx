import Link from 'next/link';
import { prisma, parseList } from '@/lib/prisma';
import RootImport from '@/components/admin/RootImport';

export const dynamic = 'force-dynamic';

export default async function AdminRootsList() {
  const roots = await prisma.root.findMany({ orderBy: [{ length: 'asc' }, { token: 'asc' }] });
  const counts = {
    1: roots.filter((r) => r.length === 1).length,
    2: roots.filter((r) => r.length === 2).length,
    3: roots.filter((r) => r.length === 3).length
  };
  const gap2 = 86 - counts[2];
  const gap3 = 37 - counts[3];
  const totalGap = gap2 + gap3;

  return (
    <div>
      <h1 className="text-3xl font-bold">Roots</h1>
      <p className="mt-1 text-sm text-heruni-ink/60">
        Single-letter: {counts[1]} / 39 · Two-letter: {counts[2]} / 86 · Three-letter:{' '}
        {counts[3]} / 37
      </p>
      <p className="mt-1 text-xs text-heruni-ink/50">
        Heruni&apos;s theory fixes the 162-entry ՏԲ set; glosses, notes, see-also, and symbol
        are editable.
      </p>

      {totalGap > 0 && (
        <div className="mt-4 rounded-xl border border-heruni-amber/50 bg-heruni-amber/10 px-4 py-3 text-sm text-heruni-bronze">
          <p className="font-semibold">
            {totalGap} roots still need transcription from book pp. 111–113
          </p>
          <p className="mt-1 text-xs">
            Missing: {gap2} two-letter (book p. 112) · {gap3} three-letter (book p. 113).
            The book PDF ships in image-scan form, so this step is manual: download the
            template below, fill in the <code>token</code>, <code>meaning_hy</code>, and{' '}
            <code>meaning_en</code> columns from the book, and re-upload.
          </p>
        </div>
      )}

      <div className="mt-6">
        <RootImport />
      </div>

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
              <td className="p-2 text-lg font-bold" lang="hy">
                {r.token}
              </td>
              <td className="p-2 font-mono">{r.length}</td>
              <td className="p-2 text-xs" lang="hy">
                {parseList(r.meaningHy).join(', ')}
              </td>
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
