'use client';

import { useEffect, useState } from 'react';
import type { SiteState } from '@/lib/admin/state';
import type { GenerationEvent, GenerationRun } from '@/lib/generation/runs';
import { PHASE_LABEL, PHASES, type Phase } from '@/lib/taste/phases';
import { isRunning } from './use-generation';

/** Medido nas gerações reais. Serve para calibrar a espera, não para prometer. */
const ESTIMATE_S: Record<Phase, number> = {
  briefing: 90,
  cenas: 200,
  composicao: 240,
  revisao: 240,
};

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

/** A ferramenta em execução: o último início sem um fim correspondente. */
function currentActivity(events: GenerationEvent[]): GenerationEvent | null {
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

function phaseProgress(state: SiteState, phase: Phase | null): string | null {
  const generation = state.generation;
  if (phase === 'cenas')
    return `${generation.coveredScenes} de ${generation.targetScenes} cenas prontas`;
  if (phase === 'composicao') return `${state.pages.length} páginas gravadas`;
  if (phase === 'revisao')
    return `rodada ${Math.max(1, generation.reviewRounds)} de 3`;
  return null;
}

function statusLine(
  run: GenerationRun | null,
  state: SiteState,
): { tone: 'ok' | 'warn' | 'err' | 'info'; text: string } | null {
  if (!run || isRunning(run)) return null;
  if (run.status === 'done')
    return {
      tone: 'ok',
      text: 'Geração concluída. Confira a prévia e publique quando quiser.',
    };
  if (run.status === 'paused')
    return {
      tone: 'warn',
      text: 'Geração pausada. O progresso está salvo; use Continuar para retomar.',
    };
  if (run.status === 'failed')
    return {
      tone: 'err',
      text: run.error ?? 'A geração parou por um erro. Confira o chat.',
    };
  return state.generation.next === 'pronto'
    ? { tone: 'ok', text: 'Geração concluída.' }
    : null;
}

export function GenerationPanel({
  run,
  events,
  state,
  error,
  busy,
  onStart,
  onStop,
}: {
  run: GenerationRun | null;
  events: GenerationEvent[];
  state: SiteState;
  error: string | null;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const running = isRunning(run);
  const now = useNow(running);
  const [dismissed, setDismissed] = useState(false);
  const next = state.generation.next;
  const done = next === 'pronto';
  // Terminar sem dizer que terminou foi parte da queixa: a conclusão fica à
  // vista até o operador fechar. Sem execução recente, o painel sai da frente.
  const finished = done && !running;
  if (finished && (!run || run.status !== 'done' || dismissed)) return null;

  const phase = running ? (run?.phase ?? null) : null;
  const activity = running ? currentActivity(events) : null;
  const phaseStarted = run?.phaseStartedAt
    ? new Date(run.phaseStartedAt).getTime()
    : null;
  const runStarted = run ? new Date(run.startedAt).getTime() : null;
  const phaseSeconds = phaseStarted ? (now - phaseStarted) / 1000 : 0;
  const estimate = phase ? ESTIMATE_S[phase] : 0;
  const progress = phaseProgress(state, phase);
  const status = statusLine(run, state);
  const reached = (item: Phase) =>
    PHASES.indexOf(item) <
    (done ? PHASES.length : PHASES.indexOf(next as Phase));

  return (
    <section className="admin-run" aria-live="polite" aria-busy={running}>
      <div className="admin-run-head">
        <div className="admin-run-title">
          <span className="admin-run-name">
            {running
              ? `Gerando: ${PHASE_LABEL[phase ?? (next as Phase)]}`
              : 'Geração em etapas'}
          </span>
          {running && runStarted ? (
            <span className="admin-run-time">
              {clock(phaseSeconds)} nesta etapa ·{' '}
              {clock((now - runStarted) / 1000)} no total
            </span>
          ) : null}
        </div>
        {finished ? (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="admin-secondary"
          >
            Fechar
          </button>
        ) : running ? (
          <button
            type="button"
            onClick={onStop}
            disabled={run?.status === 'stopping'}
            className="admin-secondary"
          >
            {run?.status === 'stopping' ? 'Pausando…' : 'Pausar'}
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
            {next === 'briefing' && !state.pages.length
              ? 'Gerar site'
              : 'Continuar'}
          </button>
        )}
      </div>

      {finished ? null : (
        <ol className="admin-run-steps">
          {PHASES.map((item) => {
            const active = phase === item;
            const complete = reached(item);
            return (
              <li
                key={item}
                data-state={active ? 'active' : complete ? 'done' : 'todo'}
              >
                <span className="admin-run-dot" aria-hidden="true" />
                <span>{PHASE_LABEL[item]}</span>
                {active && progress ? (
                  <span className="admin-run-sub">{progress}</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {running ? (
        <p className="admin-run-activity">
          <span className="admin-run-pulse" aria-hidden="true" />
          {activity?.label ?? 'Preparando a etapa'}
          {estimate ? (
            <span className="admin-run-sub">
              {phaseSeconds > estimate
                ? 'está levando mais que o normal, continua rodando'
                : `normalmente leva cerca de ${Math.round(estimate / 60)} min`}
            </span>
          ) : null}
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
          <summary>Etapas registradas ({events.length})</summary>
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
  return (
    <button type="button" onClick={onOpen} className="admin-run-bar">
      <span className="admin-run-pulse" aria-hidden="true" />
      <span className="admin-run-bar-text">
        {PHASE_LABEL[phase]}: {activity?.label ?? 'em andamento'}
      </span>
      <span className="admin-run-sub">ver</span>
    </button>
  );
}
