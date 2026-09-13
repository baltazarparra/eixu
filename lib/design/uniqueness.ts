import { db } from '../db';
import {
  SILHOUETTE_LIMIT,
  silhouette,
  orderedSilhouetteSimilarity,
  silhouetteSimilarity,
  uniquenessSilhouette,
} from '../taste/metrics';
import type { BlockInstance } from '../types';
import {
  compositionSignature,
  designDistance,
  isDesignProfile,
  type DesignProfile,
} from './profile';

type Row = { blocks?: BlockInstance[]; design?: unknown };

export type CompositionConflict = {
  /** Quanto da silhueta se repete, de 0 a 1. */
  similarity: number;
  /** Seções tipo:layout que os dois projetos têm em comum. */
  shared: string[];
};

/**
 * Compara somente a silhueta estrutural. Nenhum texto, URL, nome ou dado de
 * outro cliente sai desta função.
 *
 * A versão anterior exigia igualdade exata da sequência, incluindo tom e
 * borda: trocar a cor de fundo de uma seção já passava pela trava. Em
 * 12/09/2026 dois clientes de vibes diferentes tinham 4 das 5 seções da home
 * iguais e nenhuma recusa. No perfil v4 a medida é a proporção de seções
 * repetidas; v2/v3 conservam a comparação exata.
 */
export async function compositionConflict(
  tenantId: string,
  blocks: BlockInstance[],
  design?: Pick<
    DesignProfile,
    'version' | 'heroComposition' | 'navigation' | 'referenceDirection'
  >,
): Promise<CompositionConflict | null> {
  if (design?.version === 6 && design.referenceDirection) return null;
  const legacy = !design?.version || design.version < 4;
  const own =
    (design?.version ?? 0) >= 5
      ? uniquenessSilhouette(blocks, design)
      : silhouette(blocks, design);
  if (own.length < 4) return null;
  const exact = legacy ? compositionSignature(blocks) : undefined;

  const rows = (await db()`
    select
      case when snapshot.kind = 'published'
        then coalesce(t.published_snapshot->'brand', t.brand)->'design'
        else t.brand->'design'
      end as design,
      jsonb_agg(
        jsonb_build_object(
          'id', item.ordinality::text,
          'type', item.block->>'type',
          'props', jsonb_build_object(
            'layout', item.block->'props'->'layout',
            'presentation', jsonb_build_object(
              'tone', item.block->'props'->'presentation'->'tone',
              'edge', item.block->'props'->'presentation'->'edge'
            ),
            'items', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'role', signature_item.value->'role',
                  'image', signature_item.value ? 'image',
                  'cta', signature_item.value ? 'cta'
                ) order by signature_item.ordinality
              )
              from jsonb_array_elements(
                case
                  when jsonb_typeof(item.block->'props'->'items') = 'array'
                    then item.block->'props'->'items'
                  else '[]'::jsonb
                end
              ) with ordinality as signature_item(value, ordinality)
            ), '[]'::jsonb)
          )
        ) order by item.ordinality
      ) as blocks
    from pages p
    join tenants t on t.id = p.tenant_id
    cross join lateral (values ('draft', p.blocks), ('published', p.published_blocks)) as snapshot(kind, blocks)
    cross join lateral jsonb_array_elements(snapshot.blocks)
      with ordinality as item(block, ordinality)
    where p.tenant_id <> ${tenantId}
      and p.slug = ''
      and jsonb_array_length(snapshot.blocks) >= 4
    group by p.id, t.id, snapshot.kind
  `) as Row[];

  let worst: CompositionConflict | null = null;
  for (const row of rows) {
    if (!Array.isArray(row.blocks)) continue;
    if (
      design?.version === 7 &&
      (!isDesignProfile(row.design) ||
        row.design.version !== 7 ||
        !isDesignProfile(design) ||
        designDistance(design, row.design) >= 2)
    )
      continue;
    // v2/v3 conservam a trava exata, inclusive ordem, tom e borda. Só uma
    // recomposição em v4/v5 adota o limite novo de similaridade.
    if (legacy) {
      if (compositionSignature(row.blocks) === exact)
        return { similarity: 1, shared: own };
      continue;
    }
    const otherDesign = row.design as DesignProfile | undefined;
    const other =
      (design?.version ?? 0) >= 5
        ? uniquenessSilhouette(row.blocks, otherDesign)
        : silhouette(row.blocks, otherDesign);
    const similarity =
      (design?.version ?? 0) >= 5 && design?.version !== 7
        ? orderedSilhouetteSimilarity(own, other)
        : silhouetteSimilarity(own, other);
    if (similarity < SILHOUETTE_LIMIT) continue;
    if (worst && worst.similarity >= similarity) continue;
    const pool = [...other];
    const shared: string[] = [];
    for (const section of own) {
      const index = pool.indexOf(section);
      if (index === -1) continue;
      pool.splice(index, 1);
      shared.push(section);
    }
    worst = { similarity, shared };
  }
  return worst;
}

/** Mensagem de recusa, sem revelar o outro cliente. */
export function compositionConflictMessage(
  conflict: CompositionConflict,
): string {
  return `A silhueta da home repete ${Math.round(conflict.similarity * 100)}% de outro cliente. Seções em comum: ${conflict.shared.join(', ')}. Troque tipos ou layouts respeitando o perfil do site.`;
}
