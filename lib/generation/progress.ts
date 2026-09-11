import { PHASES, type Phase } from '@/lib/taste/phases';
import type { GenerationEvent } from './runs';

/**
 * Derivações puras sobre os eventos da execução. Vivem fora do componente
 * porque o painel, a faixa do celular e o resumo de consumo leem os mesmos
 * eventos, e porque assim o cálculo tem teste sem navegador.
 */

export type PhaseUsage = {
  model: string;
  phase: string;
  steps: number;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  costUsd?: number;
};

const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * Recibo que o runner grava no fim de cada fase. Payload de outra origem ou
 * incompleto devolve null: contagem ausente não pode virar zero no resumo.
 */
export function usageFromEvent(event: GenerationEvent): PhaseUsage | null {
  const raw = (event.payload as { usage?: unknown } | undefined)?.usage;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const usage = raw as Record<string, unknown>;
  const steps = finite(usage.steps);
  const durationMs = finite(usage.durationMs);
  if (steps === undefined || durationMs === undefined) return null;
  return {
    model: typeof usage.model === 'string' ? usage.model : '',
    phase: typeof usage.phase === 'string' ? usage.phase : event.phase,
    steps,
    durationMs,
    inputTokens: finite(usage.inputTokens),
    outputTokens: finite(usage.outputTokens),
    totalTokens: finite(usage.totalTokens),
    cacheReadTokens: finite(usage.cacheReadTokens),
    costUsd: finite(usage.costUsd),
  };
}

/** Consumo de cada fase já encerrada, na ordem em que aconteceram. */
export function runUsage(events: GenerationEvent[]): PhaseUsage[] {
  return events
    .filter((event) => event.kind === 'phase_end')
    .map(usageFromEvent)
    .filter((usage): usage is PhaseUsage => usage !== null);
}

/** A ferramenta em execução: o último início sem um fim correspondente. */
export function currentActivity(
  events: GenerationEvent[],
): GenerationEvent | null {
  const pending: GenerationEvent[] = [];
  for (const event of events) {
    if (event.kind === 'tool_start') pending.push(event);
    if (event.kind === 'tool_end') {
      const index = pending.findIndex((item) => item.tool === event.tool);
      if (index !== -1) pending.splice(index, 1);
    }
  }
  return pending.at(-1) ?? null;
}

export type PhaseRecord = {
  /** Tempo somado das passagens concluídas por esta fase. */
  seconds: number;
  /** O que a fase produziu, conforme o rótulo do evento de encerramento. */
  outcome: string | null;
};

function isPhase(value: string): value is Phase {
  return (PHASES as readonly string[]).includes(value);
}

/**
 * Duração e resultado de cada fase encerrada. A etapa de cenas pode repetir a
 * mesma fase: o tempo soma e o resultado é o mais recente.
 */
export function phaseRecords(
  events: GenerationEvent[],
): Partial<Record<Phase, PhaseRecord>> {
  const records: Partial<Record<Phase, PhaseRecord>> = {};
  const started = new Map<string, number>();
  for (const event of events) {
    if (!isPhase(event.phase)) continue;
    const at = new Date(event.createdAt).getTime();
    if (event.kind === 'phase_start') started.set(event.phase, at);
    if (event.kind === 'phase_end') {
      const from = started.get(event.phase);
      const record = records[event.phase] ?? { seconds: 0, outcome: null };
      records[event.phase] = {
        seconds:
          record.seconds + (from !== undefined ? Math.max(0, (at - from) / 1000) : 0),
        outcome: event.label || record.outcome,
      };
      started.delete(event.phase);
    }
  }
  return records;
}
