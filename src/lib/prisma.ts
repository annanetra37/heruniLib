import { PrismaClient } from '@prisma/client';

// Singleton Prisma client — avoids exhausting connections on dev hot-reload.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

export type RootRecord = Awaited<ReturnType<typeof prisma.root.findFirst>>;
export type WordRecord = Awaited<ReturnType<typeof prisma.word.findFirst>>;

// Helpers: the brief's Postgres schema uses text[] and int[] columns.
// In SQLite we store them as JSON strings; these helpers make the app layer
// indifferent to the backing store. When migrating to Postgres, these become
// pass-throughs returning the native array.
export const parseList = (s: string | null | undefined): string[] => {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

export const parseInts = (s: string | null | undefined): number[] => {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
};
