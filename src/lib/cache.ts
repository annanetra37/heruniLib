// Tag-based cache wrapper for hot pages (v2 brief §6.1).
//
// Uses Next.js's built-in data cache (`unstable_cache`) with revalidation
// tags. Same mental model as Redis + tags-based invalidation, zero new
// infrastructure — swap to Redis later if a single Next.js instance isn't
// enough (drop-in: replace the bodies below with ioredis GET/SET + pub/sub
// for tag invalidation, keep the same API).
//
// Editor save endpoints call `revalidateTag()` directly (see
// src/app/api/admin/words/[id]/route.ts) so stale word pages flush on save.
// Default TTL is 15 min per the brief.

import { unstable_cache } from 'next/cache';

export const CACHE_TTL_SECONDS = 60 * 15; // 15 min

export const tags = {
  word: (slug: string) => `word:${slug}`,
  root: (token: string) => `root:${token}`,
  pattern: (code: string) => `pattern:${code}`,
  wordsList: () => 'words:list',
  patternsList: () => 'patterns:list'
} as const;

/**
 * Wrap an async loader so its result is cached under the given tags.
 * The `keyParts` array becomes the cache key — ensure it's deterministic
 * (stringify any object args yourself before passing).
 */
export function cached<Args extends readonly unknown[], Result>(
  loader: (...args: Args) => Promise<Result>,
  keyParts: string[],
  tagsToAttach: string[],
  ttlSeconds: number = CACHE_TTL_SECONDS
) {
  return unstable_cache(loader, keyParts, {
    tags: tagsToAttach,
    revalidate: ttlSeconds
  });
}
