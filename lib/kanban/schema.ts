import { z } from 'zod';

export const MAX_COLUMNS = 8;
export const MAX_CARDS = 500;

const id = z.uuid();
const expectedRevision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const title = (maximum: number) => z.string().trim().min(1).max(maximum);
const command = { expectedRevision };

export const kanbanCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...command,
    type: z.literal('create_column'),
    id,
    title: title(40),
  }),
  z.strictObject({
    ...command,
    type: z.literal('rename_column'),
    columnId: id,
    title: title(40),
  }),
  z.strictObject({
    ...command,
    type: z.literal('reorder_columns'),
    orderedColumnIds: z
      .array(id)
      .min(1)
      .max(MAX_COLUMNS)
      .refine((ids) => new Set(ids).size === ids.length, 'Colunas repetidas.'),
  }),
  z.strictObject({
    ...command,
    type: z.literal('delete_column'),
    columnId: id,
  }),
  z.strictObject({
    ...command,
    type: z.literal('create_card'),
    id,
    columnId: id,
    title: title(160),
  }),
  z.strictObject({
    ...command,
    type: z.literal('update_card'),
    cardId: id,
    title: title(160),
    description: z.string().max(5000),
  }),
  z.strictObject({
    ...command,
    type: z.literal('move_card'),
    cardId: id,
    targetColumnId: id,
    beforeCardId: id.nullable(),
  }),
  z.strictObject({
    ...command,
    type: z.literal('delete_card'),
    cardId: id,
  }),
]);

export type KanbanCommand = z.infer<typeof kanbanCommandSchema>;

export type KanbanColumn = {
  id: string;
  title: string;
  position: number;
};

export type KanbanCardSummary = {
  id: string;
  columnId: string;
  title: string;
  position: number;
  hasDescription: boolean;
};

export type KanbanCardDetail = {
  id: string;
  columnId: string;
  title: string;
  description: string;
  position: number;
};

export type KanbanSnapshot = {
  board: { id: string; title: string };
  revision: number;
  columns: KanbanColumn[];
  cards: KanbanCardSummary[];
};
