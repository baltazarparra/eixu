import { z } from 'zod';
import {
  blockFields,
  fieldTextError,
  normalizeFieldText,
  type FieldError,
} from '@/lib/blocks/fields';
import { textPath, textStylesSchema } from '@/lib/blocks/text-style-schema';
import {
  applyPageEdit,
  pageRevision,
  PageEditError,
  type PageEdit,
} from '@/lib/ai/page-edits';
import type { Brand, Page } from '@/lib/types';

export const inlineEditSchema = z
  .object({
    page: z
      .string()
      .max(160)
      .regex(/^(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    blocks: z
      .array(
        z
          .object({
            id: z.string().min(1).max(160),
            text: z.record(textPath, z.string().max(4000)).optional(),
            textStyles: textStylesSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20)
      .refine(
        (blocks) => new Set(blocks.map((b) => b.id)).size === blocks.length,
        'Bloco repetido.',
      ),
  })
  .strict();
export type InlineEdit = z.infer<typeof inlineEditSchema>;

/** A entrada administrativa só alcança os campos visíveis do inventário. */
export function applyInlineEdit(page: Page, input: InlineEdit, brand: Brand) {
  if (input.revision !== pageRevision(page))
    throw new PageEditError(
      'A página mudou. Recarregue a prévia antes de editar novamente.',
      409,
    );
  const operations: PageEdit['operations'] = [];
  const errors: FieldError[] = [];
  for (const change of input.blocks) {
    const block = page.blocks.find((item) => item.id === change.id);
    if (!block) {
      errors.push({
        block: change.id,
        path: '',
        message: 'Bloco não encontrado nesta página.',
      });
      continue;
    }
    const fields = blockFields(block, brand);
    for (const [path, raw] of Object.entries(change.text ?? {})) {
      const field = fields.find(
        (entry) => entry.path === path && entry.editable,
      );
      if (!field) {
        errors.push({
          block: block.id,
          path,
          message: 'Este campo não pode ser editado na prévia.',
        });
        continue;
      }
      const value = normalizeFieldText(raw, field.multiline);
      const message = fieldTextError(field, value);
      if (message) errors.push({ block: block.id, path, message });
      else operations.push({ op: 'set', block: block.id, path, value });
    }
    if (change.textStyles !== undefined)
      operations.push(
        change.textStyles.length
          ? {
              op: 'set',
              block: block.id,
              path: 'textStyles',
              value: change.textStyles,
            }
          : { op: 'unset', block: block.id, path: 'textStyles' },
      );
  }
  if (errors.length)
    throw new PageEditError(
      'Confira os campos destacados. Nenhuma alteração foi salva.',
      422,
      errors,
    );
  return applyPageEdit(page, {
    page: input.page,
    revision: input.revision,
    operations,
  });
}
