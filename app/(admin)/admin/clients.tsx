'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type SyntheticEvent,
} from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronRight,
  Folder,
  FolderOpen,
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
  MetricCard,
  SegmentedControl,
  StatusDot,
  StatusPill,
  type StatusTone,
} from '@/components/admin/primitives';
import type { FolderAssignment } from '@/lib/admin/site-folders';
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
  pageCount: number;
  leadCount: number;
  updatedAt: string;
};

export type SiteFolderSummary = {
  id: string;
  name: string;
  siteCount: number;
};

type Scope = string;
type Toast = { message: string; undo?: FolderAssignment[] };

const num = new Intl.NumberFormat('pt-BR');
const date = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});
const folderOrder = new Intl.Collator('pt-BR', { sensitivity: 'base' });
const CONTEXT_KEY = 'eixu:sites-list-context:v1';

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

function FolderSidebar({
  folders,
  counts,
  active,
  busy,
  dropTarget,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onDragOver,
  onDrop,
}: {
  folders: SiteFolderSummary[];
  counts: Map<string | null, number>;
  active: Scope;
  busy: boolean;
  dropTarget: string | null | undefined;
  onSelect: (scope: Scope) => void;
  onCreate: (name: string) => Promise<boolean>;
  onRename: (folder: SiteFolderSummary, name: string) => Promise<boolean>;
  onDelete: (folder: SiteFolderSummary) => void;
  onDragOver: (folderId: string | null, event: DragEvent) => void;
  onDrop: (folderId: string | null, event: DragEvent) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitCreate = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const name = formText(new FormData(event.currentTarget), 'name');
    if (await onCreate(name)) {
      setCreating(false);
      event.currentTarget.reset();
    } else setError('Confira o nome ou tente novamente.');
  };

  return (
    <aside className="admin-folder-sidebar" aria-label="Pastas dos sites">
      <div className="admin-folder-sidebar-heading">
        <span>Biblioteca</span>
        <button
          type="button"
          aria-label="Criar pasta"
          title="Criar pasta"
          onClick={() => {
            setCreating(true);
            setEditing(null);
            setError(null);
          }}
        >
          <Plus size={16} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
      <nav>
        <button
          type="button"
          className="admin-folder-link"
          data-folder-id="all"
          aria-current={active === 'all' ? 'page' : undefined}
          onClick={() => onSelect('all')}
        >
          <span className="admin-folder-icon">
            <FolderOpen size={16} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span>Todos os sites</span>
          <small>{counts.get('all') ?? 0}</small>
        </button>
        <button
          type="button"
          className="admin-folder-link"
          data-folder-id="unfiled"
          aria-current={active === 'unfiled' ? 'page' : undefined}
          data-drag-over={dropTarget === null ? true : undefined}
          onClick={() => onSelect('unfiled')}
          onDragEnter={(event) => onDragOver(null, event)}
          onDragOver={(event) => onDragOver(null, event)}
          onDrop={(event) => onDrop(null, event)}
        >
          <span className="admin-folder-icon">
            <Folder size={16} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span>Sem pasta</span>
          <small>{counts.get(null) ?? 0}</small>
        </button>
      </nav>
      <div className="admin-folder-section-label">Pastas da equipe</div>
      <nav className="admin-folder-list">
        {folders.map((folder) =>
          editing === folder.id ? (
            <form
              key={folder.id}
              className="admin-folder-inline-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const name = formText(
                  new FormData(event.currentTarget),
                  'name',
                );
                if (await onRename(folder, name)) setEditing(null);
              }}
            >
              <input
                name="name"
                defaultValue={folder.name}
                aria-label={`Novo nome de ${folder.name}`}
                maxLength={40}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setEditing(null);
                }}
              />
              <button type="submit" disabled={busy} aria-label="Salvar nome">
                <Check size={15} strokeWidth={1.7} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Cancelar"
                onClick={() => setEditing(null)}
              >
                <X size={15} strokeWidth={1.7} aria-hidden="true" />
              </button>
            </form>
          ) : (
            <div className="admin-folder-item" key={folder.id}>
              <button
                type="button"
                className="admin-folder-link"
                data-folder-id={folder.id}
                aria-current={active === folder.id ? 'page' : undefined}
                data-drag-over={dropTarget === folder.id || undefined}
                onClick={() => onSelect(folder.id)}
                onDragEnter={(event) => onDragOver(folder.id, event)}
                onDragOver={(event) => onDragOver(folder.id, event)}
                onDrop={(event) => onDrop(folder.id, event)}
              >
                <span className="admin-folder-icon">
                  {active === folder.id ? (
                    <FolderOpen
                      size={16}
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
                  ) : (
                    <Folder size={16} strokeWidth={1.7} aria-hidden="true" />
                  )}
                </span>
                <span>{folder.name}</span>
                <small>{counts.get(folder.id) ?? 0}</small>
              </button>
              <details className="admin-folder-menu">
                <summary aria-label={`Ações da pasta ${folder.name}`}>
                  <MoreHorizontal
                    size={15}
                    strokeWidth={1.7}
                    aria-hidden="true"
                  />
                </summary>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(folder.id);
                      setCreating(false);
                    }}
                  >
                    <Pencil size={14} strokeWidth={1.7} aria-hidden="true" />
                    Renomear
                  </button>
                  <button
                    type="button"
                    className="admin-folder-delete"
                    onClick={() => onDelete(folder)}
                  >
                    <Trash2 size={14} strokeWidth={1.7} aria-hidden="true" />
                    Excluir pasta
                  </button>
                </div>
              </details>
            </div>
          ),
        )}
      </nav>
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
      ) : null}
      {error ? <p className="admin-folder-error">{error}</p> : null}
      <p className="admin-folder-hint">
        Arraste sites para organizar o trabalho da equipe.
      </p>
    </aside>
  );
}

