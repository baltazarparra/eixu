import { z } from 'zod';
import { normalizeSocialUrl } from '@/lib/social-profile';

/**
 * Contatos do cliente informados no cadastro: telefones (WhatsApp ou comuns),
 * endereços e redes sociais. Vivem em coluna própria porque são dado de
 * produto renderizado no site: `brand` é reescrita inteira por set_design a
 * partir da memória do turno e `brief` é briefing, despejado no prompt.
 *
 * O e-mail continua em `tenants.contact_email` e o WhatsApp principal continua
 * espelhado em `tenants.whatsapp`, derivado daqui na escrita, para o
 * redirecionador, o botão flutuante e o JSON-LD não mudarem.
 */

const digitsOf = (value: string) => value.replace(/\D/g, '');

export const phoneSchema = z.object({
  number: z
    .string()
    .trim()
    .max(24)
    .refine(
      (value) => /^\+?[\d\s().-]{8,24}$/.test(value),
      'Confira o telefone, incluindo o DDI.',
    )
    .refine(
      (value) => /^\d{8,15}$/.test(digitsOf(value)),
      'Informe de 8 a 15 dígitos no telefone, incluindo o DDI.',
    )
    // O sinal distingue, por exemplo, +1 415... de um telefone local com
    // onze dígitos. Não é possível recuperar essa informação só pelo tamanho.
    .transform(
      (value) => `${value.startsWith('+') ? '+' : ''}${digitsOf(value)}`,
    ),
  whatsapp: z.boolean().default(false),
});

export const addressSchema = z.object({
  label: z.string().trim().max(40).default(''),
  text: z
    .string()
    .trim()
    .min(8, 'Endereço curto demais: informe rua, número e cidade.')
    .max(200),
});

/**
 * Aceita `@perfil`, `instagram.com/perfil` ou a URL completa de qualquer rede.
 * Reaproveita a normalização do Instagram/LinkedIn que já existia no briefing.
 */
export function normalizeSocialLink(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const known = normalizeSocialUrl(value);
  if (known) return known.url;
  if (!value.includes('.')) return null;
  // Um esquema que não seja http(s) é recusado em vez de receber o prefixo:
  // "ftp://x" viraria "https://ftp://x" e um "javascript:" nunca pode virar
  // href no rodapé do cliente.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value))
    return null;
  if (value.startsWith('//')) return null;
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  parsed.protocol = 'https:';
  return parsed.toString().replace(/\/$/, '');
}

export const socialLinkSchema = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) => normalizeSocialLink(value) !== null,
    'Informe o link da rede social, como instagram.com/suaempresa.',
  )
  .transform((value) => normalizeSocialLink(value)!);

function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export const contactsSchema = z
  .object({
    phones: z.array(phoneSchema).max(4, 'Até 4 telefones.').default([]),
    addresses: z.array(addressSchema).max(5, 'Até 5 endereços.').default([]),
    social: z
      .array(socialLinkSchema)
      .max(8, 'Até 8 redes sociais.')
      .default([]),
  })
  .transform((contacts) => ({
    phones: unique(contacts.phones, (phone) => phoneE164(phone.number)),
    addresses: unique(contacts.addresses, (address) =>
      address.text.toLowerCase(),
    ),
    social: unique(contacts.social, (url) => url.toLowerCase()),
  }));

export type Contacts = z.infer<typeof contactsSchema>;
export type Phone = Contacts['phones'][number];
export type Address = Contacts['addresses'][number];

export const EMPTY_CONTACTS: Contacts = {
  phones: [],
  addresses: [],
  social: [],
};

/**
 * Leitura tolerante: linha antiga sem a coluna, fixture de teste sem a chave e
 * cliente criado antes desta entrega continuam funcionando. Sem telefone e com
 * o WhatsApp legado preenchido, ele vira o primeiro telefone da lista. A rede
 * do briefing só é recuperada enquanto a lista social ainda não foi gravada;
 * uma lista explicitamente vazia continua significando remoção pelo operador.
 */
export function contactsOf(
  value: unknown,
  legacyWhatsapp?: string | null,
  legacySocialUrl?: string,
): Contacts {
  const parsed = contactsSchema.safeParse(value ?? {});
  const contacts = parsed.success ? parsed.data : EMPTY_CONTACTS;
  const hasSocial =
    value !== null &&
    typeof value === 'object' &&
    Object.hasOwn(value, 'social');
  const legacySocial =
    !hasSocial && legacySocialUrl ? normalizeSocialUrl(legacySocialUrl) : null;
  const result = legacySocial
    ? { ...contacts, social: [legacySocial.url] }
    : contacts;
  if (!contacts.phones.length && legacyWhatsapp) {
    const number = phoneSchema.safeParse({
      number: legacyWhatsapp,
      whatsapp: true,
    });
    if (number.success) return { ...result, phones: [number.data] };
  }
  return result;
}

