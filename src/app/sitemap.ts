import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { locales } from '@/i18n/config';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

function baseUrl() {
  return (process.env.SITE_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    ''
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();

  const staticRoutes = ['', '/roots', '/words', '/decompose', '/methodology', '/contribute', '/credits', '/privacy', '/terms'];
  const statics: MetadataRoute.Sitemap = [];
  for (const loc of locales) {
    for (const r of staticRoutes) {
      statics.push({
        url: `${base}/${loc}${r}`,
        changeFrequency: r === '' ? 'weekly' : 'monthly',
        priority: r === '' ? 1 : 0.6
      });
    }
  }

  const [roots, words] = await Promise.all([
    prisma.root.findMany({ select: { token: true, updatedAt: true } }),
    prisma.word.findMany({
      where: { status: 'published' },
      select: { slug: true, updatedAt: true }
    })
  ]);

  const rootPages: MetadataRoute.Sitemap = [];
  for (const loc of locales) {
    for (const r of roots) {
      rootPages.push({
        url: `${base}/${loc}/roots/${encodeURIComponent(r.token)}`,
        lastModified: r.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.7
      });
    }
  }

  const wordPages: MetadataRoute.Sitemap = [];
  for (const loc of locales) {
    for (const w of words) {
      wordPages.push({
        url: `${base}/${loc}/words/${w.slug}`,
        lastModified: w.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.8
      });
    }
  }

  return [...statics, ...rootPages, ...wordPages];
}
