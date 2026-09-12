import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { putTenantBlobs, type TenantBlobFile } from '@/lib/blob/tenant-files';
import { surfaceOf } from '@/lib/blocks/theme';
import { logoSurfaceIssue } from '@/lib/images/logo-fit';
import { measureLogoFit } from '@/lib/images/logo-measure';
import {
  currentLogoAsset,
  logoRenditionSchema,
} from '@/lib/images/logo-schema';
import { safeLogoSvg, traceLogo } from '@/lib/images/logo-trace';
import {
  alphaBounds,
  displayHeightFor,
  markBox,
  removeUniformBackground,
  validReadingBox,
  type RgbaImage,
} from '@/lib/images/logo-pixels';
import type { LogoReading } from '@/lib/images/logo-read';
import type { Brand, LogoAsset, LogoRendition } from '@/lib/types';

export {
  alphaBounds,
  displayHeightFor,
  markBox,
  removeUniformBackground,
} from '@/lib/images/logo-pixels';

export const logoSourceHash = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex').slice(0, 12);

export type LogoAssetDeps = {
  put?: typeof putTenantBlobs;
  read?: (bytes: Buffer) => Promise<LogoReading | null>;
  now?: () => string;
  existing?: LogoRendition;
  dark?: boolean;
};

type LogoInput = {
  tenant: { id: string; slug: string };
  source: string;
  bytes: Buffer;
};

