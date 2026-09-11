import { isToolUIPart, type UIMessage } from 'ai';
import { z } from 'zod';

export const chatRequestSchema = z
  .object({
    tenant: z
      .string()
      .min(1)
      .max(63)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    page: z.string().max(200).optional(),
    phase: z.enum(['briefing', 'cenas', 'composicao', 'revisao']).optional(),
    messages: z
      .array(
        z
          .object({
            id: z.string().min(1).max(150),
            role: z.enum(['user', 'assistant']),
            parts: z
              .array(
                z
                  .object({ type: z.string() })
                  .loose()
                  .refine((part) => {
                    if (part.type === 'text')
                      return typeof part.text === 'string';
                    if (part.type === 'file')
                      return (
                        typeof part.mediaType === 'string' &&
                        part.mediaType.startsWith('image/') &&
                        typeof part.url === 'string' &&
                        part.url.startsWith('https://') &&
                        part.url.length <= 2048
                      );
                    return true;
                  }),
              )
              .max(500),
          })
          .loose(),
      )
      .min(1)
      .max(200),
  })
  .refine(
    (body) => body.messages.at(-1)?.role === 'user',
    'Envie uma mensagem do operador.',
  )
  .refine(
    (body) =>
      body.messages.reduce(
        (sum, message) =>
          sum +
          message.parts.reduce(
            (n, part) =>
              n + (typeof part.text === 'string' ? part.text.length : 0),
            0,
          ),
        0,
      ) <= 200_000,
    'Conversa extensa demais. Recarregue a página para retomar com o histórico recente.',
  );

/**
 * Preserva quatro turnos recentes completos, inclusive metadados e assinaturas
 * do provedor. Histórico antigo conserva decisões e pendências. O loop ativo
 * é do SDK: nenhuma compactação roda entre seus passos.
 */
export function contextMessages(
  messages: UIMessage[],
  options: { recentTurns?: number; maxRecentChars?: number } = {},
): UIMessage[] {
  const users = messages.flatMap((message, index) =>
    message.role === 'user' ? [index] : [],
  );
  const lastUser = users.at(-1) ?? -1;
  const recentStart = users.at(-(options.recentTurns ?? 4)) ?? 0;
  let remaining = options.maxRecentChars ?? 120_000;
  const intact = new Set<number>();
  for (let index = messages.length - 1; index >= recentStart; index -= 1) {
    const message = messages[index];
    const complete = message.parts.every(
      (part) =>
        !isToolUIPart(part) ||
        part.state === 'output-available' ||
        part.state === 'output-error',
    );
    const size = JSON.stringify(message).length;
    if (complete && size <= remaining) {
      intact.add(index);
      remaining -= size;
    }
  }
  return messages
    .map((message, index) => {
      if (intact.has(index)) return message;
      const parts: UIMessage['parts'] = [];
      for (const part of message.parts) {
        if (part.type === 'text' && typeof part.text === 'string') {
          parts.push({ type: 'text', text: part.text });
        } else if (part.type === 'file' && typeof part.url === 'string') {
          if (index === lastUser) parts.push(part);
          else
            parts.push({ type: 'text', text: `[Anexo anterior: ${part.url}]` });
        } else if (isToolUIPart(part)) {
          const name =
            part.type === 'dynamic-tool' ? part.toolName : part.type.slice(5);
          const output =
            part.state === 'output-available' ? part.output : undefined;
          const result =
            output && typeof output === 'object'
              ? (output as Record<string, unknown>)
              : {};
          const failed =
            part.state === 'output-error' ||
            result.ok === false ||
            Boolean(result.error);
          const pending =
            part.state !== 'output-available' && part.state !== 'output-error';
          const evidence = Object.fromEntries(
            [
              'error',
              'findings',
              'apontamentos',
              'pendencias',
              'publicationPending',
              'medicoes',
              'erros',
              'visual',
              'complete',
              'review',
              'paginas',
            ]
              .filter((key) => result[key] !== undefined)
              .map((key) => [key, result[key]]),
          );
          const details = JSON.stringify(evidence);
          const receipt =
            details.length > 24_000
              ? `${details.slice(0, 24_000)} [Relatório parcial; releia o estado antes de concluir.]`
              : details;
          parts.push({
            type: 'text',
            text: `[${name}: ${pending ? 'interrompida; confira o estado atual' : failed ? 'recusada' : 'executada; confira as pendências'}${typeof result.error === 'string' ? `; ${result.error}` : ''}]${details === '{}' ? '' : `\n${receipt}`}`,
          });
        }
      }
      return { id: message.id, role: message.role, parts };
    })
    .filter((message) => message.parts.length > 0);
}
