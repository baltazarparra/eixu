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
        align: z.enum(['left', 'center', 'right', 'justify']).optional(),
        fontSize: z.number().int().min(10).max(160).optional(),
        fontWeight: z
          .union([
            z.literal(300),
            z.literal(400),
            z.literal(500),
            z.literal(600),
            z.literal(700),
            z.literal(800),
            z.literal(900),
          ])
          .optional(),
        lineHeight: z.number().min(0.8).max(2.2).optional(),
        letterSpacing: z.number().min(-4).max(16).optional(),
        transform: z
          .enum(['none', 'uppercase', 'lowercase', 'capitalize'])
          .optional(),
        fontStyle: z.enum(['normal', 'italic']).optional(),
      })
      .strict()
      .refine(
        (entry) =>
          entry.size !== undefined ||
          entry.color !== undefined ||
          entry.align !== undefined ||
          entry.fontSize !== undefined ||
          entry.fontWeight !== undefined ||
          entry.lineHeight !== undefined ||
          entry.letterSpacing !== undefined ||
          entry.transform !== undefined ||
          entry.fontStyle !== undefined,
        'Informe ao menos uma propriedade de texto.',
      )
      .refine(
        (entry) => entry.size === undefined || entry.fontSize === undefined,
        'Use size ou fontSize, não os dois.',
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
