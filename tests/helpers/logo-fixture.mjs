import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const real = await jiti.import('../../lib/images/logo-asset.ts');

export function logoAssetFor(source, aspect = 4) {
  const path = 'https://assets.test/logo/asset/123456789abc-v1';
  return {
    version: 1,
    source,
    sourceHash: '123456789abc',
    background: 'transparent',
    master: { url: `${path}/master.png`, width: aspect * 256, height: 256 },
    nav: { url: `${path}/nav.png`, width: aspect * 256, height: 256 },
    svg: { url: `${path}/logo.svg`, bytes: 100, traced: true },
    aspect,
    displayHeight: real.displayHeightFor(aspect),
    preparedAt: '2026-09-12T12:00:00.000Z',
    icon: {
      svg: `${path}/icon.svg`,
      png32: `${path}/icon-32.png`,
      png192: `${path}/icon-192.png`,
      png512: `${path}/icon-512.png`,
      maskable512: `${path}/icon-maskable-512.png`,
      apple180: `${path}/apple-180.png`,
    },
    og: { url: `${path}/og.png`, width: 1200, height: 630 },
  };
}

/** Sharp/traçador reais, só uploads e leitura paga são substituídos. */
export function mockLogoAssets(onUpload = () => {}) {
  const deps = {
    read: async () => null,
    put: async (tenantId, files) =>
      files.map((file) => {
        onUpload({ tenantId, ...file });
        return {
          url: `https://blob.test/tenants/fixture/${file.path}`,
          pathname: file.path,
        };
      }),
  };
  return {
    prepareLogoAsset: (input) => real.prepareLogoAsset(input, deps),
    prepareLogoRendition: (input, options) =>
      real.prepareLogoRendition(input, { ...options, ...deps }),
  };
}
