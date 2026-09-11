'use client';

import {
  formatCost,
  formatCount,
  formatDuration,
  formatTokens,
  summarizeUsage,
} from '@/lib/admin/usage-summary';
import type { GenerationEvent } from '@/lib/generation/runs';
import type { ChatMessage } from '@/lib/ai/usage';

/**
 * Consumo desta tela. A geração saiu do navegador e passou a gravar o recibo
 * de cada fase no evento de encerramento: somar só as mensagens do stream
 * deixava de fora justamente a parte cara do trabalho.
 */
export function ChatUsageDetails({
  messages,
  events = [],
}: {
  messages: ChatMessage[];
  events?: GenerationEvent[];
}) {
  const usage = summarizeUsage({ messages, events });
  if (!usage.rows.length) return null;
  const { totals } = usage;

  return (
    <details className="admin-usage">
      <summary>
        <span>Consumo</span>
        <span className="admin-usage-total">
          {formatTokens(totals.totalTokens)} · {formatCost(totals.costUsd)}
        </span>
      </summary>

      <table className="admin-usage-table">
        <thead>
          <tr>
            <th scope="col">Etapa</th>
            <th scope="col">Entrada</th>
            <th scope="col">Saída</th>
            <th scope="col">Custo</th>
          </tr>
        </thead>
        <tbody>
          {usage.rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">
                <span>{row.label}</span>
                <small>
                  {row.steps} passos · {formatDuration(row.durationMs)}
                </small>
              </th>
              <td>
                {formatCount(row.inputTokens)}
                {row.cacheReadTokens ? (
                  <small>{formatCount(row.cacheReadTokens)} em cache</small>
                ) : null}
              </td>
              <td>{formatCount(row.outputTokens)}</td>
              <td>{row.costUsd === undefined ? '—' : formatCost(row.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="admin-usage-note">
        {usage.models.join(', ') || 'Modelo não informado'}. Somente chamadas de
        texto desta tela: geração de imagens, críticas internas e execuções
        antigas ficam fora. Custo ausente em qualquer parcela deixa o total sem
        valor, em vez de contá-lo como zero.
      </p>
    </details>
  );
}
