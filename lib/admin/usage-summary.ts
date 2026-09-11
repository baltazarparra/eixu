import type { PhaseUsage } from '@/lib/generation/progress';
import type { GenerationEvent } from '@/lib/generation/runs';
import type { ChatMessage } from '@/lib/ai/usage';
import { runUsage } from '@/lib/generation/progress';
import { PHASE_LABEL, type Phase } from '@/lib/taste/phases';

export type UsageRow = {
  id: string;
  label: string;
  origin: 'geracao' | 'conversa';
} & PhaseUsage;

export type UsageSummary = {
  rows: UsageRow[];
  /** Ausência de contagem não vira zero: o total fica indefinido. */
  totals: {
    steps: number;
    durationMs: number;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    totalTokens?: number;
    costUsd?: number;
  };
  models: string[];
};

const compact = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const full = new Intl.NumberFormat('pt-BR');
const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** Contagem ausente é declarada, nunca apresentada como zero. */
export function formatTokens(value?: number): string {
  return value === undefined
    ? 'tokens não informados'
    : `${compact.format(value)} tokens`;
}

export function formatCost(value?: number): string {
  return value === undefined ? 'custo não informado' : money.format(value);
}

export function formatCount(value?: number): string {
  return value === undefined ? 'não informado' : full.format(value);
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60
    ? `${seconds} s`
    : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
}

/** Soma só quando toda parcela informou o valor; senão, indefinido. */
function sum(values: (number | undefined)[]): number | undefined {
  return values.every((value) => value !== undefined)
    ? (values as number[]).reduce((total, value) => total + value, 0)
    : undefined;
}

const phaseLabel = (phase: string): string =>
  PHASE_LABEL[phase as Phase] ?? 'Etapa da geração';

/**
 * Consumo desta tela, vindo de duas origens. As fases da geração rodam no
 * servidor e gravam o recibo no evento de encerramento; os turnos livres
 * trazem o recibo nos metadados da própria mensagem. Sem juntar os dois, o
 * painel mostrava zero justamente na parte cara do trabalho.
 */
export function summarizeUsage(input: {
  messages: ChatMessage[];
  events: GenerationEvent[];
}): UsageSummary {
  const rows: UsageRow[] = runUsage(input.events).map((usage, index) => ({
    ...usage,
    id: `fase-${index}-${usage.phase}`,
    label: phaseLabel(usage.phase),
    origin: 'geracao' as const,
  }));

  for (const message of input.messages) {
    const usage = message.metadata?.usage;
    if (!usage) continue;
    rows.push({
      ...usage,
      id: `mensagem-${message.id}`,
      label:
        usage.phase && usage.phase !== 'livre'
          ? phaseLabel(usage.phase)
          : 'Conversa',
      origin: usage.phase && usage.phase !== 'livre' ? 'geracao' : 'conversa',
    });
  }

  return {
    rows,
    totals: {
      steps: rows.reduce((total, row) => total + row.steps, 0),
      durationMs: rows.reduce((total, row) => total + row.durationMs, 0),
      inputTokens: sum(rows.map((row) => row.inputTokens)),
      outputTokens: sum(rows.map((row) => row.outputTokens)),
      cacheReadTokens: sum(rows.map((row) => row.cacheReadTokens)),
      totalTokens: sum(rows.map((row) => row.totalTokens)),
      costUsd: sum(rows.map((row) => row.costUsd)),
    },
    models: [...new Set(rows.map((row) => row.model).filter(Boolean))],
  };
}
