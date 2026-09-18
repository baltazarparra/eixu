import type { StudioMessage } from './types';

/**
 * A UI conserva ferramentas e recibos completos. O contexto do próximo turno
 * remove pares terminais de ferramentas inteiros e mantém conversa, anexos e
 * fontes; assim um URL efêmero ou schema antigo não contamina outra execução.
 */
export function studioConversationForModel(
  messages: StudioMessage[],
): StudioMessage[] {
  return messages.slice(-40).map((message) => ({
    ...message,
    parts: message.parts.filter(
      (part) =>
        part.type === 'text' ||
        part.type === 'file' ||
        part.type === 'source-url' ||
        part.type === 'source-document',
    ),
  }));
}
