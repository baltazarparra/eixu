import { db } from '../db';
import {
  SILHOUETTE_LIMIT,
  silhouette,
  silhouetteSimilarity,
} from '../taste/metrics';
import type { BlockInstance } from '../types';
import type { DesignProfile } from './profile';

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
 * iguais e nenhuma recusa. Agora a medida é a proporção de seções repetidas.
 */
export async function compositionConflict(
  tenantId: string,
  blocks: BlockInstance[],
  design?: Pick<DesignProfile, 'heroComposition' | 'navigation'>,
): Promise<CompositionConflict | null> {
  const own = silhouette(blocks, design);
  if (own.length < 4) return null;

  const rows = (await db()`
    select
      t.brand->'design' as design,
      jsonb_agg(
        jsonb_build_object(
          'id', item.ordinality::text,
          'type', item.block->>'type',
          'props', jsonb_build_object('layout', item.block->'props'->'layout')
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
    const other = silhouette(
      row.blocks,
      row.design as DesignProfile | undefined,
    );
    const similarity = silhouetteSimilarity(own, other);
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
  return `A silhueta da home repete ${Math.round(conflict.similarity * 100)}% de outro cliente. Seções em comum: ${conflict.shared.join(', ')}. Troque tipos, layouts ou a ordem das seções dentro da gramática da vibe.`;
}
