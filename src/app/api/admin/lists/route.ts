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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  try {
    const created = await prisma.wordList.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        wordIds: stringifyInts(parsed.data.wordIds)
      }
    });
    await logAudit({
      actorId: Number((session.user as { id?: string }).id ?? 0) || null,
      action: 'word_list.create',
      entity: 'word_list',
      entityId: created.id,
      diff: { after: { name: created.name, count: parsed.data.wordIds.length } }
    });
    return NextResponse.json({ id: created.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
