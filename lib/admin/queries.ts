import { cache } from 'react';
import { db } from '@/lib/db';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { productStage } from '@/lib/generation/progress';
import { isPhase } from '@/lib/taste/phases';

// Deduplicação apenas dentro do render autenticado, sem cache entre sessões.
export const adminTenant = cache(getTenantBySlug);

export type OperationSummary = {
  running: number;
  /** Etapa e site da execução mais recente, para a linha de apoio da home. */
  current: { stage: string; site: string } | null;
};

export async function operationSummary(): Promise<OperationSummary> {
  const [row] = (await db()`
    with ativos as (
      select r.phase, r.started_at, t.name
      from generation_runs r
      join tenants t on t.id = r.tenant_id
      where r.status in ('queued', 'running', 'stopping')
    )
    select (select count(*)::int from ativos) as running,
      (select row_to_json(atual) from (
        select phase, name from ativos order by started_at desc limit 1
      ) atual) as current`) as {
    running: number;
    current: { phase: string | null; name: string } | null;
  }[];
  const current = row?.current ?? null;
  return {
    running: Number(row?.running ?? 0),
    // Run recém-enfileirado ainda não gravou a fase: a fila começa em Preparar.
    current: current
      ? {
          stage: isPhase(current.phase)
            ? productStage(current.phase).label
            : 'Preparar',
          site: current.name,
        }
      : null,
  };
}
