import type { Client } from '@neondatabase/serverless';
import { transaction } from '@/lib/db';
import { insertBefore, sameOrder } from '@/lib/kanban/ordering';
import { readKanbanBoardWith } from '@/lib/kanban/queries';
import {
  MAX_CARDS,
  MAX_COLUMNS,
  type KanbanCardDetail,
  type KanbanCommand,
} from '@/lib/kanban/schema';

const BOARD_KEY = 'operations';

export class KanbanError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string>,
    readonly currentRevision?: number,
  ) {
    super(message);
    this.name = 'KanbanError';
  }
}

type Board = { id: string; revision: string };
type Column = { id: string; title: string; position: number };
type Card = {
  id: string;
  column_id: string;
  title: string;
  description: string;
  position: number;
};
type CardSummaryRow = Omit<Card, 'description'>;

function missing(kind: 'Cartão' | 'Coluna'): never {
  throw new KanbanError(
    'NOT_FOUND',
    404,
    `${kind} não encontrado neste quadro.`,
  );
}

function cardDetail(card: Card): KanbanCardDetail {
  return {
    id: card.id,
    columnId: card.column_id,
    title: card.title,
    description: card.description,
    position: card.position,
  };
}

function cardsIn(cards: CardSummaryRow[], columnId: string) {
  return cards
    .filter((card) => card.column_id === columnId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

async function lockBoard(connection: Client): Promise<Board> {
  const result = await connection.query(
    'select id, revision::text as revision from kanban_boards where key = $1 for update',
    [BOARD_KEY],
  );
  const row = result.rows[0] as Board | undefined;
  if (!row) throw new Error('Kanban não inicializado; aplique o schema.');
  return row;
}

async function loadState(connection: Client, boardId: string) {
  const columnsResult = await connection.query(
    'select id, title, position from kanban_columns where board_id = $1 order by position, id',
    [boardId],
  );
  const cardsResult = await connection.query(
    `select k.id, k.column_id, k.title, k.position
       from kanban_cards k join kanban_columns c on c.id = k.column_id
       where c.board_id = $1 order by c.position, k.position, k.id`,
    [boardId],
  );
  return {
    columns: columnsResult.rows as Column[],
    cards: cardsResult.rows as CardSummaryRow[],
  };
}

async function setColumnOrder(connection: Client, ids: string[]) {
  await connection.query(
    `update kanban_columns c set position = ordered.position, updated_at = now()
       from unnest($1::uuid[], $2::integer[]) as ordered(id, position)
       where c.id = ordered.id`,
    [ids, ids.map((_, index) => index)],
  );
}

async function setCardOrder(connection: Client, ids: string[]) {
  if (!ids.length) return;
  await connection.query(
    `update kanban_cards k set position = ordered.position, updated_at = now()
       from unnest($1::uuid[], $2::integer[]) as ordered(id, position)
       where k.id = ordered.id`,
    [ids, ids.map((_, index) => index)],
  );
}

type CommandResult = { changed: boolean; card?: KanbanCardDetail };

async function applyCommand(
  connection: Client,
  boardId: string,
  command: KanbanCommand,
  columns: Column[],
  cards: CardSummaryRow[],
): Promise<CommandResult> {
  const column = (id: string) => {
    const found = columns.find((item) => item.id === id);
    if (!found) missing('Coluna');
    return found;
  };
  const card = (id: string) => {
    const found = cards.find((item) => item.id === id);
    if (!found) missing('Cartão');
    return found;
  };

  switch (command.type) {
    case 'create_column': {
      if (columns.length >= MAX_COLUMNS)
        throw new KanbanError(
          'VALIDATION_ERROR',
          400,
          'O quadro já tem oito colunas.',
        );
      if (columns.some((item) => item.id === command.id))
        throw new KanbanError(
          'ID_ALREADY_EXISTS',
          409,
          'Esta coluna já foi criada.',
        );
      await connection.query(
        'insert into kanban_columns (id, board_id, title, position) values ($1, $2, $3, $4)',
        [command.id, boardId, command.title, columns.length],
      );
      return { changed: true };
    }
    case 'rename_column': {
      const found = column(command.columnId);
      if (found.title === command.title) return { changed: false };
      await connection.query(
        'update kanban_columns set title = $2, updated_at = now() where id = $1 and board_id = $3',
        [found.id, command.title, boardId],
      );
      return { changed: true };
    }
    case 'reorder_columns': {
      const current = columns.map((item) => item.id);
      if (
        command.orderedColumnIds.length !== current.length ||
        command.orderedColumnIds.some((id) => !current.includes(id))
      )
        throw new KanbanError(
          'VALIDATION_ERROR',
          400,
          'A ordem precisa incluir exatamente as colunas atuais.',
          { orderedColumnIds: 'Inclua cada coluna atual uma vez.' },
        );
      if (sameOrder(current, command.orderedColumnIds))
        return { changed: false };
      await setColumnOrder(connection, command.orderedColumnIds);
      return { changed: true };
    }
    case 'delete_column': {
      const found = column(command.columnId);
      if (columns.length === 1)
        throw new KanbanError(
          'LAST_COLUMN',
          409,
          'O quadro precisa manter uma coluna.',
        );
      if (cards.some((item) => item.column_id === found.id))
        throw new KanbanError(
          'COLUMN_NOT_EMPTY',
          409,
          'Mova ou exclua os cartões antes de excluir esta coluna.',
        );
      await connection.query(
        'delete from kanban_columns where id = $1 and board_id = $2',
        [found.id, boardId],
      );
      await setColumnOrder(
        connection,
        columns.filter((item) => item.id !== found.id).map((item) => item.id),
      );
      return { changed: true };
    }
    case 'create_card': {
      column(command.columnId);
      if (cards.length >= MAX_CARDS)
        throw new KanbanError(
          'VALIDATION_ERROR',
          400,
          'O quadro já tem 500 cartões.',
        );
      if (cards.some((item) => item.id === command.id))
        throw new KanbanError(
          'ID_ALREADY_EXISTS',
          409,
          'Este cartão já foi criado.',
        );
      await connection.query(
        'insert into kanban_cards (id, column_id, title, position) values ($1, $2, $3, $4)',
        [
          command.id,
          command.columnId,
          command.title,
          cardsIn(cards, command.columnId).length,
        ],
      );
      return { changed: true };
    }
    case 'update_card': {
      const found = card(command.cardId);
      const descriptionResult = await connection.query(
        'select description from kanban_cards where id = $1 and column_id = $2',
        [found.id, found.column_id],
      );
      const currentDescription = (
        descriptionResult.rows[0] as { description: string } | undefined
      )?.description;
      if (currentDescription === undefined) missing('Cartão');
      const fullCard = { ...found, description: currentDescription };
      if (
        found.title === command.title &&
        currentDescription === command.description
      )
        return { changed: false, card: cardDetail(fullCard) };
      await connection.query(
        `update kanban_cards set title = $2, description = $3, updated_at = now()
         where id = $1 and column_id = $4`,
        [found.id, command.title, command.description, found.column_id],
      );
      return {
        changed: true,
        card: cardDetail({
          ...fullCard,
          title: command.title,
          description: command.description,
        }),
      };
    }
    case 'move_card': {
      const found = card(command.cardId);
      column(command.targetColumnId);
      const source = cardsIn(cards, found.column_id).map((item) => item.id);
      const withoutMoved = source.filter((id) => id !== found.id);
      if (found.column_id === command.targetColumnId) {
        if (command.beforeCardId === found.id) return { changed: false };
        const reordered = insertBefore(
          withoutMoved,
          found.id,
          command.beforeCardId,
        );
        if (!reordered)
          throw new KanbanError(
            'NOT_FOUND',
            404,
            'Posição de destino não encontrada.',
          );
        if (sameOrder(source, reordered)) return { changed: false };
        await setCardOrder(connection, reordered);
        return { changed: true };
      }

      const destination = cardsIn(cards, command.targetColumnId).map(
        (item) => item.id,
      );
      const reordered = insertBefore(
        destination,
        found.id,
        command.beforeCardId,
      );
      if (!reordered)
        throw new KanbanError(
          'NOT_FOUND',
          404,
          'Posição de destino não encontrada.',
        );
      await connection.query(
        'update kanban_cards set column_id = $2, position = $3, updated_at = now() where id = $1',
        [found.id, command.targetColumnId, reordered.indexOf(found.id)],
      );
      await setCardOrder(connection, withoutMoved);
      await setCardOrder(connection, reordered);
      return { changed: true };
    }
    case 'delete_card': {
      const found = card(command.cardId);
      await connection.query('delete from kanban_cards where id = $1', [
        found.id,
      ]);
      await setCardOrder(
        connection,
        cardsIn(cards, found.column_id)
          .map((item) => item.id)
          .filter((id) => id !== found.id),
      );
      return { changed: true };
    }
  }
}

/** Serializa todas as escritas do quadro e aplica uma revisão por mudança real. */
export async function executeKanbanCommand(command: KanbanCommand) {
  try {
    return await transaction(async (connection) => {
      const board = await lockBoard(connection);
      const revision = Number(board.revision);
      if (!Number.isSafeInteger(revision))
        throw new Error('Revisão do quadro fora do contrato JSON.');
      if (command.expectedRevision !== revision)
        throw new KanbanError(
          'REVISION_CONFLICT',
          409,
          'O quadro foi atualizado em outra aba. Confira as mudanças e tente novamente.',
          undefined,
          revision,
        );

      const { columns, cards } = await loadState(connection, board.id);
      const result = await applyCommand(
        connection,
        board.id,
        command,
        columns,
        cards,
      );
      if (result.changed)
        await connection.query(
          'update kanban_boards set revision = revision + 1, updated_at = now() where id = $1',
          [board.id],
        );
      const summary = await readKanbanBoardWith(connection);
      return { ...summary, ...(result.card ? { card: result.card } : {}) };
    });
  } catch (error) {
    const duplicate = error as { code?: string; constraint?: string };
    if (
      duplicate?.code === '23505' &&
      ((command.type === 'create_column' &&
        duplicate.constraint === 'kanban_columns_pkey') ||
        (command.type === 'create_card' &&
          duplicate.constraint === 'kanban_cards_pkey'))
    )
      throw new KanbanError(
        'ID_ALREADY_EXISTS',
        409,
        command.type === 'create_column'
          ? 'Esta coluna já foi criada.'
          : 'Este cartão já foi criado.',
      );
    throw error;
  }
}
