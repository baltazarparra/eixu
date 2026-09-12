import { z } from 'zod';
import type { Brand } from '@/lib/types';

const image = z.object({
  url: z.url().refine((url) => /^https?:\/\//.test(url)),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
const url = image.shape.url;

export const logoRenditionSchema = z.object({
  version: z.literal(1),
  source: url,
  sourceHash: z.string().regex(/^[a-f0-9]{12}$/),
  background: z.enum(['transparent', 'removed', 'opaque']),
  master: image,
  nav: image,
  svg: z
    .object({ url, bytes: z.number().int().positive(), traced: z.boolean() })
    .optional(),
  aspect: z.number().positive(),
  displayHeight: z.union([
    z.literal(40),
    z.literal(48),
    z.literal(56),
    z.literal(64),
  ]),
  preparedAt: z.iso.datetime(),
});

export const logoAssetSchema = logoRenditionSchema.extend({
  icon: z.object({
    svg: url.optional(),
    png32: url,
    png192: url,
    png512: url,
    maskable512: url,
    apple180: url,
  }),
  og: z.object({ url, width: z.literal(1200), height: z.literal(630) }),
  mark: z
    .object({
      box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      from: z.enum(['componentes', 'leitura']),
    })
    .optional(),
  reading: z
    .object({
      nome: z.string().optional(),
      tipo: z.enum(['wordmark', 'simbolo', 'combinado']),
      readAt: z.iso.datetime(),
    })
    .optional(),
});

/** Brand vem de JSONB legado, sem validação global na leitura. */
export function currentLogoAsset(brand: Brand) {
  const parsed = logoAssetSchema.safeParse(brand.logoAsset);
  return parsed.success && parsed.data.source === brand.logoUrl
    ? parsed.data
    : undefined;
}

export function currentDarkLogoAsset(brand: Brand) {
  const parsed = logoRenditionSchema.safeParse(brand.logoDarkAsset);
  return parsed.success && parsed.data.source === brand.logoDarkUrl
    ? parsed.data
    : undefined;
}
