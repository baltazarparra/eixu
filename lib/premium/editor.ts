import { z } from 'zod';
import {
  premiumEditorContractSchema,
  premiumEditorFieldSchema,
} from '@/lib/premium/editor-contract.mjs';

export { premiumEditorContractSchema, premiumEditorFieldSchema };

export type PremiumEditorField = z.infer<typeof premiumEditorFieldSchema>;
export type PremiumEditorContract = z.infer<typeof premiumEditorContractSchema>;
export type PremiumEditorValues = Record<string, string>;

export type PremiumEditorContent = {
  revision: number;
  values: PremiumEditorValues;
  updatedAt: string | null;
};

export type PremiumEditorState = {
  contractHash: string;
  contract: PremiumEditorContract;
  content: PremiumEditorContent;
};

export class PremiumEditorError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
    readonly currentRevision?: number,
  ) {
    super(message);
    this.name = 'PremiumEditorError';
  }
}

export function parsePremiumEditorContract(
  value: unknown,
): PremiumEditorContract | null {
  const parsed = premiumEditorContractSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function premiumEditorFields(
  contract: PremiumEditorContract,
): PremiumEditorField[] {
  return contract.pages.flatMap((page) =>
    page.sections.flatMap((section) => section.fields),
  );
}

export function premiumEditorDefaults(
  contract: PremiumEditorContract,
): PremiumEditorValues {
  return Object.fromEntries(
    premiumEditorFields(contract).map((field) => [field.key, field.value]),
  );
}

/**
 * Releases podem acrescentar campos sem exigir uma escrita no banco. Valores
 * removidos deixam de circular; os novos começam pelo conteúdo empacotado.
 */
export function compatiblePremiumEditorValues(
  contract: PremiumEditorContract,
  stored: unknown,
): PremiumEditorValues {
  const values = premiumEditorDefaults(contract);
  if (!stored || typeof stored !== 'object' || Array.isArray(stored))
    return values;
  for (const field of premiumEditorFields(contract)) {
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

export function validatePremiumEditorValues(
  contract: PremiumEditorContract,
  input: unknown,
  allowedImages?: ReadonlySet<string>,
): PremiumEditorValues {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new PremiumEditorError('Conteúdo editorial inválido.', 400);
  const raw = input as Record<string, unknown>;
  const fields = premiumEditorFields(contract);
  const known = new Set(fields.map((field) => field.key));
  const errors: Record<string, string> = {};
  for (const received of Object.keys(raw))
    if (!known.has(received))
      errors[received] = 'Campo não pertence ao projeto.';

  const values: PremiumEditorValues = {};
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
      const isPath = value.startsWith('/');
      let isHttps = false;
      try {
        isHttps = new URL(value).protocol === 'https:';
      } catch {
        isHttps = false;
      }
      if (!isPath && !isHttps) {
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
    throw new PremiumEditorError(
      'Confira os campos destacados. Nenhuma alteração foi publicada.',
      422,
      errors,
    );
  return values;
}
