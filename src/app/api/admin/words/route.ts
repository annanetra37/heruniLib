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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  try {
    const created = await prisma.word.create({
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
      action: 'word.create',
      entity: 'word',
      entityId: created.id,
      diff: { after: { wordHy: created.wordHy, status: created.status } }
    });

    revalidatePath('/hy/words');
    revalidatePath('/en/words');

    return NextResponse.json({ id: created.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
