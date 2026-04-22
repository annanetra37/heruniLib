import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma, stringifyInts, stringifyList } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { revalidatePath, revalidateTag } from 'next/cache';
import { tags } from '@/lib/cache';
import { normaliseHy } from '@/lib/normaliseHy';

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
  slug: z.string().min(1).max(100),
  classicalEtymologyHy: z.string().nullable().optional(),
  classicalEtymologyEn: z.string().nullable().optional(),
  classicalSourceRef: z.array(z.string()).optional(),
  firstAttestation: z.string().nullable().optional(),
  usagePeriod: z
    .enum(['grabar', 'middle-armenian', 'ashkharhabar', 'modern', 'pan-historic'])
    .nullable()
    .optional(),
  historicalUsageHy: z.string().nullable().optional(),
  historicalUsageEn: z.string().nullable().optional(),
  culturalNotesHy: z.string().nullable().optional(),
  culturalNotesEn: z.string().nullable().optional(),
  relatedWordIds: z.array(z.number().int().positive()).optional(),
  heruniBookRefs: z.array(z.number().int().positive()).optional(),
  patternId: z.number().int().positive().nullable().optional()
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
      wordHy: normaliseHy(parsed.data.wordHy),
      transliteration: parsed.data.transliteration,
      decomposition: parsed.data.decomposition,
      rootSequence: stringifyInts(parsed.data.rootSequence),
      suffix: parsed.data.suffix ?? null,
      meaningHy: parsed.data.meaningHy,
      meaningEn: parsed.data.meaningEn,
      category: parsed.data.category,
      source: parsed.data.source,
      confidence: parsed.data.confidence,
      status: parsed.data.status,
      slug: parsed.data.slug,
      classicalEtymologyHy: parsed.data.classicalEtymologyHy ?? null,
      classicalEtymologyEn: parsed.data.classicalEtymologyEn ?? null,
      classicalSourceRef: parsed.data.classicalSourceRef
        ? stringifyList(parsed.data.classicalSourceRef)
        : null,
      firstAttestation: parsed.data.firstAttestation ?? null,
      usagePeriod: parsed.data.usagePeriod ?? null,
      historicalUsageHy: parsed.data.historicalUsageHy ?? null,
      historicalUsageEn: parsed.data.historicalUsageEn ?? null,
      culturalNotesHy: parsed.data.culturalNotesHy ?? null,
      culturalNotesEn: parsed.data.culturalNotesEn ?? null,
      relatedWordIds: parsed.data.relatedWordIds
        ? stringifyInts(parsed.data.relatedWordIds)
        : null,
      heruniBookRefs: parsed.data.heruniBookRefs
        ? stringifyInts(parsed.data.heruniBookRefs)
        : null,
      patternId: parsed.data.patternId ?? null
    }
  });

  await logAudit({
    actorId: Number((session.user as { id?: string }).id ?? 0) || null,
    action: 'word.update',
    entity: 'word',
    entityId: updated.id,
    diff: {
      before: { status: before.status, meaningHy: before.meaningHy, patternId: before.patternId },
      after: { status: updated.status, meaningHy: updated.meaningHy, patternId: updated.patternId }
    }
  });

  revalidatePath(`/hy/words/${updated.slug}`);
  revalidatePath(`/en/words/${updated.slug}`);
  revalidatePath('/hy/words');
  revalidatePath('/en/words');
  revalidateTag(tags.word(updated.slug));
  if (before.slug !== updated.slug) revalidateTag(tags.word(before.slug));
  revalidateTag(tags.wordsList());

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(params.id);
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
