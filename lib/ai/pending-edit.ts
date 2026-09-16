import { z } from 'zod';
import type { db } from '@/lib/db';
import { pageEditSchema, type PageEdit } from '@/lib/ai/page-edits';

const pendingSchema = z.object({
  status: z.literal('ask'),
  pageId: z.string(),
  page: z.string(),
  revision: z.string(),
  blockId: z.string(),
  operations: pageEditSchema.shape.operations,
});

export type PendingEdit = z.infer<typeof pendingSchema>;
type Sql = ReturnType<typeof db>;

/** A confirmação pertence somente à próxima fala do operador deste tenant. */
export async function nextPendingEdit(
  sql: Sql,
  tenantId: string,
): Promise<PendingEdit | null> {
  const rows = (await sql`
    select pending.content,
      not exists (
        select 1 from chat_messages later
        where later.tenant_id = ${tenantId}
          and later.channel = 'site' and later.role = 'user'
          and later.id > pending.id
      ) as next_turn
    from chat_messages pending
    where pending.tenant_id = ${tenantId}
      and pending.channel = 'edit-pending' and pending.role = 'system'
    order by pending.id desc limit 1
  `) as { content: string; next_turn: boolean }[];
  if (!rows[0]?.next_turn) return null;
  let stored: unknown;
  try {
    stored = JSON.parse(rows[0].content);
  } catch {
    return null;
  }
  const parsed = pendingSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

export async function storePendingEdit(
  sql: Sql,
  tenantId: string,
  pending: PendingEdit,
) {
  await sql`
    insert into chat_messages (tenant_id, role, content, channel)
    values (${tenantId}, 'system', ${JSON.stringify(pending)}, 'edit-pending')
  `;
}

export async function consumePendingEdit(sql: Sql, tenantId: string) {
  await sql`
    insert into chat_messages (tenant_id, role, content, channel)
    values (${tenantId}, 'system', '{"status":"consumed"}', 'edit-pending')
  `;
}

/** Guarda o lote original, mas fixa o bloco cuja exclusão foi recusada. */
export function pendingFromAttempt(
  input: PageEdit,
  pageId: string,
  blockId: string,
): PendingEdit | null {
  const removals = input.operations.filter((op) => op.op === 'remove');
  if (removals.length !== 1) return null;
  return {
    status: 'ask',
    pageId,
    page: input.page,
    revision: input.revision,
    blockId,
    operations: input.operations.map((op) =>
      op.op === 'remove' ? { ...op, block: blockId } : op,
    ),
  };
}
