import { db } from '@/lib/db';
import { defaultPeriod, periodSchema } from '@/lib/admin/traffic';
import type { UsageKind } from '@/lib/ai/usage-ledger';

export const USAGE_LABELS: Record<UsageKind, string> = {
  conversa: 'Conversa',
  geracao: 'Geração do site',
  imagem: 'Geração de imagem',
  logo: 'Geração de logo',
  'critica-imagem': 'Análise de imagem',
  'critica-logo': 'Análise de logo',
  'critica-visual': 'Revisão visual',
  referencia: 'Leitura de referência',
  'site-atual': 'Leitura do site atual',
  'leitura-logo': 'Leitura de logo',
  avatar: 'Leitura de avatar',
};

export type UsageFilters = {
  start?: string;
  end?: string;
  page: number;
  error?: string;
};

export function usageFilters(
  query: Record<string, string | string[] | undefined>,
): UsageFilters {
  const rawPage =
    typeof query.usagePage === 'string' ? Number(query.usagePage) : 1;
  const page =
    Number.isSafeInteger(rawPage) && rawPage > 0
      ? Math.min(rawPage, 1_000_000)
      : 1;
  if (query.period === 'all') return { page };
  const fallback = defaultPeriod();
  const parsed = periodSchema.safeParse({
    start: query.start ?? fallback.start,
    end: query.end ?? fallback.end,
  });
  return parsed.success
    ? { ...parsed.data, page }
    : {
        ...fallback,
        page: 1,
        error:
          'Confira as datas: início até o fim, em um período de até 366 dias. Exibindo os últimos 30 dias.',
      };
}

export type UsageNumbers = {
  calls: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
  costUsd: number | null;
  missingInput: number;
  missingOutput: number;
  missingTotal: number;
  missingCache: number;
  missingCacheWrite: number;
  missingReasoning: number;
  missingCost: number;
  pending: number;
  failed: number;
  legacy: number;
};

export type UsageHistoryRow = UsageNumbers & {
  operationId: string;
  kind: UsageKind;
  model: string;
  phase: string | null;
  runId: string | null;
  createdAt: string;
};

export type UsageHistory = {
  totals: UsageNumbers;
  rows: UsageHistoryRow[];
  daily: (UsageNumbers & { day: string })[];
  totalRows: number;
  page: number;
  pages: number;
  firstRecordedAt: string | null;
};

// Os nomes abaixo são constantes do código. Nenhum fragmento SQL vem da URL.
const measures = [
  ['input_tokens', 'inputTokens', 'missingInput'],
  ['output_tokens', 'outputTokens', 'missingOutput'],
  ['total_tokens', 'totalTokens', 'missingTotal'],
  ['cache_read_tokens', 'cacheReadTokens', 'missingCache'],
  ['cache_write_tokens', 'cacheWriteTokens', 'missingCacheWrite'],
  ['reasoning_tokens', 'reasoningTokens', 'missingReasoning'],
  ['cost_usd', 'costUsd', 'missingCost'],
];
const aggregates = [
  'count(*)::int as calls',
  ...measures.flatMap(([column, value, missing]) => [
    `sum(${column}) as "${value}"`,
    `count(*) filter (where ${column} is null)::int as "${missing}"`,
  ]),
  "count(*) filter (where status = 'pending')::int as pending",
  "count(*) filter (where status = 'failed')::int as failed",
  'count(*) filter (where legacy)::int as legacy',
].join(', ');

/** Totais do período e página de operações vêm do mesmo snapshot SQL. */
export async function usageHistory(
  tenantId: string,
  filters: UsageFilters,
): Promise<UsageHistory> {
  const result = await db().query(
    `
      with filtered as (
        select * from ai_usage where tenant_id = $1
          and ($2::date is null or created_at >= ($2::date::timestamp at time zone 'America/Sao_Paulo'))
          and ($3::date is null or created_at < (($3::date + 1)::timestamp at time zone 'America/Sao_Paulo'))
      ), grouped as (
        select operation_id as "operationId", kind, model, phase,
          run_id as "runId", min(created_at) as "createdAt", ${aggregates}
        from filtered group by operation_id, kind, model, phase, run_id
      ), pagination as (
        select count(*)::int as "totalRows",
          greatest(1, ceil(count(*) / 20.0))::int as pages,
          least($4::int, greatest(1, ceil(count(*) / 20.0)))::int as page
        from grouped
      )
      select
        (select row_to_json(t) from (select ${aggregates} from filtered) t) as totals,
        coalesce((select json_agg(t) from (
          select * from grouped order by "createdAt" desc, "operationId" desc, model
          limit 20 offset (select (page - 1) * 20 from pagination)
        ) t), '[]'::json) as rows,
        coalesce((select json_agg(t) from (
          select (created_at at time zone 'America/Sao_Paulo')::date::text as day,
            ${aggregates}
          from filtered group by 1 order by 1 desc
        ) t), '[]'::json) as daily,
        (select min(created_at) from ai_usage where tenant_id = $1) as "firstRecordedAt",
        pagination.* from pagination
    `,
    [tenantId, filters.start ?? null, filters.end ?? null, filters.page],
  );
  return (result as UsageHistory[])[0];
}
