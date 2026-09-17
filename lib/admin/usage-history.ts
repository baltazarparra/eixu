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
  desenvolvimento: 'Desenvolvimento',
  'ia-runtime': 'IA no site',
  'servico-externo': 'Serviço externo',
};

export const SOURCE_LABELS: Record<string, string> = {
  gateway: 'Gerador EIXU',
  codex: 'Codex',
  claude: 'Claude',
  external: 'Serviço externo',
};
export const LIFECYCLE_LABELS: Record<string, string> = {
  generator: 'Gerador',
  converting: 'Conversão',
  premium: 'Premium',
  unknown: 'Fase não registrada',
};

/** Etapa da geração escrita como o operador lê no painel, não como no banco. */
const PHASE_LABELS: Record<string, string> = {
  briefing: 'briefing',
  cenas: 'cenas',
  composicao: 'composição',
  revisao: 'revisão',
};

export function phaseLabel(phase: string | null): string | null {
  return phase ? (PHASE_LABELS[phase] ?? phase) : null;
}

/** Nome da operação: a etapa distingue as fases de uma mesma geração. */
export function usageLabel(kind: UsageKind, phase: string | null): string {
  const step = phaseLabel(phase);
  const base = USAGE_LABELS[kind] ?? kind;
  return step ? `${base} · ${step}` : base;
}

export const USAGE_PERIODS = ['7', '30', '90', 'tudo'] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];
export const USAGE_PERIOD_LABELS: Record<UsagePeriod, string> = {
  '7': '7 dias',
  '30': '30 dias',
  '90': '90 dias',
  tudo: 'Tudo',
};

export type UsageFilters = {
  start?: string;
  end?: string;
  page: number;
  error?: string;
  /** Segmento aceso no seletor; 'livre' quando as datas não batem com nenhum. */
  periodo: UsagePeriod | 'livre';
};

function presetOf(range: {
  start: string;
  end: string;
}): UsagePeriod | 'livre' {
  const now = new Date();
  for (const days of ['7', '30', '90'] as const) {
    const preset = defaultPeriod(now, Number(days));
    if (preset.start === range.start && preset.end === range.end) return days;
  }
  return 'livre';
}

