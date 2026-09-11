import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { del, put } from '@vercel/blob';
import { generateText } from 'ai';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { decode, isPrivateAddress, metaContent, stripNoise } from '@/lib/ai/reference';
import type { Reference } from '@/lib/ai/reference';
import {
  normalizeSocialUrl,
  parseSocialRecord,
  type NormalizedSocial,
  type SocialNetwork,
  type SocialProfile,
} from '@/lib/social-profile';

const USER_AGENT = 'EIXU-SiteAgent/1.0 (+https://eixu.com.br)';
const MAX_BYTES = 1_500_000;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MODEL = () =>
  process.env.EIXU_CRITIC_MODEL ||
  process.env.EIXU_MODEL ||
  'anthropic/claude-opus-4.5';

export type SocialDeps = {
  fetch?: typeof globalThis.fetch;
  lookup?: typeof lookup;
  describe?: (png: Uint8Array) => Promise<string | undefined>;
  now?: () => Date;
};

export type SocialRead = SocialProfile & { sourceImage?: string };

const BLOCKED_MARKERS =
  /(challenge|checkpoint_required|authwall|"loginForm"|accounts\/login)/i;

function clamp(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : undefined;
}

/**
 * Nome, bio e avatar a partir das meta tags que a rede entrega a robôs. Sem
 * OG, o que voltou é a casca de login: isso é estado bloqueado, não perfil
 * vazio, e o painel precisa dizer isso ao operador.
 */
export function parseSocialProfile(
  normalized: NormalizedSocial,
  html: string,
  lidoEm: string,
): SocialRead {
  const clean = stripNoise(html);
  const base = {
    url: normalized.url,
    network: normalized.network,
    handle: normalized.handle,
    lidoEm,
  };
  const blocked = (motivo: string): SocialRead => ({
    ...base,
    status: 'inacessivel',
    motivo,
  });
  const title = metaContent(clean, 'og:title');
  const description =
    metaContent(clean, 'description') ?? metaContent(clean, 'og:description');
  const image = metaContent(clean, 'og:image');

  if (!title)
    return blocked(
      normalized.network === 'instagram'
        ? 'O Instagram devolveu a tela de login em vez do perfil.'
        : 'O LinkedIn devolveu a parede de login em vez da página.',
    );
  if (!description && BLOCKED_MARKERS.test(clean))
    return blocked('A rede social pediu verificação e não entregou o perfil.');

  if (normalized.network === 'instagram') {
    const name = clamp(title.split(' (@')[0], 120);
    // "269M Followers, 195 Following, 32K Posts - Nome on Instagram: "bio""
    // A bio só aparece nesse template; o outro traz só a contagem.
    const followers = clamp(
      /^([\d.,]+\s*(?:[KMB]|mil|mi|bi)?)\s+(?:Followers|seguidores)/i.exec(
        description ?? '',
      )?.[1],
      40,
    );
    const bio = clamp(
      /n[oa]?\s*Instagram:\s*[“"]([\s\S]*)[”"]\s*$/i.exec(description ?? '')?.[1],
      300,
    );
    return {
      ...base,
      status: 'ok',
      ...(name ? { name } : {}),
      ...(followers ? { followers: `${followers} seguidores` } : {}),
      ...(bio ? { bio } : {}),
      ...(image ? { sourceImage: decode(image) } : {}),
    };
  }

  const name = clamp(title.replace(/\s*\|\s*LinkedIn\s*$/i, ''), 120);
  // "Nome | 259,292 followers on LinkedIn. tagline" e a variante em português.
  const followers = clamp(
    /\|\s*([\d.,]+)\s+(?:followers|seguidores)/i.exec(description ?? '')?.[1],
    40,
  );
  const bio = clamp(
    /(?:on|no)\s+LinkedIn\.\s*([\s\S]*)$/i.exec(description ?? '')?.[1] ??
      description,
    300,
  );
  return {
    ...base,
    status: 'ok',
    ...(name ? { name } : {}),
    ...(followers ? { followers: `${followers} seguidores` } : {}),
    ...(bio ? { bio } : {}),
    ...(image ? { sourceImage: decode(image) } : {}),
  };
}

