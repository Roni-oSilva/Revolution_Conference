import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';
export default function robots(): MetadataRoute.Robots {
  const base = publicEnv().siteUrl;
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }], sitemap: `${base}/sitemap.xml` };
}
