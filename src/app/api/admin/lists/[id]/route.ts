import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma, stringifyInts } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

const schema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().nullable().optional(),
  wordIds: z.array(z.number().int().positive()).default([])
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(params.id);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const before = await prisma.wordList.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const updated = await prisma.wordList.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      wordIds: stringifyInts(parsed.data.wordIds)
    }
  });

  await logAudit({
    actorId: Number((session.user as { id?: string }).id ?? 0) || null,
    action: 'word_list.update',
    entity: 'word_list',
    entityId: updated.id,
    diff: { before: { name: before.name }, after: { name: updated.name, count: parsed.data.wordIds.length } }
  });

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(params.id);
  const existing = await prisma.wordList.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await prisma.wordList.delete({ where: { id } });
  await logAudit({
    actorId: Number((session.user as { id?: string }).id ?? 0) || null,
    action: 'word_list.delete',
    entity: 'word_list',
    entityId: id,
    diff: { before: { name: existing.name } }
  });
  return NextResponse.json({ ok: true });
}
