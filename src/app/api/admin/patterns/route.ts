import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma, stringifyInts } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

const schema = z.object({
  code: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/, 'lowercase letters, digits and _ only'),
  nameHy: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120),
  templateHy: z.string().min(1).max(300),
  templateEn: z.string().min(1).max(300),
  descriptionHy: z.string().nullable().optional(),
  descriptionEn: z.string().nullable().optional(),
  exampleWordIds: z.array(z.number().int().positive()).default([]),
  appliesWhen: z.string().default('{}')
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  try {
    JSON.parse(parsed.data.appliesWhen);
  } catch {
    return NextResponse.json({ error: 'applies_when is not valid JSON' }, { status: 400 });
  }

  try {
    const created = await prisma.pattern.create({
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
      action: 'pattern.create',
      entity: 'pattern',
      entityId: created.id,
      diff: { after: { code: created.code } }
    });

    return NextResponse.json({ id: created.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
