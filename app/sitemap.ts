import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/cases/saldopix', '/cases/naiacrm'];
  return routes.map((route, index) => ({
    url: `https://eixu.com.br${route}`,
    lastModified: new Date('2026-08-30'),
    changeFrequency: index === 0 ? 'monthly' : 'yearly',
    priority: index === 0 ? 1 : 0.8,
  }));
}
