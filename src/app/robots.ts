import type { MetadataRoute } from 'next';

function baseUrl() {
  return (process.env.SITE_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    ''
  );
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }
    ],
    sitemap: `${baseUrl()}/sitemap.xml`,
    host: baseUrl()
  };
}