export function Clients({
  tenants,
  folders: initialFolders,
  summary,
}: {
  tenants: ClientSummary[];
  folders: SiteFolderSummary[];
  summary: { leads30d: number; running: number };
}) {
  const session = useAdminSession();
  const [sites, setSites] = useState(tenants);
  const [folders, setFolders] = useState(initialFolders);
  const [active, setActive] = useState<Scope>('all');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('published');
  const [creating, setCreating] = useState(false);
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
  };
  const newClient = (
    <button
      className="admin-primary"
      type="button"
      onClick={() => setCreating((current) => !current)}
      aria-expanded={creating}
      aria-controls="new-client"
    >
      {creating ? 'Fechar cadastro' : '+ Novo site'}
    </button>
  );

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Sites</h1>
          <p>
            Organize o trabalho da equipe e abra cada projeto do ponto em que
            parou.
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
          {newClient}
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
      <section
        className="admin-metrics admin-client-metrics"
        aria-label="Resumo da operação"
      >
        <MetricCard
          label="Sites no ar"
          value={String(published).padStart(2, '0')}
          qualifier={`de ${String(sites.length).padStart(2, '0')}`}
        />
        <MetricCard
          label="Leads · 30 dias"
          value={num.format(summary.leads30d)}
          note="Contatos recebidos por formulário"
        />
        <MetricCard
          label="Gerações em curso"
          value={String(summary.running).padStart(2, '0')}
          qualifier={
            summary.running ? (
              <>
                <StatusDot tone="accent" pulse /> em andamento
              </>
            ) : (
              'nenhuma agora'
            )
          }
        />
      </section>
      <div className="admin-sites-library">
        <FolderSidebar
          folders={orderedFolders}
          counts={counts}
          active={active}
          busy={busy}
          dropTarget={dropTarget}
          onSelect={selectScope}
          onCreate={createFolder}
          onRename={renameFolder}
          onDelete={(folder) => void deleteFolder(folder)}
          onDragOver={(folderId, event) => {
            if (!dragged.length || busy) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDropTarget(folderId);
          }}
          onDrop={drop}
        />
        <section
          className="admin-sites-content"
          aria-labelledby="sites-scope-title"
        >
          <div className="admin-sites-scope-heading">
            <div>
              <h2 id="sites-scope-title">{scopeTitle}</h2>
              <p>
                {scopeSites.length === 1
                  ? '1 site'
                  : `${scopeSites.length} sites`}
              </p>
            </div>
            <label className="admin-folder-mobile-select">
              <span>Pasta</span>
              <select
                value={active}
                onChange={(event) => selectScope(event.target.value)}
              >
                <option value="all">Todos os sites</option>
                <option value="unfiled">Sem pasta</option>
                {orderedFolders.map((folder) => (
                  <option value={folder.id} key={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-client-toolbar">
            <label className="admin-search">
              <span className="admin-search-glyph" aria-hidden="true" />
              <input
                aria-label="Buscar clientes"
                placeholder="Buscar por nome ou endereço"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <SegmentedControl
              label="Filtrar clientes"
              value={filter}
              onChange={setFilter}
              options={[
                ['todos', 'Todos'],
                ['published', 'Publicados'],
                ['draft', 'Rascunhos'],
                ['archived', 'Arquivados'],
              ]}
            />
          </div>
          {selected.size ? (
            <section className="admin-bulk-bar" aria-label="Sites selecionados">
              <span>
                {selected.size} selecionado{selected.size === 1 ? '' : 's'}
              </span>
              <details>
                <summary className="admin-secondary">Mover para</summary>
                <div>
                  <FolderDestinations
                    folders={orderedFolders}
                    currentFolderId={undefined}
                    disabled={busy}
                    onMove={(folderId) => moveSites([...selected], folderId)}
                  />
                </div>
              </details>
              <button
                type="button"
                className="admin-icon-button"
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
                <span>Páginas</span>
                <span>Leads</span>
                <span>Atualizado</span>
                <span />
                <span />
              </div>
              <ul>
                {visible.map((tenant) => {
                  const status = statusPresentation(tenant.status);
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
                          {active === 'all' ? (
                            <em>
                              {folderLabel(orderedFolders, tenant.folderId)}
                            </em>
                          ) : null}
                        </span>
                      </Link>
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      <span
                        className="admin-numeric"
                        aria-label={`${tenant.pageCount} páginas`}
                      >
                        {String(tenant.pageCount).padStart(2, '0')}
                      </span>
                      <span
                        className="admin-numeric"
                        aria-label={`${tenant.leadCount} leads`}
                      >
                        {tenant.leadCount ? num.format(tenant.leadCount) : '—'}
                      </span>
                      <time dateTime={tenant.updatedAt}>
                        {date.format(new Date(tenant.updatedAt))}
                      </time>
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
        </section>
      </div>
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
            aria-label="Fechar aviso"
            onClick={() => setToast(null)}
          >
            <X size={14} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </output>
      ) : null}
    </>
  );
}
