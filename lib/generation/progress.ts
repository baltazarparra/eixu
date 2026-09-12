import { REVIEW_CALLS_PER_TURN, PHASES, type Phase } from '@/lib/taste/phases';
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

/**
 * Rodada e leituras da revisão, medidas nos eventos da execução. O contador
 * de `brief.generation.reviewRounds` é acumulado e nunca zera: em um cliente
 * retomado, o painel anunciava "rodada 7 de 3".
 */
export function reviewProgress(events: GenerationEvent[]): {
  round: number;
  reads: number;
  total: number;
} {
  let round = 0;
  let reads = 0;
  for (const event of events) {
    if (event.phase !== 'revisao') continue;
    if (event.kind === 'phase_start') {
      // O feed guarda só os eventos mais recentes. O número persistido evita
      // voltar à rodada 1 quando os eventos anteriores saem da janela.
      const savedRound = finite(event.payload?.round);
      round =
        savedRound && Number.isSafeInteger(savedRound) && savedRound > 0
          ? savedRound
          : round + 1;
      reads = 0;
    }
    if (round && event.kind === 'tool_end' && event.tool === 'review_pages')
      reads = Math.min(REVIEW_CALLS_PER_TURN, reads + 1);
  }
  return { round, reads, total: REVIEW_CALLS_PER_TURN };
}

/** A ferramenta em execução: o último início sem um fim correspondente. */
export function currentActivity(
  events: GenerationEvent[],
): GenerationEvent | null {
  const pending: GenerationEvent[] = [];
  for (const event of events) {
    if (event.kind === 'tool_start') pending.push(event);
    if (event.kind === 'tool_end') {
      const callId =
        typeof event.payload.callId === 'string'
          ? event.payload.callId
          : undefined;
      const index = pending.findIndex((item) =>
        callId ? item.payload.callId === callId : item.tool === event.tool,
      );
      if (index !== -1) pending.splice(index, 1);
    }
  }
  const active = pending.at(-1) ?? null;
  if (!active) return null;
  // Captura e crítico publicam unidades concluídas durante a mesma ferramenta.
  // O último detalhe posterior ao início é mais útil que "Revisando" parado.
  return (
    events.findLast(
      (event) =>
        event.id > active.id &&
        event.kind === 'note' &&
        typeof event.payload.stage === 'string',
    ) ?? active
  );
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
          record.seconds +
          (from !== undefined ? Math.max(0, (at - from) / 1000) : 0),
        outcome: event.label || record.outcome,
      };
      started.delete(event.phase);
    }
  }
  return records;
}

/**
 * Etapas de produto que o painel e o diamante da prévia mostram. O servidor
 * tem quatro fases; o operador vê três: imagens e páginas são o mesmo "Criar".
 */
export const PRODUCT_STAGES = [
  { id: 'preparar', label: 'Preparar', phases: ['briefing'] },
  { id: 'criar', label: 'Criar', phases: ['cenas', 'composicao'] },
  { id: 'conferir', label: 'Conferir', phases: ['revisao'] },
] as const satisfies readonly {
  id: string;
  label: string;
  phases: readonly Phase[];
}[];

export type ProductStage = (typeof PRODUCT_STAGES)[number];

export function productStage(phase: Phase): ProductStage {
  return PRODUCT_STAGES.find((stage) =>
    (stage.phases as readonly Phase[]).includes(phase),
  )!;
}

/** O que o cálculo de progresso lê do estado do site. */
export type ProgressState = {
  generation: {
    next: Phase | 'pronto';
    coveredScenes: number;
    targetScenes: number;
  };
  pages: { length: number };
};

