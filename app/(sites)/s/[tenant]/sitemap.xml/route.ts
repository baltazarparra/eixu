export const dynamic = 'force-dynamic';

import { getTenantBySlug, listPublishedPages } from '@/lib/tenant-queries';

export async function GET(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Not found', { status: 404 });

  const host = request.headers.get('host') ?? `${slug}.eixu.com.br`;
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const base = `${protocol}://${host}`;
  const pages = await listPublishedPages(tenant.id);

  const urls = pages
    .map((page) => {
      const loc = `${base}/${page.slug}`.replace(/\/$/, '') || base;
      const lastmod = page.publishedAt ? `<lastmod>${new Date(page.publishedAt).toISOString()}</lastmod>` : '';
      return `<url><loc>${loc}</loc>${lastmod}</url>`;
    })
    .join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=600' } },
  );
}
