// Request-context extraction for behaviour tracking.
//
// Reads the fields every tracked event needs — IP, geolocation, device,
// browser, OS — from the incoming request headers. Geo fields come from
// whichever CDN the deployment sits behind:
//   - Cloudflare:  CF-IPCountry, CF-IPCity, CF-Region, CF-Timezone
//   - Vercel:      X-Vercel-IP-Country / -City / -Country-Region
//   - Railway:     X-Country (mirrored from CF by default)
//   - Direct:      all null
// Device/browser/OS buckets are parsed from the User-Agent string.
// Keep it minimal — no UA-parser dependency, just the buckets we need
// to slice the dashboard by.

export type RequestContext = {
  ip: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  locale: string | null;
  userAgent: string | null;
  device: string;
  browser: string | null;
  os: string | null;
  referer: string | null;
};

function firstHeader(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export function extractIp(h: Headers): string | null {
  return (
    firstHeader(h.get('x-forwarded-for')) ??
    h.get('x-real-ip') ??
    h.get('cf-connecting-ip') ??
    h.get('x-vercel-forwarded-for') ??
    null
  );
}

export function extractGeo(h: Headers): {
  country: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
} {
  return {
    country:
      h.get('x-vercel-ip-country') ??
      h.get('cf-ipcountry') ??
      h.get('x-country') ??
      h.get('x-appengine-country') ??
      null,
    city:
      h.get('x-vercel-ip-city') ??
      h.get('cf-ipcity') ??
      h.get('x-appengine-city') ??
      null,
    region:
      h.get('x-vercel-ip-country-region') ??
      h.get('cf-region') ??
      h.get('x-appengine-region') ??
      null,
    timezone: h.get('x-vercel-ip-timezone') ?? h.get('cf-timezone') ?? null
  };
}

export function parseUserAgent(ua: string | null): {
  device: string;
  browser: string | null;
  os: string | null;
} {
  if (!ua) return { device: 'unknown', browser: null, os: null };
  const lower = ua.toLowerCase();

  // Bots first — catches crawlers that might otherwise look like desktop.
  const isBot = /\b(bot|crawler|spider|slurp|mediapartners|facebookexternalhit|embedly|whatsapp|preview)\b/i.test(
    ua
  );

  let device = 'desktop';
  if (isBot) device = 'bot';
  else if (/tablet|ipad/i.test(ua)) device = 'tablet';
  else if (/mobile|phone|android|iphone|blackberry|opera mini/i.test(ua)) device = 'mobile';

  // Browser — order matters: Edge UA contains "Chrome", Chrome contains
  // "Safari" etc. Check most specific first.
  let browser: string | null = null;
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('opr/') || lower.includes('opera')) browser = 'Opera';
  else if (lower.includes('firefox')) browser = 'Firefox';
  else if (lower.includes('chrome') && !lower.includes('chromium')) browser = 'Chrome';
  else if (lower.includes('chromium')) browser = 'Chromium';
  else if (lower.includes('safari')) browser = 'Safari';

  let os: string | null = null;
  if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad') || lower.includes(' like mac os x')) os = 'iOS';
  else if (lower.includes('mac os x') || lower.includes('macintosh')) os = 'macOS';
  else if (lower.includes('linux')) os = 'Linux';
  else if (lower.includes('cros')) os = 'ChromeOS';

  return { device, browser, os };
}

export function parseLocale(h: Headers): string | null {
  const raw = h.get('accept-language');
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim();
  if (!first) return null;
  return first.slice(0, 10);
}

export function getRequestContext(h: Headers): RequestContext {
  const ip = extractIp(h);
  const geo = extractGeo(h);
  const ua = h.get('user-agent');
  const parsed = parseUserAgent(ua);
  return {
    ip,
    country: geo.country,
    city: geo.city,
    region: geo.region,
    timezone: geo.timezone,
    locale: parseLocale(h),
    userAgent: ua,
    device: parsed.device,
    browser: parsed.browser,
    os: parsed.os,
    referer: h.get('referer')
  };
}
