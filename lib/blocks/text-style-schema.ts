import { z } from 'zod';

export const textPath = z
  .string()
  .max(160)
  .regex(/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/)
  .refine(
    (path) =>
      !path
        .split('.')
        .some((part) =>
          ['__proto__', 'constructor', 'prototype'].includes(part),
        ),
    'Caminho de texto inválido.',
  );

export const textStylesSchema = z
  .array(
    z
      .object({
        field: textPath,
        size: z
          .union([
            z.literal(-2),
            z.literal(-1),
            z.literal(0),
            z.literal(1),
            z.literal(2),
          ])
          .optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
      .strict()
      .refine(
        (entry) => entry.size !== undefined || entry.color !== undefined,
        'Informe tamanho ou cor.',
      ),
  )
  .max(40)
  .refine(
    (entries) =>
      new Set(entries.map((entry) => entry.field)).size === entries.length,
    'Um campo só pode ter um estilo.',
  );

export type TextStyle = z.infer<typeof textStylesSchema>[number];
export const TEXT_SCALES = {
  '-2': 80,
  '-1': 90,
  '0': 100,
  '1': 115,
  '2': 130,
} as const;
