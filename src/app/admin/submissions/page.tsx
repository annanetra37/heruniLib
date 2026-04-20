import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function SubmissionsPage() {
  const subs = await prisma.submission.findMany({ orderBy: { createdAt: 'desc' } });
  return (
    <div>
      <h1 className="text-3xl font-bold">Submissions</h1>
      <table className="mt-6 w-full divide-y rounded-xl border bg-white text-sm">
        <thead className="bg-heruni-amber/10 text-xs uppercase tracking-wider text-heruni-ink/60">
          <tr>
            <th className="p-2 text-left">Word</th>
            <th className="p-2 text-left">Proposal</th>
            <th className="p-2 text-left">Submitter</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Received</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {subs.map((s) => (
            <tr key={s.id}>
              <td className="p-2 text-base font-semibold">{s.wordHy}</td>
              <td className="p-2 text-xs">
                {s.proposedDecomposition || '—'}
                {s.proposedMeaningHy && (
                  <div className="text-heruni-ink/60">{s.proposedMeaningHy}</div>
                )}
              </td>
              <td className="p-2 text-xs">{s.submitterEmail ?? 'anonymous'}</td>
              <td className="p-2 text-xs">{s.status}</td>
              <td className="p-2 text-xs">{s.createdAt.toLocaleString()}</td>
            </tr>
          ))}
          {subs.length === 0 && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-xs text-heruni-ink/50">
                No submissions yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
