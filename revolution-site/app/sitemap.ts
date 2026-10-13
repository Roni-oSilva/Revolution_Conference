import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';
export const dynamic = 'force-dynamic';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicEnv().siteUrl;
  return ['', '/ao-vivo', '/mural', '/privacidade'].map((p) => ({ url: `${base}${p}`, changeFrequency: 'daily', priority: p === '' ? 1 : 0.7 }));
}
