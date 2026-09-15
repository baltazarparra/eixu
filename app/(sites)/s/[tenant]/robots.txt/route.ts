import { getTenantBySlug } from '@/lib/tenant-queries';
import { isTenantPublic } from '@/lib/sites/availability';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  if (!isTenantPublic(await getTenantBySlug(tenant)))
    return new Response('Not found', {
      status: 404,
      headers: { 'x-robots-tag': 'noindex', 'cache-control': 'no-store' },
    });
  const host = request.headers.get('host') ?? `${tenant}.eixu.com.br`;
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${protocol}://${host}/sitemap.xml\n`,
    { headers: { 'content-type': 'text/plain' } },
  );
}
