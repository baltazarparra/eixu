import { z } from 'zod';

/**
 * Perfil de rede social informado no briefing. O agente deduzia a empresa a
 * partir de uma URL que nunca abria; agora a leitura é explícita e o estado
 * bloqueado aparece como lacuna, não como conteúdo.
 */
export type SocialNetwork = 'instagram' | 'linkedin';

export type NormalizedSocial = {
  url: string;
  network: SocialNetwork;
  handle: string;
};

const INSTAGRAM_HANDLE = /^[a-z0-9._]{1,30}$/;
const LINKEDIN_SEGMENT = /^[a-z0-9\-_%.]{1,100}$/;
// Caminhos do Instagram que são funcionalidade do site, não perfil.
const INSTAGRAM_RESERVED = new Set([
  'p',
  'reel',
  'reels',
  'stories',
  'explore',
  'accounts',
  'direct',
  'tv',
  'about',
  'developer',
  'legal',
]);

function instagramFrom(handle: string): NormalizedSocial | null {
  const clean = handle.trim().replace(/^@/, '').toLowerCase();
  if (!INSTAGRAM_HANDLE.test(clean) || INSTAGRAM_RESERVED.has(clean))
    return null;
  return {
    url: `https://www.instagram.com/${clean}/`,
    network: 'instagram',
    handle: clean,
  };
}

/**
 * Aceita "@perfil", "perfil", ou a URL do Instagram/LinkedIn com qualquer
 * sufixo e query. Qualquer outro host devolve null: o campo é de rede social,
 * e o site do cliente continua indo em Referências.
 */
export function normalizeSocialUrl(input: string): NormalizedSocial | null {
  const value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value) && !value.includes('/'))
    return instagramFrom(value);

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (host === 'instagram.com' || host.endsWith('.instagram.com'))
    return segments.length ? instagramFrom(segments[0]) : null;

  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    const [kind, slug] = segments;
    if (
      (kind !== 'company' && kind !== 'in' && kind !== 'school') ||
      !slug ||
      !LINKEDIN_SEGMENT.test(slug.toLowerCase())
    )
      return null;
    const handle = slug.toLowerCase();
    return {
      url: `https://www.linkedin.com/${kind}/${handle}/`,
      network: 'linkedin',
      handle,
    };
  }
  return null;
}

export const socialProfileSchema = z.object({
  url: z.url(),
  network: z.enum(['instagram', 'linkedin']),
  status: z.enum(['lendo', 'ok', 'inacessivel']),
  readId: z.uuid().optional(),
  motivo: z.string().max(200).optional(),
  name: z.string().max(120).optional(),
  handle: z.string().max(60).optional(),
  bio: z.string().max(300).optional(),
  followers: z.string().max(40).optional(),
  avatarUrl: z.url().optional(),
  avatarHash: z.string().max(64).optional(),
  avatarNotes: z.string().max(300).optional(),
  lidoEm: z.string(),
});

export type SocialProfile = z.infer<typeof socialProfileSchema>;

export function parseSocialRecord(value: unknown): SocialProfile | null {
  const parsed = socialProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const NETWORK_LABEL: Record<SocialNetwork, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
};

/**
 * Uma linha só sobre a rede social no prompt: o que foi lido, ou o que ficou
 * pendente. A URL crua ao lado do perfil lido era contexto repetido.
 */
export function socialSummary(value: unknown, intakeUrl = ''): string {
  const social = parseSocialRecord(value);
  const pending = !social || social.status === 'lendo';
  if (pending)
    return intakeUrl
      ? `Rede social informada: ${intakeUrl}. A leitura ainda não terminou; não deduza conteúdo dela.`
      : '';
  const label = NETWORK_LABEL[social.network];
  const who = social.handle ? `@${social.handle}` : social.url;
  if (social.status !== 'ok') {
    const motivo = social.motivo?.replace(/\.\s*$/, '');
    return `Rede social ${who} (${label}): não foi possível ler${motivo ? ` — ${motivo}` : ''}. Trate como lacuna; não deduza conteúdo dela.`;
  }
  return [
    `Rede social lida (${label}): ${social.name ?? who}`,
    social.followers ? `, ${social.followers}` : '',
    '.',
    social.bio ? ` Bio: "${social.bio}".` : '',
    social.avatarNotes ? ` Avatar: ${social.avatarNotes}` : '',
  ]
    .join('')
    .trim();
}
