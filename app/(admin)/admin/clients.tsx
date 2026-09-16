'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronRight,
  Folder,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { BrandFields } from '@/components/admin/brand-fields';
import { TenantFields } from '@/components/admin/tenant-fields';
import { useAdminSession } from '@/components/admin/session';
import {
  EmptyState,
  SegmentedControl,
  StatusDot,
  StatusPill,
  type StatusTone,
} from '@/components/admin/primitives';
import type { FolderAssignment } from '@/lib/admin/site-folders';
import type { OperationSummary } from '@/lib/admin/queries';
import type { TenantUsage } from '@/lib/admin/usage-history';
import { formatCost, formatTokens } from '@/lib/admin/usage-summary';
import {
  actionLabel,
  actorLabel,
  lastTouch,
  type SiteAction,
} from '@/lib/admin/site-list';
import {
  createSiteFolderAction,
  createTenantAction,
  deleteSiteFolderAction,
  moveSitesToFolderAction,
  renameSiteFolderAction,
  setTenantArchivedAction,
} from './actions';

export type ClientSummary = {
  slug: string;
  name: string;
  status: string;
  folderId: string | null;
  updatedAt: string;
  lastAction: SiteAction | null;
};

export type SiteFolderSummary = {
  id: string;
  name: string;
  siteCount: number;
};

type Scope = string;
type Toast = { message: string; undo?: FolderAssignment[] };

const day = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});
const clock = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});
const folderOrder = new Intl.Collator('pt-BR', { sensitivity: 'base' });
const CONTEXT_KEY = 'eixu:sites-list-context:v1';

/** Contagens da tela têm dois dígitos, como o resto do painel. */
const pad = (value: number) => String(value).padStart(2, '0');

function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

function statusPresentation(status: string): {
  label: string;
  tone: StatusTone;
} {
  if (status === 'published') return { label: 'Publicado', tone: 'ok' };
  if (status === 'archived') return { label: 'Arquivado', tone: 'neutral' };
  return { label: 'Rascunho', tone: 'warn' };
}

function folderLabel(folders: SiteFolderSummary[], folderId: string | null) {
  return folderId
    ? (folders.find((folder) => folder.id === folderId)?.name ?? 'Pasta')
    : 'Sem pasta';
}

function ArchiveSiteButton({ tenant }: { tenant: ClientSummary }) {
  const archived = tenant.status === 'archived';
  const [result, action, pending] = useActionState(
    setTenantArchivedAction,
    null,
  );
  return (
    <form
      className="admin-client-archive"
      action={action}
      onSubmit={(event) => {
        if (
          !archived &&
          !window.confirm(
            `Arquivar ${tenant.name}? A URL pública sairá do ar, mas o conteúdo e a prévia serão preservados.`,
          )
        )
          event.preventDefault();
      }}
    >
      <input type="hidden" name="slug" value={tenant.slug} />
      <input
        type="hidden"
        name="intent"
        value={archived ? 'restore' : 'archive'}
      />
      <button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : archived ? 'Reativar site' : 'Arquivar site'}
      </button>
      {result && !result.ok ? (
        <span className="admin-client-action-error" role="alert">
          {result.message}
        </span>
      ) : null}
    </form>
  );
}

function FolderDestinations({
  folders,
  currentFolderId,
  disabled,
  onMove,
}: {
  folders: SiteFolderSummary[];
  currentFolderId: string | null | undefined;
  disabled: boolean;
  onMove: (folderId: string | null) => void;
}) {
  return (
    <div className="admin-folder-destinations">
      <button
        type="button"
        disabled={disabled || currentFolderId === null}
        onClick={() => onMove(null)}
      >
        <Folder size={15} strokeWidth={1.7} aria-hidden="true" />
        Sem pasta
        {currentFolderId === null ? (
          <Check size={14} strokeWidth={1.7} aria-hidden="true" />
        ) : null}
      </button>
      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          disabled={disabled || currentFolderId === folder.id}
          onClick={() => onMove(folder.id)}
        >
          <Folder size={15} strokeWidth={1.7} aria-hidden="true" />
          {folder.name}
          {currentFolderId === folder.id ? (
            <Check size={14} strokeWidth={1.7} aria-hidden="true" />
          ) : null}
        </button>
      ))}
    </div>
  );
}

