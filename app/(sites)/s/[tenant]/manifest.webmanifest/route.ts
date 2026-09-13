import { getPage, getTenantBySlug } from '@/lib/tenant-queries';
import { publicTenant } from '@/lib/sites/snapshot';
import { currentLogoAsset } from '@/lib/images/logo-schema';
import { logoThemeColor } from '@/lib/sites/logo-metadata';
import { surfaceOf } from '@/lib/blocks/theme';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const draft = await getTenantBySlug(slug);
  const home = draft ? await getPage(draft.id, '') : null;
  if (!draft || !home?.publishedBlocks)
    return new Response('Not Found', {
      status: 404,
      headers: { 'x-robots-tag': 'noindex', 'cache-control': 'no-store' },
    });
  const tenant = publicTenant(draft);
  const asset = currentLogoAsset(tenant.brand);
  return Response.json(
    {
      name: tenant.name,
      short_name: tenant.name,
      start_url: '/',
      display: 'browser',
      background_color: surfaceOf(tenant.brand),
      theme_color: logoThemeColor(tenant.brand, home.publishedBlocks),
      icons: asset
        ? [
            {
              src: asset.icon.png192,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: asset.icon.png512,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: asset.icon.maskable512,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ]
        : [],
    },
    {
      headers: {
        'content-type': 'application/manifest+json',
        'cache-control': 'public, max-age=600',
      },
    },
  );
}
