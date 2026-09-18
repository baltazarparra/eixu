import { z } from 'zod';
import {
  studioEditorContractSchema,
  studioEditorFieldSchema,
} from '@/lib/studio/editor-contract.mjs';

export { studioEditorContractSchema, studioEditorFieldSchema };

export type StudioEditorField = z.infer<typeof studioEditorFieldSchema>;
export type StudioEditorContract = z.infer<typeof studioEditorContractSchema>;
export type StudioEditorValues = Record<string, string>;

export class StudioEditorError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
    readonly currentRevision?: number,
  ) {
    super(message);
    this.name = 'StudioEditorError';
  }
}

export function parseStudioEditorContract(
  value: unknown,
): StudioEditorContract | null {
  const parsed = studioEditorContractSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function studioEditorFields(
  contract: StudioEditorContract,
): StudioEditorField[] {
  return contract.pages.flatMap((page) =>
    page.sections.flatMap((section) => section.fields),
  );
}

export function studioEditorDefaults(
  contract: StudioEditorContract,
): StudioEditorValues {
  return Object.fromEntries(
    studioEditorFields(contract).map((field) => [field.key, field.value]),
  );
}

export function compatibleStudioEditorValues(
  contract: StudioEditorContract,
  stored: unknown,
): StudioEditorValues {
  const values = studioEditorDefaults(contract);
  if (!stored || typeof stored !== 'object' || Array.isArray(stored))
    return values;
  for (const field of studioEditorFields(contract)) {
    const value = (stored as Record<string, unknown>)[field.key];
    if (typeof value === 'string') values[field.key] = value;
  }
  return values;
}

function normalized(value: string, multiline: boolean): string {
  const unix = value.replace(/\r/g, '');
  return multiline
    ? unix
        .split(/\n\s*\n/)
        .map((part) => part.replace(/[\t ]+/g, ' ').trim())
        .join('\n\n')
    : unix.replace(/\s+/g, ' ').trim();
}

export function validateStudioEditorValues(
  contract: StudioEditorContract,
  input: unknown,
  allowedImages?: ReadonlySet<string>,
): StudioEditorValues {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new StudioEditorError('Conteúdo editorial inválido.', 400);
  const raw = input as Record<string, unknown>;
  const fields = studioEditorFields(contract);
  const known = new Set(fields.map((field) => field.key));
  const errors: Record<string, string> = {};
  for (const received of Object.keys(raw))
    if (!known.has(received))
      errors[received] = 'Campo não pertence a esta versão do projeto.';

  const values: StudioEditorValues = {};
  for (const field of fields) {
    const candidate = raw[field.key];
    if (typeof candidate !== 'string') {
      errors[field.key] = 'Preencha este campo.';
      continue;
    }
    const value = normalized(candidate, field.type === 'textarea');
    if (field.required && !value) {
      errors[field.key] = 'Preencha este campo.';
      continue;
    }
    if (field.maxLength && value.length > field.maxLength) {
      errors[field.key] = `Use até ${field.maxLength} caracteres.`;
      continue;
    }
    if (field.type === 'image' && value) {
      const isLocalPath = value.startsWith('/') && !value.startsWith('//');
      let isHttps = false;
      try {
        isHttps = new URL(value).protocol === 'https:';
      } catch {
        isHttps = false;
      }
      if (!isLocalPath && !isHttps) {
        errors[field.key] = 'Escolha uma imagem válida do acervo.';
        continue;
      }
      if (allowedImages && value !== field.value && !allowedImages.has(value)) {
        errors[field.key] = 'Esta imagem não pertence ao acervo do projeto.';
        continue;
      }
    }
    values[field.key] = value;
  }
  if (Object.keys(errors).length)
    throw new StudioEditorError(
      'Confira os campos destacados. Nenhuma alteração foi salva.',
      422,
      errors,
    );
  return values;
}