function SiteActions({
  tenant,
  folders,
  busy,
  onMove,
}: {
  tenant: ClientSummary;
  folders: SiteFolderSummary[];
  busy: boolean;
  onMove: (folderId: string | null) => void;
}) {
  return (
    <details className="admin-site-menu">
      <summary aria-label={`Ações de ${tenant.name}`} title="Mais ações">
        <MoreHorizontal size={17} strokeWidth={1.7} aria-hidden="true" />
      </summary>
      <div className="admin-site-menu-panel">
        <strong>Mover para</strong>
        <FolderDestinations
          folders={folders}
          currentFolderId={tenant.folderId}
          disabled={busy}
          onMove={(folderId) => {
            onMove(folderId);
            document
              .querySelectorAll<HTMLDetailsElement>('.admin-site-menu[open]')
              .forEach((details) => details.removeAttribute('open'));
          }}
        />
        <span className="admin-site-menu-divider" />
        <ArchiveSiteButton tenant={tenant} />
      </div>
    </details>
  );
}

/**
 * Fila de trabalho da tela: o que espera revisão e o que a máquina está
 * fazendo agora. Ocupa a coluna que antes era um rail de pastas quase vazio.
 */
function AttentionCard({
  drafts,
  summary,
  onDrafts,
}: {
  drafts: number;
  summary: OperationSummary;
  onDrafts: () => void;
}) {
  return (
    <section className="admin-attention" aria-label="Precisa de atenção">
      <div className="admin-attention-head">
        <p className="admin-label">Precisa de atenção</p>
        {drafts ? (
          <span className="admin-attention-badge">{pad(drafts)}</span>
        ) : null}
      </div>
      <button
        type="button"
        className="admin-attention-item"
        disabled={!drafts}
        onClick={onDrafts}
      >
        <span
          className="admin-attention-value"
          data-tone={drafts ? 'warn' : undefined}
        >
          {pad(drafts)}
        </span>
        <span>
          <strong>Rascunhos sem revisão</strong>
          <small>
            {drafts
              ? 'Nenhum deles está no ar. Revise a prévia antes de publicar.'
              : 'Nenhum rascunho parado agora.'}
          </small>
        </span>
        {drafts ? (
          <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" />
        ) : null}
      </button>
      <div className="admin-attention-item">
        <span
          className="admin-attention-value"
          data-tone={summary.running ? 'accent' : undefined}
        >
          {pad(summary.running)}
        </span>
        <span>
          <strong>Gerações em curso</strong>
          <small>
            {summary.current ? (
              <>
                <StatusDot tone="accent" pulse />
                {summary.current.stage} · {summary.current.site}
              </>
            ) : (
              'Nenhuma agora. O andamento aparece aqui com a etapa.'
            )}
          </small>
        </span>
      </div>
    </section>
  );
}

