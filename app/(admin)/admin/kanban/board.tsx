'use client';

import Link from 'next/link';
import {
  formatCardNumber,
  parseCardNumber,
} from '@/lib/kanban/card-reference.mjs';
import { DragDropProvider, useDroppable } from '@dnd-kit/react';
import { Accessibility } from '@dnd-kit/dom';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/dom';
import { useSortable } from '@dnd-kit/react/sortable';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from 'react';
import { AdminHttpError, adminFetch } from '@/lib/admin/http';
import { MAX_CARD_DESCRIPTION } from '@/lib/kanban/constraints';
import type {
  KanbanCardDetail,
  KanbanCardSummary,
  KanbanColumn,
  KanbanCommand,
  KanbanPriority,
  KanbanSnapshot,
} from '@/lib/kanban/schema';
import styles from './kanban.module.css';

type Mutation = {
  [K in KanbanCommand['type']]: Omit<
    Extract<KanbanCommand, { type: K }>,
    'expectedRevision'
  >;
}[KanbanCommand['type']];

type CommandResponse = KanbanSnapshot & { card?: KanbanCardDetail };

const numbers = new Intl.NumberFormat('pt-BR');
const STALE_EDITOR_MESSAGE =
  'Este cartão mudou em outra aba. Copie seu texto antes de fechar e abra o cartão novamente para editar a versão atual.';
const priorityLabels: Record<KanbanPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};
const dueDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});

function formatDueDate(value: string) {
  return dueDate.format(new Date(`${value}T12:00:00Z`));
}

function matchesFilters(
  card: KanbanCardSummary,
  query: string,
  tenantId: string,
  priority: string,
) {
  const number = parseCardNumber(query);
  const searchable =
    `${card.title} ${card.tenantName ?? ''} ${card.tenantSlug ?? ''}`.toLocaleLowerCase(
      'pt-BR',
    );
  return (
    (number === null ? searchable.includes(query) : card.number === number) &&
    (!tenantId || card.tenantId === tenantId) &&
    (!priority || card.priority === priority)
  );
}

