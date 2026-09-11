import { z } from 'zod';
import { intakeSchema, lines } from '@/lib/tenant-intake';
import { contactsSchema, derivedSocialUrl } from '@/lib/tenant-contacts';
import { vibeSchema } from '@/lib/design/vibes';
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
// O WhatsApp saiu daqui: ele é derivado de contacts na escrita, para o site
// continuar lendo uma coluna só e o operador cadastrar vários números.
export const tenantDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(80),
  contactEmail: z
    .union([z.literal(''), z.email('Confira o e-mail de contato.')])
    .transform((value) => value || null),
});

/** Valores repetidos de uma linha do formulário de contatos. */
function rows(form: FormData, name: string): string[] {
  return form
    .getAll(name)
    .map((value) => (typeof value === 'string' ? value.trim() : ''));
}

/**
 * Telefones, endereços e redes chegam como campos repetidos, um por linha do
 * formulário. O índice mantém número e tipo alinhados; linha vazia é ignorada
 * depois do pareamento, senão remover uma linha trocaria o tipo das seguintes.
 */
export function contactsFromForm(form: FormData) {
  const numbers = rows(form, 'phone');
  const kinds = rows(form, 'phoneKind');
  const labels = rows(form, 'addressLabel');
  const texts = rows(form, 'addressText');
  return contactsSchema.safeParse({
    phones: numbers
      .map((number, index) => ({
        number,
        whatsapp: kinds[index] === 'whatsapp',
      }))
      .filter((phone) => phone.number),
    addresses: texts
      .map((value, index) => ({ label: labels[index] ?? '', text: value }))
      .filter((address) => address.text),
    social: rows(form, 'social').filter(Boolean),
  });
}

export function vibeFromForm(form: FormData) {
  return vibeSchema.safeParse(text(form, 'vibe', 'comercial') || 'comercial');
}

export function intakeFromForm(form: FormData) {
  const field = (name: string) => text(form, name).trim();
  // O perfil lido no briefing é a primeira rede que a leitura sabe abrir.
  const contacts = contactsFromForm(form);
  return intakeSchema.safeParse({
    segment: field('segment'),
    region: field('region'),
    audience: field('audience'),
    offer: field('offer'),
    goal: field('goal'),
    evidence: lines(field('evidence')),
    constraints: lines(field('constraints')),
    references: lines(field('references'), 3),
    socialUrl: contacts.success ? derivedSocialUrl(contacts.data) : '',
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
