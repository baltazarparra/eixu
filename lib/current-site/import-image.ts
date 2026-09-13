import { createHash, randomUUID } from 'node:crypto';
import { del } from '@vercel/blob';
import sharp from 'sharp';
import { putTenantBlob } from '@/lib/blob/tenant-files';
import { insertImage, listImages } from '@/lib/images/queries';
import { publicResource, type PublicResource } from '@/lib/references/network';
import type { TenantImage } from '@/lib/types';
import {
  CURRENT_SITE_IMAGE_MODEL,
  CURRENT_SITE_MAX_IMPORTS,
  type CurrentSiteImageCandidate,
} from '@/lib/current-site/schema';
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export type CurrentSiteImageSelection = CurrentSiteImageCandidate & {
  kind: 'photo' | 'logo';
  selectedAlt: string;
  reason: string;
};

async function readImage(
  input: string,
  request: (url: string) => Promise<PublicResource>,
) {
  let current = input;
  for (let hop = 0; hop < 6; hop++) {
    const resource = await request(current);
    if (REDIRECTS.has(resource.status) && resource.headers.location) {
      current = new URL(resource.headers.location, current).toString();
      continue;
    }
    if (resource.status < 200 || resource.status >= 300)
      throw new Error(`imagem respondeu ${resource.status}`);
    if (!/^image\//i.test(resource.headers['content-type'] ?? ''))
      throw new Error('recurso não é imagem');
    return resource.body;
  }
  throw new Error('redirecionamentos demais');
}

function imported(image: TenantImage, selection: CurrentSiteImageSelection) {
  return {
    id: image.id,
    seq: image.seq,
    url: image.url,
    sourceUrl: selection.url,
    pageUrl: selection.pageUrl,
    kind: image.kind,
    alt: image.alt ?? selection.selectedAlt,
  };
}

/** Copia bytes públicos para o Blob do tenant e registra sua procedência. */
export async function importCurrentSiteImages(
  tenantId: string,
  scanId: string,
  selections: CurrentSiteImageSelection[],
  deps: {
    request?: (url: string) => Promise<PublicResource>;
    existing?: TenantImage[];
  } = {},
) {
  const request = deps.request ?? publicResource;
  const importedImages: ReturnType<typeof imported>[] = [];
  const failures: string[] = [];
  const remember = (
    image: TenantImage,
    selection: CurrentSiteImageSelection,
  ) => {
    if (!importedImages.some((saved) => saved.id === image.id))
      importedImages.push(imported(image, selection));
  };
  const selected = selections
    .filter(
      (selection, index, all) =>
        all.findIndex((other) => other.url === selection.url) === index,
    )
    .slice(0, CURRENT_SITE_MAX_IMPORTS);
  if (!selected.length) return { importedImages, failures };
  const existing = deps.existing ?? (await listImages(tenantId));
  for (const selection of selected) {
    let blobUrl: string | undefined;
    try {
      const bytes = await readImage(selection.url, request);
      const source = sharp(bytes, {
        limitInputPixels: 40_000_000,
        failOn: 'warning',
      });
      const metadata = await source.metadata();
      if (
        !['jpeg', 'png', 'webp', 'heif'].includes(metadata.format ?? '') ||
        (metadata.pages ?? 1) > 1
      )
        throw new Error('formato raster não aceito');
      const output = await source
        .rotate()
        .webp({ quality: 90 })
        .toBuffer({ resolveWithObject: true });
      const { width, height } = output.info;
      const pixels = width * height;
      if (
        selection.kind === 'photo' &&
        (Math.min(width, height) < 240 || pixels < 200_000)
      )
        throw new Error('imagem pequena demais para compor o site');
      if (
        selection.kind === 'logo' &&
        (Math.min(width, height) < 32 || pixels < 4_096)
      )
        throw new Error('logo pequeno demais');
      const digest = createHash('sha256').update(output.data).digest('hex');
      const duplicate = existing.find(
        (image) =>
          image.model === CURRENT_SITE_IMAGE_MODEL &&
          image.blobPath.endsWith(`/${digest}.webp`) &&
          image.status !== 'rejeitada',
      );
      if (duplicate) {
        remember(duplicate, selection);
        continue;
      }
      const divisor = (function gcd(a: number, b: number): number {
        return b ? gcd(b, a % b) : a;
      })(width, height);
      const blob = await putTenantBlob(
        tenantId,
        `current-site/${scanId}/${digest}.webp`,
        output.data,
        {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'image/webp',
        },
      );
      blobUrl = blob.url;
      const saved = await insertImage({
        tenantId,
        batchId: scanId || randomUUID(),
        requestText:
          `Importada de ${selection.pageUrl}: ${selection.reason}`.slice(
            0,
            600,
          ),
        targetBlock: 'livre',
        ratio: `${width / divisor}:${height / divisor}`,
        model: CURRENT_SITE_IMAGE_MODEL,
        promptFinal: '',
        url: blob.url,
        blobPath: blob.pathname,
        kind: selection.kind === 'logo' ? 'logo' : 'foto',
        referenceUrls: [selection.url],
        alt: selection.selectedAlt,
        width,
        height,
      });
      existing.push(saved);
      remember(saved, selection);
    } catch (error) {
      if (blobUrl) await del(blobUrl).catch(() => undefined);
      failures.push(
        `${selection.url}: ${error instanceof Error ? error.message : 'falha ao importar'}`.slice(
          0,
          500,
        ),
      );
    }
  }
  return { importedImages, failures };
}
