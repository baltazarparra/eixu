import { tool } from 'ai';
import { z } from 'zod';
import { getGuide, setGuide } from '@/lib/images/queries';
import type { Tenant } from '@/lib/types';

/**
 * Guia de imagem do cliente. Vive fora dos dois toolsets porque o chat de site
 * também precisa dele: sem guia, o gerador de cenas caía num padrão genérico
 * sem paleta nem ambiente.
 */
export function guideTool(
  tenant: Tenant,
  safe: <I, O>(
    run: (input: I) => Promise<O>,
  ) => (input: I) => Promise<O | { error: string }>,
) {
  return tool({
    description:
      'Define ou ajusta o guia de imagem do cliente. Passe só os campos que mudam; o resto é preservado. Toda imagem gerada depois obedece a este guia.',
    inputSchema: z.object({
      estilo: z.enum(['fotografia', 'ilustracao', '3d']).optional(),
      luz: z
        .string()
        .max(200)
        .optional()
        .describe('Ex: luz natural de manhã, sombra suave.'),
      paleta: z.array(z.string().max(40)).max(6).optional(),
      ambientes: z.array(z.string().max(60)).max(8).optional(),
      sujeitos: z
        .array(z.string().max(60))
        .max(8)
        .optional()
        .describe('Quem ou o que costuma aparecer.'),
      nunca: z
        .array(z.string().max(60))
        .max(12)
        .optional()
        .describe('O que nunca pode aparecer.'),
      notas: z.string().max(400).optional(),
    }),
    execute: safe(async (input: Record<string, unknown>) => {
      const current = await getGuide(tenant.id);
      const guide = await setGuide(tenant.id, { ...current, ...input });
      return { guia: guide };
    }),
  });
}
