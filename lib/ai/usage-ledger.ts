import { randomUUID } from 'node:crypto';
import type { ImageModelUsage, LanguageModelUsage } from 'ai';
import { db } from '@/lib/db';
import { sumGatewayCosts } from '@/lib/ai/usage';

export type UsageKind =
  | 'conversa'
  | 'geracao'
  | 'imagem'
  | 'logo'
  | 'critica-imagem'
  | 'critica-logo'
  | 'critica-visual'
  | 'referencia'
  | 'site-atual'
  | 'leitura-logo'
  | 'avatar'
  | 'desenvolvimento'
  | 'ia-runtime'
  | 'servico-externo';

export type UsageContext = {
  tenantId: string;
  kind: UsageKind;
  model: string;
  phase?: string;
  runId?: string;
};

function count(value: number | undefined): number | null {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

/** Registra a intenção antes da chamada paga; uma interrupção conserva a lacuna. */
async function begin(context: UsageContext, operation: string, step: number) {
  await db()`
    insert into ai_usage (tenant_id, operation_id, step, kind, model, phase, run_id, lifecycle)
    select id, ${operation}, ${step}, ${context.kind},
      ${context.model}, ${context.phase ?? null}, ${context.runId ?? null}, maintenance_mode
    from tenants where id = ${context.tenantId}
    on conflict (tenant_id, operation_id, step) do nothing
  `;
}

async function finish(
  context: UsageContext,
  operation: string,
  step: number,
  usage: LanguageModelUsage | ImageModelUsage | undefined,
  cost: unknown,
) {
  const input = count(usage?.inputTokens);
  const output = count(usage?.outputTokens);
  const total =
    count(usage?.totalTokens) ??
    (input !== null && output !== null ? input + output : null);
  const inputDetails =
    usage && 'inputTokenDetails' in usage ? usage.inputTokenDetails : undefined;
  const outputDetails =
    usage && 'outputTokenDetails' in usage
      ? usage.outputTokenDetails
      : undefined;
  await db()`
    update ai_usage set
      input_tokens = ${input}, output_tokens = ${output}, total_tokens = ${total},
      cache_read_tokens = ${count(inputDetails?.cacheReadTokens)},
      cache_write_tokens = ${count(inputDetails?.cacheWriteTokens)},
      reasoning_tokens = ${count(outputDetails?.reasoningTokens)},
      cost_usd = ${sumGatewayCosts([cost]) ?? null},
      status = 'recorded', finished_at = now()
    where tenant_id = ${context.tenantId}
      and operation_id = ${operation} and step = ${step}
  `;
}

function receiptWarning(
  context: UsageContext,
  stage: 'inicial' | 'final',
  error: unknown,
) {
  console.warn(`[ai-usage] recibo ${stage} não foi salvo`, {
    tenantId: context.tenantId,
    kind: context.kind,
    error: error instanceof Error ? error.message : 'erro desconhecido',
  });
}

/** Um recibo por passo. O total agregado do turno não é inserido novamente. */
export function usageTracking(context: UsageContext) {
  return {
    onStepStart: async (event: { callId: string; stepNumber: number }) => {
      await begin(context, event.callId, event.stepNumber).catch((error) =>
        receiptWarning(context, 'inicial', error),
      );
    },
    onStepEnd: async (event: {
      callId: string;
      stepNumber: number;
      usage: LanguageModelUsage;
      providerMetadata?: { gateway?: Record<string, unknown> };
    }) => {
      await finish(
        context,
        event.callId,
        event.stepNumber,
        event.usage,
        event.providerMetadata?.gateway?.cost,
      ).catch((error) => receiptWarning(context, 'final', error));
    },
  };
}

/** O SDK de imagem não oferece os mesmos callbacks do loop de texto. */
export async function trackImageUsage<
  T extends {
    usage: ImageModelUsage;
    providerMetadata?: unknown;
  },
>(context: UsageContext, generate: () => Promise<T>): Promise<T> {
  const operation = randomUUID();
  await begin(context, operation, 0).catch((error) =>
    receiptWarning(context, 'inicial', error),
  );
  try {
    const result = await generate();
    const metadata = result.providerMetadata as
      | { gateway?: { cost?: unknown } }
      | undefined;
    await finish(
      context,
      operation,
      0,
      result.usage,
      metadata?.gateway?.cost,
    ).catch((error) => receiptWarning(context, 'final', error));
    return result;
  } catch (error) {
    await db()`
      update ai_usage set status = 'failed', finished_at = now()
      where tenant_id = ${context.tenantId}
        and operation_id = ${operation} and step = 0
    `.catch(() => undefined);
    throw error;
  }
}