function svgViewport(
  svg: string,
): [number, number, number, number] | undefined {
  const value = svg
    .match(/\bviewBox\s*=\s*['"]([^'"]+)['"]/i)?.[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  return value?.length === 4 &&
    value.every(Number.isFinite) &&
    value[2] > 0 &&
    value[3] > 0
    ? (value as [number, number, number, number])
    : undefined;
}

/** Pixels limpos também são usados antes de salvar/criticar candidatos do modelo. */
export async function cleanLogo(bytes: Buffer) {
  const originalSvg = safeLogoSvg(bytes);
  const meta = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
  const density =
    originalSvg && meta.width && meta.height
      ? Math.min(1200, (72 * 1024) / Math.max(meta.width, meta.height))
      : 72;
  const decoded = await sharp(bytes, { density, limitInputPixels: 40_000_000 })
    .rotate()
    .toColourspace('srgb')
    .ensureAlpha()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cleaned = removeUniformBackground({
    data: decoded.data,
    width: decoded.info.width,
    height: decoded.info.height,
  });
  const bounds = alphaBounds(cleaned);
  const crop =
    bounds &&
    cleaned.background !== 'opaque' &&
    bounds.width * bounds.height >= cleaned.width * cleaned.height * 0.04
      ? bounds
      : { left: 0, top: 0, width: cleaned.width, height: cleaned.height };
  const pad =
    crop === bounds
      ? Math.max(2, Math.round(Math.max(crop.width, crop.height) * 0.02))
      : 0;
  const cropped = await sharp(Buffer.from(cleaned.data), {
    raw: { width: cleaned.width, height: cleaned.height, channels: 4 },
  })
    .extract(crop)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Sharp executa resize antes de extend na mesma pipeline. Redimensionar o
  // resultado evita que o padding leve o master além do limite de 1024 px.
  const master = await sharp(cropped.data, {
    raw: {
      width: cropped.info.width,
      height: cropped.info.height,
      channels: 4,
    },
  })
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .png({ palette: true, quality: 90, effort: 8 })
    .toBuffer();
  const rgba = await sharp(master)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let svg: string | undefined;
  // Um fundo removido do bitmap não pode reaparecer no SVG de origem.
  if (originalSvg && cleaned.background === 'transparent') {
    const view = svgViewport(originalSvg) ?? [
      0,
      0,
      meta.width ?? cleaned.width,
      meta.height ?? cleaned.height,
    ];
    const box = [
      view[0] + ((crop.left - pad) * view[2]) / cleaned.width,
      view[1] + ((crop.top - pad) * view[3]) / cleaned.height,
      ((crop.width + pad * 2) * view[2]) / cleaned.width,
      ((crop.height + pad * 2) * view[3]) / cleaned.height,
    ];
    svg = originalSvg.replace(/<svg\b[^>]*>/i, (tag) =>
      tag
        .replace(/\s(?:width|height|viewBox)\s*=\s*(['"])[\s\S]*?\1/gi, '')
        .replace(
          />$/,
          ` viewBox="${box.join(' ')}" width="${rgba.info.width}" height="${rgba.info.height}">`,
        ),
    );
  }
  return {
    master,
    width: rgba.info.width,
    height: rgba.info.height,
    rgba: {
      data: rgba.data,
      width: rgba.info.width,
      height: rgba.info.height,
    } as RgbaImage,
    background: cleaned.background,
    svg,
  };
}

type Prepared = Awaited<ReturnType<typeof cleanLogo>>;

async function filesForRendition(input: LogoInput, deps: LogoAssetDeps) {
  const clean = await cleanLogo(input.bytes);
  const hash = logoSourceHash(input.bytes);
  const prefix = `logo/asset/${hash}-v1`;
  const traced =
    clean.svg || clean.background === 'opaque'
      ? null
      : await traceLogo(clean.master);
  const svg = clean.svg ?? traced?.svg;
  const nav = await sharp(clean.master)
    .resize({ height: 256 })
    .png({ palette: true, quality: 90 })
    .toBuffer({ resolveWithObject: true });
  const files: TenantBlobFile[] = [];
  const add = (
    name: string,
    body: Buffer | string,
    contentType = 'image/png',
  ) => {
    files.push({
      path: `${prefix}/${name}`,
      body,
      options: {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 31_536_000,
        contentType,
      },
    });
  };
  add('master.png', clean.master);
  add('nav.png', nav.data);
  if (svg) add('logo.svg', svg, 'image/svg+xml');
  const rendition = (urls: Map<string, string>): LogoRendition => ({
    version: 1,
    source: input.source,
    sourceHash: hash,
    background: clean.background,
    master: {
      url: urls.get('master.png')!,
      width: clean.width,
      height: clean.height,
    },
    nav: {
      url: urls.get('nav.png')!,
      width: nav.info.width,
      height: nav.info.height,
    },
    ...(svg
      ? {
          svg: {
            url: urls.get('logo.svg')!,
            bytes: Buffer.byteLength(svg),
            traced: !clean.svg,
          },
        }
      : {}),
    aspect: clean.width / clean.height,
    displayHeight: displayHeightFor(clean.width / clean.height),
    preparedAt: deps.now?.() ?? new Date().toISOString(),
  });
  return { clean, svg, files, add, rendition };
}

async function upload(
  input: LogoInput,
  files: TenantBlobFile[],
  deps: LogoAssetDeps,
) {
  const blobs = await (deps.put ?? putTenantBlobs)(input.tenant.id, files);
  return new Map(
    files.map((file, index) => [
      file.path.split('/').at(-1)!,
      blobs[index].url,
    ]),
  );
}

export async function prepareLogoRendition(
  input: LogoInput,
  deps: LogoAssetDeps = {},
): Promise<{ rendition: LogoRendition; master: Buffer }> {
  const existing = logoRenditionSchema.safeParse(deps.existing);
  if (
    existing.success &&
    existing.data.source === input.source &&
    existing.data.sourceHash === logoSourceHash(input.bytes)
  )
    return {
      rendition: existing.data,
      master: (await cleanLogo(input.bytes)).master,
    };
  const prepared = await filesForRendition(input, deps);
  if (deps.dark) {
    const nav = prepared.files.find((file) => file.path.endsWith('/nav.png'))!;
    nav.path = nav.path.replace(/nav\.png$/, 'nav-dark.png');
    const urls = await upload(input, [nav], deps);
    const rendition = prepared.rendition(
      new Map([
        ['master.png', input.source],
        ['nav.png', urls.get('nav-dark.png')!],
      ]),
    );
    delete rendition.svg;
    return { rendition, master: prepared.clean.master };
  }
  const urls = await upload(input, prepared.files, deps);
  return { rendition: prepared.rendition(urls), master: prepared.clean.master };
}

function iconCrop(clean: Prepared, box?: [number, number, number, number]) {
  if (!box) return sharp(clean.master);
  const left = Math.floor(box[0] * clean.width),
    top = Math.floor(box[1] * clean.height);
  return sharp(clean.master).extract({
    left,
    top,
    width: Math.min(clean.width - left, Math.ceil(box[2] * clean.width)),
    height: Math.min(clean.height - top, Math.ceil(box[3] * clean.height)),
  });
}

async function iconPng(
  clean: Prepared,
  size: number,
  paper: string,
  plate: string,
  box?: [number, number, number, number],
  maskable = false,
) {
  const extent = Math.round(size * (maskable ? 0.6 : 0.76));
  const art = await iconCrop(clean, box)
    .resize(extent, extent, { fit: 'inside' })
    .png()
    .toBuffer();
  const background = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${paper}"/><rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${size * 0.18}" fill="${plate}"/></svg>`,
  );
  return sharp(background)
    .composite([{ input: art, gravity: 'centre' }])
    .removeAlpha()
    .png()
    .toBuffer();
}

function iconSvg(
  svg: string,
  paper: string,
  plate: string,
  box?: [number, number, number, number],
) {
  const view = svgViewport(svg)!;
  const area = box
    ? [
        view[0] + box[0] * view[2],
        view[1] + box[1] * view[3],
        box[2] * view[2],
        box[3] * view[3],
      ]
    : view;
  const inner = svg
    .slice(svg.indexOf('>', svg.indexOf('<svg')) + 1)
    .replace(/<\/svg\s*>\s*$/i, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${paper}"/><rect x="1" y="1" width="510" height="510" rx="92" fill="${plate}"/><svg x="61" y="61" width="390" height="390" viewBox="${area.join(' ')}" preserveAspectRatio="xMidYMid meet">${inner}</svg></svg>`;
}

export async function prepareLogoAsset(
  input: LogoInput & {
    tenant: { id: string; slug: string; name: string; brand: Brand };
    read?: boolean;
  },
  deps: LogoAssetDeps = {},
): Promise<{ asset: LogoAsset; master: Buffer }> {
  const existing = currentLogoAsset(input.tenant.brand);
  if (
    existing?.source === input.source &&
    existing.sourceHash === logoSourceHash(input.bytes)
  )
    return { asset: existing, master: (await cleanLogo(input.bytes)).master };
  const prepared = await filesForRendition(input, deps);
  const { clean } = prepared;
  const reading = input.read
    ? await (
        deps.read ??
        (async (bytes: Buffer) =>
          (await import('@/lib/images/logo-read')).readLogo(bytes))
      )(clean.master).catch(() => null)
    : null;
  const component = markBox(clean.rgba);
  const readBox = reading?.simbolo_bbox ?? undefined;
  const box =
    component ?? (validReadingBox(clean.rgba, readBox) ? readBox : undefined);
  const paper = surfaceOf(input.tenant.brand);
  const fit = await measureLogoFit(clean.master, input.source);
  const plate = logoSurfaceIssue(fit, paper)
    ? fit.opaqueLuminance < 0.5
      ? '#ffffff'
      : '#0b0e14'
    : paper;
  const icons = [
    [32, 'icon-32.png'],
    [192, 'icon-192.png'],
    [512, 'icon-512.png'],
    [512, 'icon-maskable-512.png'],
    [180, 'apple-180.png'],
  ] as const;
  const outputs = await Promise.all(
    icons.map(async ([size, name]) => ({
      name,
      data: await iconPng(
        clean,
        size,
        paper,
        plate,
        box,
        name.includes('maskable'),
      ),
    })),
  );
  outputs.forEach(({ name, data }) => prepared.add(name, data));
  if (prepared.svg)
    prepared.add(
      'icon.svg',
      iconSvg(prepared.svg, paper, plate, box),
      'image/svg+xml',
    );
  const ogLogo = await sharp(clean.master)
    .resize(720, 315, { fit: 'inside' })
    .png()
    .toBuffer();
  const ogPlate =
    plate === paper
      ? []
      : [
          {
            input: Buffer.from(
              `<svg width="840" height="435" xmlns="http://www.w3.org/2000/svg"><rect width="840" height="435" rx="36" fill="${plate}"/></svg>`,
            ),
            gravity: 'centre' as const,
          },
        ];
  const ogComposite = await sharp({
    create: { width: 1200, height: 630, channels: 3, background: paper },
  })
    .composite([...ogPlate, { input: ogLogo, gravity: 'centre' }])
    .png()
    .toBuffer();
  const og = await sharp(ogComposite).removeAlpha().png().toBuffer();
  prepared.add('og.png', og);
  const urls = await upload(input, prepared.files, deps);
  return {
    master: clean.master,
    asset: {
      ...prepared.rendition(urls),
      icon: {
        ...(prepared.svg ? { svg: urls.get('icon.svg')! } : {}),
        png32: urls.get('icon-32.png')!,
        png192: urls.get('icon-192.png')!,
        png512: urls.get('icon-512.png')!,
        maskable512: urls.get('icon-maskable-512.png')!,
        apple180: urls.get('apple-180.png')!,
      },
      og: { url: urls.get('og.png')!, width: 1200, height: 630 },
      ...(box
        ? { mark: { box, from: component ? 'componentes' : 'leitura' } }
        : {}),
      ...(reading
        ? {
            reading: {
              nome: reading.nome_lido,
              tipo: reading.tipo,
              readAt: deps.now?.() ?? new Date().toISOString(),
            },
          }
        : {}),
    },
  };
}
