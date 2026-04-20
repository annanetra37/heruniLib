import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma, stringifyInts } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

const schema = z.object({
  code: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  nameHy: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120),
  templateHy: z.string().min(1).max(300),
  templateEn: z.string().min(1).max(300),
  descriptionHy: z.string().nullable().optional(),
  descriptionEn: z.string().nullable().optional(),
  exampleWordIds: z.array(z.number().int().positive()).default([]),
  appliesWhen: z.string().default('{}')
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(params.id);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  try {
    JSON.parse(parsed.data.appliesWhen);
  } catch {
    return NextResponse.json({ error: 'applies_when is not valid JSON' }, { status: 400 });
  }

  const before = await prisma.pattern.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const updated = await prisma.pattern.update({
    where: { id },
    data: {
      code: parsed.data.code,
      nameHy: parsed.data.nameHy,
      nameEn: parsed.data.nameEn,
      templateHy: parsed.data.templateHy,
      templateEn: parsed.data.templateEn,
      descriptionHy: parsed.data.descriptionHy ?? null,
      descriptionEn: parsed.data.descriptionEn ?? null,
      exampleWords: stringifyInts(parsed.data.exampleWordIds),
      appliesWhen: parsed.data.appliesWhen
    }
  });

  await logAudit({
    actorId: Number((session.user as { id?: string }).id ?? 0) || null,
    action: 'pattern.update',
    entity: 'pattern',
    entityId: updated.id,
    diff: { before: { code: before.code }, after: { code: updated.code } }
  });

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(params.id);
  const existing = await prisma.pattern.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Un-link any words that pointed at this pattern so FK stays valid.
  await prisma.word.updateMany({ where: { patternId: id }, data: { patternId: null } });
  await prisma.aiDraft.updateMany({ where: { patternId: id }, data: { patternId: null } });
  await prisma.pattern.delete({ where: { id } });

  await logAudit({
    actorId: Number((session.user as { id?: string }).id ?? 0) || null,
    action: 'pattern.delete',
    entity: 'pattern',
    entityId: id,
    diff: { before: { code: existing.code } }
  });

  return NextResponse.json({ ok: true });
}
