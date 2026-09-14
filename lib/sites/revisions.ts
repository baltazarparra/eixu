import { db } from '@/lib/db';
import type { BlockInstance } from '@/lib/types';

/** Quantas versões do rascunho ficam guardadas por página. */
export const MAX_PAGE_REVISIONS = 20;

export type RevisionOrigin = 'chat' | 'previa' | 'geracao' | 'desfazer';

export type PageRevision = {
  id: string;
  blocks: BlockInstance[];
  revision: string;
  origin: RevisionOrigin;
  summary: string | null;
  createdAt: string;
};

/**
 * Guarda o estado anterior do rascunho antes de sobrescrevê-lo.
 *
 * É melhor esforço de propósito: uma falha aqui não pode impedir a edição que o
 * operador pediu, inclusive num deploy que chegue antes da migração. O que se
 * perde é o desfazer daquele lote, e o recibo só oferece desfazer quando a
 * gravação do histórico confirma.
 */
export async function recordPageRevision(input: {
  tenantId: string;
  pageId: string;
  blocks: BlockInstance[];
  revision: string;
  origin: RevisionOrigin;
  summary?: string;
}): Promise<boolean> {
  try {
    await db()`
      insert into page_revisions (tenant_id, page_id, blocks, revision, origin, summary)
      values (
        ${input.tenantId}, ${input.pageId}, ${JSON.stringify(input.blocks)}::jsonb,
        ${input.revision}, ${input.origin}, ${input.summary ?? null}
      )
    `;
    await db()`
      delete from page_revisions
      where page_id = ${input.pageId}
        and id not in (
          select id from page_revisions
          where page_id = ${input.pageId}
          order by created_at desc, id desc
          limit ${MAX_PAGE_REVISIONS}
        )
    `;
    return true;
  } catch (error) {
    console.warn('[edits] histórico do rascunho não gravado', {
      pageId: input.pageId,
      error: error instanceof Error ? error.name : 'unknown',
    });
    return false;
  }
}

function toRevision(row: Record<string, unknown>): PageRevision {
  return {
    id: String(row.id),
    blocks: (row.blocks ?? []) as BlockInstance[],
    revision: String(row.revision),
    origin: String(row.origin) as RevisionOrigin,
    summary: typeof row.summary === 'string' ? row.summary : null,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

/** A versão anterior mais recente de uma página, se existir. */
export async function lastPageRevision(
  tenantId: string,
  pageId: string,
): Promise<PageRevision | undefined> {
  try {
    const rows = await db()`
      select id, blocks, revision, origin, summary, created_at
      from page_revisions
      where page_id = ${pageId} and tenant_id = ${tenantId}
      order by created_at desc, id desc
      limit 1
    `;
    const [row] = rows as Record<string, unknown>[];
    return row ? toRevision(row) : undefined;
  } catch (error) {
    console.warn('[edits] histórico do rascunho indisponível', {
      pageId,
      error: error instanceof Error ? error.name : 'unknown',
    });
    return undefined;
  }
}

/** Consome a versão anterior: ela deixa de ser candidata a um novo desfazer. */
export async function dropPageRevision(id: string): Promise<void> {
  try {
    await db()`delete from page_revisions where id = ${id}`;
  } catch (error) {
    console.warn('[edits] versão do rascunho não removida', {
      id,
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
}

/** Quais páginas do cliente têm desfazer disponível, para o painel. */
export async function pagesWithUndo(tenantId: string): Promise<string[]> {
  try {
    const rows = await db()`
      select distinct p.slug
      from page_revisions r
      join pages p on p.id = r.page_id
      where r.tenant_id = ${tenantId}
    `;
    return (rows as { slug: string }[]).map((row) => row.slug);
  } catch {
    return [];
  }
}
