import type { UIMessage } from 'ai';

/**
 * Anota no texto a URL das imagens anexadas.
 *
 * O modelo enxerga a imagem pela parte de arquivo, mas não lê a URL dela. Sem
 * essa anotação ele não tem como passar a URL exata para as props de um bloco
 * nem para a referência de um logo.
 */
export function annotateAttachments(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== 'user') return message;
    const files = message.parts.filter((part) => part.type === 'file') as { url: string }[];
    if (!files.length) return message;

    const note = files.map((file) => `[imagem anexada: ${file.url}]`).join('\n');
    const hasText = message.parts.some((part) => part.type === 'text');
    const parts = hasText
      ? message.parts.map((part) =>
          part.type === 'text' ? { ...part, text: `${(part as { text: string }).text}\n${note}` } : part,
        )
      : [...message.parts, { type: 'text' as const, text: note }];
    return { ...message, parts };
  });
}