export function contactsIsEmpty(contacts: Contacts): boolean {
  return (
    !contacts.phones.length &&
    !contacts.addresses.length &&
    !contacts.social.length
  );
}

/** O número que alimenta `tenants.whatsapp`, o botão flutuante e o /go/wa. */
export function primaryWhatsapp(contacts: Contacts): string | null {
  const phone = contacts.phones.find((phone) => phone.whatsapp);
  return phone ? digitsOf(phone.number) : null;
}

export function whatsappNumbers(contacts: Contacts): string[] {
  return contacts.phones
    .filter((phone) => phone.whatsapp)
    .map((phone) => digitsOf(phone.number));
}

/** Enésimo WhatsApp da lista, para o rodapé oferecer um número secundário. */
export function whatsappAt(contacts: Contacts, index: number): string | null {
  return whatsappNumbers(contacts)[index] ?? null;
}

/** Primeiro perfil que a leitura de rede social sabe abrir. */
export function derivedSocialUrl(contacts: Contacts): string {
  for (const link of contacts.social) {
    const known = normalizeSocialUrl(link);
    if (known) return known.url;
  }
  return '';
}

/**
 * O "+" informado pelo operador identifica o DDI, inclusive em números
 * internacionais curtos. Mantém compatibilidade com números longos já
 * gravados sem sinal; telefones locais de 8 a 11 dígitos não ganham um país.
 */
export function hasCountryCode(number: string): boolean {
  return number.trim().startsWith('+') || digitsOf(number).length >= 12;
}

function brazilian(digits: string): string {
  const area = digits.slice(0, 2);
  const rest = digits.slice(2);
  return `(${area}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
}

/** Exibição: com DDI sai em E.164 legível, sem DDI sai no formato local. */
export function formatPhone(number: string): string {
  const digits = digitsOf(number);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13))
    return `+55 ${brazilian(digits.slice(2))}`;
  if (hasCountryCode(number)) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return brazilian(digits);
  if (digits.length > 4)
    return `${digits.slice(0, digits.length - 4)}-${digits.slice(-4)}`;
  return digits;
}

/** Destino do link de ligação. Sem DDI o "+" seria uma afirmação falsa. */
export function phoneE164(number: string): string {
  const digits = digitsOf(number);
  return hasCountryCode(number) ? `+${digits}` : digits;
}

const NETWORKS: { key: string; label: string; hosts: string[] }[] = [
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
  { key: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.com'] },
  { key: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com'] },
  { key: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  { key: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
  { key: 'x', label: 'X', hosts: ['x.com', 'twitter.com'] },
  { key: 'threads', label: 'Threads', hosts: ['threads.net', 'threads.com'] },
  {
    key: 'pinterest',
    label: 'Pinterest',
    hosts: ['pinterest.com', 'pinterest.com.br'],
  },
];

export type SocialLink = { url: string; key: string; label: string };

/** Rede pelo host, com o próprio domínio como rótulo do que não é conhecido. */
export function socialNetwork(url: string): SocialLink {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return { url, key: 'site', label: 'Site' };
  }
  const found = NETWORKS.find((network) =>
    network.hosts.some((known) => host === known || host.endsWith(`.${known}`)),
  );
  return found
    ? { url, key: found.key, label: found.label }
    : { url, key: 'site', label: host };
}

export function socialLinks(contacts: Contacts): SocialLink[] {
  return contacts.social.map(socialNetwork);
}

/** Mesmo embed sem chave que o bloco media.map já usa. */
export function mapsEmbedUrl(address: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&hl=pt-BR`;
}

export function mapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/** Resumo para o prompt: o agente precisa saber o que já é renderizado. */
export function contactsSummary(
  contacts: Contacts,
  email?: string | null,
): string {
  const rows: string[] = [];
  if (contacts.phones.length)
    rows.push(
      `Telefones: ${contacts.phones
        .map(
          (phone) =>
            `${formatPhone(phone.number)}${phone.whatsapp ? ' (WhatsApp)' : ''}`,
        )
        .join('; ')}`,
    );
  if (email) rows.push(`E-mail: ${email}`);
  if (contacts.addresses.length)
    rows.push(
      `Endereços: ${contacts.addresses
        .map((address) =>
          address.label ? `${address.label}: ${address.text}` : address.text,
        )
        .join(' | ')}`,
    );
  if (contacts.social.length)
    rows.push(
      `Redes: ${socialLinks(contacts)
        .map((link) => `${link.label} ${link.url}`)
        .join('; ')}`,
    );
  return rows.join('\n');
}
