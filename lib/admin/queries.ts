import { cache } from 'react';
import { db } from '@/lib/db';
import { getTenantBySlug } from '@/lib/tenant-queries';

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
      select r.kind, r.created_at, t.name
      from studio_runs r
      join tenants t on t.id = r.tenant_id
      where r.status in ('queued', 'running', 'cancel_requested')
    )
    select (select count(*)::int from ativos) as running,
      (select row_to_json(atual) from (
        select kind, name from ativos order by created_at desc limit 1
      ) atual) as current`) as {
    running: number;
    current: { kind: string | null; name: string } | null;
  }[];
  const current = row?.current ?? null;
  return {
    running: Number(row?.running ?? 0),
    current: current
      ? {
          stage:
            (
              {
                build: 'Criando',
                edit: 'Editando',
                refine: 'Refinando',
                preview: 'Preparando prévia',
                publish: 'Publicando',
                chat: 'Conversando',
              } as Record<string, string>
            )[current.kind ?? 'chat'] ?? 'Trabalhando',
          site: current.name,
        }
      : null,
  };
}
