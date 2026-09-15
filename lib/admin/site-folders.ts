import { z } from 'zod';

const uuid = z.uuid('Pasta inválida.');

function hasNoControlCharacters(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return false;
  }
  return true;
}

export const folderNameSchema = z
  .string()
  .refine(
    hasNoControlCharacters,
    'O nome da pasta contém um caractere inválido.',
  )
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(1, 'Dê um nome para a pasta.')
      .max(40, 'Use até 40 caracteres no nome da pasta.'),
  );

export const optionalFolderIdSchema = z.union([uuid, z.null()]);

export const folderAssignmentSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  fromFolderId: optionalFolderIdSchema,
  toFolderId: optionalFolderIdSchema,
});

export const folderAssignmentsSchema = z
  .array(folderAssignmentSchema)
  .min(1, 'Selecione ao menos um site.')
  .max(100, 'Mova até 100 sites por vez.')
  .refine(
    (assignments) =>
      new Set(assignments.map((assignment) => assignment.slug)).size ===
      assignments.length,
    'A seleção contém sites repetidos.',
  );

export type FolderAssignment = z.infer<typeof folderAssignmentSchema>;

export function parseFolderAssignments(value: string) {
  try {
    return folderAssignmentsSchema.safeParse(JSON.parse(value));
  } catch {
    return folderAssignmentsSchema.safeParse(null);
  }
}
