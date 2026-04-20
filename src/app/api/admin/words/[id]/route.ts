import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

const schema = z.object({
  wordHy: z.string().min(1).max(100),
  transliteration: z.string().min(1).max(100),
  decomposition: z.string().min(1).max(200),
  rootSequence: z.array(z.number().int().positive()),
  suffix: z.string().nullable().optional(),
  meaningHy: z.string().min(1),
  meaningEn: z.string().min(1),
  category: z.string().min(1),
  source: z.string().min(1),
  confidence: z.number().int().min(1).max(3),
  status: z.enum(['draft', 'review', 'published']),
  slug: z.string().min(1).max(100)
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(params.id);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const before = await prisma.word.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const updated = await prisma.word.update({
    where: { id },
    data: {
      wordHy: parsed.data.wordHy.toLowerCase(),
      transliteration: parsed.data.transliteration,
      decomposition: parsed.data.decomposition,
      rootSequence: JSON.stringify(parsed.data.rootSequence),
      suffix: parsed.data.suffix ?? null,
      meaningHy: parsed.data.meaningHy,
      meaningEn: parsed.data.meaningEn,
      category: parsed.data.category,
      source: parsed.data.source,
      confidence: parsed.data.confidence,
      status: parsed.data.status,
      slug: parsed.data.slug
    }
  });

  await logAudit({
    actorId: Number((session.user as { id?: string }).id ?? 0) || null,
    action: 'word.update',
    entity: 'word',
    entityId: updated.id,
    diff: { before: { status: before.status, meaningHy: before.meaningHy }, after: { status: updated.status, meaningHy: updated.meaningHy } }
  });

  revalidatePath(`/hy/words/${updated.slug}`);
  revalidatePath(`/en/words/${updated.slug}`);
  revalidatePath('/hy/words');
  revalidatePath('/en/words');

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(params.id);
  // Soft-delete: flip status to "draft" and prefix slug so SEO URLs disappear
  // without destroying editorial history. A second editor can restore later.
  const w = await prisma.word.findUnique({ where: { id } });
  if (!w) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const updated = await prisma.word.update({
    where: { id },
    data: { status: 'draft', slug: `deleted-${Date.now()}-${w.slug}` }
  });

  await logAudit({
    actorId: Number((session.user as { id?: string }).id ?? 0) || null,
    action: 'word.delete',
    entity: 'word',
    entityId: updated.id,
    diff: { before: { status: w.status, slug: w.slug }, after: { status: updated.status, slug: updated.slug } }
  });

  revalidatePath('/hy/words');
  revalidatePath('/en/words');

  return NextResponse.json({ ok: true });
}
