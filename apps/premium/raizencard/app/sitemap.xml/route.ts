import { pages, tenant } from '@/content/site';

function xml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET() {
  const origin = `https://${tenant.slug}.eixu.com.br`;
  const urls = pages
    .filter((page) => page.type !== 'thank_you' && !page.seo.noindex)
    .map((page) => {
      const location = page.slug ? `${origin}/${page.slug}` : origin;
      const lastmod = page.publishedAt
        ? `<lastmod>${xml(new Date(page.publishedAt).toISOString())}</lastmod>`
        : '';
      return `<url><loc>${xml(location)}</loc>${lastmod}</url>`;
    })
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    {
      headers: {
        'content-type': 'application/xml',
        'cache-control': 'public, max-age=600',
      },
    },
  );
}
