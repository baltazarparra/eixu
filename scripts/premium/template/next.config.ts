import type { NextConfig } from 'next';
import { resolve } from 'node:path';
import data from './content/site.json';

type ExportedBrand = {
  logoUrl?: string;
  logoAsset?: { source?: string; icon?: { png32?: string } };
};

const brand = data.tenant.brand as ExportedBrand;
const logoAsset = brand.logoAsset;
const favicon =
  logoAsset && logoAsset.source === brand.logoUrl
    ? logoAsset.icon?.png32
    : undefined;

const config: NextConfig = {
  turbopack: { root: resolve(process.cwd(), '../../..') },
  htmlLimitedBots: /.*/,
  async redirects() {
    return favicon
      ? [
          {
            source: '/favicon.ico',
            destination: favicon,
            permanent: false,
          },
        ]
      : [];
  },
};

export default config;
