'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import type { SiteState } from '@/lib/admin/state';
import {
  formatCost,
  formatTokens,
  summarizeUsage,
} from '@/lib/admin/usage-summary';
import {
  currentActivity,
  phaseRecords,
  reviewProgress,
} from '@/lib/generation/progress';
import type { GenerationEvent, GenerationRun } from '@/lib/generation/runs';
import {
  PHASE_LABEL,
  PHASES,
  REVIEW_CALLS_PER_TURN,
  type Phase,
} from '@/lib/taste/phases';
import { isRunning } from './use-generation';

/** Medido nas gerações reais. Serve para calibrar a espera, não para prometer. */
const ESTIMATE_S: Record<Phase, number> = {
  briefing: 90,
  cenas: 200,
  composicao: 240,
  revisao: 240,
};

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/** O que a etapa em execução já produziu, medido no estado e nos eventos. */
function phaseProgress(
  state: SiteState,
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
    const reads = `leitura ${Math.max(1, review.reads)} de ${review.total}`;
    return review.round > 1 ? `rodada ${review.round} · ${reads}` : reads;
  }
  return null;
}

function statusLine(
  run: GenerationRun | null,
  state: SiteState,
): { tone: 'ok' | 'warn' | 'err' | 'info'; text: string } | null {
  if (!run || isRunning(run)) return null;
  if (run.status === 'paused')
    return {
      tone: 'warn',
      text: 'O progresso está salvo. Retomar continua da etapa em que parou.',
    };
  if (run.status === 'failed')
    return {
      tone: 'err',
      text: run.error ?? 'A geração parou por um erro. Confira o chat.',
    };
  if (run.status === 'done' && state.generation.next !== 'pronto')
    return {
      tone: 'warn',
      text: 'A execução terminou com etapas pendentes. Confira a última resposta.',
    };
  return null;
}

/** Barra de quatro segmentos: a etapa ativa enche conforme o progresso real. */
function Track({
  active,
  reached,
  fill,
}: {
  active: Phase | null;
  reached: (phase: Phase) => boolean;
  fill: number | null;
}) {
  return (
    <ol className="admin-run-track" aria-hidden="true">
      {PHASES.map((item) => {
        const state = reached(item)
          ? 'done'
          : item === active
            ? 'active'
            : 'todo';
        return (
          <li key={item} data-state={state}>
            <span
              style={
                state === 'active' && fill !== null
                  ? { width: `${Math.round(fill * 100)}%` }
                  : undefined
              }
              data-indeterminate={
                state === 'active' && fill === null ? '' : undefined
              }
            />
          </li>
        );
      })}
    </ol>
  );
}

