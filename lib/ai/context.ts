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
 * Compacta somente turnos encerrados. As chamadas, resultados e reasoning
 * do loop atual continuam intactos no SDK. Estado editorial vem do servidor.
 * Texto do operador e respostas finais nunca são cortados por esta função.
 */
export function economicalMessages(messages: UIMessage[]): UIMessage[] {
  const lastUser = messages.findLastIndex((message) => message.role === 'user');
  return messages
    .map((message, index) => {
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
          // Mantém a conclusão e a falha, sem repetir páginas completas, schemas
          // ou imagens. Não transforma uma ferramenta interrompida em sucesso.
          parts.push({
            type: 'text',
            text: `[${name}: ${pending ? 'interrompida; confira o estado atual' : failed ? 'recusada' : 'concluída'}${typeof result.error === 'string' ? `; ${result.error}` : ''}]`,
          });
        }
      }
      return { id: message.id, role: message.role, parts };
    })
    .filter((message) => message.parts.length > 0);
}
