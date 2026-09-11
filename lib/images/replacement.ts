import { transaction } from '@/lib/db';
import type { BlockInstance, TenantImage } from '@/lib/types';

const ALT_FIELDS: Record<string, string> = {
  image: 'imageAlt',
  secondaryImage: 'secondaryImageAlt',
  src: 'alt',
};

/** Troca somente campos de imagem com URL exata, inclusive galerias e abas. */
export function replaceImageInBlocks(
  blocks: BlockInstance[],
  previousUrl: string,
  image: Pick<TenantImage, 'url' | 'alt'>,
): { blocks: BlockInstance[]; changed: boolean } {
  let changed = false;
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== 'object') return value;
    const next = Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, walk(child)]),
    );
    for (const [key, altField] of Object.entries(ALT_FIELDS)) {
      if (next[key] !== previousUrl) continue;
      next[key] = image.url;
      if (image.alt) next[altField] = image.alt;
      changed = true;
    }
    return next;
  };
  const next = blocks.map((block) => ({
    ...block,
    props: walk(block.props) as Record<string, unknown>,
  }));
  return { blocks: changed ? next : blocks, changed };
}

/**
 * Relê os rascunhos sob lock depois da geração. Não sobrescreve uma edição
 * feita durante a chamada de imagem nem altera snapshots publicados ou marca.
 */
export async function replaceDraftImage(
  tenantId: string,
  previous: TenantImage,
  image: TenantImage,
): Promise<string[]> {
  return transaction(async (connection) => {
    const assets = await connection.query(
      'select id, url, status from images where tenant_id = $1 and id = any($2::uuid[]) order by id for share',
      [tenantId, [previous.id, image.id]],
    );
    if (
      !assets.rows.some(
        (row) => row.id === previous.id && row.url === previous.url,
      ) ||
      !assets.rows.some(
        (row) =>
          row.id === image.id &&
          row.url === image.url &&
          row.status !== 'rejeitada',
      )
    )
      throw new Error(
        'A imagem de origem ou a nova versão não está mais disponível neste cliente.',
      );

    const { rows } = await connection.query(
      'select id, slug, blocks from pages where tenant_id = $1 order by id for update',
      [tenantId],
    );
    const pages: string[] = [];
    for (const row of rows) {
      const result = replaceImageInBlocks(
        row.blocks as BlockInstance[],
        previous.url,
        image,
      );
      if (!result.changed) continue;
      await connection.query(
        'update pages set blocks = $1::jsonb, updated_at = now() where tenant_id = $2 and id = $3',
        [JSON.stringify(result.blocks), tenantId, row.id],
      );
      pages.push(`/${row.slug}`);
    }
    return pages;
  });
}
