import type { Client } from '@neondatabase/serverless';
import { db } from '@/lib/db';
import type { KanbanCardDetail, KanbanSnapshot } from '@/lib/kanban/schema';

const BOARD_KEY = 'operations';

const BOARD_SQL = `
  select b.id, b.title, b.revision::text as revision,
    coalesce((
      select json_agg(json_build_object(
        'id', c.id, 'title', c.title, 'position', c.position
      ) order by c.position, c.id)
      from kanban_columns c where c.board_id = b.id
    ), '[]'::json) as columns,
    coalesce((
      select json_agg(json_build_object(
        'id', k.id, 'columnId', k.column_id, 'title', k.title,
        'position', k.position, 'hasDescription', k.description <> ''
      ) order by c.position, k.position, k.id)
      from kanban_cards k
      join kanban_columns c on c.id = k.column_id
      where c.board_id = b.id
    ), '[]'::json) as cards
  from kanban_boards b where b.key = $1
`;

type BoardRow = {
  id: string;
  title: string;
  revision: string;
  columns: KanbanSnapshot['columns'];
  cards: KanbanSnapshot['cards'];
};

function safeRevision(raw: string): number {
  const revision = Number(raw);
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error('Revisão do quadro fora do contrato JSON.');
  return revision;
}

function snapshot(row: BoardRow | undefined): KanbanSnapshot {
  if (!row) throw new Error('Kanban não inicializado; aplique o schema.');
  return {
    board: { id: row.id, title: row.title },
    revision: safeRevision(row.revision),
    columns: row.columns,
    cards: row.cards,
  };
}

/** Uma instrução SQL: revisão, colunas e cartões partilham o mesmo snapshot. */
export async function readKanbanBoard(): Promise<KanbanSnapshot> {
  const rows = (await db().query(BOARD_SQL, [BOARD_KEY])) as BoardRow[];
  return snapshot(rows[0]);
}

/** Lê o resultado da escrita ainda sob a transação que detém o lock. */
export async function readKanbanBoardWith(
  connection: Client,
): Promise<KanbanSnapshot> {
  const result = await connection.query(BOARD_SQL, [BOARD_KEY]);
  return snapshot(result.rows[0] as BoardRow | undefined);
}

const CARD_SQL = `
  select b.revision::text as revision, k.id, k.title, k.description,
    k.position, c.id as column_id
  from kanban_boards b
  join kanban_columns c on c.board_id = b.id
  join kanban_cards k on k.column_id = c.id
  where b.key = $1 and k.id = $2
`;

type CardRow = {
  revision: string;
  id: string;
  title: string;
  description: string;
  position: number;
  column_id: string;
};

export async function readKanbanCard(
  id: string,
): Promise<{ card: KanbanCardDetail; revision: number } | null> {
  const rows = (await db().query(CARD_SQL, [BOARD_KEY, id])) as CardRow[];
  const row = rows[0];
  if (!row) return null;
  return {
    card: {
      id: row.id,
      columnId: row.column_id,
      title: row.title,
      description: row.description,
      position: row.position,
    },
    revision: safeRevision(row.revision),
  };
}
