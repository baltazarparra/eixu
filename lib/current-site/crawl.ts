import { decode, metaContent, stripNoise } from '@/lib/ai/reference';
import { publicResource, type PublicResource } from '@/lib/references/network';
import { renderCurrentSitePages } from './render';
import {
  CURRENT_SITE_MAX_PAGES,
  type CurrentSiteImageCandidate,
  type CurrentSiteLink,
  type CurrentSitePage,
} from './schema';

const MAX_HTML_BYTES = 1_500_000;
const MAX_TOTAL_HTML_BYTES = 18_000_000;
const MAX_TOTAL_TEXT = 60_000;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const DOCUMENT_EXT = /\.(?:pdf|docx?|xlsx?|pptx?|zip)(?:$|[?#])/i;
const NON_PAGE_EXT =
  /\.(?:avif|bmp|css|gif|ico|jpe?g|js|json|mp3|mp4|png|svg|webm|webp|woff2?)(?:$|[?#])/i;
const SKIP_PATH =
  /\/(?:admin|login|log-in|wp-admin|carrinho|cart|checkout|minha-conta|account|search|busca|calendar)(?:\/|$)/i;
const SOCIAL_HOST =
  /(^|\.)(facebook|instagram|linkedin|tiktok|twitter|x|youtube)\.com$/i;

type Reader = (url: string) => Promise<PublicResource>;
type Renderer = typeof renderCurrentSitePages;

export type CurrentSiteCrawl = {
  url: string;
  finalUrl: string;
  pages: CurrentSitePage[];
  links: CurrentSiteLink[];
  images: CurrentSiteImageCandidate[];
  renderedPages: number;
  limits: string[];
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function attr(tag: string, name: string): string {
  const found = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  ).exec(tag);
  return decode(found?.[1] ?? found?.[2] ?? found?.[3] ?? '');
}

function plain(html: string): string {
  return decode(html.replace(/<[^>]*>/g, ' '));
}

function absoluteHttp(value: string, base: string): string | null {
  if (!value || /^(?:data|blob|javascript):/i.test(value)) return null;
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function pageUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const key of Array.from(url.searchParams.keys()))
    if (/^(?:utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.toString();
}

function imageRole(url: string, alt: string, width?: number, height?: number) {
  const description = `${url} ${alt}`.toLowerCase();
  if (/logo|logotipo|brandmark|marca\b/.test(description))
    return 'logo' as const;
  if (/icon|ícone|favicon|sprite|badge|selo/.test(description))
    return 'unknown' as const;
  if ((width ?? 0) >= 480 || (height ?? 0) >= 360) return 'photo' as const;
  return 'unknown' as const;
}

function srcsetUrls(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function structuredData(html: string) {
  const rows: CurrentSitePage['structuredData'] = [];
  const images: string[] = [];
  const sameAs: string[] = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const root = JSON.parse(decode(match[1]));
      const visit = (value: unknown, depth = 0) => {
        if (depth > 6 || rows.length >= 20 || value === null) return;
        if (Array.isArray(value)) {
          for (const child of value) visit(child, depth + 1);
          return;
        }
        if (typeof value !== 'object') return;
        const item = value as Record<string, unknown>;
        const string = (key: string) =>
          typeof item[key] === 'string' ? decode(item[key] as string) : '';
        const address =
          typeof item.address === 'string'
            ? decode(item.address)
            : item.address && typeof item.address === 'object'
              ? Object.values(item.address as Record<string, unknown>)
                  .filter((part): part is string => typeof part === 'string')
                  .map(decode)
                  .join(', ')
              : '';
        const type = Array.isArray(item['@type'])
          ? item['@type'].filter((part) => typeof part === 'string').join(', ')
          : string('@type');
        if (
          type ||
          string('name') ||
          string('description') ||
          string('telephone') ||
          string('email') ||
          address
        )
          rows.push({
            type: type.slice(0, 120),
            name: string('name').slice(0, 240),
            description: string('description').slice(0, 600),
            telephone: string('telephone').slice(0, 80),
            email: string('email').slice(0, 320),
            address: address.slice(0, 500),
            url: string('url').slice(0, 2000),
          });
        const collectUrls = (value: unknown, target: string[], depth = 0) => {
          if (depth > 6) return;
          if (typeof value === 'string') target.push(value);
          else if (Array.isArray(value))
            for (const child of value) collectUrls(child, target, depth + 1);
          else if (value && typeof value === 'object') {
            const record = value as Record<string, unknown>;
            collectUrls(record.url ?? record.contentUrl, target, depth + 1);
          }
        };
        for (const key of ['image', 'logo', 'thumbnailUrl'])
          collectUrls(item[key], images);
        collectUrls(item.sameAs, sameAs);
        for (const child of Object.values(item))
          if (child && typeof child === 'object') visit(child, depth + 1);
      };
      visit(root);
    } catch {
      // JSON-LD inválido não impede a leitura do HTML visível.
    }
  }
  return { rows, images: unique(images), sameAs: unique(sameAs) };
}

export function extractCurrentSitePage(
  url: string,
  html: string,
  allowedOrigin: string,
  rendered = false,
): CurrentSitePage {
  const clean = stripNoise(html);
  const title =
    plain(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(clean)?.[1] ?? '') ||
    metaContent(clean, 'og:title') ||
    '';
  const description =
    metaContent(clean, 'description') ??
    metaContent(clean, 'og:description') ??
    '';
  const canonicalValue = [...clean.matchAll(/<link\b[^>]*>/gi)].find((match) =>
    /\brel=["'][^"']*canonical/i.test(match[0]),
  );
  const canonical = canonicalValue
    ? absoluteHttp(attr(canonicalValue[0], 'href'), url)
    : null;
  const headings = unique(
    [...clean.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
      .map((match) => plain(match[1]))
      .filter((value) => value.length >= 2 && value.length <= 240),
  ).slice(0, 40);
  const fragments = [
    ...clean.matchAll(
      /<(p|li|blockquote|dt|dd|address|figcaption|button|label)[^>]*>([\s\S]*?)<\/\1>/gi,
    ),
  ]
    .map((match) => plain(match[2]))
    .filter((value) => value.length >= 2 && value.length <= 1200);
  let text = unique([...headings, ...fragments]).join('\n');
  if (text.length < 400) text = plain(clean).slice(0, 8000);
  text = text.slice(0, 8000);

  const links: CurrentSiteLink[] = [];
  for (const match of clean.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const href = attr(match[0], 'href');
    if (!href || /^javascript:/i.test(href)) continue;
    const label = plain(match[0]).slice(0, 240);
    let resolved = href;
    let kind: CurrentSiteLink['kind'];
    if (/^mailto:/i.test(href)) kind = 'email';
    else if (/^tel:/i.test(href)) kind = 'phone';
    else {
      const absolute = absoluteHttp(href, url);
      if (!absolute) continue;
      resolved = absolute;
      const target = new URL(absolute);
      if (/wa\.me$|whatsapp\.com$/i.test(target.hostname)) kind = 'whatsapp';
      else if (SOCIAL_HOST.test(target.hostname)) kind = 'social';
      else if (DOCUMENT_EXT.test(target.pathname)) kind = 'document';
      else kind = target.origin === allowedOrigin ? 'internal' : 'external';
    }
    links.push({ url: resolved.slice(0, 2000), label, kind, pageUrl: url });
  }

  const images: CurrentSiteImageCandidate[] = [];
  const pushImage = (raw: string, tag = '', forcedAlt = '') => {
    const source = absoluteHttp(raw, url);
    if (!source || images.some((image) => image.url === source)) return;
    const alt = (forcedAlt || attr(tag, 'alt') || attr(tag, 'title')).slice(
      0,
      300,
    );
    const width = Number.parseInt(attr(tag, 'width'), 10) || undefined;
    const height = Number.parseInt(attr(tag, 'height'), 10) || undefined;
    images.push({
      url: source,
      pageUrl: url,
      alt,
      context: alt.slice(0, 400),
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      role: imageRole(source, alt, width, height),
    });
  };
  for (const match of clean.matchAll(/<(?:img|source|video)\b[^>]*>/gi)) {
    const tag = match[0];
    for (const name of [
      'src',
      'poster',
      'data-src',
      'data-lazy-src',
      'data-original',
      'data-eixu-current-src',
      'data-eixu-background-src',
    ])
      pushImage(attr(tag, name), tag);
    for (const name of ['srcset', 'data-srcset'])
      for (const candidate of srcsetUrls(attr(tag, name)))
        pushImage(candidate, tag);
  }
  const socialImage = metaContent(clean, 'og:image');
  if (socialImage)
    pushImage(socialImage, '', metaContent(clean, 'og:image:alt') ?? '');
  for (const match of clean.matchAll(/<link\b[^>]*>/gi))
    if (/\brel=["'][^"']*image_src/i.test(match[0]))
      pushImage(attr(match[0], 'href'));
  for (const match of clean.matchAll(
    /(?:background-image\s*:|\bstyle=["'][^"']*)[^;"']*url\((['"]?)([^)'"\s]+)\1\)/gi,
  ))
    pushImage(match[2]);

  const structured = structuredData(html);
  const data = structured.rows;
  for (const value of structured.images) pushImage(value);
  for (const value of structured.sameAs) {
    const resolved = absoluteHttp(value, url);
    if (!resolved) continue;
    const target = new URL(resolved);
    links.push({
      url: resolved,
      label: '',
      kind: SOCIAL_HOST.test(target.hostname) ? 'social' : 'external',
      pageUrl: url,
    });
  }
  const emails = unique([
    ...(text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) ?? []),
    ...links
      .filter((link) => link.kind === 'email')
      .map((link) => link.url.replace(/^mailto:/i, '').split('?')[0]),
    ...data.map((item) => item.email).filter(Boolean),
  ]).slice(0, 20);
  const phones = unique([
    ...(text.match(
      /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/g,
    ) ?? []),
    ...links
      .filter((link) => link.kind === 'phone')
      .map((link) => link.url.replace(/^tel:/i, '')),
    ...data.map((item) => item.telephone).filter(Boolean),
  ]).slice(0, 20);
  const addresses = unique([
    ...[...clean.matchAll(/<address[^>]*>([\s\S]*?)<\/address>/gi)].map(
      (match) => plain(match[1]),
    ),
    ...data.map((item) => item.address).filter(Boolean),
  ]).slice(0, 12);

  return {
    url,
    title: title.slice(0, 240),
    description: description.slice(0, 500),
    ...(canonical ? { canonical } : {}),
    headings,
    text,
    links: links
      .filter(
        (link, index) =>
          links.findIndex(
            (other) => other.url === link.url && other.kind === link.kind,
          ) === index,
      )
      .slice(0, 160),
    images: images.slice(0, 100),
    emails,
    phones,
    addresses,
    structuredData: data,
    rendered,
  };
}

function mergePage(
  raw: CurrentSitePage,
  rendered: CurrentSitePage,
): CurrentSitePage {
  const links = [...raw.links, ...rendered.links].filter(
    (link, index, all) =>
      all.findIndex(
        (other) => other.url === link.url && other.kind === link.kind,
      ) === index,
  );
  const images = [...raw.images, ...rendered.images].filter(
    (image, index, all) =>
      all.findIndex((other) => other.url === image.url) === index,
  );
  return {
    ...raw,
    title: rendered.title || raw.title,
    description: rendered.description || raw.description,
    canonical: rendered.canonical ?? raw.canonical,
    headings: unique([...raw.headings, ...rendered.headings]).slice(0, 40),
    text: unique([raw.text, rendered.text]).join('\n').slice(0, 8000),
    links: links.slice(0, 160),
    images: images.slice(0, 100),
    emails: unique([...raw.emails, ...rendered.emails]).slice(0, 20),
    phones: unique([...raw.phones, ...rendered.phones]).slice(0, 20),
    addresses: unique([...raw.addresses, ...rendered.addresses]).slice(0, 12),
    structuredData: [...raw.structuredData, ...rendered.structuredData].slice(
      0,
      20,
    ),
    rendered: true,
  };
}

async function readWithRedirects(
  input: string,
  request: Reader,
  allowedOrigin?: string,
) {
  let current = input;
  for (let hop = 0; hop < 6; hop++) {
    if (allowedOrigin && new URL(current).origin !== allowedOrigin)
      throw new Error('Redirecionamento para fora do domínio');
    const resource = await request(current);
    if (REDIRECTS.has(resource.status) && resource.headers.location) {
      current = new URL(resource.headers.location, current).toString();
      continue;
    }
    return { ...resource, finalUrl: current };
  }
  throw new Error('Redirecionamentos demais');
}

function htmlResource(resource: Awaited<ReturnType<typeof readWithRedirects>>) {
  const contentType = resource.headers['content-type'] ?? '';
  return (
    resource.status >= 200 &&
    resource.status < 300 &&
    /text\/html|application\/xhtml/i.test(contentType)
  );
}

function sitemapLocations(xml: string, base: string): string[] {
  return unique(
    [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)]
      .map((match) => absoluteHttp(decode(match[1]), base))
      .filter((value): value is string => Boolean(value)),
  );
}

async function sitemapPages(
  rootUrl: string,
  allowedOrigin: string,
  request: Reader,
): Promise<string[]> {
  const sitemap = new URL('/sitemap.xml', rootUrl).toString();
  try {
    const first = await readWithRedirects(sitemap, request, allowedOrigin);
    if (first.status < 200 || first.status >= 300) return [];
    const firstLocations = sitemapLocations(
      first.body.toString('utf8').slice(0, 1_000_000),
      first.finalUrl,
    );
    const nested = firstLocations
      .filter(
        (url) =>
          new URL(url).origin === allowedOrigin && /\.xml(?:$|[?#])/i.test(url),
      )
      .slice(0, 3);
    const locations = firstLocations.filter(
      (url) => !/\.xml(?:$|[?#])/i.test(url),
    );
    for (const url of nested) {
      try {
        const child = await readWithRedirects(url, request, allowedOrigin);
        if (child.status >= 200 && child.status < 300)
          locations.push(
            ...sitemapLocations(
              child.body.toString('utf8').slice(0, 1_000_000),
              child.finalUrl,
            ),
          );
      } catch {
        // Um sitemap secundário ruim não invalida os demais.
      }
    }
    return unique(locations).filter(
      (url) => new URL(url).origin === allowedOrigin,
    );
  } catch {
    return [];
  }
}

/** Crawl same-origin com limites explícitos; links externos são inventariados, não visitados. */
export async function crawlCurrentSite(
  inputUrl: string,
  deps: { request?: Reader; render?: Renderer | null } = {},
): Promise<CurrentSiteCrawl> {
  const request = deps.request ?? publicResource;
  const render =
    deps.render === undefined ? renderCurrentSitePages : deps.render;
  const root = await readWithRedirects(inputUrl, request);
  if (!htmlResource(root))
    throw new Error(
      root.status >= 200 && root.status < 300
        ? `Conteúdo ${root.headers['content-type'] || 'desconhecido'}`
        : `A página respondeu ${root.status}`,
    );
  const finalUrl = pageUrl(root.finalUrl);
  const allowedOrigin = new URL(finalUrl).origin;
  let rootPage = extractCurrentSitePage(
    finalUrl,
    root.body.toString('utf8').slice(0, MAX_HTML_BYTES),
    allowedOrigin,
  );
  let renderedPages = 0;
  const limits: string[] = [];
  if (render) {
    try {
      const rendered = (await render([finalUrl], request))[0];
      if (
        rendered &&
        new URL(pageUrl(rendered.finalUrl)).origin === allowedOrigin
      ) {
        rootPage = mergePage(
          rootPage,
          extractCurrentSitePage(
            pageUrl(rendered.finalUrl),
            rendered.html,
            allowedOrigin,
            true,
          ),
        );
        renderedPages++;
        if (rendered.unavailableResources)
          limits.push(
            `${rendered.unavailableResources} recurso(s) da página inicial não puderam ser renderizados.`,
          );
      }
    } catch {
      limits.push(
        'A página inicial foi lida pelo HTML, mas a renderização com JavaScript não ficou disponível.',
      );
    }
  }

  const pages = [rootPage];
  const visited = new Set([finalUrl]);
  const priority = (url: string) =>
    /\/(?:sobre|quem-somos|servicos|produtos|solucoes|contato|faq|cases|projetos)(?:\/|$)/i.test(
      new URL(url).pathname,
    )
      ? 0
      : 1;
  const navigation = rootPage.links
    .filter((link) => link.kind === 'internal')
    .map((link) => pageUrl(link.url))
    .sort((a, b) => priority(a) - priority(b));
  const fromSitemap = await sitemapPages(finalUrl, allowedOrigin, request);
  const queue = unique([...navigation, ...fromSitemap]).map((url) => ({
    url: pageUrl(url),
    depth: 1,
  }));
  const canonicalSeen = new Set([pageUrl(rootPage.canonical ?? finalUrl)]);
  let totalBytes = Math.min(root.body.length, MAX_HTML_BYTES);
  while (queue.length && pages.length < CURRENT_SITE_MAX_PAGES) {
    const { url: next, depth } = queue.shift()!;
    if (
      depth > 2 ||
      visited.has(next) ||
      NON_PAGE_EXT.test(new URL(next).pathname) ||
      SKIP_PATH.test(new URL(next).pathname)
    )
      continue;
    visited.add(next);
    try {
      const resource = await readWithRedirects(next, request, allowedOrigin);
      if (!htmlResource(resource)) continue;
      totalBytes += Math.min(resource.body.length, MAX_HTML_BYTES);
      if (totalBytes > MAX_TOTAL_HTML_BYTES) {
        limits.push('A navegação atingiu o limite total de 18 MB de HTML.');
        break;
      }
      const url = pageUrl(resource.finalUrl);
      if (
        new URL(url).origin !== allowedOrigin ||
        pages.some((page) => page.url === url)
      )
        continue;
      const page = extractCurrentSitePage(
        url,
        resource.body.toString('utf8').slice(0, MAX_HTML_BYTES),
        allowedOrigin,
      );
      const canonical = pageUrl(page.canonical ?? page.url);
      if (
        new URL(canonical).origin !== allowedOrigin ||
        canonicalSeen.has(canonical)
      )
        continue;
      canonicalSeen.add(canonical);
      pages.push(page);
      for (const link of page.links)
        if (link.kind === 'internal' && depth < 2)
          queue.push({ url: pageUrl(link.url), depth: depth + 1 });
    } catch {
      // Uma rota ruim não interrompe as outras páginas do domínio.
    }
  }

  const sparse = pages
    .slice(1)
    .filter((page) => page.text.length < 500)
    .slice(0, 3);
  if (render && sparse.length) {
    try {
      for (const rendered of await render(
        sparse.map((page) => page.url),
        request,
      )) {
        if (new URL(pageUrl(rendered.finalUrl)).origin !== allowedOrigin)
          continue;
        const index = pages.findIndex(
          (page) => page.url === pageUrl(rendered.requestedUrl),
        );
        if (index === -1) continue;
        pages[index] = mergePage(
          pages[index],
          extractCurrentSitePage(
            pageUrl(rendered.finalUrl),
            rendered.html,
            allowedOrigin,
            true,
          ),
        );
        renderedPages++;
      }
    } catch {
      limits.push(
        'Algumas páginas com pouco HTML não puderam ser complementadas por JavaScript.',
      );
    }
  }

  let textBudget = 0;
  for (const page of pages) {
    const remaining = Math.max(0, MAX_TOTAL_TEXT - textBudget);
    page.text = page.text.slice(0, remaining);
    textBudget += page.text.length;
  }
  if (pages.length === CURRENT_SITE_MAX_PAGES && queue.length)
    limits.push(
      `A navegação foi limitada a ${CURRENT_SITE_MAX_PAGES} páginas públicas.`,
    );
  if (textBudget >= MAX_TOTAL_TEXT)
    limits.push('O conteúdo normalizado foi limitado a 60.000 caracteres.');

  const allLinks = pages
    .flatMap((page) => page.links)
    .filter(
      (link, index, all) =>
        all.findIndex(
          (other) => other.url === link.url && other.kind === link.kind,
        ) === index,
    );
  const allImages = pages
    .flatMap((page) => page.images)
    .filter(
      (image, index, all) =>
        all.findIndex((other) => other.url === image.url) === index,
    );
  if (allLinks.length > 160)
    limits.push('O inventário foi limitado a 160 links únicos.');
  if (allImages.length > 100)
    limits.push('A seleção foi limitada a 100 candidatos de imagem.');
  const links = allLinks.slice(0, 160);
  const images = allImages.slice(0, 100);
  return {
    url: inputUrl,
    finalUrl,
    pages,
    links,
    images,
    renderedPages,
    limits,
  };
}
