import { db } from '../db';
import type { BlockInstance } from '../types';
import { compositionSignature } from './profile';

type Row = { blocks?: BlockInstance[] };

/**
 * Compara somente a silhueta estrutural. Nenhum texto, URL, nome ou dado de
 * outro cliente sai desta função.
 */
export async function hasDuplicateComposition(
  tenantId: string,
  blocks: BlockInstance[],
): Promise<boolean> {
  const ownSignature = compositionSignature(blocks);
  const contentBlocks = blocks.filter(
    (block) =>
      !block.type.startsWith('nav.') && !block.type.startsWith('footer.'),
  );
  if (!ownSignature || contentBlocks.length < 4) return false;

  const rows = (await db()`
    select jsonb_agg(
      jsonb_build_object(
        'type', item.block->>'type',
        'props', jsonb_build_object(
          'layout', item.block->'props'->'layout',
          'presentation', jsonb_build_object(
            'tone', item.block->'props'->'presentation'->'tone',
            'edge', item.block->'props'->'presentation'->'edge'
          )
        )
      ) order by item.ordinality
    ) as blocks
    from pages p
    cross join lateral (values ('draft', p.blocks), ('published', p.published_blocks)) as snapshot(kind, blocks)
    cross join lateral jsonb_array_elements(snapshot.blocks)
      with ordinality as item(block, ordinality)
    where p.tenant_id <> ${tenantId}
      and p.slug = ''
      and jsonb_array_length(snapshot.blocks) >= 4
    group by p.id, snapshot.kind
  `) as Row[];
  return rows.some((row) =>
    Array.isArray(row.blocks)
      ? compositionSignature(row.blocks) === ownSignature
      : false,
  );
}
