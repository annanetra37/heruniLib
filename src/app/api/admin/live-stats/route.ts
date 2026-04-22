import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/live-stats  — polled every few seconds by the monitoring
// page's LiveStats component. Returns a compact JSON snapshot:
//   { activeNow, pageViews5m, generations5m, costUsd5m, events: [...] }
// where "events" is the 25 most-recent rows across PageView +
// AiGenerationCost (merged + sorted by timestamp), so operators get a
// single activity feed instead of having to tail stdout.

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const _5mAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const _1mAgo = new Date(now.getTime() - 60 * 1000);

  const [pageViews5m, generations5m, activeVisitors, recentViews, recentGens] =
    await Promise.all([
      prisma.pageView.count({ where: { createdAt: { gte: _5mAgo } } }),
      prisma.aiGenerationCost.findMany({
        where: { createdAt: { gte: _5mAgo } },
        select: { costUsd: true }
      }),
      // Active right now = named visitors with lastSeenAt within the last
      // 5 min AND at least one pageview in that same window.
      prisma.pageView.findMany({
        where: { createdAt: { gte: _5mAgo }, visitorId: { not: null } },
        select: { visitorId: true },
        distinct: ['visitorId']
      }),
      prisma.pageView.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          path: true,
          locale: true,
          visitorId: true,
          ip: true,
          createdAt: true
        }
      }),
      prisma.aiGenerationCost.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          wordHy: true,
          kind: true,
          costUsd: true,
          visitorId: true,
          editorId: true,
          createdAt: true
        }
      })
    ]);

  // Resolve visitor names for the recent-events feed.
  const visitorIds = Array.from(
    new Set(
      [
        ...recentViews.map((v) => v.visitorId),
        ...recentGens.map((g) => g.visitorId)
      ].filter((x): x is string => !!x)
    )
  );
  const visitors = visitorIds.length
    ? await prisma.visitor.findMany({
        where: { id: { in: visitorIds } },
        select: { id: true, firstName: true, lastName: true }
      })
    : [];
  const vById = new Map(
    visitors.map((v) => [v.id, `${v.firstName}${v.lastName ? ' ' + v.lastName : ''}`])
  );

  // Anonymous-visitor count = pageviews in last 5m with no visitorId.
  const anonViewsCount = recentViews.filter(
    (v) => v.createdAt >= _5mAgo && !v.visitorId
  ).length;

  const costUsd5m = generations5m.reduce((a, r) => a + r.costUsd, 0);

  // Merge the two event streams into one reverse-chronological feed.
  type FeedItem =
    | {
        type: 'view';
        id: string;
        at: string;
        path: string;
        locale: string | null;
        visitor: string | null;
        ip: string | null;
      }
    | {
        type: 'gen';
        id: string;
        at: string;
        word: string;
        kind: string;
        costUsd: number;
        visitor: string | null;
        editorId: number | null;
      };

  const feed: FeedItem[] = [
    ...recentViews.map(
      (v): FeedItem => ({
        type: 'view',
        id: `v${v.id}`,
        at: v.createdAt.toISOString(),
        path: v.path,
        locale: v.locale,
        visitor: v.visitorId ? vById.get(v.visitorId) ?? null : null,
        ip: v.ip
      })
    ),
    ...recentGens.map(
      (g): FeedItem => ({
        type: 'gen',
        id: `g${g.id}`,
        at: g.createdAt.toISOString(),
        word: g.wordHy,
        kind: g.kind,
        costUsd: g.costUsd,
        visitor: g.visitorId ? vById.get(g.visitorId) ?? null : null,
        editorId: g.editorId
      })
    )
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 30);

  return NextResponse.json(
    {
      activeNow: activeVisitors.length,
      activeAnonymous: anonViewsCount,
      pageViews5m,
      generations5m: generations5m.length,
      costUsd5m,
      lastMinuteViews: recentViews.filter((v) => v.createdAt >= _1mAgo).length,
      feed
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
