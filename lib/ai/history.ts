import type { ChatAuthor, ChatMessage } from '@/lib/ai/usage';
import { db } from '@/lib/db';

/** Existência no canal do site, inclusive antes do cursor já entregue à tela. */
export async function hasChatHistory(tenantId: string): Promise<boolean> {
  const rows = (await db()`
    select exists (
      select 1 from chat_messages
      where tenant_id = ${tenantId} and channel = 'site'
    ) as found
  `) as { found: boolean }[];
  return rows[0]?.found === true;
}

/** Um canal só: o estúdio de imagens virou biblioteca, sem conversa própria. */
export async function chatHistory(
  tenantId: string,
  channel: 'site' = 'site',
): Promise<ChatMessage[]> {
  const rows = (await db()`
    select id, role, content, actor_type, actor_name, actor_login from chat_messages
    where tenant_id = ${tenantId} and channel = ${channel}
    order by created_at desc, id desc limit 60
  `) as MessageRow[];
  return rows.reverse().map((row) => ({
    id: `saved-${row.id}`,
    role: row.role,
    parts: [{ type: 'text', text: row.content }],
    metadata: { author: author(row) },
  }));
}

/**
 * Mensagens gravadas depois de um id conhecido. A geração roda no servidor:
 * sem isto, o painel só veria a resposta de uma etapa ao recarregar a página.
 */
export async function messagesAfter(
  tenantId: string,
  afterId: number,
  channel: 'site' = 'site',
): Promise<ChatMessage[]> {
  const rows = (await db()`
    select id, role, content, actor_type, actor_name, actor_login from chat_messages
    where tenant_id = ${tenantId} and channel = ${channel} and id > ${afterId}
    order by id limit 60
  `) as MessageRow[];
  return rows.map((row) => ({
    id: `saved-${row.id}`,
    role: row.role,
    parts: [{ type: 'text', text: row.content }],
    metadata: { author: author(row) },
  }));
}

type MessageRow = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  actor_type: string;
  actor_name: string | null;
  actor_login: string | null;
};

function author(row: MessageRow): ChatAuthor {
  return {
    type:
      row.actor_type === 'user' || row.actor_type === 'agent'
        ? row.actor_type
        : ('legacy' as const),
    ...(row.actor_name ? { name: row.actor_name } : {}),
    ...(row.actor_login ? { login: row.actor_login } : {}),
  };
}

/** Cursor do mesmo lote entregue: uma inserção posterior fica para a próxima leitura. */
export function messageCursor(messages: ChatMessage[], fallback = 0): number {
  const last = messages.at(-1);
  return last ? Number(last.id.replace(/^saved-/, '')) : fallback;
}
