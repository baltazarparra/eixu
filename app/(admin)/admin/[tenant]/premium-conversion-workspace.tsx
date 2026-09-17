'use client';

import {
  Check,
  Clock3,
  ExternalLink,
  Gem,
  GitPullRequest,
  LoaderCircle,
  RefreshCw,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MobileViews, WorkspaceHeader } from '@/components/admin/navigation';
import { adminFetch } from '@/lib/admin/http';
import type { SiteState } from '@/lib/admin/state';

type Props = { initial: SiteState };
type Status = NonNullable<SiteState['premium']['conversion']>['status'];

const STEPS: Array<{
  status: Status;
  label: string;
  description: string;
}> = [
  {
    status: 'queued',
    label: 'Pedido recebido',
    description: 'A versão publicada foi protegida para a conversão.',
  },
  {
    status: 'claimed',
    label: 'Preparar o projeto',
    description: 'Código, conteúdo e integrações estão sendo validados.',
  },
  {
    status: 'exported',
    label: 'Revisar a entrega',
    description: 'A primeira versão precisa da aprovação da EIXU.',
  },
  {
    status: 'deploying',
    label: 'Publicar',
    description: 'O novo projeto passa pelos gates antes da troca.',
  },
  {
    status: 'activated',
    label: 'Premium ativo',
    description: 'O editor Premium assume a mesma URL do site.',
  },
];

