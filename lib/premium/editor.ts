import { z } from 'zod';

const slug = z
  .string()
  .max(160)
  .regex(/^(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/);
const key = z
  .string()
  .min(1)
  .max(240)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/);

const targetSchema = z
  .object({
    page: slug,
    block: z.string().min(1).max(160),
    path: z.string().min(1).max(240),
  })
  .strict();

export const premiumEditorFieldSchema = z
  .object({
    key,
    label: z.string().min(1).max(120),
    type: z.enum(['text', 'textarea', 'image']),
    value: z.string().max(8_000),
    required: z.boolean().default(true),
    maxLength: z.number().int().positive().max(8_000).optional(),
    help: z.string().min(1).max(240).optional(),
    target: targetSchema.optional(),
  })
  .strict();

export const premiumEditorContractSchema = z
  .object({
    version: z.literal(1),
    pages: z
      .array(
        z
          .object({
            slug,
            label: z.string().min(1).max(120),
            sections: z
              .array(
                z
                  .object({
                    id: z.string().min(1).max(120),
                    label: z.string().min(1).max(120),
                    fields: z.array(premiumEditorFieldSchema).min(1).max(120),
                  })
                  .strict(),
              )
              .min(1)
              .max(80),
          })
          .strict(),
      )
      .min(1)
      .max(60),
  })
  .strict()
  .superRefine((contract, context) => {
    const pages = new Set<string>();
    const fields = new Set<string>();
    for (const page of contract.pages) {
      if (pages.has(page.slug))
        context.addIssue({
          code: 'custom',
          message: `Página repetida: /${page.slug}`,
        });
      pages.add(page.slug);
      const sections = new Set<string>();
      for (const section of page.sections) {
        if (sections.has(section.id))
          context.addIssue({
            code: 'custom',
            message: `Seção repetida em /${page.slug}: ${section.id}`,
          });
        sections.add(section.id);
        for (const field of section.fields) {
          if (fields.has(field.key))
            context.addIssue({
              code: 'custom',
              message: `Chave editorial repetida: ${field.key}`,
            });
          fields.add(field.key);
        }
      }
    }
  });

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
