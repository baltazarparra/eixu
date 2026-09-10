import type { ChatMessage } from '@/lib/ai/usage';

const number = new Intl.NumberFormat('pt-BR');
export function ChatUsageDetails({ messages }: { messages: ChatMessage[] }) {
  const usage = messages.flatMap((message) =>
    message.metadata?.usage ? [message.metadata.usage] : [],
  );
  if (!usage.length) return null;
  const latest = usage.at(-1)!;
  const input = usage.reduce((sum, item) => sum + (item.inputTokens ?? 0), 0);
  const output = usage.reduce((sum, item) => sum + (item.outputTokens ?? 0), 0);
  const cached = usage.reduce(
    (sum, item) => sum + (item.cacheReadTokens ?? 0),
    0,
  );
  const cost = usage.every((item) => item.costUsd !== undefined)
    ? usage.reduce((sum, item) => sum + item.costUsd!, 0)
    : undefined;
  const hasTokens = usage.every((item) => item.totalTokens !== undefined);
  const total = usage.reduce((sum, item) => sum + (item.totalTokens ?? 0), 0);
  return (
    <details className="admin-usage">
      <summary>
        Uso nesta sessão{' '}
        <span>
          {hasTokens ? `${number.format(total)} tokens` : 'Não informado'}
        </span>
      </summary>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        <dt>Entrada</dt>
        <dd>
          {usage.every((u) => u.inputTokens !== undefined)
            ? number.format(input)
            : 'Não informado'}
        </dd>
        <dt>Saída</dt>
        <dd>
          {usage.every((u) => u.outputTokens !== undefined)
            ? number.format(output)
            : 'Não informado'}
        </dd>
        <dt>Entrada em cache</dt>
        <dd>
          {usage.every((u) => u.cacheReadTokens !== undefined)
            ? number.format(cached)
            : 'Não informado'}
        </dd>
        <dt>Última resposta</dt>
        <dd>
          {Math.round(latest.durationMs / 1000)} s · {latest.steps} passos
        </dd>
        <dt>Custo dos chats</dt>
        <dd>
          {cost === undefined
            ? 'Não informado'
            : new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 4,
              }).format(cost)}
        </dd>
      </dl>
      <p className="mt-3 break-words text-[var(--color-muted)]">
        {latest.model}
      </p>
      <p className="mt-2 text-[var(--color-muted)]">
        Contagens dos chats após abrir esta tela. Geração de imagens e críticas
        têm consumo adicional. Tokens não equivalem a um valor em reais.
      </p>
    </details>
  );
}
