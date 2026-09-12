import { z } from 'zod';
import type { Brand } from '@/lib/types';

export const logoStudioSchema = z.object({
  status: z.enum(['running', 'done', 'failed', 'skipped']),
  sourceHash: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  error: z.string().optional(),
  original: z.object({ seq: z.number().int().positive() }).optional(),
  proposals: z.array(
    z.object({
      seq: z.number().int().positive(),
      imageId: z.string(),
      variant: z.enum(['fiel', 'ousada']),
      url: z.url(),
      score: z.number().nullable(),
      aprovado: z.boolean(),
      nomeCorreto: z.boolean().nullable(),
      fidelidade: z.number().nullable(),
      aspect: z.number().positive(),
    }),
  ),
  recommended: z.number().optional(),
  applied: z.object({ seq: z.number(), at: z.string() }).optional(),
  gate: z.string().optional(),
});

export function logoStudioState(brief: Record<string, unknown>) {
  const parsed = logoStudioSchema.safeParse(brief.logoStudio);
  return parsed.success ? parsed.data : undefined;
}

/** Texto de estado não anuncia uma aplicação antiga depois que o operador trocou o logo. */
export function logoStudioSummary(
  brief: Record<string, unknown>,
  brand: Brand,
): string | undefined {
  const state = logoStudioState(brief);
  if (!state) return undefined;
  if (state.status === 'running') return 'Modernizando o logo';
  const original = state.original ? `Original #${state.original.seq}` : '';
  const applied = state.proposals.find(
    (p) => p.seq === state.applied?.seq && p.url === brand.logoUrl,
  );
  return [
    original,
    applied
      ? `Modernizado #${applied.seq} aplicado`
      : state.proposals.length
        ? `Propostas ${state.proposals.map((p) => `#${p.seq}`).join(' e ')} na biblioteca`
        : 'Modernização não concluída',
  ]
    .filter(Boolean)
    .join(' · ');
}
