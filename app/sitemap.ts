import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/vibe-coding-para-producao', '/cases/saldopix', '/cases/naiacrm'];
  return routes.map((route, index) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date('2026-08-30'),
    changeFrequency: index <= 1 ? 'monthly' : 'yearly',
    priority: index === 0 ? 1 : index === 1 ? 0.9 : 0.8,
  }));
}
