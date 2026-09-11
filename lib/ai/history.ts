import type { ChatMessage } from '@/lib/ai/usage';
import { db } from '@/lib/db';

/** Um canal só: o estúdio de imagens virou biblioteca, sem conversa própria. */
export async function chatHistory(
  tenantId: string,
  channel: 'site' = 'site',
): Promise<ChatMessage[]> {
  const rows = (await db()`
    select id, role, content from chat_messages
    where tenant_id = ${tenantId} and channel = ${channel}
    order by created_at desc, id desc limit 60
  `) as { id: number; role: 'user' | 'assistant'; content: string }[];
  return rows.reverse().map((row) => ({
    id: `saved-${row.id}`,
    role: row.role,
    parts: [{ type: 'text', text: row.content }],
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
    select id, role, content from chat_messages
    where tenant_id = ${tenantId} and channel = ${channel} and id > ${afterId}
    order by id limit 60
  `) as { id: number; role: 'user' | 'assistant'; content: string }[];
  return rows.map((row) => ({
    id: `saved-${row.id}`,
    role: row.role,
    parts: [{ type: 'text', text: row.content }],
  }));
}

/** Cursor do mesmo lote entregue: uma inserção posterior fica para a próxima leitura. */
export function messageCursor(messages: ChatMessage[], fallback = 0): number {
  const last = messages.at(-1);
  return last ? Number(last.id.replace(/^saved-/, '')) : fallback;
}
