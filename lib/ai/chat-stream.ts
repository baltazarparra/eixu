import { generateId, type UIMessageChunk } from 'ai';
import { changesPreview } from './preview-updates';

export const CHAT_INTERRUPTED =
  'A conexão terminou antes da conclusão. Consulte o resultado salvo no painel.';

/**
 * Uma parada externa pode terminar em tool-calls, sem texto final do modelo.
 * O recibo vem do banco e entra no mesmo stream e histórico que o operador vê.
 */
export function completeChatStream(
  stream: ReadableStream<UIMessageChunk>,
  options: {
    summary: () => Promise<string>;
    persist: (text: string) => Promise<void>;
  },
): ReadableStream<UIMessageChunk> {
  let text = '';
  let finalText = '';
  let ended = false;
  let failed = false;
  const tools = new Map<string, string>();
  const notified = new Set<string>();
  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      async transform(chunk, controller) {
        if (chunk.type === 'tool-input-available')
          tools.set(chunk.toolCallId, chunk.toolName);
        if (chunk.type === 'start-step') finalText = '';
        if (
          chunk.type === 'tool-input-available' ||
          chunk.type === 'tool-output-available' ||
          chunk.type === 'tool-input-error' ||
          chunk.type === 'tool-output-error'
        )
          finalText = '';
        if (chunk.type === 'text-start' && text.trim()) text += '\n\n';
        if (chunk.type === 'text-delta') {
          text += chunk.delta;
          finalText += chunk.delta;
        }
        if (chunk.type === 'error') failed = true;
        if (chunk.type === 'abort') ended = true;
        if (
          chunk.type === 'tool-input-error' ||
          chunk.type === 'tool-output-error'
        ) {
          // Estes eventos são recuperáveis pelo loop; não anunciam falha do turno.
          controller.enqueue({
            ...chunk,
            errorText:
              'Esta tentativa foi recusada. O agente pode corrigir e tentar novamente.',
          });
          return;
        }
        if (chunk.type === 'finish') {
          ended = true;
          if (!failed && !finalText.trim()) {
            const summary = await options.summary();
            const id = generateId();
            const delta = `${text.trim() ? '\n\n' : ''}${summary}`;
            controller.enqueue({ type: 'text-start', id });
            controller.enqueue({ type: 'text-delta', id, delta });
            controller.enqueue({ type: 'text-end', id });
            text += delta;
          }
          if (text.trim()) await options.persist(text.trim());
        }
        controller.enqueue(chunk);
        if (
          chunk.type === 'tool-output-available' &&
          !chunk.preliminary &&
          !notified.has(chunk.toolCallId) &&
          changesPreview(tools.get(chunk.toolCallId) ?? '', chunk.output)
        ) {
          notified.add(chunk.toolCallId);
          // Entrega antes da próxima resposta do modelo e sem uma consulta
          // adicional ao banco. Não entra no histórico nem no contexto do agente.
          controller.enqueue({
            type: 'data-preview-update',
            transient: true,
            data: { toolCallId: chunk.toolCallId },
          });
        }
      },
      flush(controller) {
        if (!ended && !failed)
          controller.enqueue({ type: 'error', errorText: CHAT_INTERRUPTED });
      },
    }),
  );
}
