import { prisma } from '@/lib/prisma';

// /feed.xml — v2 brief §4.6. RSS feed of newly-published words.
// Used by Zontik.am social channels for "word of the day" automation.
// Valid RSS 2.0 with the Atom self-link namespace so feed validators are
// happy.

export const dynamic = 'force-dynamic';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const site =
    process.env.SITE_URL?.replace(/\/$/, '') ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ??
    'http://localhost:3000';

  const words = await prisma.word.findMany({
    where: { status: 'published' },
    orderBy: { updatedAt: 'desc' },
    take: 50
  });

  const items = words
    .map((w) => {
      const link = `${site}/hy/words/${w.slug}`;
      const pubDate = new Date(w.updatedAt).toUTCString();
      const desc = `${w.wordHy} — ${w.meaningHy}`;
      return `    <item>
      <title>${escapeXml(w.wordHy)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(desc)}</description>
    </item>`;
    })
    .join('\n');

  const feedUrl = `${site}/feed.xml`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Heruni Dict — new words</title>
    <link>${escapeXml(site)}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <description>Newly-published Armenian word entries on Heruni Dict.</description>
    <language>hy</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=900'
    }
  });
}
