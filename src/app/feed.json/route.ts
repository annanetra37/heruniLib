import { prisma } from '@/lib/prisma';

// /feed.json — v2 brief §4.6, JSON Feed 1.1 spec.
// Paired with /feed.xml for consumers that prefer JSON.

export const dynamic = 'force-dynamic';

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

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Heruni Dict — new words',
    home_page_url: site,
    feed_url: `${site}/feed.json`,
    language: 'hy',
    description: 'Newly-published Armenian word entries on Heruni Dict.',
    items: words.map((w) => ({
      id: `${site}/hy/words/${w.slug}`,
      url: `${site}/hy/words/${w.slug}`,
      title: w.wordHy,
      content_text: `${w.wordHy} — ${w.meaningHy}`,
      date_published: w.createdAt.toISOString(),
      date_modified: w.updatedAt.toISOString(),
      tags: [w.category]
    }))
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      'content-type': 'application/feed+json; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=900'
    }
  });
}
