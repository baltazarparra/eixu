import { db } from '@/lib/db';
import type { Phase } from '@/lib/taste/phases';

export const RUN_STATUS = [
  'queued',
  'running',
  'stopping',
  'paused',
  'done',
  'failed',
] as const;
export type RunStatus = (typeof RUN_STATUS)[number];

/** Enquanto vivo, nenhum outro turno abre para o mesmo cliente. */
export const ACTIVE_STATUS: RunStatus[] = ['queued', 'running', 'stopping'];

export type GenerationRun = {
  id: string;
  tenantId: string;
  status: RunStatus;
  phase: Phase | null;
  phaseStartedAt: string | null;
  startedAt: string;
  heartbeatAt: string;
  finishedAt: string | null;
  error: string | null;
  hops: number;
  progress: string | null;
  origin: string;
};

export type EventKind =
  | 'phase_start'
  | 'tool_start'
  | 'tool_end'
  | 'note'
  | 'phase_end'
  | 'stopped'
  | 'error';

export type GenerationEvent = {
  id: number;
  phase: string;
  kind: EventKind;
  tool: string | null;
  label: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

/**
 * Uma fase que trava sem crash deixaria o cliente preso em "running" para
 * sempre, porque o índice parcial recusa um run novo. Sem sinal por esse
 * tempo, o run é dado por perdido e o operador pode retomar.
 */
export const STALE_MS = 15 * 60 * 1000;

type RunRow = {
  id: string;
  tenant_id: string;
  status: RunStatus;
  phase: Phase | null;
  phase_started_at: Date | string | null;
  started_at: Date | string;
  heartbeat_at: Date | string;
  finished_at: Date | string | null;
  error: string | null;
  hops: number;
  progress: string | null;
  origin: string;
};

const iso = (value: Date | string | null): string | null =>
  value === null ? null : new Date(value).toISOString();

function toRun(row: RunRow): GenerationRun {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    status: row.status,
    phase: row.phase,
    phaseStartedAt: iso(row.phase_started_at),
    startedAt: iso(row.started_at) as string,
    heartbeatAt: iso(row.heartbeat_at) as string,
    finishedAt: iso(row.finished_at),
    error: row.error,
    hops: row.hops,
    progress: row.progress,
    origin: row.origin,
  };
}

export async function getRun(runId: string): Promise<GenerationRun | null> {
  const rows = (await db()`
    select * from generation_runs where id = ${runId}
  `) as RunRow[];
  return rows[0] ? toRun(rows[0]) : null;
}

/**
 * O deploy chega antes da migração: sem isto, o chat inteiro cairia até
 * alguém rodar `npm run db:migrate`. Tabela ausente significa "sem execução".
 */
function missingTable(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '42P01';
}

export async function activeRun(
  tenantId: string,
): Promise<GenerationRun | null> {
  try {
    const rows = (await db()`
      select * from generation_runs
      where tenant_id = ${tenantId} and status = any(${ACTIVE_STATUS})
      limit 1
    `) as RunRow[];
    return rows[0] ? toRun(rows[0]) : null;
  } catch (error) {
    if (missingTable(error)) return null;
    throw error;
  }
}

export async function latestRun(
  tenantId: string,
): Promise<GenerationRun | null> {
  try {
    const rows = (await db()`
      select * from generation_runs
      where tenant_id = ${tenantId}
      order by created_at desc limit 1
    `) as RunRow[];
    return rows[0] ? toRun(rows[0]) : null;
  } catch (error) {
    if (missingTable(error)) return null;
    throw error;
  }
}

/**
 * O índice parcial garante um run ativo por cliente mesmo entre instâncias:
 * a corrida perde no banco, não na leitura anterior.
 */
export async function createRun(input: {
  tenantId: string;
  origin: string;
  phase: Phase;
}): Promise<GenerationRun | null> {
  const rows = (await db()`
    insert into generation_runs (tenant_id, origin, phase, status)
    values (${input.tenantId}, ${input.origin}, ${input.phase}, 'queued')
    on conflict do nothing
    returning *
  `) as RunRow[];
  return rows[0] ? toRun(rows[0]) : null;
}

