import { z } from 'zod';
import type { BlockInstance, Page, TenantImage } from '../types';
import type { Finding } from './lint';
import {
  contentText,
  pageImageUrls,
  structuralFindings,
  type SitePage,
} from './metrics';

export const inboundSchema = z.object({
  stage: z.enum(['discovery', 'consideration', 'conversion']),
  intent: z.string().min(12).max(180),
});
export type Inbound = z.infer<typeof inboundSchema>;
export type { SitePage } from './metrics';
export { pageImageUrls } from './metrics';
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

/** Contrato de projeto. Imagens disponíveis não exigem aprovação. */
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
  // Composição: fotos por página, seção protagonista e ritmo tonal. Estas
  // regras vivem em metrics porque a revisão do agente usa as mesmas medidas.
  for (const finding of structuralFindings(pages, images))
    findings.push(finding);
  if (mode === 'publish') {
    const used = new Set(pages.flatMap((p) => pageImageUrls(p.blocks)));
    const rejected = images.filter(
      (i) => used.has(i.url) && i.status === 'rejeitada',
    );
    if (rejected.length)
      fail(
        '',
        'imagens-rejeitadas',
        `Troque as imagens rejeitadas antes de publicar: ${rejected.map((i) => `#${i.seq}`).join(', ')}.`,
      );
  }
  return findings;
}
