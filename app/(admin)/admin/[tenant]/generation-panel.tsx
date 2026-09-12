'use client';

import { useEffect, useState } from 'react';
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
import { PHASE_LABEL, PHASES, type Phase } from '@/lib/taste/phases';
import { StatusPill } from '@/components/admin/primitives';
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
  // Um run só fecha como concluído quando o estado dizia "pronto". Se uma
  // etapa voltou a existir, foi o rascunho, o acervo ou o gerador que mudaram
  // depois; culpar a execução mandava o operador procurar um erro que não houve.
  if (run.status === 'done' && state.generation.next !== 'pronto')
    return {
      tone: 'warn',
      text: 'A geração terminou, mas o rascunho ou o gerador mudaram depois disso. A revisão visual do rascunho atual está pendente; use Continuar para refazê-la.',
    };
  return null;
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
  const title = starting
    ? 'Iniciando a geração'
    : run?.status === 'stopping'
      ? 'Pausando a geração'
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

  // A etapa e o que ela já produziu ficam à esquerda; os tempos, à direita,
  // para o bloco caber acima da conversa sem roubar altura da prévia.
  const stage = starting
    ? 'Abrindo a primeira etapa no servidor'
    : running && runStarted
      ? [
          `Etapa ${position} de ${PHASES.length}`,
          phaseProgress(state, phase, events),
        ]
          .filter(Boolean)
          .join(' · ')
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
      aria-live="polite"
      aria-busy={running || starting}
    >
      <div className="admin-run-head">
        <StatusPill
          tone={
            run?.status === 'failed'
              ? 'err'
              : finished
                ? 'ok'
                : running || starting
                  ? 'accent'
                  : 'neutral'
          }
          pulse={running && run?.status !== 'stopping'}
        >
          {run?.status === 'stopping'
            ? 'Pausando'
            : running || starting
              ? 'Em execução'
              : finished
                ? 'Concluída'
                : run?.status === 'failed'
                  ? 'Interrompida'
                  : 'Parada'}
        </StatusPill>
        <strong className="admin-run-name">{title}</strong>
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
        <ol className="admin-run-steps">
          {PHASES.map((item) => {
            const active = phase === item;
            const complete = reached(item);
            const record = records[item];
            const failed =
              run?.status === 'failed' && (run.phase ?? next) === item;
            const outcome = [
              record?.outcome,
              record?.seconds ? `em ${clock(record.seconds)}` : null,
            ]
              .filter(Boolean)
              .join(' ');
            // O nome da fase e o que ela produziu saem da trilha e viram o
            // título dela; a linha do tempo continua trazendo o mesmo conteúdo.
            const hint = failed
              ? `${PHASE_LABEL[item]} · interrompida`
              : active
                ? `${PHASE_LABEL[item]} · em execução`
                : complete
                  ? `${PHASE_LABEL[item]}${outcome ? ` · ${outcome}` : ''}`
                  : `${PHASE_LABEL[item]} · ~${Math.round(ESTIMATE_S[item] / 60)} min`;
            return (
              <li
                key={item}
                title={hint}
                data-state={
                  failed
                    ? 'failed'
                    : active
                      ? 'active'
                      : complete
                        ? 'done'
                        : 'todo'
                }
              >
                <span className="admin-step-track" aria-hidden="true" />
              </li>
            );
          })}
        </ol>
      )}

      <p className="admin-run-stage">
        <span>{stage}</span>
        {running && runStarted ? (
          <span className="admin-run-meta">
            {clock(phaseSeconds)} · {clock(totalSeconds ?? 0)} no total
          </span>
        ) : null}
      </p>

      {running ? (
        <p className="admin-run-activity">
          <span className="admin-run-pulse" aria-hidden="true" />
          <span>
            {run?.status === 'stopping'
              ? 'A etapa atual termina e a próxima não começa.'
              : (activity?.label ?? 'Preparando a etapa')}
            {estimate ? (
              <small>
                {phaseSeconds > estimate
                  ? 'Está levando mais que o normal; continua rodando.'
                  : `Normalmente leva cerca de ${Math.round(estimate / 60)} min.`}
              </small>
            ) : null}
          </span>
        </p>
      ) : null}
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
