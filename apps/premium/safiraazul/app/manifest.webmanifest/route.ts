import { currentLogoAsset } from '@/lib/images/logo-schema';
import { tenant } from '@/content/site';

/*
 * O campo do site é mineral em todas as páginas, então a cor declarada aqui é
 * a mesma do `viewport`. Derivar a cor do tom de um bloco, como antes, passaria
 * a descrever uma superfície que a composição não usa mais.
 */
const SURFACE = '#0c0a1a';

export async function GET() {
  const asset = currentLogoAsset(tenant.brand);
  return Response.json(
    {
      name: tenant.name,
      short_name: tenant.name,
      start_url: '/',
      display: 'browser',
      background_color: SURFACE,
      theme_color: SURFACE,
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
