'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch } from '@/lib/admin/http';
import type { SiteState } from '@/lib/admin/state';
import type { ChatMessage } from '@/lib/ai/usage';
import type { GenerationEvent, GenerationRun } from '@/lib/generation/runs';

export type GenerationFeed = {
  run: GenerationRun | null;
  events: GenerationEvent[];
  messages: ChatMessage[];
  lastMessageId: number;
  hasMoreMessages: boolean;
  state: SiteState;
};

const ACTIVE = ['queued', 'running', 'stopping'];
/** Rápido o bastante para parecer ao vivo, leve o bastante para uma aba aberta o dia todo. */
const POLL_MS = 3_000;

export function isRunning(run: GenerationRun | null): boolean {
  return Boolean(run && ACTIVE.includes(run.status));
}

/**
 * Andamento lido do servidor. O laço das etapas morava aqui no navegador:
 * recarregar a página matava a geração no meio e o painel voltava oferecendo
 * "Continuar" como se nada estivesse rodando.
 */
export function useGeneration(input: {
  tenant: string;
  onState: (state: SiteState) => void;
  onMessages: (messages: ChatMessage[]) => void;
  /** Último id já exibido: o painel busca daí em diante. */
  initialMessageId: number;
  /** Suspende a leitura periódica, para telas que não precisam dela. */
  paused?: boolean;
}) {
  const { tenant, onState, onMessages, paused = false } = input;
  const [run, setRun] = useState<GenerationRun | null>(null);
  const [events, setEvents] = useState<GenerationEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef(input.initialMessageId);
  const readSequence = useRef(0);
  const active = isRunning(run);
  const stateRef = useRef(onState);
  const messagesRef = useRef(onMessages);
  // O painel recebe callbacks novos a cada render; guardá-los fora do render
  // mantém o laço de leitura estável sem reiniciar o polling.
  useEffect(() => {
    stateRef.current = onState;
    messagesRef.current = onMessages;
  }, [onState, onMessages]);

  const read = useCallback(
    async (signal?: AbortSignal) => {
      const ticket = ++readSequence.current;
      const feed = await adminFetch<GenerationFeed>(
        `/api/admin/${tenant}/generation?after=${cursor.current}`,
        {
          signal: AbortSignal.any([
            AbortSignal.timeout(20_000),
            ...(signal ? [signal] : []),
          ]),
        },
      );
      // A leitura inicial, os controles e o polling podem se cruzar. Uma
      // resposta cancelada ou antiga não reverte o painel nem consome o cursor.
      if (signal?.aborted || ticket !== readSequence.current) return feed;
      setRun(feed.run);
      setEvents(feed.events);
      stateRef.current(feed.state);
      if (feed.messages.length) messagesRef.current(feed.messages);
      cursor.current = Math.max(cursor.current, feed.lastMessageId);
      return feed;
    },
    [tenant],
  );

  // Enquanto a execução está viva o painel acompanha sozinho; parada, uma
  // leitura no retorno basta e a aba para de conversar com o servidor.
  useEffect(() => {
    if (paused) return;
    let alive = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const feed = await read(controller.signal);
        if (!alive) return;
        setError(null);
        if (feed.hasMoreMessages || isRunning(feed.run))
          timer = setTimeout(tick, feed.hasMoreMessages ? 0 : POLL_MS);
      } catch (failure) {
        if (!alive) return;
        setError(
          failure instanceof Error
            ? failure.message
            : 'Não foi possível ler o andamento.',
        );
        timer = setTimeout(tick, POLL_MS * 3);
      }
    };
    void tick();
    return () => {
      alive = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [read, paused, active]);

  const start = useCallback(async () => {
    setError(null);
    const result = await adminFetch<{ run: GenerationRun }>(
      `/api/admin/${tenant}/generation`,
      { method: 'POST' },
    );
    setRun(result.run);
    await read();
    return result.run;
  }, [tenant, read]);

  const stop = useCallback(async () => {
    setError(null);
    await adminFetch(`/api/admin/${tenant}/generation/stop`, {
      method: 'POST',
    });
    await read();
  }, [tenant, read]);

  return { run, events, error, refresh: read, start, stop };
}