/** Consumo do período curto, por cliente, com link para o histórico de cada um. */
function UsageCard({ usage }: { usage: TenantUsage }) {
  const rows = usage.rows.filter((row) => row.costUsd !== null);
  if (!rows.length) return null;
  const top = Math.max(...rows.map((row) => row.costUsd ?? 0));
  return (
    <section
      className="admin-usage-card"
      aria-label={`Consumo de IA nos últimos ${usage.days} dias`}
    >
      <p className="admin-label">Consumo de IA · {usage.days} dias</p>
      <p className="admin-usage-total">
        <strong>{formatCost(usage.costUsd ?? undefined)}</strong>
        <span>{formatTokens(usage.totalTokens ?? undefined)}</span>
      </p>
      <ul className="admin-usage-list">
        {rows.map((row) => (
          <li key={row.tenantId}>
            <Link href={`/admin/${row.slug}/consumo`}>{row.name}</Link>
            <b>{formatCost(row.costUsd ?? undefined)}</b>
            <span className="admin-usage-bar" aria-hidden="true">
              <span
                style={{
                  width: `${top ? Math.round(((row.costUsd ?? 0) / top) * 100) : 0}%`,
                }}
              />
            </span>
          </li>
        ))}
      </ul>
      <p className="admin-usage-note">
        Valores informados pelo provedor, em dólar, sem conversão para reais.
      </p>
    </section>
  );
}

/**
 * As pastas deixaram o rail e viraram filtro no topo da lista: continuam
 * recebendo o arraste, mas sem gastar uma coluna inteira da tela.
 */
function FolderFilters({
  folders,
  counts,
  active,
  busy,
  dropTarget,
  onSelect,
  onCreate,
  onDragOver,
  onDrop,
  children,
}: {
  folders: SiteFolderSummary[];
  counts: Map<string | null, number>;
  active: Scope;
  busy: boolean;
  dropTarget: string | null | undefined;
  onSelect: (scope: Scope) => void;
  onCreate: (name: string) => Promise<boolean>;
  onDragOver: (folderId: string | null, event: DragEvent) => void;
  onDrop: (folderId: string | null, event: DragEvent) => void;
  children: ReactNode;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitCreate = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    if (await onCreate(formText(new FormData(form), 'name'))) {
      setCreating(false);
      form.reset();
    } else setError('Confira o nome ou tente novamente.');
  };

  const pill = (
    scope: Scope,
    folderId: string | null | undefined,
    name: string,
    count: number,
    title: string,
  ) => (
    <button
      key={scope}
      type="button"
      className="admin-folder-pill"
      data-folder-id={scope}
      title={title}
      aria-current={active === scope ? 'page' : undefined}
      data-drag-over={
        folderId !== undefined && dropTarget === folderId ? true : undefined
      }
      onClick={() => onSelect(scope)}
      onDragEnter={
        folderId === undefined
          ? undefined
          : (event) => onDragOver(folderId, event)
      }
      onDragOver={
        folderId === undefined
          ? undefined
          : (event) => onDragOver(folderId, event)
      }
      onDrop={
        folderId === undefined ? undefined : (event) => onDrop(folderId, event)
      }
    >
      <Folder size={14} strokeWidth={1.7} aria-hidden="true" />
      {name}
      <small>{pad(count)}</small>
    </button>
  );

  return (
    <div className="admin-folder-filters" aria-label="Pastas dos sites">
      {pill(
        'all',
        undefined,
        'Todos',
        counts.get('all') ?? 0,
        'Todos os sites da equipe',
      )}
      {pill(
        'unfiled',
        null,
        'Sem pasta',
        counts.get(null) ?? 0,
        'Solte sites aqui para tirar da pasta',
      )}
      {folders.map((folder) =>
        pill(
          folder.id,
          folder.id,
          folder.name,
          counts.get(folder.id) ?? 0,
          `Solte sites aqui para mover para ${folder.name}`,
        ),
      )}
      {creating ? (
        <form className="admin-folder-create" onSubmit={submitCreate}>
          <input
            name="name"
            aria-label="Nome da nova pasta"
            placeholder="Nome da pasta"
            maxLength={40}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setCreating(false);
            }}
          />
          <button type="submit" className="admin-secondary" disabled={busy}>
            Criar
          </button>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="Cancelar criação"
            onClick={() => setCreating(false)}
          >
            <X size={15} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="admin-folder-add"
          onClick={() => {
            setCreating(true);
            setError(null);
          }}
        >
          <Plus size={13} strokeWidth={1.9} aria-hidden="true" />
          Nova pasta
        </button>
      )}
      {error ? (
        <p className="admin-folder-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="admin-folder-filters-trailing">{children}</div>
    </div>
  );
}

