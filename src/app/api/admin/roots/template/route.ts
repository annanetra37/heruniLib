import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, parseList } from '@/lib/prisma';

// GET /api/admin/roots/template — downloads a CSV template seeded with
// every currently-entered root PLUS explicit empty slots for every Heruni
// ՏԲ entry we don't have yet. Editor fills the empty-gloss rows directly
// from the book (pp. 111-113) and re-uploads via the bulk-import form.
//
// The "which two-letter / three-letter tokens exist in Heruni's table" is
// the editorial knowledge we don't have programmatically. The template
// therefore only scaffolds the 39 single-letter rows (known) and leaves
// the length-2 and length-3 pools partially filled with what we already
// have — the editor adds rows by typing the Armenian token in the first
// column, glosses in the next two. Structure, not content.

export const dynamic = 'force-dynamic';

function csvField(value: unknown): string {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  }

  const existing = await prisma.root.findMany({
    orderBy: [{ length: 'asc' }, { token: 'asc' }]
  });

  const header = [
    'token',
    'length',
    'meaning_hy',
    'meaning_en',
    'symbol',
    'book_page',
    'notes_hy',
    'notes_en'
  ];

  const rows: string[] = [header.join(',')];

  for (const r of existing) {
    rows.push(
      [
        r.token,
        r.length,
        parseList(r.meaningHy).join(' ; '),
        parseList(r.meaningEn).join(' ; '),
        r.symbol ?? '',
        r.bookPage,
        r.notesHy ?? '',
        r.notesEn ?? ''
      ]
        .map(csvField)
        .join(',')
    );
  }

  // Empty-slot rows to prompt editors. We know Heruni's theoretical counts
  // are 39 + 86 + 37 = 162; if any count is short, append empty rows the
  // editor fills with (token, glosses) from the book.
  const counts = {
    1: existing.filter((r) => r.length === 1).length,
    2: existing.filter((r) => r.length === 2).length,
    3: existing.filter((r) => r.length === 3).length
  };
  const gaps = [
    { length: 2, needed: 86 - counts[2] },
    { length: 3, needed: 37 - counts[3] }
  ];
  for (const { length, needed } of gaps) {
    for (let i = 0; i < needed; i += 1) {
      rows.push(['', length, '', '', '', 111 + (length - 1), '', ''].map(csvField).join(','));
    }
  }

  const csv = rows.join('\n') + '\n';
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="heruni-roots-template.csv"'
    }
  });
}
