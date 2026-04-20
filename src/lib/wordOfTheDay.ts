// Deterministic daily rotation through published words (v2 §5.3).
//
// Given a date (defaults to today in UTC), returns a stable index into a
// sorted list so every user lands on the same word each day. Sort is by
// id, which is append-only, so adding a new word doesn't shift yesterday's
// word out — the rotation only grows forward.
//
// This runs in a server component on every render; no cron needed. Redis
// caching (Batch 9 §6.1) will wrap the homepage response to avoid hitting
// the DB on every hit.

import { prisma } from './prisma';

function dayOfYearUTC(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const diff = d.getTime() - start;
  return Math.floor(diff / 86400000);
}

export async function getWordOfTheDay(date: Date = new Date()) {
  const count = await prisma.word.count({ where: { status: 'published' } });
  if (count === 0) return null;
  const doy = dayOfYearUTC(date);
  // year * 367 to prevent near-identical pick on same doy next year.
  const index = (doy + date.getUTCFullYear() * 367) % count;
  const rows = await prisma.word.findMany({
    where: { status: 'published' },
    orderBy: { id: 'asc' },
    skip: index,
    take: 1
  });
  return rows[0] ?? null;
}