function elapsed(createdAt: string, now: number): string {
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(createdAt).getTime()) / 1000),
  );
  if (seconds < 60) return 'menos de 1 min';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}min`;
}

function currentIndex(status: Status): number {
  const index = STEPS.findIndex((step) => step.status === status);
  return index < 0 ? 0 : index;
}

function statusMessage(site: SiteState, now: number) {
  const conversion = site.premium.conversion;
  if (!conversion)
    return {
      title: 'Preparando o acompanhamento',
      description:
        'O site publicado continua no ar enquanto sincronizamos o estado.',
    };
  if (conversion.status === 'queued') {
    const waiting = now - new Date(conversion.createdAt).getTime() > 120_000;
    return {
      title: waiting ? 'A preparação ainda não começou' : 'Pedido recebido',
      description: waiting
        ? 'O pedido está seguro e uma nova tentativa será feita automaticamente. Você pode fechar esta tela.'
        : 'Estamos iniciando a preparação. A próxima atualização aparece automaticamente.',
    };
  }
  if (conversion.status === 'claimed')
    return {
      title: 'Projeto em preparação',
      description:
        'Estamos exportando a versão publicada e executando tipos, lint e build.',
    };
  if (conversion.status === 'exported' && conversion.error)
    return {
      title: 'A publicação precisa de atenção',
      description: conversion.error,
    };
  if (conversion.status === 'exported')
    return {
      title: 'Entrega pronta para revisão',
      description:
        'A preparação terminou. Revise a entrega e aprove para iniciar a publicação.',
    };
  if (conversion.status === 'deploying')
    return {
      title: 'Publicando o projeto Premium',
      description:
        'A URL só será transferida depois do build, do deployment e do smoke passarem.',
    };
  return {
    title: 'Conversão em andamento',
    description: 'A versão publicada continua disponível na mesma URL.',
  };
}

export function PremiumConversionWorkspace({ initial }: Props) {
  const [site, setSite] = useState(initial);
  const [view, setView] = useState<'chat' | 'content'>('chat');
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshInFlight = useRef(false);
  const conversion = site.premium.conversion;
  const status = conversion?.status ?? 'queued';
  const activeIndex = currentIndex(status);
  const message = statusMessage(site, now);

  const refresh = useCallback(
    async (silent = false) => {
      if (refreshInFlight.current) return;
      refreshInFlight.current = true;
      if (!silent) setRefreshing(true);
      try {
        const next = await adminFetch<SiteState>(
          `/api/admin/${initial.tenant.slug}/state`,
          { signal: AbortSignal.timeout(20_000) },
        );
        setRefreshError(null);
        if (
          next.premium.maintenanceMode === 'premium' &&
          next.premium.publicRuntime === 'premium'
        ) {
          window.location.reload();
          return;
        }
        setSite(next);
      } catch (error) {
        setRefreshError(
          error instanceof Error
            ? error.message
            : 'Não foi possível atualizar agora.',
        );
      } finally {
        refreshInFlight.current = false;
        if (!silent) setRefreshing(false);
      }
    },
    [initial.tenant.slug],
  );

  useEffect(() => {
    const poll = window.setInterval(() => void refresh(true), 5_000);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  const retryRelease = useCallback(async () => {
    setRetrying(true);
    setRefreshError(null);
    try {
      await adminFetch(`/api/admin/${initial.tenant.slug}/premium/retry`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      await refresh(true);
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : 'Não foi possível tentar a publicação novamente.',
      );
    } finally {
      setRetrying(false);
    }
  }, [initial.tenant.slug, refresh]);

  const decision = useMemo(() => {
    if (status === 'exported' && conversion?.error)
      return (
        <button
          type="button"
          className="admin-primary"
          disabled={retrying}
          onClick={() => void retryRelease()}
        >
          <Rocket size={15} aria-hidden="true" />
          {retrying ? 'Reiniciando…' : 'Tentar publicar novamente'}
        </button>
      );
    if (status === 'exported' && conversion?.pullRequestUrl)
      return (
        <a
          className="admin-primary"
          href={conversion.pullRequestUrl}
          target="_blank"
          rel="noreferrer"
        >
          <GitPullRequest size={15} aria-hidden="true" /> Revisar e aprovar
        </a>
      );
    return (
      <span className="admin-premium-conversion-state">
        <LoaderCircle size={15} aria-hidden="true" />
        {status === 'deploying' ? 'Publicando…' : 'Preparando…'}
      </span>
    );
  }, [conversion, retryRelease, retrying, status]);

  return (
    <div className="admin-workspace admin-premium-conversion" data-view={view}>
      <WorkspaceHeader
        tenant={site.tenant}
        conversation={
          <span className="admin-premium-mode">
            <Gem size={15} aria-hidden="true" /> Premium
          </span>
        }
        preview={
          <a
            className="admin-secondary"
            href={site.premium.canonicalUrl}
            target="_blank"
            rel="noreferrer"
          >
            Site atual <ExternalLink size={14} aria-hidden="true" />
          </a>
        }
        decision={decision}
      />

      <div className="admin-workspace-body admin-premium-conversion-body">
        <main
          id="admin-conversation"
          className="admin-conversation admin-premium-conversion-panel"
        >
          <div className="admin-premium-conversion-intro">
            <span className="admin-premium-conversion-mark" aria-hidden="true">
              <Gem size={24} />
            </span>
            <div>
              <p>Conversão Premium</p>
              <h1>{message.title}</h1>
            </div>
          </div>
          <p className="admin-premium-conversion-copy">{message.description}</p>

          <ol className="admin-premium-conversion-steps">
            {STEPS.map((step, index) => {
              const complete = index < activeIndex;
              const current = index === activeIndex;
              return (
                <li
                  key={step.status}
                  data-state={
                    complete ? 'complete' : current ? 'current' : 'waiting'
                  }
                  aria-current={current ? 'step' : undefined}
                >
                  <span aria-hidden="true">
                    {complete ? <Check size={14} /> : index + 1}
                  </span>
                  <div>
                    <strong>{step.label}</strong>
                    <p>{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="admin-premium-conversion-meta" aria-live="polite">
            <span>
              <Clock3 size={15} aria-hidden="true" />
              {conversion
                ? `Decorrido: ${elapsed(conversion.createdAt, now)}`
                : 'Sincronizando o pedido'}
            </span>
            <button
              type="button"
              className="admin-secondary"
              disabled={refreshing}
              onClick={() => void refresh()}
            >
              <RefreshCw size={14} aria-hidden="true" />
              {refreshing ? 'Atualizando…' : 'Atualizar agora'}
            </button>
          </div>
          {refreshError ? (
            <p className="admin-premium-conversion-error" role="alert">
              {refreshError}
            </p>
          ) : null}

          <div className="admin-premium-conversion-assurance">
            <ShieldCheck size={19} aria-hidden="true" />
            <p>
              <strong>O site continua no ar.</strong> A mesma URL só muda quando
              o projeto Premium estiver validado e disponível.
            </p>
          </div>
        </main>

        <section
          id="admin-preview"
          className="admin-content admin-premium-conversion-preview"
          aria-label="Site publicado durante a conversão"
        >
          <header>
            <div>
              <span aria-hidden="true" />
              <strong>Site atual no ar</strong>
            </div>
            <p>A conversão usa exatamente esta versão publicada.</p>
          </header>
          <iframe
            title={`Site publicado de ${site.tenant.name}`}
            src={`/s/${site.tenant.slug}/?__tenant=${site.tenant.slug}`}
            sandbox="allow-same-origin allow-scripts"
            referrerPolicy="same-origin"
          />
        </section>
      </div>

      <MobileViews value={view} onChange={setView} second="Site atual" />
    </div>
  );
}
