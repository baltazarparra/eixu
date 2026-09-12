import { getPage, getTenantBySlug } from '@/lib/tenant-queries';
import { publicTenant } from '@/lib/sites/snapshot';
import { currentLogoAsset } from '@/lib/images/logo-schema';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  const home = tenant ? await getPage(tenant.id, '') : null;
  const asset =
    tenant && home?.publishedBlocks
      ? currentLogoAsset(publicTenant(tenant).brand)
      : undefined;
  if (!asset)
    return new Response('Not Found', {
      status: 404,
      headers: { 'x-robots-tag': 'noindex', 'cache-control': 'no-store' },
    });
  return new Response(null, {
    status: 302,
    headers: {
      location: asset.icon.png32,
      'cache-control': 'public, max-age=600',
    },
  });
}
