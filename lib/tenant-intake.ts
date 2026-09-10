import { z } from 'zod';

/**
 * Briefing que o operador informa ao criar o cliente. Antes o tenant nascia só
 * com nome, slug e WhatsApp, e o agente deduzia o negócio inteiro a partir de
 * uma URL que não conseguia abrir.
 */
export const intakeSchema = z.object({
  segment: z.string().max(120).default(''),
  region: z.string().max(120).default(''),
  audience: z.string().max(240).default(''),
  offer: z.string().max(240).default(''),
  goal: z.string().max(240).default(''),
  evidence: z.array(z.string().min(3).max(160)).max(8).default([]),
  constraints: z.array(z.string().min(3).max(160)).max(8).default([]),
  references: z.array(z.url()).max(3).default([]),
});

export type Intake = z.infer<typeof intakeSchema>;

/** Campos multilinha do formulário: uma informação por linha. */
export function lines(value: string, limit = 8): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 3)
    .slice(0, limit);
}

export function intakeIsEmpty(intake: Intake): boolean {
  return (
    !intake.segment &&
    !intake.audience &&
    !intake.offer &&
    !intake.goal &&
    !intake.evidence.length &&
    !intake.references.length
  );
}

/** Resumo legível do intake para o prompt. */
export function intakeSummary(value: unknown): string {
  const parsed = intakeSchema.safeParse(value);
  if (!parsed.success) return '';
  const intake = parsed.data;
  if (intakeIsEmpty(intake)) return '';
  const rows: string[] = [];
  const add = (label: string, text: string) => {
    if (text) rows.push(`${label}: ${text}`);
  };
  add('Segmento', intake.segment);
  add('Região', intake.region);
  add('Público', intake.audience);
  add('Oferta', intake.offer);
  add('Objetivo', intake.goal);
  add('Confirmado pelo operador', intake.evidence.join('; '));
  add('Restrições', intake.constraints.join('; '));
  add('Referências', intake.references.join(' '));
  return rows.join('\n');
}
