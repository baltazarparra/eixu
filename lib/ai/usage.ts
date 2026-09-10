import type { LanguageModelUsage, UIMessage } from 'ai';

export type ChatUsage = {
  model: string;
  phase: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  steps: number;
  durationMs: number;
  costUsd?: number;
};
export type ChatMessage = UIMessage<{ usage?: ChatUsage }>;

export function usageRecord(
  usage: LanguageModelUsage,
  model: string,
  phase: string,
  steps: number,
  started: number,
): ChatUsage {
  return {
    model,
    phase,
    steps,
    durationMs: Date.now() - started,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens,
    cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens,
  };
}

/** Cache do Gateway: mantém o mesmo modelo, prefixo e contrato de qualidade. */
export function gatewayOptions(
  tenantId: string,
  channel: string,
  phase = 'livre',
) {
  return {
    gateway: {
      caching: 'auto' as const,
      user: tenantId,
      tags: ['eixu', channel, phase],
    },
  };
}

/** O evento final pode chegar ao cliente antes do callback de persistência. */
export function usageMetadata(model: string, phase: string, started: number) {
  let steps = 0;
  const costs: unknown[] = [];
  return ({
    part,
  }: {
    part: {
      type: string;
      totalUsage?: LanguageModelUsage;
      providerMetadata?: { gateway?: Record<string, unknown> };
    };
  }) => {
    if (part.type === 'finish-step') {
      steps += 1;
      costs.push(part.providerMetadata?.gateway?.cost);
    }
    if (part.type === 'finish' && part.totalUsage)
      return {
        usage: {
          ...usageRecord(part.totalUsage, model, phase, steps, started),
          costUsd: sumGatewayCosts(costs),
        },
      };
    return undefined;
  };
}

export function sumGatewayCosts(costs: unknown[]): number | undefined {
  if (!costs.length) return undefined;
  const values = costs.map((cost) =>
    typeof cost === 'number' || (typeof cost === 'string' && cost.trim() !== '')
      ? Number(cost)
      : NaN,
  );
  return values.every((cost) => Number.isFinite(cost) && cost >= 0)
    ? values.reduce((sum, cost) => sum + cost, 0)
    : undefined;
}
