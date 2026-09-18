import { validateUIMessages } from 'ai';
import { db } from '@/lib/db';
import type { StudioMessage, StudioMessageMetadata } from './types';

type MessageRow = {
  id: number;
  role: StudioMessage['role'];
  content: string;
  message_uid: string;
  parts: StudioMessage['parts'];
  metadata: StudioMessageMetadata;
  actor_type: string;
  actor_name: string | null;
  actor_login: string | null;
};

function visibleText(message: Pick<StudioMessage, 'parts'>): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function fromRow(row: MessageRow): StudioMessage {
  const metadata = row.metadata ?? {};
  if (!metadata.author)
    metadata.author = {
      type:
        row.actor_type === 'user' || row.actor_type === 'agent'
          ? row.actor_type
          : 'legacy',
      ...(row.actor_name ? { name: row.actor_name } : {}),
      ...(row.actor_login ? { login: row.actor_login } : {}),
    };
  return {
    id: row.message_uid || `legacy-${row.id}`,
    role: row.role,
    parts: row.parts ?? [{ type: 'text', text: row.content }],
    metadata,
  };
}

export async function studioMessages(
  tenantId: string,
  limit = 80,
): Promise<StudioMessage[]> {
  const rows = (await db()`
    select id, role, content, message_uid, parts, metadata,
           actor_type, actor_name, actor_login
    from chat_messages
    where tenant_id = ${tenantId} and channel = 'site'
    order by created_at desc, id desc limit ${limit}
  `) as MessageRow[];
  return validateUIMessages<StudioMessage>({
    messages: rows.reverse().map(fromRow),
  });
}

export async function persistStudioMessage(input: {
  tenantId: string;
  message: StudioMessage;
  actor: {
    id: string;
    type: 'user' | 'agent';
    name: string;
    login: string;
  };
  runId?: string;
}): Promise<boolean> {
  const [message] = await validateUIMessages<StudioMessage>({
    messages: [input.message],
  });
  const rows = (await db()`
    insert into chat_messages (
      tenant_id, role, content, channel, admin_user_id,
      actor_type, actor_name, actor_login, message_uid, parts, metadata,
      studio_run_id
    ) values (
      ${input.tenantId}, ${message.role}, ${visibleText(message)}, 'site',
      ${input.actor.id}, ${input.actor.type}, ${input.actor.name},
      ${input.actor.login}, ${message.id},
      ${JSON.stringify(message.parts)}::jsonb,
      ${JSON.stringify(message.metadata ?? {})}::jsonb,
      ${input.runId ?? null}
    )
    on conflict (tenant_id, channel, message_uid) do nothing
    returning id
  `) as { id: number }[];
  return rows.length === 1;
}

export async function linkMessageToStudioRun(input: {
  tenantId: string;
  messageUid: string;
  runId: string;
}): Promise<void> {
  await db()`
    update chat_messages set studio_run_id = ${input.runId}
    where tenant_id = ${input.tenantId} and channel = 'site'
      and message_uid = ${input.messageUid}
      and studio_run_id is null
  `;
}
