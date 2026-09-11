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
