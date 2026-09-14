import { db } from '@/lib/db';
import type { Client } from '@neondatabase/serverless';
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

type RevisionConnection = Pick<Client, 'query'>;

export type PageRevisionInput = {
  tenantId: string;
  pageId: string;
  blocks: BlockInstance[];
  revision: string;
  origin: RevisionOrigin;
  summary?: string;
};

/**
 * Guarda o estado anterior do rascunho antes de sobrescrevê-lo.
 * A conexão pertence à mesma transação da escrita da página, para a ordem do
 * histórico acompanhar a ordem efetiva das edições.
 */
export async function recordPageRevision(
  connection: RevisionConnection,
  input: PageRevisionInput,
): Promise<void> {
  await connection.query(
    `insert into page_revisions
       (tenant_id, page_id, blocks, revision, origin, summary)
     values ($1, $2, $3::jsonb, $4, $5, $6)`,
    [
      input.tenantId,
      input.pageId,
      JSON.stringify(input.blocks),
      input.revision,
      input.origin,
      input.summary ?? null,
    ],
  );
  await connection.query(
    `delete from page_revisions
     where page_id = $1
       and id not in (
         select id from page_revisions
         where page_id = $1
         order by created_at desc, id desc
         limit $2
       )`,
    [input.pageId, MAX_PAGE_REVISIONS],
  );
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
  connection: RevisionConnection,
  tenantId: string,
  pageId: string,
): Promise<PageRevision | undefined> {
  const result = await connection.query(
    `select id, blocks, revision, origin, summary, created_at
     from page_revisions
     where page_id = $1 and tenant_id = $2
     order by created_at desc, id desc
     limit 1
     for update`,
    [pageId, tenantId],
  );
  const [row] = result.rows as Record<string, unknown>[];
  return row ? toRevision(row) : undefined;
}

/** Consome a versão anterior: ela deixa de ser candidata a um novo desfazer. */
export async function dropPageRevision(
  connection: RevisionConnection,
  id: string,
): Promise<void> {
  await connection.query('delete from page_revisions where id = $1', [id]);
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
