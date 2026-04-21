import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma, stringifyList } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

// POST /api/admin/roots/bulk  — upsert roots from CSV import.
//
// Heruni's theory fixes the set of roots (162), so we upsert on token
// rather than create/delete freely. New tokens = scaffold entry created;
// existing tokens = glosses replaced.

const row = z.object({
  token: z.string().min(1).max(10),
  length: z.number().int().min(1).max(3),
  meaningHy: z.array(z.string()).default([]),
  meaningEn: z.array(z.string()).default([]),
  symbol: z.string().nullable().optional(),
  bookPage: z.number().int().min(1).max(321).default(111),
  notesHy: z.string().nullable().optional(),
  notesEn: z.string().nullable().optional()
});

const schema = z.object({ rows: z.array(row).min(1).max(500) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  let upserted = 0;
  let skipped = 0;
  for (const r of parsed.data.rows) {
    try {
      await prisma.root.upsert({
        where: { token: r.token },
        update: {
          length: r.length,
          meaningHy: stringifyList(r.meaningHy),
          meaningEn: stringifyList(r.meaningEn),
          symbol: r.symbol ?? null,
          bookPage: r.bookPage,
          notesHy: r.notesHy ?? null,
          notesEn: r.notesEn ?? null
        },
        create: {
          token: r.token,
          length: r.length,
          meaningHy: stringifyList(r.meaningHy),
          meaningEn: stringifyList(r.meaningEn),
          symbol: r.symbol ?? null,
          bookPage: r.bookPage,
          notesHy: r.notesHy ?? null,
          notesEn: r.notesEn ?? null
        }
      });
      upserted += 1;
    } catch {
      skipped += 1;
    }
  }

  await logAudit({
    actorId: Number((session.user as { id?: string }).id ?? 0) || null,
    action: 'root.bulk_upsert',
    entity: 'root',
    entityId: null,
    diff: { upserted, skipped, total: parsed.data.rows.length }
  });

  revalidatePath('/hy/roots');
  revalidatePath('/en/roots');

  return NextResponse.json({ upserted, skipped });
}
