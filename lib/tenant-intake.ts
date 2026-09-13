import { z } from 'zod';
import { normalizeSocialUrl } from '@/lib/social-profile';

/**
 * Briefing que o operador informa ao criar o cliente. Antes o tenant nascia só
 * com nome, slug e WhatsApp, e o agente deduzia o negócio inteiro a partir de
 * uma URL que não conseguia abrir.
 */
export const intakeSchema = z.object({
  story: z.string().max(12000).default(''),
  segment: z.string().max(120).default(''),
  region: z.string().max(120).default(''),
  audience: z.string().max(240).default(''),
  offer: z.string().max(240).default(''),
  goal: z.string().max(240).default(''),
  evidence: z.array(z.string().min(3).max(160)).max(8).default([]),
  constraints: z.array(z.string().min(3).max(160)).max(8).default([]),
  references: z.array(z.url()).max(3).default([]),
  socialUrl: z
    .string()
    .trim()
    .max(200)
    .default('')
    .refine(
      (value) => !value || normalizeSocialUrl(value) !== null,
      'Informe um perfil do Instagram ou uma página de empresa no LinkedIn.',
    )
    .transform((value) => (value ? normalizeSocialUrl(value)!.url : '')),
});

/**
 * Escritas novas usam uma história única e, quando houver, uma única
 * referência visual. O schema de leitura acima continua aceitando o formato
 * anterior para que sites e snapshots existentes permaneçam legíveis.
 */
export const intakeWriteSchema = intakeSchema
  .extend({
    story: z
      .string()
      .trim()
      .min(1, 'Conte a história do cliente.')
      .max(12000, 'A história do cliente pode ter até 12.000 caracteres.'),
    references: z
      .array(
        z
          .url('Informe um link de referência válido.')
          .refine(
            (value) => /^https?:\/\//i.test(value),
            'Use um link de referência iniciado por http:// ou https://.',
          )
          .max(2000, 'O link de referência pode ter até 2.000 caracteres.'),
      )
      .max(1, 'Informe apenas um link de referência.'),
  })
  .transform((value) => ({
    ...value,
    segment: '',
    region: '',
    audience: '',
    offer: '',
    goal: '',
  }));

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
    !intake.story &&
    !intake.segment &&
    !intake.region &&
    !intake.audience &&
    !intake.offer &&
    !intake.goal &&
    !intake.evidence.length &&
    !intake.constraints.length &&
    !intake.references.length &&
    !intake.socialUrl
  );
}

function legacyStory(intake: Intake): string {
  return [
    ['Segmento', intake.segment],
    ['Região atendida', intake.region],
    ['Para quem vende', intake.audience],
    ['O que a empresa oferece', intake.offer],
    ['Ação esperada do visitante', intake.goal],
  ]
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

/**
 * Preenche o novo campo ao editar um cadastro antigo sem alterar o dado salvo.
 * A conversão só é persistida quando o operador salva o formulário.
 */
export function intakeForForm(value: unknown): Intake | null {
  const parsed = intakeSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    story: parsed.data.story || legacyStory(parsed.data),
  };
}

/** URL da rede social já normalizada, quando o operador informou uma. */
export function intakeSocialUrl(value: unknown): string {
  const parsed = intakeSchema.safeParse(value);
  return parsed.success ? parsed.data.socialUrl : '';
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
  if (intake.story) add('História do cliente', intake.story);
  else {
    add('Segmento', intake.segment);
    add('Região', intake.region);
    add('Público', intake.audience);
    add('Oferta', intake.offer);
    add('Objetivo', intake.goal);
  }
  add('Confirmado pelo operador', intake.evidence.join('; '));
  add('Restrições', intake.constraints.join('; '));
  add('Referência visual', intake.references.join(' '));
  return rows.join('\n');
}
