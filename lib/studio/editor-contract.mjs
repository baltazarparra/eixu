import { z } from 'zod';

const pageSlug = z
  .string()
  .max(160)
  .regex(/^(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/);

const stableKey = z
  .string()
  .min(1)
  .max(240)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/);

export const studioEditorFieldSchema = z
  .object({
    key: stableKey,
    label: z.string().trim().min(1).max(120),
    type: z.enum(['text', 'textarea', 'image']),
    value: z.string().max(12_000),
    required: z.boolean().default(true),
    maxLength: z.number().int().positive().max(12_000).optional(),
    help: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

export const studioEditorContractSchema = z
  .object({
    version: z.literal(1),
    pages: z
      .array(
        z
          .object({
            slug: pageSlug,
            label: z.string().trim().min(1).max(120),
            sections: z
              .array(
                z
                  .object({
                    id: stableKey,
                    label: z.string().trim().min(1).max(120),
                    fields: z.array(studioEditorFieldSchema).min(1).max(160),
                  })
                  .strict(),
              )
              .min(1)
              .max(100),
          })
          .strict(),
      )
      .min(1)
      .max(80),
  })
  .strict()
  .superRefine((contract, context) => {
    const pageSlugs = new Set();
    const fieldKeys = new Set();
    for (const page of contract.pages) {
      if (pageSlugs.has(page.slug))
        context.addIssue({
          code: 'custom',
          message: `Página repetida: /${page.slug}`,
        });
      pageSlugs.add(page.slug);
      const sectionIds = new Set();
      for (const section of page.sections) {
        if (sectionIds.has(section.id))
          context.addIssue({
            code: 'custom',
            message: `Seção repetida em /${page.slug}: ${section.id}`,
          });
        sectionIds.add(section.id);
        for (const field of section.fields) {
          if (fieldKeys.has(field.key))
            context.addIssue({
              code: 'custom',
              message: `Chave editorial repetida: ${field.key}`,
            });
          fieldKeys.add(field.key);
        }
      }
    }
  });

export function assertStudioEditorContract(value) {
  const parsed = studioEditorContractSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const location = issue?.path?.length ? ` em ${issue.path.join('.')}` : '';
  throw new Error(
    `Contrato editorial inválido${location}: ${issue?.message ?? 'estrutura desconhecida'}.`,
  );
}