/** O que a etapa em execução já produziu, medido no estado e nos eventos. */
export function phaseProgress(
  state: ProgressState,
  phase: Phase | null,
  events: GenerationEvent[],
): string | null {
  const generation = state.generation;
  if (phase === 'cenas')
    return `${generation.coveredScenes} de ${generation.targetScenes} cenas prontas`;
  if (phase === 'composicao')
    return state.pages.length
      ? `${state.pages.length} páginas gravadas`
      : 'montando as páginas';
  if (phase === 'revisao') {
    const review = reviewProgress(events);
    const reads = review.reads
      ? `${review.reads} de ${review.total} leituras concluídas`
      : 'preparando a primeira leitura';
    return review.round > 1 ? `rodada ${review.round} · ${reads}` : reads;
  }
  return null;
}

export type StageProgress = {
  id: ProductStage['id'];
  label: string;
  state: 'done' | 'active' | 'todo';
  /** Unidades medidas da etapa, de 0 a 1. Sem total conhecido, fica em 0. */
  fill: number;
};

export type CreationProgress = {
  /** Etapas concluídas mais a fração medida da ativa, de 0 a 1. */
  fraction: number;
  stages: StageProgress[];
  /** Etapa ativa ou, parada, a próxima a rodar. */
  stage: ProductStage;
  /** Posição da etapa mostrada, de 1 a 3. */
  position: number;
  /** Unidades medidas da fase em execução; null quando não há total. */
  detail: string | null;
  done: boolean;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Fração medida da fase, nunca estimada: cenas comparam cobertura, páginas
 * existem ou não, a revisão conta leituras. O briefing não tem unidade e fica
 * em zero enquanto roda; o movimento do diamante é que diz que há trabalho.
 */
function phaseFill(
  state: ProgressState,
  phase: Phase,
  events: GenerationEvent[],
): number {
  if (phase === 'cenas')
    return state.generation.targetScenes > 0
      ? clamp01(state.generation.coveredScenes / state.generation.targetScenes)
      : 0;
  if (phase === 'composicao') return state.pages.length > 0 ? 1 : 0;
  if (phase === 'revisao') {
    const review = reviewProgress(events);
    return review.total > 0 ? clamp01(review.reads / review.total) : 0;
  }
  return 0;
}

/**
 * Progresso da criação do site em três etapas, para o diamante da prévia. O
 * mesmo estado que o painel lê; nada aqui usa tempo decorrido como estimativa.
 */
export function creationProgress(
  state: ProgressState,
  phase: Phase | null,
  events: GenerationEvent[],
): CreationProgress {
  const next = state.generation.next;
  if (!phase && next === 'pronto') {
    return {
      fraction: 1,
      stages: PRODUCT_STAGES.map((stage) => ({
        id: stage.id,
        label: stage.label,
        state: 'done',
        fill: 1,
      })),
      stage: PRODUCT_STAGES[PRODUCT_STAGES.length - 1],
      position: PRODUCT_STAGES.length,
      detail: null,
      done: true,
    };
  }
  const current: Phase = phase ?? (next as Phase);
  const active = productStage(current);
  const activeIndex = PRODUCT_STAGES.findIndex(
    (stage) => stage.id === active.id,
  );
  // "Criar" soma as duas fases do servidor: imagens valem metade, páginas a
  // outra metade. Uma fase já passada dentro da etapa conta como completa.
  const phases = active.phases as readonly Phase[];
  const position = phases.indexOf(current);
  const fill =
    phases.reduce(
      (sum, _item, index) =>
        sum +
        (index < position
          ? 1
          : index === position
            ? phaseFill(state, current, events)
            : 0),
      0,
    ) / phases.length;
  return {
    fraction: clamp01((activeIndex + fill) / PRODUCT_STAGES.length),
    stages: PRODUCT_STAGES.map((stage, index) => ({
      id: stage.id,
      label: stage.label,
      state:
        index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'todo',
      fill: index < activeIndex ? 1 : index === activeIndex ? fill : 0,
    })),
    stage: active,
    position: activeIndex + 1,
    detail: phase ? phaseProgress(state, phase, events) : null,
    done: false,
  };
}
