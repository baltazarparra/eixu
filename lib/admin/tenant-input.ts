import { z } from 'zod';
import { intakeSchema, lines } from '@/lib/tenant-intake';
import { text } from '@/lib/form-data';

export const RESERVED_TENANTS = new Set([
  'www',
  'admin',
  'api',
  'app',
  's',
  'go',
]);
export const tenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(63)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use letras minúsculas, números e hífens entre palavras.',
  )
  .refine(
    (slug) => !RESERVED_TENANTS.has(slug),
    'Esse endereço é reservado. Escolha outro.',
  );
export const tenantDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(80),
  whatsapp: z
    .string()
    .trim()
    .max(20)
    .refine(
      (value) => !value || /^\+?[\d\s()-]{8,20}$/.test(value),
      'Confira o WhatsApp, incluindo o DDI.',
    )
    .refine(
      (value) => !value || /^\d{8,15}$/.test(value.replace(/\D/g, '')),
      'Informe de 8 a 15 dígitos, incluindo o DDI.',
    )
    .transform((value) => value.replace(/\D/g, '') || null),
  contactEmail: z
    .union([z.literal(''), z.email('Confira o e-mail de contato.')])
    .transform((value) => value || null),
});

export function intakeFromForm(form: FormData) {
  const field = (name: string) => text(form, name).trim();
  return intakeSchema.safeParse({
    segment: field('segment'),
    region: field('region'),
    audience: field('audience'),
    offer: field('offer'),
    goal: field('goal'),
    evidence: lines(field('evidence')),
    constraints: lines(field('constraints')),
    references: lines(field('references'), 3),
    socialUrl: field('socialUrl'),
  });
}

const hex = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, 'Use cores em hexadecimal, como #1f6feb.');

/**
 * As três cores do cadastro, com papéis distintos no tema: a primária pinta
 * superfícies e seções de marca, a secundária é o tom complementar e o acento
 * fica em botões, links e destaques.
 */
export const brandColorsSchema = z
  .object({ primary: hex, secondary: hex, highlight: hex })
  .refine(
    (colors) => colors.primary !== colors.secondary,
    'A cor primária e a secundária precisam ser diferentes para criar ritmo.',
  );

export function brandColorsFromForm(form: FormData) {
  return brandColorsSchema.safeParse({
    primary: text(form, 'primary'),
    secondary: text(form, 'secondary'),
    highlight: text(form, 'highlight'),
  });
}
