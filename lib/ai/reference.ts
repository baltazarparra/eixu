import { abortable } from '@/lib/async/abort';
import { lookup } from 'node:dns/promises';
import type { ReferenceVisual } from '@/lib/references/read';
import { publicResource } from '@/lib/references/network';

/** Redes que nunca devem ser alcançadas por uma URL vinda do chat. */
export function isPrivateAddress(address: string, family: number): boolean {
  if (family === 6)
    return /^(::1|fe80:|fc|fd)/i.test(address) || address === '::';
  const [a, b] = address.split('.').map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Domínios que servem uma parede de login para quem não está autenticado. */
const LOGIN_WALLED = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  'tiktok.com',
  'linkedin.com',
  'x.com',
  'twitter.com',
];

export type Reference = {
  url: string;
  status: 'ok' | 'inacessivel';
  motivo?: string;
  titulo?: string;
  descricao?: string;
  texto?: string;
  telefones?: string[];
  whatsapp?: string[];
  lidoEm: string;
  visual?: ReferenceVisual;
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  aacute: 'á',
  agrave: 'à',
  acirc: 'â',
  atilde: 'ã',
  auml: 'ä',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  euml: 'ë',
  iacute: 'í',
  icirc: 'î',
  oacute: 'ó',
  ocirc: 'ô',
  otilde: 'õ',
  ouml: 'ö',
  uacute: 'ú',
  ucirc: 'û',
  uuml: 'ü',
  ccedil: 'ç',
  ntilde: 'ñ',
  ordf: 'ª',
  ordm: 'º',
  deg: '°',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

function decodeOnce(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) => {
      const value = ENTITIES[name.toLowerCase()];
      if (!value) return ' ';
      // Nomes em maiúscula representam a letra maiúscula: &Ccedil; é Ç.
      return /^[A-Z]/.test(name) ? value.toUpperCase() : value;
    });
}

export function decode(text: string): string {
  // Segunda passada porque `&amp;#39;` só vira `&#39;` depois que `&amp;` cai:
  // o LinkedIn entrega a bio codificada duas vezes.
  const once = decodeOnce(text);
  const twice = /&#x?\d/i.test(once) ? decodeOnce(once) : once;
  return twice.replace(/\s+/g, ' ').trim();
}

function strip(html: string): string {
  return decode(html.replace(/<[^>]*>/g, ' '));
}

/**
 * Conteúdo de uma meta tag. A aspa de fechamento vem por backreference, senão
 * uma bio com apóstrofo é cortada no primeiro `'`. O conteúdo não pode conter
 * `>`: sem isso o padrão atravessa tags e captura metade do documento.
 */
export function metaContent(html: string, name: string): string | undefined {
  const value = `("|')((?:(?!\\1)[^>])*)\\1`;
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=${value}`,
    'i',
  );
  const alt = new RegExp(
    `<meta[^>]+content=${value}[^>]*(?:name|property)=["']${name}["']`,
    'i',
  );
  const found = pattern.exec(html) ?? alt.exec(html);
  return found ? decode(found[2]) : undefined;
}

