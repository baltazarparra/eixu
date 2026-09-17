import { tenant } from '@/content/site';

export async function GET() {
  const origin = `https://${tenant.slug}.eixu.com.br`;
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
    { headers: { 'content-type': 'text/plain' } },
  );
}
