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
    const pages = new Set();
    const fields = new Set();
    for (const page of contract.pages) {
      if (pages.has(page.slug))
        context.addIssue({
          code: 'custom',
          message: `Página repetida: /${page.slug}`,
        });
      pages.add(page.slug);
      const sections = new Set();
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

export function assertEditorContract(value) {
  const parsed = premiumEditorContractSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const location = issue?.path?.length ? ` em ${issue.path.join('.')}` : '';
  throw new Error(
    `Contrato editorial Premium inválido${location}: ${issue?.message ?? 'estrutura desconhecida'}.`,
  );
}