export function GenerationPanel({
  run,
  events,
  state,
  clockOffsetMs,
  error,
  busy,
  starting,
  onStart,
  onStop,
}: {
  run: GenerationRun | null;
  events: GenerationEvent[];
  state: SiteState;
  clockOffsetMs: number;
  error: string | null;
  busy: boolean;
  starting: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const running = isRunning(run);
  const now = useNow(running || starting) + clockOffsetMs;
  const [dismissed, setDismissed] = useState(false);
  const next = state.generation.next;
  const done = next === 'pronto';
  // Terminar sem dizer que terminou foi parte da queixa: a conclusão fica à
  // vista até o operador fechar. Sem execução recente, o painel sai da frente.
  const finished = done && !running && !starting;
  if (finished && (!run || run.status !== 'done' || dismissed)) return null;

  const phase = running ? (run?.phase ?? null) : null;
  const activity = running ? currentActivity(events) : null;
  const records = phaseRecords(events);
  const runStarted = run ? new Date(run.startedAt).getTime() : null;
  // A fase inicial fica alguns instantes na fila antes de receber
  // phaseStartedAt; nesse intervalo ela já conta a partir do início do run.
  const phaseStarted = run?.phaseStartedAt
    ? new Date(run.phaseStartedAt).getTime()
    : runStarted;
  const phaseSeconds =
    running && phaseStarted ? (now - phaseStarted) / 1000 : 0;
  const estimate = phase ? ESTIMATE_S[phase] : 0;
  const status = statusLine(run, state);
  const reached = (item: Phase) =>
    PHASES.indexOf(item) <
    (done ? PHASES.length : PHASES.indexOf(next as Phase));
  const usage = summarizeUsage({ messages: [], events });

  const position = phase ? PHASES.indexOf(phase) + 1 : 0;
  const fill =
    phase === 'cenas' && state.generation.targetScenes > 0
      ? Math.min(
          1,
          state.generation.coveredScenes / state.generation.targetScenes,
        )
      : phase === 'revisao'
        ? Math.min(
            1,
            Math.max(1, reviewProgress(events).reads) / REVIEW_CALLS_PER_TURN,
          )
        : null;

  const title = starting
    ? 'Iniciando a geração'
    : running
      ? PHASE_LABEL[phase ?? (next as Phase)]
      : finished
        ? 'Geração concluída'
        : run?.status === 'paused'
          ? 'Geração pausada'
          : run?.status === 'failed'
            ? 'Geração interrompida'
            : 'Geração em etapas';

  const totalSeconds = (() => {
    if (!run || !runStarted) return null;
    const end = run.finishedAt ? new Date(run.finishedAt).getTime() : now;
    return (end - runStarted) / 1000;
  })();

  const meta = starting
    ? 'Abrindo a primeira etapa no servidor'
    : running && runStarted
      ? `Etapa ${position} de ${PHASES.length} · ${clock(phaseSeconds)} nesta etapa · ${clock(totalSeconds ?? 0)} no total`
      : finished
        ? [
            plural(state.pages.length, 'página', 'páginas'),
            plural(state.generation.photos, 'foto', 'fotos'),
            totalSeconds !== null ? `${clock(totalSeconds)} de trabalho` : '',
          ]
            .filter(Boolean)
            .join(' · ')
        : `Próxima etapa: ${PHASE_LABEL[next as Phase]}`;

  const action = starting ? null : running ? (
    <button
      type="button"
      onClick={onStop}
      disabled={run?.status === 'stopping'}
      className="admin-secondary"
    >
      {run?.status === 'stopping' ? 'Pausando…' : 'Pausar'}
    </button>
  ) : finished ? (
    <button
      type="button"
      onClick={() => setDismissed(true)}
      className="admin-secondary"
    >
      Fechar
    </button>
  ) : (
    <button
      type="button"
      onClick={onStart}
      disabled={busy}
      className="admin-primary"
      title={
        busy
          ? 'Aguarde a resposta atual do chat para iniciar a geração.'
          : undefined
      }
    >
      {run?.status === 'paused'
        ? 'Retomar'
        : run?.status === 'failed'
          ? 'Tentar novamente'
          : 'Continuar'}
    </button>
  );

  return (
    <section
      className="admin-run"
      data-running={running || starting ? '' : undefined}
      aria-live="polite"
      aria-busy={running || starting}
    >
      <div className="admin-run-head">
        <div className="admin-run-title">
          <span className="admin-run-eyebrow">Geração do site</span>
          <strong className="admin-run-name">{title}</strong>
          <span className="admin-run-meta">{meta}</span>
        </div>
        {action}
      </div>

      {finished ? (
        usage.rows.length ? (
          <p className="admin-run-cost">
            {formatTokens(usage.totals.totalTokens)} ·{' '}
            {formatCost(usage.totals.costUsd)} · confira a prévia ao lado antes
            de publicar.
          </p>
        ) : (
          <p className="admin-run-cost">
            Confira a prévia ao lado antes de publicar.
          </p>
        )
      ) : (
        <>
          <Track active={phase} reached={reached} fill={fill} />
          <ol className="admin-run-steps">
            {PHASES.map((item) => {
              const active = phase === item;
              const complete = reached(item);
              const record = records[item];
              const detail = active
                ? phaseProgress(state, item, events)
                : complete
                  ? record?.outcome
                  : null;
              const aside =
                complete && record?.seconds
                  ? clock(record.seconds)
                  : !complete && !active
                    ? `~${Math.round(ESTIMATE_S[item] / 60)} min`
                    : null;
              return (
                <li
                  key={item}
                  data-state={active ? 'active' : complete ? 'done' : 'todo'}
                >
                  <span className="admin-run-mark" aria-hidden="true">
                    {complete ? <Check size={11} strokeWidth={3.5} /> : null}
                  </span>
                  <div className="admin-run-step">
                    <span className="admin-run-step-name">
                      {PHASE_LABEL[item]}
                    </span>
                    {detail ? (
                      <span className="admin-run-sub">{detail}</span>
                    ) : null}
                    {active && running ? (
                      <span className="admin-run-activity">
                        <span className="admin-run-pulse" aria-hidden="true" />
                        <span>{activity?.label ?? 'Preparando a etapa'}</span>
                        {estimate ? (
                          <span className="admin-run-sub">
                            {phaseSeconds > estimate
                              ? 'está levando mais que o normal, continua rodando'
                              : `normalmente leva cerca de ${Math.round(estimate / 60)} min`}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                  {aside ? (
                    <span className="admin-run-step-time">{aside}</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {status ? (
        <p className="admin-run-status" data-tone={status.tone}>
          {status.text}
        </p>
      ) : null}
      {error ? (
        <p className="admin-run-status" data-tone="warn">
          {error}
        </p>
      ) : null}

      {events.length ? (
        <details className="admin-run-log">
          <summary>Linha do tempo ({events.length})</summary>
          <ol>
            {[...events].reverse().map((event) => (
              <li key={event.id} data-kind={event.kind}>
                <span>{event.label}</span>
                <time dateTime={event.createdAt}>
                  {new Date(event.createdAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

/** Versão compacta para o celular, onde a conversa pode estar oculta. */
export function GenerationBar({
  run,
  events,
  state,
  onOpen,
}: {
  run: GenerationRun | null;
  events: GenerationEvent[];
  state: SiteState;
  onOpen: () => void;
}) {
  const running = isRunning(run);
  if (!running) return null;
  const activity = currentActivity(events);
  const phase = run?.phase ?? (state.generation.next as Phase);
  const progress = phaseProgress(state, phase, events);
  return (
    <button type="button" onClick={onOpen} className="admin-run-bar">
      <span className="admin-run-pulse" aria-hidden="true" />
      <span className="admin-run-bar-text">
        <strong>{PHASE_LABEL[phase]}</strong>
        <span>{progress ?? activity?.label ?? 'em andamento'}</span>
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
}
