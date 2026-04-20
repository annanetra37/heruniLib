import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

// Minimal endpoint used by the bulk "Assign patterns (tentative)" page.
// Only touches patternId — leaves all other word fields untouched, so it
// can be called on published words without triggering a full re-validate
// of editorial content.
const schema = z.object({
  patternId: z.number().int().positive().nullable()
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

  if (parsed.data.patternId) {
    const exists = await prisma.pattern.findUnique({ where: { id: parsed.data.patternId } });
    if (!exists) return NextResponse.json({ error: 'pattern not found' }, { status: 400 });
  }

  const updated = await prisma.word.update({
    where: { id },
    data: { patternId: parsed.data.patternId }
  });

  await logAudit({
    actorId: Number((session.user as { id?: string }).id ?? 0) || null,
    action: 'word.update_pattern',
    entity: 'word',
    entityId: updated.id,
    diff: { before: { patternId: before.patternId }, after: { patternId: updated.patternId } }
  });

  revalidatePath(`/hy/words/${updated.slug}`);
  revalidatePath(`/en/words/${updated.slug}`);

  return NextResponse.json({ id: updated.id, patternId: updated.patternId });
}
