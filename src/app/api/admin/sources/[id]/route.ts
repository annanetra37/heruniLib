import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma, stringifyList } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

const schema = z.object({
  bookPage: z.number().int().min(1).max(321),
  chapter: z.string().nullable().optional(),
  excerptHy: z.string().min(1),
  excerptEn: z.string().nullable().optional(),
  mentionedWords: z.array(z.string()).default([]),
  imageUrl: z.string().url().nullable().optional()
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(params.id);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const before = await prisma.source.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const updated = await prisma.source.update({
    where: { id },
    data: {
      bookPage: parsed.data.bookPage,
      chapter: parsed.data.chapter ?? null,
      excerptHy: parsed.data.excerptHy,
      excerptEn: parsed.data.excerptEn ?? null,
      mentionedWords: stringifyList(parsed.data.mentionedWords),
      imageUrl: parsed.data.imageUrl ?? null
    }
  });

  await logAudit({
    actorId: Number((session.user as { id?: string }).id ?? 0) || null,
    action: 'source.update',
    entity: 'source',
    entityId: updated.id,
    diff: { before: { bookPage: before.bookPage }, after: { bookPage: updated.bookPage } }
  });

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(params.id);
  const existing = await prisma.source.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await prisma.source.delete({ where: { id } });

  await logAudit({
    actorId: Number((session.user as { id?: string }).id ?? 0) || null,
    action: 'source.delete',
    entity: 'source',
    entityId: id,
    diff: { before: { bookPage: existing.bookPage } }
  });

  return NextResponse.json({ ok: true });
}