/** Melhor esforço: nunca lança, e um bloqueio volta com o motivo real. */
export async function readSocialProfile(
  normalized: NormalizedSocial,
  deps: SocialDeps = {},
): Promise<SocialRead> {
  const request = deps.fetch ?? globalThis.fetch;
  const lidoEm = (deps.now ?? (() => new Date()))().toISOString();
  const base = {
    url: normalized.url,
    network: normalized.network,
    handle: normalized.handle,
    lidoEm,
  };
  try {
    const response = await request(normalized.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      // Sem accept-language: em português as redes trocam o texto por um
      // resumo sem bio ("Veja as fotos e vídeos de…"). Medido nas duas.
      headers: { 'user-agent': USER_AGENT },
    });
    if (response.status === 999 || response.status === 403 || response.status === 429)
      return {
        ...base,
        status: 'inacessivel',
        motivo:
          normalized.network === 'linkedin'
            ? 'O LinkedIn bloqueia leitura de perfis pessoais; use a página da empresa.'
            : 'A rede social recusou a leitura automática deste perfil.',
      };
    if (!response.ok)
      return {
        ...base,
        status: 'inacessivel',
        motivo: `O perfil respondeu ${response.status}.`,
      };
    const body = await response.text();
    return parseSocialProfile(normalized, body.slice(0, MAX_BYTES), lidoEm);
  } catch (error) {
    return {
      ...base,
      status: 'inacessivel',
      motivo:
        error instanceof Error && error.name === 'TimeoutError'
          ? 'Tempo esgotado ao abrir o perfil.'
          : 'Falha ao abrir o perfil.',
    };
  }
}

/**
 * O avatar vem de um CDN arbitrário lido do HTML, então ele passa pelo mesmo
 * guard de rede das referências. A URL assinada expira: o que fica é a cópia
 * no Blob do cliente.
 */
async function downloadAvatar(
  url: string,
  deps: SocialDeps,
): Promise<Uint8Array | null> {
  const request = deps.fetch ?? globalThis.fetch;
  const resolve = deps.lookup ?? lookup;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  try {
    const address = await resolve(parsed.hostname, { all: false });
    if (isPrivateAddress(address.address, address.family)) return null;
    const response = await request(parsed.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': USER_AGENT },
    });
    if (!response.ok) return null;
    if (!/^image\//i.test(response.headers.get('content-type') ?? '')) return null;
    const raw = new Uint8Array(await response.arrayBuffer());
    if (raw.byteLength > MAX_AVATAR_BYTES) return null;
    const png = await sharp(Buffer.from(raw))
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return new Uint8Array(png);
  } catch {
    return null;
  }
}

/** Descrição curta do avatar, para marca e guia de imagem. */
export async function describeAvatar(
  png: Uint8Array,
): Promise<string | undefined> {
  try {
    const { text } = await generateText({
      model: MODEL(),
      maxRetries: 1,
      maxOutputTokens: 200,
      instructions:
        'Você descreve a foto de perfil de um negócio para orientar a direção visual do site dele. Responda em português do Brasil, em no máximo 300 caracteres, numa frase corrida: o que a imagem mostra (logotipo, pessoa, produto, fachada), cores dominantes e estilo. Não invente nome, slogan ou texto que não esteja legível. Sem listas e sem preâmbulo.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'file' as const, data: png, mediaType: 'image/png' },
            { type: 'text' as const, text: 'Descreva esta foto de perfil.' },
          ],
        },
      ],
    });
    return clamp(text, 300);
  } catch {
    return undefined;
  }
}

async function saveSocial(
  tenantId: string,
  social: SocialProfile,
): Promise<SocialProfile> {
  // Merge: o brief guarda também intake, fontes e progresso, e um turno de
  // chat pode estar escrevendo ao mesmo tempo.
  await db()`
    update tenants
    set brief = brief || jsonb_build_object('social', ${JSON.stringify(social)}::jsonb),
        updated_at = now()
    where id = ${tenantId}
  `;
  return social;
}

