import { z } from 'zod';
import { blockSchemas, isBlockType } from '../blocks/registry';
import type { BlockInstance, Page, TenantImage } from '../types';
import type { Finding } from './lint';

export const inboundSchema = z.object({
  stage: z.enum(['discovery', 'consideration', 'conversion']),
  intent: z.string().min(12).max(180),
});
export type Inbound = z.infer<typeof inboundSchema>;
export type SitePage = Pick<
  Page,
  'slug' | 'type' | 'title' | 'seo' | 'blocks' | 'meta'
>;
export type SiteFinding = Finding & { page: string };

/** Estado prospectivo: só os alvos selecionados contam pelo rascunho. */
export function publicationState(
  pages: Page[],
  targetIds: Set<string>,
): SitePage[] {
  return pages
    .filter((page) => targetIds.has(page.id) || page.publishedBlocks)
    .map((page) =>
      targetIds.has(page.id)
        ? page
        : {
            ...page,
            blocks: page.publishedBlocks!,
            seo: page.publishedSeo ?? {},
          },
    );
}

/** Somente imagens renderizadas por schemas válidos. Logo, link e texto não contam. */
export function pageImageUrls(blocks: BlockInstance[]): string[] {
  const urls = new Set<string>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (
          ['image', 'secondaryImage', 'src'].includes(key) &&
          typeof child === 'string'
        )
          urls.add(child);
        else if (typeof child === 'object') walk(child);
      }
    }
  };
  for (const block of blocks) {
    if (!isBlockType(block.type) || /^(nav|footer)\./.test(block.type))
      continue;
    const parsed = blockSchemas[block.type].strict().safeParse(block.props);
    if (parsed.success) {
      const props = { ...parsed.data } as Record<string, unknown>;
      // A segunda imagem do hero só é exibida pela composição atelier.
      if (block.type === 'hero.split' && props.layout !== 'atelier')
        delete props.secondaryImage;
      walk(props);
    }
  }
  return [...urls];
}

function contentText(blocks: BlockInstance[]): string {
  const copy: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (
          [
            'title',
            'headline',
            'subtext',
            'body',
            'description',
            'q',
            'a',
          ].includes(key) &&
          typeof child === 'string'
        )
          copy.push(child);
        else if (typeof child === 'object') walk(child);
      }
    }
  };
  blocks
    .filter((b) => !/^(nav|footer)\./.test(b.type))
    .forEach((b) => walk(b.props));
  return copy.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
}

function destinations(blocks: BlockInstance[]): string[] {
  const links: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (['href', 'redirectTo'].includes(key) && typeof child === 'string')
          links.push(child);
        else if (typeof child === 'object') walk(child);
      }
    }
  };
  blocks.forEach((block) => walk(block.props));
  return links;
}

