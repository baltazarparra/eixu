'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { Archive, ArrowUpRight, Plus, Search, Settings2 } from 'lucide-react';
import { setTenantArchivedAction } from '@/app/(admin)/admin/actions';
import { useAdminSession } from '@/components/admin/session';
import {
  STUDIO_DIRECTION_LABEL,
  type StudioDirection,
} from '@/lib/studio/directions';
import type { StudioDashboardProject } from '@/lib/studio/dashboard';

const date = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

function stateOf(project: StudioDashboardProject) {
  if (project.tenantStatus === 'archived')
    return { label: 'Arquivado', tone: 'muted' };
  if (project.run)
    return {
      label:
        project.run.kind === 'build'
          ? 'Criando site'
          : project.run.kind === 'refine'
            ? 'Refinando'
            : 'Editando',
      tone: 'working',
    };
  if (
    project.release &&
    ['preparing', 'validating', 'ready'].includes(project.release.status)
  )
    return { label: 'Publicando', tone: 'working' };
  if (project.release?.status === 'failed')
    return { label: 'Publicação falhou', tone: 'error' };
  if (project.tenantStatus === 'published')
    return { label: 'Publicado', tone: 'live' };
  if (project.projectStatus === 'ready')
    return { label: 'Pronto para revisar', tone: 'review' };
  if (project.projectStatus === 'failed')
    return { label: 'Precisa de atenção', tone: 'error' };
  return { label: 'Briefing', tone: 'draft' };
}

function ArchiveProject({ project }: { project: StudioDashboardProject }) {
  const router = useRouter();
  const archived = project.tenantStatus === 'archived';
  const [result, action, pending] = useActionState(
    setTenantArchivedAction,
    null,
  );
  useEffect(() => {
    if (result?.ok) router.refresh();
  }, [result, router]);
  return (
    <form
      action={action}
      className="studio-project-archive"
      onSubmit={(event) => {
        if (
          !archived &&
          !window.confirm(
            `Arquivar ${project.name}? O domínio público sairá do ar, mas o projeto será preservado.`,
          )
        )
          event.preventDefault();
      }}
    >
      <input type="hidden" name="slug" value={project.slug} />
      <input
        type="hidden"
        name="intent"
        value={archived ? 'restore' : 'archive'}
      />
      <button type="submit" disabled={pending}>
        <Archive size={14} aria-hidden="true" />
        {pending ? 'Salvando' : archived ? 'Reativar' : 'Arquivar'}
      </button>
      {result && !result.ok ? (
        <small role="alert">{result.message}</small>
      ) : null}
    </form>
  );
}

function DirectionMark({ direction }: { direction: StudioDirection }) {
  return (
    <span className="studio-direction-mark" data-direction={direction}>
      <i />
      <i />
      <i />
    </span>
  );
}

export function StudioProjects({
  initialProjects,
}: {
  initialProjects: StudioDashboardProject[];
}) {
  const session = useAdminSession();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'ativos' | 'arquivados'>('ativos');
  const visible = useMemo(
    () =>
      initialProjects.filter((project) => {
        const archived = project.tenantStatus === 'archived';
        return (
          (scope === 'arquivados' ? archived : !archived) &&
          `${project.name} ${project.slug}`
            .toLocaleLowerCase('pt-BR')
            .includes(query.toLocaleLowerCase('pt-BR'))
        );
      }),
    [initialProjects, query, scope],
  );
  const published = initialProjects.filter(
    (project) => project.tenantStatus === 'published',
  ).length;
  const working = initialProjects.filter(
    (project) =>
      project.run ||
      (project.release &&
        ['preparing', 'validating', 'ready'].includes(project.release.status)),
  ).length;

  return (
    <main className="studio-home">
      <header className="studio-home-header">
        <Link
          href="/studio"
          className="studio-wordmark"
          aria-label="EIXU Studio"
        >
          <span>EIXU</span>
          <strong>Studio</strong>
        </Link>
        <div className="studio-operator">
          <span>{session?.operator}</span>
          {session?.logout}
        </div>
      </header>

      <section className="studio-home-intro">
        <div>
          <p>Sites em produção</p>
          <h1>Da conversa ao site no ar.</h1>
          <span>
            Crie, acompanhe e publique experiências próprias para cada cliente.
          </span>
        </div>
        <dl>
          <div>
            <dt>Projetos</dt>
            <dd>{String(initialProjects.length).padStart(2, '0')}</dd>
          </div>
          <div>
            <dt>No ar</dt>
            <dd>{String(published).padStart(2, '0')}</dd>
          </div>
          <div>
            <dt>Em curso</dt>
            <dd>{String(working).padStart(2, '0')}</dd>
          </div>
        </dl>
      </section>

      <section
        className="studio-library"
        aria-labelledby="studio-projects-title"
      >
        <div className="studio-library-bar">
          <div>
            <p>Biblioteca</p>
            <h2 id="studio-projects-title">Projetos</h2>
          </div>
          <label className="studio-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Buscar projetos</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente ou domínio"
            />
          </label>
          <div className="studio-scope" aria-label="Filtrar projetos">
            <button
              type="button"
              aria-pressed={scope === 'ativos'}
              onClick={() => setScope('ativos')}
            >
              Ativos
            </button>
            <button
              type="button"
              aria-pressed={scope === 'arquivados'}
              onClick={() => setScope('arquivados')}
            >
              Arquivados
            </button>
          </div>
          <Link href="/studio/novo" className="studio-new-project">
            <Plus size={15} aria-hidden="true" /> Novo projeto
          </Link>
        </div>

        {visible.length ? (
          <ul className="studio-project-grid">
            {visible.map((project) => {
              const state = stateOf(project);
              return (
                <li key={project.id} className="studio-project-card">
                  <Link
                    href={`/studio/${project.slug}`}
                    className="studio-project-open"
                  >
                    <div className="studio-project-visual">
                      <DirectionMark direction={project.direction} />
                      <span
                        className="studio-project-state"
                        data-tone={state.tone}
                      >
                        {state.tone === 'working' ? <i /> : null}
                        {state.label}
                      </span>
                    </div>
                    <div className="studio-project-copy">
                      <div>
                        <p>{STUDIO_DIRECTION_LABEL[project.direction]}</p>
                        <h3>{project.name}</h3>
                        <span>{project.canonicalHost}</span>
                      </div>
                      <ArrowUpRight size={18} aria-hidden="true" />
                    </div>
                  </Link>
                  <footer>
                    <span>
                      Atualizado {date.format(new Date(project.updatedAt))}
                    </span>
                    <div>
                      <Link
                        href={`/studio/${project.slug}/dados`}
                        aria-label={`Editar dados de ${project.name}`}
                      >
                        <Settings2 size={14} aria-hidden="true" /> Editar
                      </Link>
                      <ArchiveProject project={project} />
                    </div>
                  </footer>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="studio-empty">
            <span>
              {scope === 'arquivados'
                ? 'Arquivo vazio'
                : 'Comece pelo briefing'}
            </span>
            <h3>
              {query
                ? 'Nenhum projeto corresponde à busca.'
                : scope === 'arquivados'
                  ? 'Nenhum projeto arquivado.'
                  : 'Crie o primeiro projeto do Studio.'}
            </h3>
            {scope === 'ativos' && !query ? (
              <Link href="/studio/novo">Criar projeto</Link>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