export async function markSocialReading(
  tenantId: string,
  normalized: NormalizedSocial,
): Promise<SocialProfile> {
  return saveSocial(tenantId, {
    url: normalized.url,
    network: normalized.network,
    handle: normalized.handle,
    status: 'lendo',
    lidoEm: new Date().toISOString(),
  });
}

async function currentSocial(tenantId: string): Promise<SocialProfile | null> {
  const rows = (await db()`
    select brief->'social' as social from tenants where id = ${tenantId} limit 1
  `) as { social: unknown }[];
  return parseSocialRecord(rows[0]?.social);
}

export async function clearSocialProfile(tenantId: string): Promise<void> {
  const previous = await currentSocial(tenantId);
  if (previous?.avatarUrl) await del(previous.avatarUrl).catch(() => undefined);
  await db()`
    update tenants set brief = brief - 'social', updated_at = now()
    where id = ${tenantId}
  `;
}

/**
 * Lê o perfil, copia o avatar para o Blob do cliente e grava o resultado.
 * Termina sempre num estado final: "lendo" preso na tela seria pior que um
 * bloqueio declarado.
 */
export async function syncSocialProfile(
  tenant: { id: string; slug: string },
  socialUrl: string,
  deps: SocialDeps = {},
): Promise<SocialProfile> {
  const normalized = normalizeSocialUrl(socialUrl);
  if (!normalized) {
    await clearSocialProfile(tenant.id);
    throw new Error('Perfil de rede social inválido.');
  }
  try {
    const previous = await currentSocial(tenant.id);
    const read = await readSocialProfile(normalized, deps);
    const { sourceImage, ...profile } = read;
    let social: SocialProfile = profile;

    if (read.status === 'ok' && sourceImage) {
      const png = await downloadAvatar(sourceImage, deps);
      if (png) {
        const hash = createHash('sha256').update(png).digest('hex').slice(0, 32);
        const reusable =
          previous?.avatarHash === hash && previous.avatarUrl
            ? previous
            : undefined;
        if (reusable) {
          social = {
            ...social,
            avatarUrl: reusable.avatarUrl,
            avatarHash: hash,
            ...(reusable.avatarNotes
              ? { avatarNotes: reusable.avatarNotes }
              : {}),
          };
        } else {
          const blob = await put(
            `tenants/${tenant.slug}/social/avatar-${Date.now()}.png`,
            Buffer.from(png),
            { access: 'public', addRandomSuffix: false, contentType: 'image/png' },
          );
          const notes = deps.describe
            ? await deps.describe(png)
            : await describeAvatar(png);
          social = {
            ...social,
            avatarUrl: blob.url,
            avatarHash: hash,
            ...(notes ? { avatarNotes: notes } : {}),
          };
          if (previous?.avatarUrl && previous.avatarUrl !== blob.url)
            await del(previous.avatarUrl).catch(() => undefined);
        }
      }
    }
    return await saveSocial(tenant.id, social);
  } catch (error) {
    return await saveSocial(tenant.id, {
      url: normalized.url,
      network: normalized.network,
      handle: normalized.handle,
      status: 'inacessivel',
      motivo:
        error instanceof Error
          ? `Falha ao ler o perfil: ${error.message.slice(0, 140)}`
          : 'Falha ao ler o perfil.',
      lidoEm: new Date().toISOString(),
    });
  }
}

/** Converte o perfil no formato que a ferramenta de referência já devolve. */
export function referenceFromSocial(social: SocialProfile): Reference {
  const label: Record<SocialNetwork, string> = {
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
  };
  if (social.status !== 'ok')
    return {
      url: social.url,
      status: 'inacessivel',
      motivo:
        social.motivo ??
        `O ${label[social.network]} não entregou o conteúdo deste perfil.`,
      lidoEm: social.lidoEm,
    };
  const texto = [
    social.bio,
    social.followers,
    social.avatarNotes ? `Avatar: ${social.avatarNotes}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
  return {
    url: social.url,
    status: 'ok',
    lidoEm: social.lidoEm,
    ...(social.name ? { titulo: social.name } : {}),
    ...(social.bio ? { descricao: social.bio } : {}),
    ...(texto ? { texto } : {}),
  };
}
