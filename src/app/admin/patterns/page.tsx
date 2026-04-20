import Link from 'next/link';
import { prisma, parseInts } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminPatternsList() {
  const patterns = await prisma.pattern.findMany({ orderBy: { code: 'asc' } });
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Patterns</h1>
        <Link
          href="/admin/patterns/new"
          className="rounded-full bg-heruni-ink px-4 py-2 text-sm font-semibold text-white hover:bg-heruni-sun"
        >
          + New pattern
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-heruni-ink/60">
        Rhetorical templates distilled from Heruni&apos;s ~80 worked reconstructions (v2 brief §3.3).
        Each pattern feeds the AI inference engine in Sprint 3 — examples are what make drafts
        read like Heruni rather than mechanical concatenations.
      </p>
      <table className="mt-6 w-full divide-y rounded-xl border bg-white text-sm">
        <thead className="bg-heruni-amber/10 text-xs uppercase tracking-wider text-heruni-ink/60">
          <tr>
            <th className="p-2 text-left">Code</th>
            <th className="p-2 text-left">Name (hy / en)</th>
            <th className="p-2 text-left">Template (hy)</th>
            <th className="p-2 text-left">Examples</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {patterns.map((p) => {
            const exampleIds = parseInts(p.exampleWords);
            return (
              <tr key={p.id}>
                <td className="p-2 font-mono text-xs">{p.code}</td>
                <td className="p-2">
                  <div lang="hy">{p.nameHy}</div>
                  <div className="text-xs text-heruni-ink/60">{p.nameEn}</div>
                </td>
                <td className="p-2 text-xs" lang="hy">
                  {p.templateHy}
                </td>
                <td className="p-2 text-xs">{exampleIds.length}</td>
                <td className="p-2 text-right">
                  <Link
                    href={`/admin/patterns/${p.id}`}
                    className="text-xs font-semibold text-heruni-sun"
                  >
                    Edit →
                  </Link>
                </td>
              </tr>
            );
          })}
          {patterns.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-xs text-heruni-ink/60">
                No patterns yet. Seed data adds 7 starter patterns on first deploy.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
