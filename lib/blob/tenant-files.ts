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
