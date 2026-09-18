import { transaction } from '@/lib/db';
import type { StudioModelRole } from './models';

export type StudioStepUsageReceipt = {
  step: number;
  role: StudioModelRole;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
  generationId?: string;
};

/** Nasce antes da chamada; uma interrupção fica visível como pending. */
export async function beginStudioUsage(input: {
  tenantId: string;
  runId: string;
  step: number;
  role: StudioModelRole;
  model: string;
}): Promise<void> {
  await transaction(async (connection) => {
    await connection.query(
      `insert into ai_usage (
         tenant_id, operation_id, step, kind, model, phase, studio_run_id,
         status, source, lifecycle
       ) values ($1, $2, $3, $4, $5, $6, $7, 'pending', 'gateway', 'studio')
       on conflict (tenant_id, operation_id, step) do nothing`,
      [
        input.tenantId,
        `studio-run:${input.runId}`,
        input.step,
        input.role,
        input.model,
        `${input.role}:step-${input.step}`,
        input.runId,
      ],
    );
  });
}

/** Um recibo por chamada de modelo; retries do Workflow atualizam a mesma etapa. */
export async function recordStudioUsage(input: {
  tenantId: string;
  runId: string;
  receipts: StudioStepUsageReceipt[];
}): Promise<void> {
  await transaction(async (connection) => {
    for (const usage of input.receipts)
      await connection.query(
        `insert into ai_usage (
           tenant_id, operation_id, step, kind, model, phase, studio_run_id,
           status, input_tokens, output_tokens, total_tokens,
           cache_read_tokens, cache_write_tokens, reasoning_tokens, cost_usd,
           source, lifecycle, external_id, finished_at
         ) values (
           $1, $2, $3, $4, $5, $6, $7, 'recorded', $8, $9, $10,
           $11, $12, $13, $14, 'gateway', 'studio', $15, now()
         )
         on conflict (tenant_id, operation_id, step) do update set
           status = excluded.status,
           model = excluded.model,
           phase = excluded.phase,
           input_tokens = excluded.input_tokens,
           output_tokens = excluded.output_tokens,
           total_tokens = excluded.total_tokens,
           cache_read_tokens = excluded.cache_read_tokens,
           cache_write_tokens = excluded.cache_write_tokens,
           reasoning_tokens = excluded.reasoning_tokens,
           cost_usd = excluded.cost_usd,
           external_id = coalesce(ai_usage.external_id, excluded.external_id),
           finished_at = excluded.finished_at`,
        [
          input.tenantId,
          `studio-run:${input.runId}`,
          usage.step,
          usage.role,
          usage.model,
          `${usage.role}:step-${usage.step}`,
          input.runId,
          usage.inputTokens ?? null,
          usage.outputTokens ?? null,
          usage.totalTokens ?? null,
          usage.cacheReadTokens ?? null,
          usage.cacheWriteTokens ?? null,
          usage.reasoningTokens ?? null,
          usage.costUsd ?? null,
          usage.generationId ?? null,
        ],
      );
  });
}
