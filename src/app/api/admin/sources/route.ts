import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma, stringifyList } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

const row = z.object({
  bookPage: z.number().int().min(1).max(321),
  chapter: z.string().nullable().optional(),
  excerptHy: z.string().min(1),
  excerptEn: z.string().nullable().optional(),
  mentionedWords: z.array(z.string()).default([]),
  imageUrl: z.string().url().nullable().optional()
});

const singleSchema = row;
const bulkSchema = z.object({ rows: z.array(row) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  // Detect shape: bulk import uses { rows: [...] }, single create is the row itself.
  const isBulk = body && typeof body === 'object' && Array.isArray((body as { rows: unknown }).rows);

  if (isBulk) {
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    let created = 0;
    let skipped = 0;
    for (const r of parsed.data.rows) {
      try {
        await prisma.source.create({
          data: {
            bookPage: r.bookPage,
            chapter: r.chapter ?? null,
            excerptHy: r.excerptHy,
            excerptEn: r.excerptEn ?? null,
            mentionedWords: stringifyList(r.mentionedWords),
            imageUrl: r.imageUrl ?? null
          }
        });
        created += 1;
      } catch {
        skipped += 1;
      }
    }
    await logAudit({
      actorId: Number((session.user as { id?: string }).id ?? 0) || null,
      action: 'source.bulk_import',
      entity: 'source',
      entityId: null,
      diff: { created, skipped, total: parsed.data.rows.length }
    });
    return NextResponse.json({ created, skipped });
  }

  const parsed = singleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const s = await prisma.source.create({
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
    action: 'source.create',
    entity: 'source',
    entityId: s.id,
    diff: { after: { bookPage: s.bookPage } }
  });

  return NextResponse.json({ id: s.id });
}