export function stripNoise(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

export function extractReference(url: string, html: string): Reference {
  const clean = stripNoise(html);
  const meta = (name: string) => metaContent(clean, name);
  const titulo =
    decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(clean)?.[1] ?? '') ||
    meta('og:title');
  const descricao = meta('description') ?? meta('og:description');
  const headings = [...clean.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => strip(match[1]))
    .filter((text) => text.length > 2 && text.length < 140);
  const paragraphs = [...clean.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => strip(match[1]))
    .filter((text) => text.length > 40);
  const telefones = [
    ...new Set(
      (clean.match(/\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/g) ?? []).map((t) =>
        t.trim(),
      ),
    ),
  ].slice(0, 4);
  const whatsapp = [
    ...new Set(
      clean.match(/(?:wa\.me|api\.whatsapp\.com)\/[^"'\s<>]+/gi) ?? [],
    ),
  ].slice(0, 2);
  const texto = [...new Set([...headings, ...paragraphs])]
    .join(' | ')
    .slice(0, 1200);
  return {
    url,
    status: 'ok',
    lidoEm: new Date().toISOString(),
    ...(titulo ? { titulo: titulo.slice(0, 160) } : {}),
    ...(descricao ? { descricao: descricao.slice(0, 300) } : {}),
    ...(texto ? { texto } : {}),
    ...(telefones.length ? { telefones } : {}),
    ...(whatsapp.length ? { whatsapp } : {}),
  };
}

const MAX_BYTES = 1_500_000;

/**
 * Lê uma referência informada pelo operador. Quem não consegue ler diz que não
 * conseguiu: o resultado anterior era o agente deduzir a empresa inteira a
 * partir de uma URL de rede social que ele nunca abriu.
 */
export async function readReference(
  url: string,
  deps: {
    fetch?: typeof globalThis.fetch;
    lookup?: typeof lookup;
    timeoutMs?: number;
  } = {},
): Promise<Reference> {
  const signal = AbortSignal.timeout(deps.timeoutMs ?? 20_000);
  const request = deps.fetch ?? globalThis.fetch;
  const resolve = deps.lookup ?? lookup;
  const lidoEm = new Date().toISOString();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, status: 'inacessivel', motivo: 'URL inválida', lidoEm };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    return {
      url,
      status: 'inacessivel',
      motivo: 'Protocolo não suportado',
      lidoEm,
    };
  const host = parsed.hostname.toLowerCase();
  if (
    LOGIN_WALLED.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    )
  )
    return {
      url,
      status: 'inacessivel',
      motivo:
        'A rede social exige login e não entrega o conteúdo. Peça ao operador os dados que essa página traria.',
      lidoEm,
    };
  try {
    if (deps.lookup || deps.fetch) {
      const address = await abortable(resolve(host, { all: false }), signal);
      if (isPrivateAddress(address.address, address.family))
        return {
          url,
          status: 'inacessivel',
          motivo: 'Endereço de rede interna',
          lidoEm,
        };
    }
  } catch {
    return {
      url,
      status: 'inacessivel',
      motivo: 'Domínio não resolvido',
      lidoEm,
    };
  }
  try {
    const response = deps.fetch
      ? await abortable(
          request(parsed.toString(), {
            redirect: 'follow',
            signal,
            headers: {
              'user-agent': 'EIXU-SiteAgent/1.0 (+https://eixu.com.br)',
            },
          }),
          signal,
        )
      : await readPublicHtml(parsed.toString(), signal);
    if (!response.ok)
      return {
        url,
        status: 'inacessivel',
        motivo: `A página respondeu ${response.status}`,
        lidoEm,
      };
    const type = response.headers.get('content-type') ?? '';
    if (!/text\/html|text\/plain|application\/xhtml/i.test(type))
      return {
        url,
        status: 'inacessivel',
        motivo: `Conteúdo ${type || 'desconhecido'}`,
        lidoEm,
      };
    const body = await abortable(response.text(), signal);
    return extractReference(parsed.toString(), body.slice(0, MAX_BYTES));
  } catch (error) {
    return {
      url,
      status: 'inacessivel',
      motivo:
        error instanceof Error && error.name === 'TimeoutError'
          ? 'Tempo esgotado'
          : 'Falha ao buscar a página',
      lidoEm,
    };
  }
}

/** A leitura textual usa a mesma fronteira pública da captura, inclusive redirects. */
async function readPublicHtml(
  url: string,
  signal: AbortSignal,
): Promise<Response> {
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    const resource = await abortable(publicResource(current, signal), signal);
    if (
      [301, 302, 303, 307, 308].includes(resource.status) &&
      resource.headers.location
    ) {
      current = new URL(resource.headers.location, current).toString();
      continue;
    }
    return new Response(
      [204, 205, 304].includes(resource.status)
        ? null
        : new Uint8Array(resource.body),
      { status: resource.status, headers: resource.headers },
    );
  }
  throw new Error('Redirecionamentos demais');
}