/** Contrato de projeto. A fase de rascunho permite candidatas; publicação não. */
export function lintSite(
  pages: SitePage[],
  images: TenantImage[],
  mode: 'draft' | 'publish',
): SiteFinding[] {
  const findings: SiteFinding[] = [];
  const fail = (page: string, rule: string, message: string) =>
    findings.push({ page: `/${page}`, level: 'error', rule, message });
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  if (bySlug.size !== pages.length)
    fail('', 'slug-duplicado', 'Cada página precisa de slug único.');
  const organic = pages.filter(
    (p) =>
      ['page', 'post'].includes(p.type) && !p.seo.noindex && p.blocks.length,
  );
  if (organic.length < 3)
    fail(
      '',
      'inbound-paginas',
      `O projeto precisa de pelo menos 3 páginas orgânicas úteis; há ${organic.length}. Obrigado e paid_lp não contam.`,
    );
  const home = bySlug.get('');
  if (!home || home.type !== 'page' || home.seo.noindex)
    fail('', 'home-ausente', 'O projeto precisa de uma home indexável.');
  const stages = new Set<string>();
  const intents = new Set<string>();
  const titles = new Set<string>();
  const texts = new Set<string>();
  const graph = new Map<string, Set<string>>();
  for (const page of pages) {
    const edges = new Set<string>();
    graph.set(page.slug, edges);
    for (const href of destinations(page.blocks)) {
      if (!href.startsWith('/') && !href.startsWith('#')) continue;
      if (href.startsWith('//') || href.startsWith('/go/')) continue;
      let slug: string;
      let anchor: string;
      try {
        const target = new URL(href, `https://site.local/${page.slug}`);
        slug = decodeURIComponent(target.pathname).replace(/^\/+|\/+$/g, '');
        anchor = decodeURIComponent(target.hash.slice(1));
      } catch {
        fail(page.slug, 'link-interno', `Destino inválido: ${href}.`);
        continue;
      }
      const destination = bySlug.get(slug);
      if (!destination) {
        fail(page.slug, 'link-interno', `Destino inexistente: ${href}.`);
        continue;
      }
      if (page.slug !== slug) edges.add(slug);
      if (
        anchor &&
        !destination.blocks.some(
          (b) =>
            (b.props.anchor ?? (b.type === 'form.lead' ? 'contato' : '')) ===
            anchor,
        )
      )
        fail(page.slug, 'anchor-inexistente', `Âncora inexistente: ${href}.`);
    }
  }
  const referenced = new Set<string>(['']);
  const pending = [''];
  while (pending.length) {
    for (const target of graph.get(pending.pop()!) ?? []) {
      if (!referenced.has(target)) {
        referenced.add(target);
        pending.push(target);
      }
    }
  }
  for (const page of organic) {
    const inbound = inboundSchema.safeParse(page.meta.inbound);
    if (!inbound.success)
      fail(
        page.slug,
        'inbound-intencao',
        'Defina meta.inbound com stage e intent específicos desta página.',
      );
    else {
      stages.add(inbound.data.stage);
      const intent = inbound.data.intent.toLowerCase().trim();
      if (intents.has(intent))
        fail(
          page.slug,
          'inbound-repetido',
          'As páginas precisam responder a intenções diferentes.',
        );
      intents.add(intent);
    }
    const title = (page.seo.title ?? page.title).toLowerCase().trim();
    if (titles.has(title))
      fail(page.slug, 'seo-repetido', 'Título SEO repetido entre páginas.');
    titles.add(title);
    if (!page.seo.description?.trim())
      fail(
        page.slug,
        'seo-descricao',
        'Escreva uma descrição de busca específica para a página.',
      );
    const text = contentText(page.blocks);
    if (text.split(/\s+/).length < 100)
      fail(
        page.slug,
        'inbound-conteudo',
        'A página tem menos de 100 palavras de conteúdo útil. Desenvolva a resposta à intenção, sem filler.',
      );
    if (texts.has(text))
      fail(page.slug, 'inbound-copia', 'Conteúdo repetido entre páginas.');
    texts.add(text);
    if (!referenced.has(page.slug))
      fail(
        page.slug,
        'pagina-isolada',
        'Página sem link de entrada no projeto. Conecte-a à jornada.',
      );
  }
  if (
    !stages.has('discovery') ||
    !stages.has('consideration') ||
    !stages.has('conversion')
  )
    fail(
      '',
      'inbound-jornada',
      'Cubra descoberta, consideração e conversão com páginas conectadas.',
    );
  if (home) {
    const tones = new Set(
      home.blocks
        .filter((b) => !/^(nav|footer)\./.test(b.type))
        .map(
          (b) => (b.props.presentation as { tone?: string } | undefined)?.tone,
        ),
    );
    if (![...tones].some((t) => t === 'accent' || t === 'secondary'))
      fail(
        '',
        'home-paleta',
        'Aplique a cor principal ou complementar em uma seção da home, além das áreas de leitura.',
      );
    const used = pageImageUrls(home.blocks);
    const generated = images.filter(
      (i) =>
        i.kind === 'foto' &&
        i.blobPath.includes('/gerado/') &&
        i.model &&
        i.status !== 'rejeitada' &&
        used.includes(i.url),
    );
    const distinct = new Set(generated.map((i) => i.url));
    if (distinct.size < 2)
      fail(
        '',
        'home-imagens-geradas',
        'A home precisa de 2 fotos geradas distintas da biblioteca deste cliente, com cenas coerentes. Logos, uploads e repetição da mesma foto não contam.',
      );
  }
  if (mode === 'publish') {
    const used = new Set(pages.flatMap((p) => pageImageUrls(p.blocks)));
    const unapproved = images.filter(
      (i) => used.has(i.url) && i.status !== 'aprovada',
    );
    if (unapproved.length)
      fail(
        '',
        'imagens-aprovacao',
        `Aprovação do operador pendente: ${unapproved.map((i) => `#${i.seq}`).join(', ')}. A crítica de IA não aprova imagens.`,
      );
  }
  return findings;
}
