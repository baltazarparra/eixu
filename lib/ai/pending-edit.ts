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
export type PendingEditCandidate = {
  id: number;
  content: string;
  edit: PendingEdit;
};
type Sql = ReturnType<typeof db>;

/** A confirmação pertence somente à próxima fala do mesmo operador neste tenant. */
export async function nextPendingEdit(
  sql: Sql,
  tenantId: string,
  userId: string,
): Promise<PendingEditCandidate | null> {
  const rows = (await sql`
    select pending.id, pending.content,
      not exists (
        select 1 from chat_messages later
        where later.tenant_id = ${tenantId}
          and later.admin_user_id = ${userId}
          and later.channel = 'site' and later.role = 'user'
          and later.id > pending.id
      ) as next_turn
    from chat_messages pending
    where pending.tenant_id = ${tenantId}
      and pending.admin_user_id = ${userId}
      and pending.channel = 'edit-pending' and pending.role = 'system'
    order by pending.id desc limit 1
  `) as { id: number; content: string; next_turn: boolean }[];
  if (!rows[0]?.next_turn) return null;
  let stored: unknown;
  try {
    stored = JSON.parse(rows[0].content);
  } catch {
    return null;
  }
  const parsed = pendingSchema.safeParse(stored);
  return parsed.success
    ? { id: rows[0].id, content: rows[0].content, edit: parsed.data }
    : null;
}

export async function storePendingEdit(
  sql: Sql,
  tenantId: string,
  userId: string,
  pending: PendingEdit,
) {
  await sql`
    insert into chat_messages (tenant_id, role, content, channel, admin_user_id, actor_type)
    values (${tenantId}, 'system', ${JSON.stringify(pending)}, 'edit-pending', ${userId}, 'system')
  `;
}

/** Compare-and-swap: somente um turno pode reivindicar a mesma confirmação. */
export async function claimPendingEdit(
  sql: Sql,
  tenantId: string,
  userId: string,
  pending: PendingEditCandidate,
  userMessageId: number | null,
): Promise<boolean> {
  const rows = (await sql`
    update chat_messages pending set content = '{"status":"consumed"}'
    where pending.id = ${pending.id}
      and pending.tenant_id = ${tenantId}
      and pending.admin_user_id = ${userId}
      and pending.channel = 'edit-pending' and pending.role = 'system'
      and pending.content = ${pending.content}
      and not exists (
        select 1 from chat_messages later
        where later.tenant_id = ${tenantId}
          and later.admin_user_id = ${userId}
          and later.channel = 'site' and later.role = 'user'
          and later.id > pending.id
          and (${userMessageId}::bigint is null or later.id < ${userMessageId})
      )
    returning pending.id
  `) as { id: number }[];
  return rows.length === 1;
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
