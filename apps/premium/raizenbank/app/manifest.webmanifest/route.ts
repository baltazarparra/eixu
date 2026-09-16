import { currentLogoAsset } from '@/lib/images/logo-schema';
import { logoThemeColor } from '@/lib/sites/logo-metadata';
import { surfaceOf } from '@/lib/blocks/theme';
import { pages, tenant } from '@/content/site';

export async function GET() {
  const home = pages.find((page) => page.slug === '') ?? pages[0];
  const asset = currentLogoAsset(tenant.brand);
  return Response.json(
    {
      name: tenant.name,
      short_name: tenant.name,
      start_url: '/',
      display: 'browser',
      background_color: surfaceOf(tenant.brand),
      theme_color: logoThemeColor(tenant.brand, home?.blocks ?? []),
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