/** Renomear e excluir seguem a pasta aberta, no lugar do menu do rail. */
function ScopeMenu({
  folder,
  busy,
  onRename,
  onDelete,
}: {
  folder: SiteFolderSummary;
  busy: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <details className="admin-scope-menu">
      <summary
        aria-label={`Ações da pasta ${folder.name}`}
        title="Ações da pasta"
      >
        <MoreHorizontal size={16} strokeWidth={1.7} aria-hidden="true" />
      </summary>
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={(event) => {
            event.currentTarget.closest('details')?.removeAttribute('open');
            onRename();
          }}
        >
          <Pencil size={14} strokeWidth={1.7} aria-hidden="true" />
          Renomear
        </button>
        <button
          type="button"
          className="admin-folder-delete"
          disabled={busy}
          onClick={(event) => {
            event.currentTarget.closest('details')?.removeAttribute('open');
            onDelete();
          }}
        >
          <Trash2 size={14} strokeWidth={1.7} aria-hidden="true" />
          Excluir pasta
        </button>
      </div>
    </details>
  );
}

export function Clients({
  tenants,
  folders: initialFolders,
  summary,
  usage,
}: {
  tenants: ClientSummary[];
  folders: SiteFolderSummary[];
  summary: OperationSummary;
  usage: TenantUsage;
}) {
  const session = useAdminSession();
  const [sites, setSites] = useState(tenants);
  const [folders, setFolders] = useState(initialFolders);
  const [active, setActive] = useState<Scope>('all');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('published');
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [dragged, setDragged] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const contextReady = useRef(false);
  const [error, formAction, pending] = useActionState(createTenantAction, null);

  const orderedFolders = useMemo(
    () => [...folders].sort((a, b) => folderOrder.compare(a.name, b.name)),
    [folders],
  );
  useEffect(() => {
    if (contextReady.current) return;
    contextReady.current = true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(CONTEXT_KEY) ?? '{}') as {
        active?: string;
        query?: string;
        filter?: string;
      };
      queueMicrotask(() => {
        if (
          saved.active === 'all' ||
          saved.active === 'unfiled' ||
          (saved.active &&
            initialFolders.some((folder) => folder.id === saved.active))
        )
          setActive(saved.active);
        if (typeof saved.query === 'string') setQuery(saved.query);
        if (
          ['todos', 'published', 'draft', 'archived'].includes(
            saved.filter ?? '',
          )
        )
          setFilter(saved.filter!);
      });
    } catch {
      sessionStorage.removeItem(CONTEXT_KEY);
    }
  }, [initialFolders]);

  useEffect(() => {
    sessionStorage.setItem(
      CONTEXT_KEY,
      JSON.stringify({ active, query, filter }),
    );
  }, [active, filter, query]);

  const counts = useMemo(() => {
    const next = new Map<string | null, number>();
    next.set('all', sites.length);
    next.set(null, 0);
    for (const site of sites)
      next.set(site.folderId, (next.get(site.folderId) ?? 0) + 1);
    return next;
  }, [sites]);
  const scopeSites = sites.filter(
    (site) =>
      active === 'all' ||
      (active === 'unfiled'
        ? site.folderId === null
        : site.folderId === active),
  );
  const visible = scopeSites.filter(
    (site) =>
      `${site.name} ${site.slug}`
        .toLocaleLowerCase('pt-BR')
        .includes(query.toLocaleLowerCase('pt-BR')) &&
      (filter === 'todos' || site.status === filter),
  );
  const published = sites.filter((site) => site.status === 'published').length;
  const drafts = sites.filter((site) => site.status === 'draft').length;
  const activeFolder = orderedFolders.find((folder) => folder.id === active);
  const scopeTitle =
    active === 'all'
      ? 'Todos os sites'
      : active === 'unfiled'
        ? 'Sem pasta'
        : (activeFolder?.name ?? 'Pasta');
  const allVisibleSelected =
    visible.length > 0 && visible.every((site) => selected.has(site.slug));

  const applyAssignments = async (
    assignments: FolderAssignment[],
    successMessage: string,
    undo?: FolderAssignment[],
  ) => {
    if (!assignments.length || busy) return;
    setBusy(true);
    setToast(null);
    const before = new Map(
      assignments.map((item) => [item.slug, item.fromFolderId]),
    );
    const destination = new Map(
      assignments.map((item) => [item.slug, item.toFolderId]),
    );
    setSites((current) =>
      current.map((site) =>
        destination.has(site.slug)
          ? { ...site, folderId: destination.get(site.slug) ?? null }
          : site,
      ),
    );
    setSelected(new Set());
    const form = new FormData();
    form.set('assignments', JSON.stringify(assignments));
    const result = await moveSitesToFolderAction(form);
    if (!result.ok) {
      setSites((current) =>
        current.map((site) =>
          before.has(site.slug)
            ? { ...site, folderId: before.get(site.slug) ?? null }
            : site,
        ),
      );
      setToast({ message: result.message });
    } else setToast({ message: successMessage, undo });
    setBusy(false);
  };

  const moveSites = (slugs: string[], toFolderId: string | null) => {
    const assignments = slugs
      .map((slug) => sites.find((site) => site.slug === slug))
      .filter((site): site is ClientSummary => Boolean(site))
      .filter((site) => site.folderId !== toFolderId)
      .map((site) => ({
        slug: site.slug,
        fromFolderId: site.folderId,
        toFolderId,
      }));
    const undo = assignments.map((item) => ({
      slug: item.slug,
      fromFolderId: item.toFolderId,
      toFolderId: item.fromFolderId,
    }));
    const destination = folderLabel(orderedFolders, toFolderId);
    void applyAssignments(
      assignments,
      assignments.length === 1
        ? `Site movido para ${destination}.`
        : `${assignments.length} sites movidos para ${destination}.`,
      undo,
    );
  };

  const createFolder = async (name: string) => {
    if (busy) return false;
    setBusy(true);
    const form = new FormData();
    form.set('name', name);
    const result = await createSiteFolderAction(form);
    if (result.ok && result.folder) {
      setFolders((current) => [...current, result.folder!]);
      setActive(result.folder.id);
      setSelected(new Set());
    }
    setToast({ message: result.message });
    setBusy(false);
    return result.ok;
  };

  const renameFolder = async (folder: SiteFolderSummary, name: string) => {
    if (busy) return false;
    setBusy(true);
    const form = new FormData();
    form.set('folderId', folder.id);
    form.set('name', name);
    const result = await renameSiteFolderAction(form);
    if (result.ok && result.folder)
      setFolders((current) =>
        current.map((item) =>
          item.id === result.folder!.id ? result.folder! : item,
        ),
      );
    setToast({ message: result.message });
    setBusy(false);
    return result.ok;
  };

  const deleteFolder = async (folder: SiteFolderSummary) => {
    const siteCount = counts.get(folder.id) ?? 0;
    if (
      busy ||
      !window.confirm(
        siteCount
          ? `Excluir a pasta ${folder.name}? Os ${siteCount} sites serão mantidos em Sem pasta.`
          : `Excluir a pasta ${folder.name}?`,
      )
    )
      return;
    setBusy(true);
    const form = new FormData();
    form.set('folderId', folder.id);
    const result = await deleteSiteFolderAction(form);
    if (result.ok) {
      setFolders((current) => current.filter((item) => item.id !== folder.id));
      setSites((current) =>
        current.map((site) =>
          site.folderId === folder.id ? { ...site, folderId: null } : site,
        ),
      );
      if (active === folder.id) setActive('unfiled');
    }
    setToast({ message: result.message });
    setBusy(false);
  };

  const drop = (folderId: string | null, event: DragEvent) => {
    event.preventDefault();
    let slugs = dragged;
    try {
      const transferred = JSON.parse(
        event.dataTransfer.getData('application/json'),
      );
      if (Array.isArray(transferred)) slugs = transferred;
    } catch {
      // O estado local ainda identifica o arraste quando o navegador omite dados.
    }
    setDropTarget(undefined);
    setDragged([]);
    moveSites(slugs, folderId);
  };

  const selectScope = (scope: Scope) => {
    setActive(scope);
    if (scope !== 'all') setFilter('todos');
    setSelected(new Set());
    setRenaming(false);
  };

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Sites</h1>
          <p className="admin-sites-stats">
            <b>{pad(sites.length)}</b> sites
            <span aria-hidden="true">·</span>
            <b data-tone="ok">{pad(published)}</b> no ar
            <span aria-hidden="true">·</span>
            <b data-tone="warn">{pad(drafts)}</b> em rascunho
          </p>
        </div>
        <div className="admin-page-actions">
          <span className="admin-current-user" title={session?.login}>
            {session?.operator}
          </span>
          <Link className="admin-secondary" href="/admin/atividade">
            Atividade
          </Link>
          <Link className="admin-secondary" href="/admin/kanban">
            Kanban
          </Link>
          <button
            className="admin-primary"
            type="button"
            onClick={() => setCreating((current) => !current)}
            aria-expanded={creating}
            aria-controls="new-client"
          >
            {creating ? (
              'Fechar cadastro'
            ) : (
              <>
                <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
                Novo site
              </>
            )}
          </button>
          {session?.logout}
        </div>
      </div>
      {creating ? (
        <section id="new-client" className="admin-new-client">
          <div className="admin-new-client-heading">
            <h2>Criar novo site</h2>
            {activeFolder ? <span>em {activeFolder.name}</span> : null}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              startTransition(() => formAction(data));
            }}
          >
            <fieldset disabled={pending}>
              <input
                type="hidden"
                name="folderId"
                value={activeFolder?.id ?? ''}
              />
              <TenantFields withSlug compact />
              <BrandFields />
              {error ? (
                <p role="alert" className="admin-form-error">
                  {error}
                </p>
              ) : null}
              <div className="admin-form-footer">
                <button
                  type="submit"
                  className="admin-primary"
                  disabled={pending}
                >
                  {pending ? 'Criando site…' : 'Criar site'}
                </button>
                <p>
                  O agente começa por um plano e salva cada etapa. Você confere
                  o rascunho antes de publicar.
                </p>
              </div>
            </fieldset>
          </form>
        </section>
      ) : null}
      <div className="admin-sites-library">
        <aside className="admin-sites-aside">
          <AttentionCard
            drafts={drafts}
            summary={summary}
            onDrafts={() => {
              setFilter('draft');
              setSelected(new Set());
            }}
          />
          <UsageCard usage={usage} />
        </aside>
        <section
          className="admin-sites-content"
          aria-labelledby="sites-scope-title"
        >
          <div className="admin-sites-scope-heading">
            <div>
              <div className="admin-sites-scope-title" id="sites-scope-title">
                {renaming && activeFolder ? (
                  <form
                    className="admin-folder-inline-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const name = formText(
                        new FormData(event.currentTarget),
                        'name',
                      );
                      if (await renameFolder(activeFolder, name))
                        setRenaming(false);
                    }}
                  >
                    <input
                      name="name"
                      defaultValue={activeFolder.name}
                      aria-label={`Novo nome de ${activeFolder.name}`}
                      maxLength={40}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setRenaming(false);
                      }}
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      aria-label="Salvar nome"
                    >
                      <Check size={15} strokeWidth={1.7} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Cancelar"
                      onClick={() => setRenaming(false)}
                    >
                      <X size={15} strokeWidth={1.7} aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <h2>{scopeTitle}</h2>
                )}
                {activeFolder && !renaming ? (
                  <ScopeMenu
                    folder={activeFolder}
                    busy={busy}
                    onRename={() => setRenaming(true)}
                    onDelete={() => void deleteFolder(activeFolder)}
                  />
                ) : null}
              </div>
              <p>
                {scopeSites.length === 1
                  ? '1 site'
                  : `${scopeSites.length} sites`}{' '}
                · {visible.length} nesta lista
              </p>
            </div>
            <label className="admin-search">
              <span className="admin-search-glyph" aria-hidden="true" />
              <input
                aria-label="Buscar sites"
                placeholder="Buscar por nome ou endereço"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <FolderFilters
            folders={orderedFolders}
            counts={counts}
            active={active}
            busy={busy}
            dropTarget={dropTarget}
            onSelect={selectScope}
            onCreate={createFolder}
            onDragOver={(folderId, event) => {
              if (!dragged.length || busy) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDropTarget(folderId);
            }}
            onDrop={drop}
          >
            <SegmentedControl
              label="Filtrar sites por estado"
              value={filter}
              onChange={setFilter}
              options={[
                ['todos', 'Todos'],
                ['published', 'Publicados'],
                ['draft', 'Rascunhos'],
                ['archived', 'Arquivados'],
              ]}
            />
          </FolderFilters>
          {selected.size ? (
            <section className="admin-bulk-bar" aria-label="Sites selecionados">
              <strong>
                {selected.size} selecionado{selected.size === 1 ? '' : 's'}
              </strong>
              <span>Mover para</span>
              <button
                type="button"
                className="admin-bulk-target"
                disabled={busy}
                onClick={() => moveSites([...selected], null)}
              >
                <Folder size={13} strokeWidth={1.7} aria-hidden="true" />
                Sem pasta
              </button>
              {orderedFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="admin-bulk-target"
                  disabled={busy}
                  onClick={() => moveSites([...selected], folder.id)}
                >
                  <Folder size={13} strokeWidth={1.7} aria-hidden="true" />
                  {folder.name}
                </button>
              ))}
              <button
                type="button"
                className="admin-bulk-clear"
                aria-label="Limpar seleção"
                onClick={() => setSelected(new Set())}
              >
                <X size={15} strokeWidth={1.7} aria-hidden="true" />
              </button>
            </section>
          ) : null}
          {visible.length ? (
            <section
              className="admin-client-table"
              aria-label="Sites cadastrados"
            >
              <div className="admin-client-columns" aria-hidden="true">
                <span />
                <span>Site</span>
                <span>Status</span>
                <span>Última ação</span>
                <span>Quando</span>
                <span />
              </div>
              <ul>
                {visible.map((tenant) => {
                  const status = statusPresentation(tenant.status);
                  const touched = new Date(lastTouch(tenant));
                  return (
                    <li
                      className="admin-client-row"
                      key={tenant.slug}
                      data-selected={selected.has(tenant.slug) || undefined}
                      data-dragging={dragged.includes(tenant.slug) || undefined}
                    >
                      <span className="admin-client-select">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${tenant.name}`}
                          checked={selected.has(tenant.slug)}
                          onChange={(event) => {
                            setSelected((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(tenant.slug);
                              else next.delete(tenant.slug);
                              return next;
                            });
                          }}
                        />
                        <button
                          type="button"
                          className="admin-client-drag"
                          draggable={!busy}
                          aria-label={`Arrastar ${tenant.name} para uma pasta`}
                          title="Arrastar para uma pasta"
                          onDragStart={(event) => {
                            const slugs = selected.has(tenant.slug)
                              ? [...selected]
                              : [tenant.slug];
                            setDragged(slugs);
                            if (!selected.has(tenant.slug))
                              setSelected(new Set([tenant.slug]));
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData(
                              'application/json',
                              JSON.stringify(slugs),
                            );
                            event.dataTransfer.setData(
                              'text/plain',
                              tenant.name,
                            );
                          }}
                          onDragEnd={() => {
                            setDragged([]);
                            setDropTarget(undefined);
                          }}
                        >
                          <GripVertical
                            size={15}
                            strokeWidth={1.7}
                            aria-hidden="true"
                          />
                        </button>
                      </span>
                      <Link
                        className="admin-client-name"
                        href={`/admin/${tenant.slug}`}
                      >
                        <span className="admin-avatar">
                          {tenant.name
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((word) => word[0])
                            .join('')}
                        </span>
                        <span>
                          <strong>{tenant.name}</strong>
                          <small>{tenant.slug}.eixu.com.br</small>
                        </span>
                      </Link>
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      <span
                        className="admin-client-action"
                        title={tenant.lastAction?.summary}
                      >
                        <span>
                          {tenant.lastAction
                            ? actionLabel(tenant.lastAction.action)
                            : '—'}
                        </span>
                        <small>
                          {tenant.lastAction
                            ? actorLabel(tenant.lastAction)
                            : 'Sem ação registrada'}
                        </small>
                      </span>
                      <time dateTime={touched.toISOString()}>
                        {day.format(touched)} {clock.format(touched)}
                      </time>
                      <span className="admin-client-row-actions">
                        <SiteActions
                          tenant={tenant}
                          folders={orderedFolders}
                          busy={busy}
                          onMove={(folderId) =>
                            moveSites([tenant.slug], folderId)
                          }
                        />
                        <Link
                          className="admin-client-open"
                          href={`/admin/${tenant.slug}`}
                          aria-label={`Abrir ${tenant.name}`}
                        >
                          <ChevronRight
                            size={16}
                            strokeWidth={1.7}
                            aria-hidden="true"
                          />
                        </Link>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <label className="admin-select-visible">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      for (const site of visible)
                        if (event.target.checked) next.add(site.slug);
                        else next.delete(site.slug);
                      return next;
                    });
                  }}
                />
                Selecionar os {visible.length} sites desta lista
              </label>
            </section>
          ) : (
            <EmptyState
              title={
                !sites.length
                  ? 'Nenhum site cadastrado'
                  : scopeSites.length === 0 && !query && filter === 'todos'
                    ? 'Esta pasta está vazia'
                    : 'Nenhum site encontrado'
              }
              action={
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() => {
                    if (
                      !sites.length ||
                      (scopeSites.length === 0 && !query && filter === 'todos')
                    )
                      setCreating(true);
                    else {
                      setQuery('');
                      setFilter('todos');
                      setActive('all');
                    }
                  }}
                >
                  {!sites.length ||
                  (scopeSites.length === 0 && !query && filter === 'todos')
                    ? 'Criar site aqui'
                    : 'Limpar filtros'}
                </button>
              }
            >
              {!sites.length
                ? 'Crie o primeiro site para começar a biblioteca da equipe.'
                : scopeSites.length === 0 && !query && filter === 'todos'
                  ? 'Arraste sites para cá ou crie um novo site já organizado nesta pasta.'
                  : 'Tente outro nome ou limpe os filtros para ver a lista novamente.'}
            </EmptyState>
          )}
          {toast ? (
            <output className="admin-sites-toast" aria-live="polite">
              <span>{toast.message}</span>
              {toast.undo?.length ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void applyAssignments(toast.undo!, 'Movimentação desfeita.')
                  }
                >
                  Desfazer
                </button>
              ) : null}
              <button
                type="button"
                className="admin-sites-toast-close"
                aria-label="Fechar aviso"
                onClick={() => setToast(null)}
              >
                <X size={14} strokeWidth={1.7} aria-hidden="true" />
              </button>
            </output>
          ) : null}
        </section>
      </div>
    </>
  );
}
