'use client';

import Link from 'next/link';
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
import type {
  KanbanCardDetail,
  KanbanCardSummary,
  KanbanColumn,
  KanbanCommand,
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
    a.position !== b.position
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
  const [selectedColumnId, setSelectedColumnId] = useState(
    initial.columns[0]?.id ?? '',
  );
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const columnCreateIdRef = useRef<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KanbanCardDetail | null>(null);
  const [detailRevision, setDetailRevision] = useState<number | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorError, setEditorError] = useState('');
  const [editorStale, setEditorStale] = useState(false);
  const [detailRequestVersion, setDetailRequestVersion] = useState(0);
  const editorDirtyRef = useRef(false);
  const editorInputVersionRef = useRef(0);
  const editorSaveRef = useRef<{
    cardId: string;
    title: string;
    description: string;
    columnId: string;
    position: number;
  } | null>(null);
  const editorStaleRef = useRef(false);
  const detailRevisionRef = useRef<number | null>(null);
  const serverDetailRef = useRef<KanbanCardDetail | null>(null);
  const panelRef = useRef<HTMLDialogElement | null>(null);

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
    detailRevisionRef.current = null;
    setDetailRevision(null);
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
    detailRevisionRef.current = null;
    setDetailRevision(null);
    serverDetailRef.current = null;
    editorDirtyRef.current = false;
    editorSaveRef.current = null;
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          `[data-card-id="${id}"] .${styles.cardOpen}`,
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
          saving.columnId === card.columnId &&
          saving.position === card.position;
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
        }
        serverDetailRef.current = card;
        detailRevisionRef.current = revision;
        setDetailRevision(revision);
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
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]',
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
    if (
      editorStale ||
      editorError ||
      detailRevisionRef.current !== snapshotRef.current.revision
    ) {
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
    const submittedInputVersion = editorInputVersionRef.current;
    editorSaveRef.current = {
      cardId: detail.id,
      title,
      description: submittedDescription,
      columnId: detail.columnId,
      position: detail.position,
    };
    let result: CommandResponse | null;
    try {
      result = await commit(
        {
          type: 'update_card',
          cardId: detail.id,
          title,
          description: submittedDescription,
        },
        'Cartão salvo.',
        (applied) => {
          if (applied.card) {
            serverDetailRef.current = applied.card;
            detailRevisionRef.current = applied.revision;
          }
        },
      );
    } finally {
      editorSaveRef.current = null;
    }
    if (result) {
      setDetail(
        result.card ?? { ...detail, title, description: submittedDescription },
      );
      serverDetailRef.current = result.card ?? {
        ...detail,
        title,
        description: submittedDescription,
      };
      detailRevisionRef.current = result.revision;
      setDetailRevision(result.revision);
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
      detailRevisionRef.current !== snapshotRef.current.revision ||
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
      detailRevisionRef.current = null;
      setDetailRevision(null);
      serverDetailRef.current = null;
      editorStaleRef.current = false;
    }
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

  const cardCount = snapshot.cards.length;
  const canCreateCard = cardCount < 500;
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
            <p>{numbers.format(cardCount)} cartões · quadro da operação</p>
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
            href="/admin/login?returnTo=/admin/app/kanban"
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

      <label className={styles.mobilePicker}>
        <span>Etapa</span>
        <select
          value={selectedColumnId}
          onChange={(event) => setSelectedColumnId(event.target.value)}
        >
          {snapshot.columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.title} ({sortCards(snapshot.cards, column.id).length})
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
            cards={sortCards(snapshot.cards, column.id)}
            columns={snapshot.columns}
            active={column.id === selectedColumnId}
            busy={busy}
            dragging={dragging}
            canCreateCard={canCreateCard}
            fieldErrors={fieldErrors}
            failedMutation={failedMutation}
            onCommit={commit}
            onOpenCard={openCard}
          />
        ))}
      </div>

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
              <strong>Cartão</strong>
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
                  maxLength={5000}
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
                      Boolean(editorError) ||
                      detailRevision !== snapshot.revision
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
                  className={styles.deleteButton}
                  disabled={
                    busy ||
                    editorStale ||
                    Boolean(editorError) ||
                    detailRevision !== snapshot.revision
                  }
                  onClick={() => void deleteEditor()}
                >
                  Excluir cartão
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
  columns,
  active,
  busy,
  dragging,
  canCreateCard,
  fieldErrors,
  failedMutation,
  onCommit,
  onOpenCard,
}: {
  column: KanbanColumn;
  index: number;
  cards: KanbanCardSummary[];
  columns: KanbanColumn[];
  active: boolean;
  busy: boolean;
  dragging: boolean;
  canCreateCard: boolean;
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
    if (cards.length || columns.length === 1) return;
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
        <span className={styles.count}>{cards.length}</span>
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
              disabled={busy || cards.length > 0 || columns.length === 1}
              onClick={deleteColumn}
              title={
                cards.length ? 'Mova os cartões antes de excluir.' : undefined
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
        {cards.map((card, cardIndex) => (
          <BoardCard
            key={card.id}
            card={card}
            index={cardIndex}
            cards={cards}
            columns={columns}
            busy={busy}
            onCommit={onCommit}
            onOpenCard={onOpenCard}
          />
        ))}
      </ol>
      {!cards.length ? (
        <p className={styles.empty}>Adicione a primeira tarefa.</p>
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
        <span>{card.title}</span>
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