/**
 * Reserva o salto antes de agendar trabalho ou avaliar o progresso.
 * O `hops` esperado torna a reivindicação atômica — um encadeamento repetido
 * (retentativa de rede, entrega dupla) não abre a mesma etapa duas vezes.
 */
export async function claimStep(
  runId: string,
  expectedHops: number,
): Promise<GenerationRun | null> {
  const rows = (await db()`
    update generation_runs
    set status = case when status = 'stopping' then 'stopping' else 'running' end,
        heartbeat_at = now(),
        hops = hops + 1
    where id = ${runId}
      and hops = ${expectedHops}
      and status in ('queued', 'running', 'stopping')
    returning *
  `) as RunRow[];
  return rows[0] ? toRun(rows[0]) : null;
}

export async function heartbeat(runId: string): Promise<void> {
  await db()`update generation_runs set heartbeat_at = now() where id = ${runId}`;
}

export async function saveProgress(
  runId: string,
  phase: Phase,
  progress: string,
): Promise<void> {
  await db()`
    update generation_runs
    set phase = ${phase}, phase_started_at = now(),
        progress = ${progress}, heartbeat_at = now()
    where id = ${runId}
  `;
}

export async function requestStop(runId: string): Promise<void> {
  await db()`
    update generation_runs set status = 'stopping', heartbeat_at = now()
    where id = ${runId} and status in ('queued', 'running')
  `;
}

export async function isStopping(runId: string): Promise<boolean> {
  const rows = (await db()`
    select status from generation_runs where id = ${runId}
  `) as { status: RunStatus }[];
  return rows[0]?.status === 'stopping';
}

export async function finishRun(
  runId: string,
  status: Extract<RunStatus, 'paused' | 'done' | 'failed'>,
  error?: string,
): Promise<void> {
  await db()`
    update generation_runs
    set status = ${status}, error = ${error ?? null}, finished_at = now(), heartbeat_at = now()
    where id = ${runId}
  `;
}

/**
 * Registro do que o painel mostra. Rótulo e contadores apenas: o conteúdo do
 * cliente já vive nas páginas e no histórico do chat.
 */
export async function recordEvent(input: {
  runId: string;
  tenantId: string;
  phase: string;
  kind: EventKind;
  label: string;
  tool?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db()`
    insert into generation_events (run_id, tenant_id, phase, kind, tool, label, payload)
    values (${input.runId}, ${input.tenantId}, ${input.phase}, ${input.kind},
            ${input.tool ?? null}, ${input.label.slice(0, 240)},
            ${JSON.stringify(input.payload ?? {})}::jsonb)
  `;
  await heartbeat(input.runId);
}

export async function listEvents(
  runId: string,
  limit = 200,
): Promise<GenerationEvent[]> {
  const rows = (await db()`
    select id, phase, kind, tool, label, payload, created_at
    from generation_events
    where run_id = ${runId}
    order by id desc limit ${limit}
  `) as {
    id: string | number;
    phase: string;
    kind: EventKind;
    tool: string | null;
    label: string;
    payload: Record<string, unknown>;
    created_at: Date | string;
  }[];
  return rows.reverse().map((row) => ({
    id: Number(row.id),
    phase: row.phase,
    kind: row.kind,
    tool: row.tool,
    label: row.label,
    payload: row.payload ?? {},
    createdAt: iso(row.created_at) as string,
  }));
}

/**
 * Uma instância derrubada no meio da fase não consegue marcar o próprio fim.
 * Sem isto o cliente ficaria sem poder retomar, porque o run ativo continua
 * ocupando o índice.
 */
export async function expireStaleRun(
  run: GenerationRun | null,
): Promise<GenerationRun | null> {
  if (!run || !ACTIVE_STATUS.includes(run.status)) return run;
  if (Date.now() - new Date(run.heartbeatAt).getTime() < STALE_MS) return run;
  const minutes = Math.round(STALE_MS / 60000);
  await finishRun(
    run.id,
    'failed',
    `A geração ficou sem sinal por mais de ${minutes} minutos e foi encerrada. O progresso salvo continua no painel; use Continuar para retomar.`,
  );
  await recordEvent({
    runId: run.id,
    tenantId: run.tenantId,
    phase: run.phase ?? 'briefing',
    kind: 'error',
    label: 'Geração encerrada por falta de sinal',
  });
  return getRun(run.id);
}