export function usageFilters(
  query: Record<string, string | string[] | undefined>,
): UsageFilters {
  const rawPage =
    typeof query.usagePage === 'string' ? Number(query.usagePage) : 1;
  const page =
    Number.isSafeInteger(rawPage) && rawPage > 0
      ? Math.min(rawPage, 1_000_000)
      : 1;
  // O seletor novo manda ?periodo=; links antigos com start/end e period=all
  // continuam válidos e acendem o segmento correspondente.
  const chosen =
    typeof query.periodo === 'string' &&
    (USAGE_PERIODS as readonly string[]).includes(query.periodo)
      ? (query.periodo as UsagePeriod)
      : null;
  if (chosen === 'tudo' || (!chosen && query.period === 'all'))
    return { page, periodo: 'tudo' };
  if (chosen)
    return {
      ...defaultPeriod(new Date(), Number(chosen)),
      page,
      periodo: chosen,
    };
  const fallback = defaultPeriod();
  const parsed = periodSchema.safeParse({
    start: query.start ?? fallback.start,
    end: query.end ?? fallback.end,
  });
  return parsed.success
    ? { ...parsed.data, page, periodo: presetOf(parsed.data) }
    : {
        ...fallback,
        page: 1,
        periodo: '30',
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
  source: string;
  lifecycle: string;
  kind: UsageKind;
  model: string;
  phase: string | null;
  runId: string | null;
  createdAt: string;
};

/** Uma barra do gráfico: a etapa, não a chamada nem o dia. */
export type UsageOperationTotals = UsageNumbers & {
  kind: UsageKind;
  phase: string | null;
};

export type UsageHistory = {
  totals: UsageNumbers;
  lifetime: UsageNumbers;
  bySource: (UsageNumbers & { source: string; lifecycle: string })[];
  rows: UsageHistoryRow[];
  byOperation: UsageOperationTotals[];
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
        select operation_id as "operationId", kind, model, phase, source, lifecycle,
          run_id as "runId", min(created_at) as "createdAt", ${aggregates}
        from filtered group by operation_id, kind, model, phase, run_id, source, lifecycle
      ), pagination as (
        select count(*)::int as "totalRows",
          greatest(1, ceil(count(*) / 20.0))::int as pages,
          least($4::int, greatest(1, ceil(count(*) / 20.0)))::int as page
        from grouped
      )
      select
        (select row_to_json(t) from (select ${aggregates} from ai_usage where tenant_id = $1) t) as lifetime,
        coalesce((select json_agg(t) from (
          select source, lifecycle, ${aggregates} from filtered group by source, lifecycle
          order by source, lifecycle
        ) t), '[]'::json) as "bySource",
        (select row_to_json(t) from (select ${aggregates} from filtered) t) as totals,
        coalesce((select json_agg(t) from (
          select * from grouped order by "createdAt" desc, "operationId" desc, model
          limit 20 offset (select (page - 1) * 20 from pagination)
        ) t), '[]'::json) as rows,
        coalesce((select json_agg(t) from (
          select kind, phase, ${aggregates}
          from filtered group by kind, phase
          order by sum(total_tokens) desc nulls last, kind
        ) t), '[]'::json) as "byOperation",
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

export type UsageCardSummary = {
  days: number;
  costUsd: number | null;
  totalTokens: number | null;
};

/**
 * Resumo do cartão em Dados: só custo e tokens do período curto. O histórico
 * inteiro não é carregado numa tela que deixou de mostrá-lo.
 */
export async function usageSummary(
  tenantId: string,
  days = 30,
): Promise<UsageCardSummary> {
  const { start, end } = defaultPeriod(new Date(), days);
  const result = (await db().query(
    `select sum(cost_usd) as "costUsd", sum(total_tokens) as "totalTokens"
       from ai_usage where tenant_id = $1
        and created_at >= ($2::date::timestamp at time zone 'America/Sao_Paulo')
        and created_at < (($3::date + 1)::timestamp at time zone 'America/Sao_Paulo')`,
    [tenantId, start, end],
  )) as {
    costUsd: number | string | null;
    totalTokens: number | string | null;
  }[];
  const row = result[0];
  const number = (value: number | string | null | undefined) =>
    value === null || value === undefined ? null : Number(value);
  return {
    days,
    costUsd: number(row?.costUsd),
    totalTokens: number(row?.totalTokens),
  };
}

export type TenantUsageRow = {
  tenantId: string;
  slug: string;
  name: string;
  costUsd: number | null;
  totalTokens: number | null;
};

export type TenantUsage = {
  days: number;
  costUsd: number | null;
  totalTokens: number | null;
  /** Os maiores consumos do período, já ordenados, para o cartão da lista. */
  rows: TenantUsageRow[];
};

/**
 * Consumo agregado por cliente no período curto. O total e as linhas saem do
 * mesmo recorte: o cartão da home não pode somar um período e listar outro.
 */
export async function usageByTenant(days = 30, top = 3): Promise<TenantUsage> {
  const { start, end } = defaultPeriod(new Date(), days);
  const result = (await db().query(
    `with periodo as (
       select tenant_id, sum(cost_usd) as cost_usd, sum(total_tokens) as total_tokens
         from ai_usage
        where created_at >= ($1::date::timestamp at time zone 'America/Sao_Paulo')
          and created_at < (($2::date + 1)::timestamp at time zone 'America/Sao_Paulo')
        group by tenant_id
     )
     select
       (select sum(cost_usd) from periodo) as "costUsd",
       (select sum(total_tokens) from periodo) as "totalTokens",
       coalesce((select json_agg(linha) from (
         select p.tenant_id as "tenantId", t.slug, t.name,
                p.cost_usd as "costUsd", p.total_tokens as "totalTokens"
           from periodo p join tenants t on t.id = p.tenant_id
          order by p.cost_usd desc nulls last, t.name
          limit $3
       ) linha), '[]'::json) as rows`,
    [start, end, Math.max(1, top)],
  )) as {
    costUsd: number | string | null;
    totalTokens: number | string | null;
    rows: (Omit<TenantUsageRow, 'costUsd' | 'totalTokens'> & {
      costUsd: number | string | null;
      totalTokens: number | string | null;
    })[];
  }[];
  const row = result[0];
  // Contagem ausente não vira zero, como no resto do ledger.
  const number = (value: number | string | null | undefined) =>
    value === null || value === undefined ? null : Number(value);
  return {
    days,
    costUsd: number(row?.costUsd),
    totalTokens: number(row?.totalTokens),
    rows: (row?.rows ?? []).map((item) => ({
      tenantId: item.tenantId,
      slug: item.slug,
      name: item.name,
      costUsd: number(item.costUsd),
      totalTokens: number(item.totalTokens),
    })),
  };
}
