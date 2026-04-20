import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { prisma, parseList, parseInts } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export default async function EditRootPage({ params: { id } }: { params: { id: string } }) {
  const root = await prisma.root.findUnique({ where: { id: Number(id) } });
  if (!root) notFound();

  async function save(formData: FormData) {
    'use server';
    const session = await getServerSession(authOptions);
    if (!session) redirect('/admin/login');

    const meaningHy = String(formData.get('meaningHy') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const meaningEn = String(formData.get('meaningEn') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const symbol = String(formData.get('symbol') ?? '').trim() || null;
    const seeAlso = String(formData.get('seeAlso') ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    const notesHy = String(formData.get('notesHy') ?? '').trim() || null;
    const notesEn = String(formData.get('notesEn') ?? '').trim() || null;

    const before = { meaningHy: root!.meaningHy, meaningEn: root!.meaningEn, symbol: root!.symbol, seeAlso: root!.seeAlso, notesHy: root!.notesHy, notesEn: root!.notesEn };
    const updated = await prisma.root.update({
      where: { id: root!.id },
      data: {
        meaningHy: JSON.stringify(meaningHy),
        meaningEn: JSON.stringify(meaningEn),
        symbol,
        seeAlso: JSON.stringify(seeAlso),
        notesHy,
        notesEn
      }
    });

    await logAudit({
      actorId: Number((session.user as { id?: string }).id ?? 0) || null,
      action: 'root.update',
      entity: 'root',
      entityId: updated.id,
      diff: { before, after: { meaningHy: updated.meaningHy, meaningEn: updated.meaningEn, symbol: updated.symbol, seeAlso: updated.seeAlso, notesHy: updated.notesHy, notesEn: updated.notesEn } }
    });

    revalidatePath(`/hy/roots/${root!.token}`);
    revalidatePath(`/en/roots/${root!.token}`);
    revalidatePath('/hy/roots');
    revalidatePath('/en/roots');
    redirect(`/admin/roots/${root!.id}?saved=1`);
  }

  const field = 'mt-1 w-full rounded-lg border border-heruni-ink/20 bg-white px-3 py-2 text-sm';

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold">
        <span className="mr-3 text-4xl">{root.token}</span>
        <span className="text-sm font-normal text-heruni-ink/60">
          length {root.length} · book p.{root.bookPage} · id {root.id}
        </span>
      </h1>

      <form action={save} className="mt-8 space-y-4 text-sm">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
            Meaning hy (comma-separated)
          </span>
          <textarea
            name="meaningHy"
            defaultValue={parseList(root.meaningHy).join(', ')}
            className={field}
            rows={2}
            lang="hy"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
            Meaning en (comma-separated)
          </span>
          <textarea
            name="meaningEn"
            defaultValue={parseList(root.meaningEn).join(', ')}
            className={field}
            rows={2}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
            Symbol
          </span>
          <input name="symbol" defaultValue={root.symbol ?? ''} className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
            See also (root ids, comma-separated)
          </span>
          <input
            name="seeAlso"
            defaultValue={parseInts(root.seeAlso).join(', ')}
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
            Notes hy
          </span>
          <textarea name="notesHy" defaultValue={root.notesHy ?? ''} className={field} rows={2} lang="hy" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-heruni-ink/60">
            Notes en
          </span>
          <textarea name="notesEn" defaultValue={root.notesEn ?? ''} className={field} rows={2} />
        </label>
        <button
          type="submit"
          className="rounded-full bg-heruni-ink px-5 py-2 font-semibold text-white transition hover:bg-heruni-sun"
        >
          Save
        </button>
      </form>
    </div>
  );
}
