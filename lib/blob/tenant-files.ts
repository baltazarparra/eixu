import { del, list, put } from '@vercel/blob';
import { withTenantLock } from '@/lib/tenant-lock';

export type BlobDeps = { list?: typeof list; del?: typeof del };

/**
 * Barra final é obrigatória: sem ela, "tenants/porto" também casaria
 * "tenants/porto-pedras".
 */
export function tenantBlobPrefix(slug: string): string {
  return `tenants/${slug}/`;
}

const BATCH = 100;

export const UPLOAD_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);
export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function checkUpload(file: File): void {
  if (!UPLOAD_TYPES.has(file.type))
    throw new UploadError(`Tipo não aceito: ${file.type}`, 415);
  if (file.size > UPLOAD_MAX_BYTES)
    throw new UploadError('Imagem acima de 8 MB.', 413);
}

/** Nome previsível: canApplyLogo confere o formato do caminho do logo. */
export function uploadFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'imagem'
  );
}

/**
 * Upload do cadastro, antes de o cliente existir. Não passa pelo lock porque
 * não há tenant para travar; um insert recusado apaga o arquivo em seguida.
 */
export async function putNewTenantBlob(slug: string, file: File) {
  checkUpload(file);
  const blob = await put(
    `${tenantBlobPrefix(slug)}logo/${Date.now()}-${uploadFileName(file.name)}`,
    file,
    { access: 'public', addRandomSuffix: false, contentType: file.type },
  );
  return blob.url;
}

/** Todo upload do produto participa do mesmo lock usado pela exclusão. */
export function putTenantBlob(
  tenantId: string,
  path: string,
  body: Parameters<typeof put>[1],
  options: Parameters<typeof put>[2],
) {
  return withTenantLock(tenantId, 'upload', (tenant) =>
    put(`${tenantBlobPrefix(tenant.slug)}${path}`, body, options),
  );
}

/**
 * Apaga tudo o que o cliente tem no Blob: fotos geradas, logos, uploads e a
 * cópia do avatar social. Idempotente, para uma segunda tentativa depois de
 * falha parcial não exigir limpeza manual.
 */
export async function deleteTenantBlobs(
  slug: string,
  deps: BlobDeps = {},
): Promise<{ deleted: number }> {
  const listBlobs = deps.list ?? list;
  const delBlobs = deps.del ?? del;
  const prefix = tenantBlobPrefix(slug);
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const page = await listBlobs({ prefix, cursor, limit: 1000 });
    const urls = page.blobs.map((blob) => blob.url);
    for (let index = 0; index < urls.length; index += BATCH) {
      const batch = urls.slice(index, index + BATCH);
      await delBlobs(batch);
      deleted += batch.length;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return { deleted };
}
