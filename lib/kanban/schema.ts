import { z } from 'zod';
import { MAX_CARD_DESCRIPTION } from '@/lib/kanban/constraints';

export { MAX_CARD_DESCRIPTION } from '@/lib/kanban/constraints';

export const MAX_COLUMNS = 8;
export const MAX_CARDS = 500;

const id = z.uuid();
const expectedRevision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const expectedCardVersion = z.number().int().min(1).max(2_147_483_647);
const title = (maximum: number) => z.string().trim().min(1).max(maximum);
export const kanbanPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const optionalCardFields = {
  description: z.string().max(MAX_CARD_DESCRIPTION).optional(),
  tenantId: id.nullable().optional(),
  priority: kanbanPrioritySchema.nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
};
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
    ...optionalCardFields,
  }),
  z.strictObject({
    ...command,
    type: z.literal('update_card'),
    cardId: id,
    title: title(160),
    description: z.string().max(MAX_CARD_DESCRIPTION),
    tenantId: id.nullable().optional(),
    priority: kanbanPrioritySchema.nullable().optional(),
    dueDate: z.iso.date().nullable().optional(),
    expectedCardVersion: expectedCardVersion.optional(),
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
    type: z.literal('archive_card'),
    cardId: id,
  }),
  z.strictObject({
    ...command,
    type: z.literal('restore_card'),
    cardId: id,
  }),
  z.strictObject({
    ...command,
    type: z.literal('delete_card'),
    cardId: id,
  }),
]);

export type KanbanCommand = z.infer<typeof kanbanCommandSchema>;
export type KanbanPriority = z.infer<typeof kanbanPrioritySchema>;

export type KanbanTenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

export type KanbanColumn = {
  id: string;
  title: string;
  position: number;
  archivedCardCount: number;
};

export type KanbanCardSummary = {
  id: string;
  number: number;
  columnId: string;
  title: string;
  position: number;
  hasDescription: boolean;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  priority: KanbanPriority | null;
  dueDate: string | null;
  version: number;
  archivedAt: string | null;
};

export type KanbanCardDetail = {
  id: string;
  number: number;
  columnId: string;
  title: string;
  description: string;
  position: number;
  tenantId: string | null;
  priority: KanbanPriority | null;
  dueDate: string | null;
  version: number;
  archivedAt: string | null;
};

export type KanbanSnapshot = {
  board: { id: string; title: string };
  revision: number;
  columns: KanbanColumn[];
  cards: KanbanCardSummary[];
  archivedCards: KanbanCardSummary[];
  tenants: KanbanTenant[];
};