function sortCards(cards: KanbanCardSummary[], columnId: string) {
  return cards
    .filter((card) => card.columnId === columnId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

function nextColumnOrder(
  columns: KanbanColumn[],
  sourceId: string,
  targetId: string,
) {
  const sourceIndex = columns.findIndex((column) => column.id === sourceId);
  const targetIndex = columns.findIndex((column) => column.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return null;
  const ids = columns
    .map((column) => column.id)
    .filter((id) => id !== sourceId);
  const index = ids.indexOf(targetId);
  ids.splice(index + (sourceIndex < targetIndex ? 1 : 0), 0, sourceId);
  return ids;
}

function detailChanged(a: KanbanCardDetail, b: KanbanCardDetail) {
  return (
    a.title !== b.title ||
    a.description !== b.description ||
    a.columnId !== b.columnId ||
    a.tenantId !== b.tenantId ||
    a.priority !== b.priority ||
    a.dueDate !== b.dueDate ||
    a.version !== b.version ||
    a.archivedAt !== b.archivedAt
  );
}

function focusCard(id: string) {
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>(`[data-card-id="${id}"] button`)
      ?.focus();
  });
}

export function KanbanBoard({ initial }: { initial: KanbanSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const snapshotRef = useRef(initial);
  const busyRef = useRef(false);
  const dragRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failedMutation, setFailedMutation] = useState<Mutation | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [query, setQuery] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState(
    initial.columns[0]?.id ?? '',
  );
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const columnCreateIdRef = useRef<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KanbanCardDetail | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorTenantId, setEditorTenantId] = useState('');
  const [editorPriority, setEditorPriority] = useState('');
  const [editorDueDate, setEditorDueDate] = useState('');
  const [editorError, setEditorError] = useState('');
  const [editorStale, setEditorStale] = useState(false);
  const [detailRequestVersion, setDetailRequestVersion] = useState(0);
  const editorDirtyRef = useRef(false);
  const editorInputVersionRef = useRef(0);
  const editorSaveRef = useRef<{
    cardId: string;
    title: string;
    description: string;
    tenantId: string | null;
    priority: KanbanPriority | null;
    dueDate: string | null;
    columnId: string;
  } | null>(null);
  const editorStaleRef = useRef(false);
  const serverDetailRef = useRef<KanbanCardDetail | null>(null);
  const panelRef = useRef<HTMLDialogElement | null>(null);
  const archiveToggleRef = useRef<HTMLButtonElement | null>(null);

  const applySnapshot = useCallback((next: KanbanSnapshot) => {
    if (next.revision < snapshotRef.current.revision) return;
    snapshotRef.current = next;
    setSnapshot(next);
    setSelectedColumnId((previous) =>
      next.columns.some((column) => column.id === previous)
        ? previous
        : (next.columns[0]?.id ?? ''),
    );
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if ((!force && busyRef.current) || dragRef.current) return null;
      try {
        const next = await adminFetch<KanbanSnapshot>('/api/admin/kanban');
        applySnapshot(next);
        setSessionExpired(false);
        if (!busyRef.current) setFailure('');
        return next;
      } catch (error) {
        if (error instanceof AdminHttpError && error.status === 401)
          setSessionExpired(true);
        setFailure(
          error instanceof Error
            ? error.message
            : 'Não foi possível atualizar o quadro.',
        );
        return null;
      }
    },
    [applySnapshot],
  );

  useEffect(() => {
    const onReturn = () => {
      if (!document.hidden && !busyRef.current && !dragRef.current)
        void refresh();
    };
    window.addEventListener('focus', onReturn);
    window.addEventListener('online', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('online', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [refresh]);

  const commit = async (
    mutation: Mutation,
    success: string,
    onApplied?: (result: CommandResponse) => void,
  ): Promise<CommandResponse | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    setFailure('');
    setFieldErrors({});
    setFailedMutation(null);
    setNotice('');
    const expectedRevision = snapshotRef.current.revision;
    let result: CommandResponse | null = null;
    let unknownOutcome = false;
    try {
      result = await adminFetch<CommandResponse>('/api/admin/kanban/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...mutation, expectedRevision }),
      });
      onApplied?.(result);
      applySnapshot(result);
      setNotice(success);
    } catch (error) {
      if (error instanceof AdminHttpError) {
        if (error.status === 401) setSessionExpired(true);
        setFailure(error.message);
        if (error.fields) {
          setFieldErrors(error.fields);
          setFailedMutation(mutation);
          requestAnimationFrame(() => {
            const field = Object.keys(error.fields ?? {})[0];
            const selector =
              mutation.type === 'create_column'
                ? '#new-column-title'
                : mutation.type === 'rename_column'
                  ? `#rename-${mutation.columnId}`
                  : mutation.type === 'create_card'
                    ? `#new-card-${mutation.columnId}`
                    : mutation.type === 'update_card'
                      ? field === 'description'
                        ? '#card-description'
                        : field === 'tenantId'
                          ? '#card-tenant'
                          : field === 'priority'
                            ? '#card-priority'
                            : field === 'dueDate'
                              ? '#card-due-date'
                              : '#card-title'
                      : null;
            if (selector)
              document.querySelector<HTMLElement>(selector)?.focus();
          });
        }
        unknownOutcome = error.code === 'ID_ALREADY_EXISTS';
      } else {
        // Uma resposta perdida pode ter chegado ao banco: reler antes de repetir.
        unknownOutcome = true;
        setFailure(
          'Não foi possível confirmar o salvamento. Confira o quadro antes de tentar novamente.',
        );
      }
    } finally {
      const fresh = await refresh(true);
      if (
        unknownOutcome &&
        fresh &&
        ((mutation.type === 'create_column' &&
          fresh.columns.some((column) => column.id === mutation.id)) ||
          (mutation.type === 'create_card' &&
            fresh.cards.some((card) => card.id === mutation.id)))
      ) {
        result = fresh;
        setFailure('');
        setNotice(`${success} Confirmado após atualizar o quadro.`);
      }
      busyRef.current = false;
      setBusy(false);
    }
    return result;
  };

  function openCard(id: string) {
    if (busyRef.current) return;
    if (editorDirtyRef.current && selectedCardId !== id) {
      if (!window.confirm('Descartar as alterações deste cartão?')) return;
    }
    setSelectedCardId(id);
    setDetail(null);
    setEditorError('');
    setEditorStale(false);
    editorStaleRef.current = false;
    serverDetailRef.current = null;
    editorDirtyRef.current = false;
    editorSaveRef.current = null;
  }

  const closeEditor = useCallback(() => {
    if (busyRef.current) return;
    if (
      editorDirtyRef.current &&
      !window.confirm('Descartar as alterações deste cartão?')
    )
      return;
    const id = selectedCardId;
    setSelectedCardId(null);
    setDetail(null);
    setEditorError('');
    setEditorStale(false);
    editorStaleRef.current = false;
    serverDetailRef.current = null;
    editorDirtyRef.current = false;
    editorSaveRef.current = null;
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          `[data-card-id="${id}"] .${styles.cardOpen}, [data-card-id="${id}"] .${styles.archivedCard}`,
        )
        ?.focus();
    });
  }, [selectedCardId]);

  useEffect(() => {
    if (!selectedCardId) return;
    let current = true;
    const cardId = selectedCardId;
    void adminFetch<{ card: KanbanCardDetail; revision: number }>(
      `/api/admin/kanban/cards/${cardId}`,
    )
      .then(({ card, revision }) => {
        if (!current) return;
        if (revision < snapshotRef.current.revision) return;
        setEditorError('');
        const saving = editorSaveRef.current;
        const matchesOwnSave =
          saving?.cardId === card.id &&
          saving.title === card.title &&
          saving.description === card.description &&
          saving.tenantId === card.tenantId &&
          saving.priority === card.priority &&
          saving.dueDate === card.dueDate &&
          saving.columnId === card.columnId;
        if (
          (!matchesOwnSave && editorStaleRef.current) ||
          (editorDirtyRef.current &&
            serverDetailRef.current &&
            !matchesOwnSave &&
            detailChanged(serverDetailRef.current, card))
        ) {
          editorStaleRef.current = true;
          setEditorStale(true);
          setEditorError(STALE_EDITOR_MESSAGE);
        } else if (!editorDirtyRef.current) {
          setEditorStale(false);
          setDetail(card);
          setEditorTitle(card.title);
          setEditorDescription(card.description);
          setEditorTenantId(card.tenantId ?? '');
          setEditorPriority(card.priority ?? '');
          setEditorDueDate(card.dueDate ?? '');
        }
        serverDetailRef.current = card;
        if (revision > snapshotRef.current.revision) void refresh();
      })
      .catch((error) => {
        if (!current) return;
        setEditorError(
          error instanceof Error
            ? error.message
            : 'Não foi possível abrir o cartão.',
        );
        if (error instanceof AdminHttpError && error.status === 401)
          setSessionExpired(true);
      });
    return () => {
      current = false;
    };
  }, [selectedCardId, snapshot.revision, detailRequestVersion, refresh]);

  useEffect(() => {
    if (!selectedCardId) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('button, input, textarea')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeEditor();
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedCardId, closeEditor]);

  async function addColumn(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newColumnTitle.trim();
    if (!title) return;
    const id = columnCreateIdRef.current ?? crypto.randomUUID();
    columnCreateIdRef.current = id;
    const result = await commit(
      { type: 'create_column', id, title },
      'Coluna criada.',
    );
    if (result) {
      columnCreateIdRef.current = null;
      setNewColumnTitle('');
      setAddingColumn(false);
    }
  }

  async function saveEditor(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || busyRef.current) return;
    if (editorStale || editorError) {
      setEditorError(
        'Confira a versão atual deste cartão antes de salvar. Seu texto continua nesta aba.',
      );
      return;
    }
    const title = editorTitle.trim();
    if (!title) {
      setFailure('Informe um título para o cartão.');
      return;
    }
    const submittedDescription = editorDescription;
    const submittedTenantId = editorTenantId || null;
    const submittedPriority = (editorPriority || null) as KanbanPriority | null;
    const submittedDueDate = editorDueDate || null;
    const submittedInputVersion = editorInputVersionRef.current;
    editorSaveRef.current = {
      cardId: detail.id,
      title,
      description: submittedDescription,
      tenantId: submittedTenantId,
      priority: submittedPriority,
      dueDate: submittedDueDate,
      columnId: detail.columnId,
    };
    let result: CommandResponse | null;
    try {
      result = await commit(
        {
          type: 'update_card',
          cardId: detail.id,
          title,
          description: submittedDescription,
          tenantId: submittedTenantId,
          priority: submittedPriority,
          dueDate: submittedDueDate,
          expectedCardVersion: detail.version,
        },
        'Cartão salvo.',
        (applied) => {
          if (applied.card) {
            serverDetailRef.current = applied.card;
          }
        },
      );
    } finally {
      editorSaveRef.current = null;
    }
    if (result) {
      setDetail(
        result.card ?? {
          ...detail,
          title,
          description: submittedDescription,
          tenantId: submittedTenantId,
          priority: submittedPriority,
          dueDate: submittedDueDate,
        },
      );
      serverDetailRef.current = result.card ?? {
        ...detail,
        title,
        description: submittedDescription,
        tenantId: submittedTenantId,
        priority: submittedPriority,
        dueDate: submittedDueDate,
      };
      const editedWhileSaving =
        editorInputVersionRef.current !== submittedInputVersion;
      editorDirtyRef.current = editedWhileSaving;
      if (editedWhileSaving)
        setNotice(
          'Cartão salvo. O texto digitado durante o salvamento ainda precisa ser salvo.',
        );
      editorStaleRef.current = false;
    }
  }

  async function deleteEditor() {
    if (
      !detail ||
      editorStale ||
      editorError ||
      !window.confirm(`Excluir definitivamente “${detail.title}”?`)
    )
      return;
    const result = await commit(
      { type: 'delete_card', cardId: detail.id },
      'Cartão excluído.',
    );
    if (result) {
      editorDirtyRef.current = false;
      setSelectedCardId(null);
      setDetail(null);
      serverDetailRef.current = null;
      editorStaleRef.current = false;
      requestAnimationFrame(() => archiveToggleRef.current?.focus());
    }
  }

  async function archiveEditor() {
    if (!detail || detail.archivedAt || editorStale || editorError) return;
    if (
      editorDirtyRef.current &&
      !window.confirm('Arquivar e descartar as alterações ainda não salvas?')
    )
      return;
    const result = await commit(
      { type: 'archive_card', cardId: detail.id },
      'Cartão arquivado.',
    );
    if (!result) return;
    editorDirtyRef.current = false;
    setSelectedCardId(null);
    setDetail(null);
    serverDetailRef.current = null;
    editorStaleRef.current = false;
    setShowArchived(true);
    requestAnimationFrame(() => archiveToggleRef.current?.focus());
  }

  async function restoreEditor() {
    if (!detail || !detail.archivedAt || editorStale || editorError) return;
    if (
      editorDirtyRef.current &&
      !window.confirm('Restaurar e descartar as alterações ainda não salvas?')
    )
      return;
    const cardId = detail.id;
    const result = await commit(
      { type: 'restore_card', cardId },
      'Cartão restaurado.',
    );
    if (!result) return;
    editorDirtyRef.current = false;
    setSelectedCardId(null);
    setDetail(null);
    serverDetailRef.current = null;
    editorStaleRef.current = false;
    focusCard(cardId);
  }

  async function onDrop(
    event: Parameters<
      NonNullable<React.ComponentProps<typeof DragDropProvider>['onDragEnd']>
    >[0],
  ) {
    dragRef.current = false;
    setDragging(false);
    if (event.canceled) return;
    const { source, target } = event.operation;
    if (!source || !target) return;
    const sourceId = String(source.id);
    const targetId = String(target.id);
    if (sourceId === targetId) return;
    if (source.type === 'column' && target.type === 'column') {
      const order = nextColumnOrder(
        snapshotRef.current.columns,
        sourceId,
        targetId,
      );
      if (order)
        await commit(
          { type: 'reorder_columns', orderedColumnIds: order },
          'Colunas reordenadas.',
        );
      return;
    }
    if (source.type !== 'card') return;
    if (target.type === 'card') {
      const targetCard = snapshotRef.current.cards.find(
        (card) => card.id === targetId,
      );
      if (!targetCard) return;
      const sourceCard = snapshotRef.current.cards.find(
        (card) => card.id === sourceId,
      );
      const targetCards = sortCards(
        snapshotRef.current.cards,
        targetCard.columnId,
      ).filter((card) => card.id !== sourceId);
      const targetIndex = targetCards.findIndex(
        (card) => card.id === targetCard.id,
      );
      const sourceBeforeTarget =
        sourceCard?.columnId === targetCard.columnId &&
        sourceCard.position < targetCard.position;
      const beforeCardId = sourceBeforeTarget
        ? (targetCards[targetIndex + 1]?.id ?? null)
        : targetCard.id;
      const moved = await commit(
        {
          type: 'move_card',
          cardId: sourceId,
          targetColumnId: targetCard.columnId,
          beforeCardId,
        },
        'Cartão movido.',
      );
      if (moved) focusCard(sourceId);
    } else if (target.type === 'column-end') {
      const columnId = targetId.slice('end:'.length);
      if (!snapshotRef.current.columns.some((column) => column.id === columnId))
        return;
      const moved = await commit(
        {
          type: 'move_card',
          cardId: sourceId,
          targetColumnId: columnId,
          beforeCardId: null,
        },
        'Cartão movido.',
      );
      if (moved) focusCard(sourceId);
    }
  }

  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const filtersActive = Boolean(
    normalizedQuery || tenantFilter || priorityFilter,
  );
  const visibleCards = snapshot.cards.filter((card) =>
    matchesFilters(card, normalizedQuery, tenantFilter, priorityFilter),
  );
  const visibleArchivedCards = snapshot.archivedCards.filter((card) =>
    matchesFilters(card, normalizedQuery, tenantFilter, priorityFilter),
  );
  const cardCount = snapshot.cards.length;
  const archivedCardCount = snapshot.archivedCards.length;
  const totalCardCount = cardCount + archivedCardCount;
  const canCreateCard = totalCardCount < 500;
  const editorTenant = snapshot.tenants.find(
    (tenant) => tenant.id === editorTenantId,
  );
  const dragLabel = (id: string | number) => {
    const value = String(id);
    const card = snapshotRef.current.cards.find((item) => item.id === value);
    if (card) return `cartão ${card.title}`;
    const column = snapshotRef.current.columns.find(
      (item) => item.id === value,
    );
    if (column) return `coluna ${column.title}`;
    if (value.startsWith('end:')) {
      const endColumn = snapshotRef.current.columns.find(
        (item) => item.id === value.slice(4),
      );
      if (endColumn) return `fim de ${endColumn.title}`;
    }
    return 'item';
  };
  return (
    <DragDropProvider
      plugins={(defaults) =>
        defaults.map((plugin) =>
          plugin === Accessibility
            ? Accessibility.configure({
                screenReaderInstructions: {
                  draggable:
                    'Pressione espaço para iniciar o arrasto, use as setas para escolher o destino, pressione espaço para soltar ou Escape para cancelar.',
                },
                announcements: {
                  dragstart: (event: DragStartEvent) =>
                    `Selecionado ${dragLabel(event.operation.source?.id ?? '')}.`,
                  dragover: (event: DragOverEvent) =>
                    event.operation.target
                      ? `Destino: ${dragLabel(event.operation.target.id)}.`
                      : undefined,
                  dragend: (event: DragEndEvent) =>
                    event.canceled
                      ? 'Movimento cancelado.'
                      : event.operation.target
                        ? `${dragLabel(event.operation.source?.id ?? '')} solto em ${dragLabel(event.operation.target.id)}.`
                        : 'Movimento encerrado sem destino.',
                },
              })
            : plugin,
        )
      }
      onDragStart={() => {
        dragRef.current = true;
        setDragging(true);
      }}
      onDragEnd={(event) => void onDrop(event)}
    >
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <Link
            href="/admin"
            className={styles.back}
            aria-label="Voltar aos clientes"
          >
            ←
          </Link>
          <div>
            <h1>Kanban</h1>
            <p>
              {numbers.format(cardCount)} ativos
              {archivedCardCount
                ? ` · ${numbers.format(archivedCardCount)} arquivados`
                : ''}{' '}
              · quadro da operação
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className="admin-secondary"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Atualizar
          </button>
          <button
            className="admin-primary"
            disabled={busy || snapshot.columns.length >= 8}
            onClick={() => setAddingColumn((previous) => !previous)}
            aria-expanded={addingColumn}
          >
            + Coluna
          </button>
        </div>
      </header>

      {sessionExpired ? (
        <p className={styles.alert} role="alert">
          Sua sessão expirou. O texto não salvo continua nesta aba.{' '}
          <Link
            href="/admin/login?returnTo=/admin/kanban"
            target="_blank"
            rel="noreferrer"
          >
            Entrar em outra aba
          </Link>
        </p>
      ) : null}
      {failure ? (
        <p className={styles.alert} role="alert">
          {failure}
        </p>
      ) : null}
      <output className={styles.status} aria-live="polite">
        {busy ? 'Salvando…' : notice}
      </output>

      {addingColumn ? (
        <form
          className={styles.newColumn}
          onSubmit={(event) => void addColumn(event)}
        >
          <label htmlFor="new-column-title">Nome da coluna</label>
          <input
            id="new-column-title"
            className="admin-input"
            aria-describedby={
              failedMutation?.type === 'create_column' && fieldErrors.title
                ? 'new-column-error'
                : undefined
            }
            maxLength={40}
            value={newColumnTitle}
            onChange={(event) => setNewColumnTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setAddingColumn(false);
            }}
          />
          {failedMutation?.type === 'create_column' && fieldErrors.title ? (
            <p id="new-column-error" className={styles.fieldError}>
              {fieldErrors.title}
            </p>
          ) : null}
          <button
            className="admin-primary"
            disabled={busy || !newColumnTitle.trim()}
          >
            Criar coluna
          </button>
        </form>
      ) : null}

      <section className={styles.filters} aria-label="Filtros do Kanban">
        <label className={styles.searchField}>
          <span>Buscar</span>
          <input
            type="search"
            className="admin-input"
            placeholder="Número, título ou cliente"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className={styles.filterField}>
          <span>Cliente</span>
          <select
            className="admin-input"
            value={tenantFilter}
            onChange={(event) => setTenantFilter(event.target.value)}
          >
            <option value="">Todos</option>
            {snapshot.tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          <span>Prioridade</span>
          <select
            className="admin-input"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="">Todas</option>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.filterActions}>
          <button
            ref={archiveToggleRef}
            type="button"
            className={styles.archiveToggle}
            aria-pressed={showArchived}
            onClick={() => setShowArchived((visible) => !visible)}
          >
            Arquivados ({numbers.format(archivedCardCount)})
          </button>
          {filtersActive ? (
            <button
              type="button"
              className={styles.clearFilters}
              onClick={() => {
                setQuery('');
                setTenantFilter('');
                setPriorityFilter('');
              }}
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      </section>

      <label className={styles.mobilePicker}>
        <span>Etapa</span>
        <select
          value={selectedColumnId}
          onChange={(event) => setSelectedColumnId(event.target.value)}
        >
          {snapshot.columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.title} ({sortCards(visibleCards, column.id).length})
            </option>
          ))}
        </select>
      </label>

      <div className={styles.columns} aria-label="Colunas do Kanban">
        {snapshot.columns.map((column, index) => (
          <BoardColumn
            key={column.id}
            column={column}
            index={index}
            cards={sortCards(visibleCards, column.id)}
            allCards={sortCards(snapshot.cards, column.id)}
            columns={snapshot.columns}
            active={column.id === selectedColumnId}
            busy={busy}
            dragging={dragging}
            canCreateCard={canCreateCard}
            filtersActive={filtersActive}
            fieldErrors={fieldErrors}
            failedMutation={failedMutation}
            onCommit={commit}
            onOpenCard={openCard}
          />
        ))}
      </div>

      {showArchived ? (
        <section className={styles.archived} aria-labelledby="archived-title">
          <div className={styles.archivedHead}>
            <div>
              <h2 id="archived-title">Arquivados</h2>
              <p>
                Saem do quadro, mas podem ser consultados, editados e
                restaurados.
              </p>
            </div>
            <span className={styles.count}>
              {filtersActive
                ? `${visibleArchivedCards.length} de ${archivedCardCount}`
                : archivedCardCount}
            </span>
          </div>
          {visibleArchivedCards.length ? (
            <ol className={styles.archivedList}>
              {visibleArchivedCards.map((card) => (
                <li key={card.id} data-card-id={card.id}>
                  <button
                    type="button"
                    className={styles.archivedCard}
                    onClick={() => openCard(card.id)}
                  >
                    <small>#{formatCardNumber(card.number)}</small>
                    <span className={styles.cardTitle}>{card.title}</span>
                    <CardMeta card={card} />
                    <small>
                      {snapshot.columns.find(
                        (column) => column.id === card.columnId,
                      )?.title ?? 'Etapa removida'}
                    </small>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.archivedEmpty}>
              {filtersActive
                ? 'Nenhum cartão arquivado corresponde aos filtros.'
                : 'Ainda não há cartões arquivados.'}
            </p>
          )}
        </section>
      ) : null}

      {selectedCardId ? (
        <>
          <div
            className={styles.backdrop}
            aria-hidden="true"
            onClick={closeEditor}
          />
          <dialog
            open
            ref={panelRef}
            className={styles.editor}
            aria-modal="true"
            aria-label="Editar cartão"
          >
            <div className={styles.editorHead}>
              <strong>
                Cartão{detail ? ` #${formatCardNumber(detail.number)}` : ''}
              </strong>
              <button
                className={styles.iconButton}
                onClick={closeEditor}
                aria-label="Fechar cartão"
                disabled={busy}
              >
                ×
              </button>
            </div>
            {editorError ? (
              <div className={styles.editorAlert} role="alert">
                <p>{editorError}</p>
                {!editorStale ? (
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() =>
                      setDetailRequestVersion((version) => version + 1)
                    }
                  >
                    Tentar atualizar
                  </button>
                ) : null}
              </div>
            ) : null}
            {detail ? (
              <form
                onSubmit={(event) => void saveEditor(event)}
                className={styles.editorForm}
              >
                {detail.archivedAt ? (
                  <p className={styles.archivedNotice}>
                    Este cartão está arquivado. Você pode editá-lo ou
                    restaurá-lo para a etapa atual.
                  </p>
                ) : null}
                <label htmlFor="card-title">Título</label>
                <input
                  id="card-title"
                  className="admin-input"
                  aria-describedby={
                    failedMutation?.type === 'update_card' && fieldErrors.title
                      ? 'card-title-error'
                      : undefined
                  }
                  maxLength={160}
                  value={editorTitle}
                  onChange={(event) => {
                    setEditorTitle(event.target.value);
                    editorDirtyRef.current = true;
                    editorInputVersionRef.current += 1;
                  }}
                />
                {failedMutation?.type === 'update_card' && fieldErrors.title ? (
                  <p id="card-title-error" className={styles.fieldError}>
                    {fieldErrors.title}
                  </p>
                ) : null}
                <label htmlFor="card-description">Descrição</label>
                <textarea
                  id="card-description"
                  className="admin-input"
                  aria-describedby={
                    failedMutation?.type === 'update_card' &&
                    fieldErrors.description
                      ? 'card-description-error'
                      : undefined
                  }
                  maxLength={MAX_CARD_DESCRIPTION}
                  rows={10}
                  value={editorDescription}
                  onChange={(event) => {
                    setEditorDescription(event.target.value);
                    editorDirtyRef.current = true;
                    editorInputVersionRef.current += 1;
                  }}
                />
                {failedMutation?.type === 'update_card' &&
                fieldErrors.description ? (
                  <p id="card-description-error" className={styles.fieldError}>
                    {fieldErrors.description}
                  </p>
                ) : null}
                <div className={styles.editorGrid}>
                  <label htmlFor="card-tenant">
                    <span>Cliente</span>
                    <select
                      id="card-tenant"
                      className="admin-input"
                      aria-describedby={
                        failedMutation?.type === 'update_card' &&
                        fieldErrors.tenantId
                          ? 'card-tenant-error'
                          : undefined
                      }
                      value={editorTenantId}
                      onChange={(event) => {
                        setEditorTenantId(event.target.value);
                        editorDirtyRef.current = true;
                        editorInputVersionRef.current += 1;
                      }}
                    >
                      <option value="">Sem cliente</option>
                      {snapshot.tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                          {tenant.status === 'archived' ? ' (arquivado)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor="card-priority">
                    <span>Prioridade</span>
                    <select
                      id="card-priority"
                      className="admin-input"
                      aria-describedby={
                        failedMutation?.type === 'update_card' &&
                        fieldErrors.priority
                          ? 'card-priority-error'
                          : undefined
                      }
                      value={editorPriority}
                      onChange={(event) => {
                        setEditorPriority(event.target.value);
                        editorDirtyRef.current = true;
                        editorInputVersionRef.current += 1;
                      }}
                    >
                      <option value="">Sem prioridade</option>
                      {Object.entries(priorityLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor="card-due-date">
                    <span>Prazo</span>
                    <input
                      id="card-due-date"
                      type="date"
                      className="admin-input"
                      aria-describedby={
                        failedMutation?.type === 'update_card' &&
                        fieldErrors.dueDate
                          ? 'card-due-date-error'
                          : undefined
                      }
                      value={editorDueDate}
                      onChange={(event) => {
                        setEditorDueDate(event.target.value);
                        editorDirtyRef.current = true;
                        editorInputVersionRef.current += 1;
                      }}
                    />
                  </label>
                </div>
                {failedMutation?.type === 'update_card' &&
                fieldErrors.tenantId ? (
                  <p id="card-tenant-error" className={styles.fieldError}>
                    {fieldErrors.tenantId}
                  </p>
                ) : null}
                {failedMutation?.type === 'update_card' &&
                fieldErrors.priority ? (
                  <p id="card-priority-error" className={styles.fieldError}>
                    {fieldErrors.priority}
                  </p>
                ) : null}
                {failedMutation?.type === 'update_card' &&
                fieldErrors.dueDate ? (
                  <p id="card-due-date-error" className={styles.fieldError}>
                    {fieldErrors.dueDate}
                  </p>
                ) : null}
                {editorTenant ? (
                  <Link
                    href={`/admin/${editorTenant.slug}`}
                    className={styles.editorTenantLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir {editorTenant.name} em outra aba ↗
                  </Link>
                ) : null}
                <p className={styles.editorMeta}>
                  {snapshot.columns.find(
                    (column) => column.id === detail.columnId,
                  )?.title ?? 'Etapa alterada em outra aba'}
                </p>
                <div className={styles.editorActions}>
                  <button
                    className="admin-primary"
                    disabled={
                      busy ||
                      !editorTitle.trim() ||
                      editorStale ||
                      Boolean(editorError)
                    }
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={closeEditor}
                    disabled={busy}
                  >
                    Fechar
                  </button>
                </div>
                <button
                  type="button"
                  className={styles.archiveButton}
                  disabled={busy || editorStale || Boolean(editorError)}
                  onClick={() =>
                    void (detail.archivedAt ? restoreEditor() : archiveEditor())
                  }
                >
                  {detail.archivedAt ? 'Restaurar cartão' : 'Arquivar cartão'}
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  disabled={busy || editorStale || Boolean(editorError)}
                  onClick={() => void deleteEditor()}
                >
                  Excluir definitivamente
                </button>
              </form>
            ) : (
              <p className={styles.editorLoading}>
                {editorError
                  ? 'Não foi possível carregar o cartão.'
                  : 'Carregando cartão…'}
              </p>
            )}
          </dialog>
        </>
      ) : null}
    </DragDropProvider>
  );
}

function ColumnEnd({
  columnId,
  disabled,
}: {
  columnId: string;
  disabled: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `end:${columnId}`,
    type: 'column-end',
    accept: 'card',
    collisionPriority: -1,
    disabled,
  });
  return (
    <div
      ref={ref}
      className={`${styles.columnEnd} ${isDropTarget ? styles.dropTarget : ''}`}
      aria-hidden="true"
    />
  );
}

function BoardColumn({
  column,
  index,
  cards,
  allCards,
  columns,
  active,
  busy,
  dragging,
  canCreateCard,
  filtersActive,
  fieldErrors,
  failedMutation,
  onCommit,
  onOpenCard,
}: {
  column: KanbanColumn;
  index: number;
  cards: KanbanCardSummary[];
  allCards: KanbanCardSummary[];
  columns: KanbanColumn[];
  active: boolean;
  busy: boolean;
  dragging: boolean;
  canCreateCard: boolean;
  filtersActive: boolean;
  fieldErrors: Record<string, string>;
  failedMutation: Mutation | null;
  onCommit: (
    mutation: Mutation,
    success: string,
  ) => Promise<CommandResponse | null>;
  onOpenCard: (id: string) => void;
}) {
  const [newTitle, setNewTitle] = useState('');
  const cardCreateIdRef = useRef<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [columnTitle, setColumnTitle] = useState(column.title);
  const [renameBaseTitle, setRenameBaseTitle] = useState(column.title);
  const renameStale = renaming && column.title !== renameBaseTitle;
  const renameError =
    failedMutation?.type === 'rename_column' &&
    failedMutation.columnId === column.id
      ? fieldErrors.title
      : '';
  const createCardError =
    failedMutation?.type === 'create_card' &&
    failedMutation.columnId === column.id
      ? fieldErrors.title
      : '';
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({
    id: column.id,
    index,
    type: 'column',
    accept: 'column',
    group: 'columns',
    disabled: busy,
  });

  async function addCard(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const id = cardCreateIdRef.current ?? crypto.randomUUID();
    cardCreateIdRef.current = id;
    const result = await onCommit(
      {
        type: 'create_card',
        id,
        columnId: column.id,
        title,
      },
      'Cartão criado.',
    );
    if (result) {
      cardCreateIdRef.current = null;
      setNewTitle('');
      setAdding(false);
      onOpenCard(id);
    }
  }

  async function rename(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = columnTitle.trim();
    if (!title || renameStale) return;
    const result = await onCommit(
      { type: 'rename_column', columnId: column.id, title },
      'Coluna renomeada.',
    );
    if (result) setRenaming(false);
  }

  function shiftColumn(direction: -1 | 1) {
    const ids = columns.map((item) => item.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void onCommit(
      { type: 'reorder_columns', orderedColumnIds: ids },
      'Colunas reordenadas.',
    );
  }

  function deleteColumn() {
    if (allCards.length || column.archivedCardCount || columns.length === 1)
      return;
    if (!window.confirm(`Excluir definitivamente a coluna “${column.title}”?`))
      return;
    void onCommit(
      { type: 'delete_column', columnId: column.id },
      'Coluna excluída.',
    );
  }

  return (
    <section
      ref={ref}
      className={`${styles.column} ${isDragging ? styles.dragging : ''} ${isDropTarget ? styles.dropTarget : ''}`}
      data-active={active}
      aria-labelledby={`column-${column.id}`}
    >
      <div className={styles.columnHead}>
        <button
          ref={handleRef}
          className={styles.dragHandle}
          aria-label={`Arrastar coluna ${column.title}`}
          title="Arrastar coluna"
          disabled={busy}
        >
          ⋮⋮
        </button>
        <h2 id={`column-${column.id}`}>{column.title}</h2>
        <span className={styles.count}>
          {filtersActive ? `${cards.length}/${allCards.length}` : cards.length}
        </span>
        <details className={styles.actions}>
          <summary aria-label={`Ações da coluna ${column.title}`}>···</summary>
          <div className={styles.actionList}>
            <button
              type="button"
              disabled={busy}
              onClick={(event) => {
                const menu = event.currentTarget.closest('details');
                if (menu) menu.open = false;
                setColumnTitle(column.title);
                setRenameBaseTitle(column.title);
                setRenaming(true);
              }}
            >
              Renomear
            </button>
            <button
              type="button"
              disabled={busy || index === 0}
              onClick={() => shiftColumn(-1)}
            >
              Mover à esquerda
            </button>
            <button
              type="button"
              disabled={busy || index === columns.length - 1}
              onClick={() => shiftColumn(1)}
            >
              Mover à direita
            </button>
            <button
              type="button"
              disabled={
                busy ||
                allCards.length > 0 ||
                column.archivedCardCount > 0 ||
                columns.length === 1
              }
              onClick={deleteColumn}
              title={
                allCards.length || column.archivedCardCount
                  ? 'Mova, restaure ou exclua os cartões antes de excluir.'
                  : undefined
              }
            >
              Excluir coluna
            </button>
          </div>
        </details>
      </div>
      {renaming ? (
        <form
          className={styles.inlineForm}
          onSubmit={(event) => void rename(event)}
        >
          <label htmlFor={`rename-${column.id}`}>Novo nome</label>
          <input
            id={`rename-${column.id}`}
            className="admin-input"
            aria-describedby={
              renameStale
                ? `rename-stale-${column.id}`
                : renameError
                  ? `rename-error-${column.id}`
                  : undefined
            }
            maxLength={40}
            value={columnTitle}
            onChange={(event) => setColumnTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setColumnTitle(column.title);
                setRenaming(false);
              }
            }}
          />
          {renameError ? (
            <p id={`rename-error-${column.id}`} className={styles.fieldError}>
              {renameError}
            </p>
          ) : null}
          {renameStale ? (
            <p
              id={`rename-stale-${column.id}`}
              className={styles.fieldError}
              role="alert"
            >
              Esta coluna mudou em outra aba. Copie seu texto, cancele e abra
              Renomear novamente.
            </p>
          ) : null}
          <div className={styles.inlineActions}>
            <button
              className="admin-primary"
              disabled={busy || !columnTitle.trim() || renameStale}
            >
              Salvar
            </button>
            <button
              type="button"
              className="admin-secondary"
              onClick={() => setRenaming(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
      <ol className={styles.cardList} aria-label={`Cartões em ${column.title}`}>
        {cards.map((card) => (
          <BoardCard
            key={card.id}
            card={card}
            index={allCards.findIndex((item) => item.id === card.id)}
            cards={allCards}
            columns={columns}
            busy={busy}
            onCommit={onCommit}
            onOpenCard={onOpenCard}
          />
        ))}
      </ol>
      {!cards.length ? (
        <p className={styles.empty}>
          {filtersActive
            ? 'Nenhum cartão corresponde aos filtros.'
            : 'Adicione a primeira tarefa.'}
        </p>
      ) : null}
      <ColumnEnd columnId={column.id} disabled={busy || !dragging} />
      {adding ? (
        <form
          className={styles.inlineForm}
          onSubmit={(event) => void addCard(event)}
        >
          <label htmlFor={`new-card-${column.id}`}>Título do cartão</label>
          <input
            id={`new-card-${column.id}`}
            className="admin-input"
            aria-describedby={
              createCardError ? `new-card-error-${column.id}` : undefined
            }
            maxLength={160}
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setAdding(false);
            }}
          />
          {createCardError ? (
            <p id={`new-card-error-${column.id}`} className={styles.fieldError}>
              {createCardError}
            </p>
          ) : null}
          <div className={styles.inlineActions}>
            <button
              className="admin-primary"
              disabled={busy || !newTitle.trim()}
            >
              Criar
            </button>
            <button
              type="button"
              className="admin-secondary"
              onClick={() => setAdding(false)}
            >
              Fechar
            </button>
          </div>
        </form>
      ) : (
        <button
          className={styles.addCard}
          disabled={busy || !canCreateCard}
          onClick={() => setAdding(true)}
          title={!canCreateCard ? 'Limite de 500 cartões atingido.' : undefined}
        >
          + Cartão
        </button>
      )}
    </section>
  );
}

function BoardCard({
  card,
  index,
  cards,
  columns,
  busy,
  onCommit,
  onOpenCard,
}: {
  card: KanbanCardSummary;
  index: number;
  cards: KanbanCardSummary[];
  columns: KanbanColumn[];
  busy: boolean;
  onCommit: (
    mutation: Mutation,
    success: string,
  ) => Promise<CommandResponse | null>;
  onOpenCard: (id: string) => void;
}) {
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({
    id: card.id,
    index,
    type: 'card',
    accept: 'card',
    group: 'cards',
    data: { columnId: card.columnId },
    disabled: busy,
  });

  async function moveRelative(direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= cards.length) return;
    const beforeCardId =
      direction === -1 ? cards[targetIndex].id : (cards[index + 2]?.id ?? null);
    const moved = await onCommit(
      {
        type: 'move_card',
        cardId: card.id,
        targetColumnId: card.columnId,
        beforeCardId,
      },
      'Cartão movido.',
    );
    if (moved) focusCard(card.id);
  }

  async function moveToColumn(columnId: string) {
    const moved = await onCommit(
      {
        type: 'move_card',
        cardId: card.id,
        targetColumnId: columnId,
        beforeCardId: null,
      },
      'Cartão movido.',
    );
    if (moved) focusCard(card.id);
  }

  return (
    <li
      ref={ref}
      className={`${styles.card} ${isDragging ? styles.dragging : ''} ${isDropTarget ? styles.dropTarget : ''}`}
      data-card-id={card.id}
    >
      <button className={styles.cardOpen} onClick={() => onOpenCard(card.id)}>
        <small>#{formatCardNumber(card.number)}</small>
        <span className={styles.cardTitle}>{card.title}</span>
        <CardMeta card={card} />
        {card.hasDescription ? <small>Com descrição</small> : null}
      </button>
      <div className={styles.cardControls}>
        <button
          ref={handleRef}
          className={styles.dragHandle}
          disabled={busy}
          aria-label={`Arrastar cartão ${card.title}`}
          title="Arrastar cartão"
        >
          ⋮⋮
        </button>
        <details className={styles.actions}>
          <summary aria-label={`Ações do cartão ${card.title}`}>···</summary>
          <div className={styles.actionList}>
            <button
              type="button"
              disabled={busy || index === 0}
              onClick={() => void moveRelative(-1)}
            >
              Subir
            </button>
            <button
              type="button"
              disabled={busy || index === cards.length - 1}
              onClick={() => void moveRelative(1)}
            >
              Descer
            </button>
            <span className={styles.actionLabel}>Mover para</span>
            {columns.map((column) => (
              <button
                type="button"
                key={column.id}
                disabled={busy || column.id === card.columnId}
                onClick={() => void moveToColumn(column.id)}
              >
                {column.title}
              </button>
            ))}
          </div>
        </details>
      </div>
    </li>
  );
}

function CardMeta({ card }: { card: KanbanCardSummary }) {
  if (!card.tenantName && !card.priority && !card.dueDate) return null;
  return (
    <span className={styles.cardMeta}>
      {card.tenantName ? (
        <span className={styles.metaTag}>{card.tenantName}</span>
      ) : null}
      {card.priority ? (
        <span className={styles.priorityTag} data-priority={card.priority}>
          {priorityLabels[card.priority]}
        </span>
      ) : null}
      {card.dueDate ? (
        <span className={styles.metaTag}>
          Prazo {formatDueDate(card.dueDate)}
        </span>
      ) : null}
    </span>
  );
}
