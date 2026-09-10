import { blockSchemas, familyOf, isBlockType } from '../blocks/registry';
import { expectedRatio, ratioFits } from '../images/ratios';
import type { BlockInstance, Page, TenantImage } from '../types';

export type SitePage = Pick<
  Page,
  'slug' | 'type' | 'title' | 'seo' | 'blocks' | 'meta'
>;

export type StructuralFinding = {
  page: string;
  level: 'error' | 'warn';
  rule: string;
  message: string;
  blockId?: string;
  blockIndex?: number;
  blockType?: string;
};

const CHROME = /^(nav|footer)\./;

/** Blocos de conteúdo: tipos conhecidos, sem navegação nem rodapé. */
export function contentBlocks(blocks: BlockInstance[]): BlockInstance[] {
  return blocks.filter((b) => isBlockType(b.type) && !CHROME.test(b.type));
}

function layoutOf(block: BlockInstance): string | undefined {
  return typeof block.props.layout === 'string'
    ? block.props.layout
    : undefined;
}

function toneOf(block: BlockInstance): string {
  const presentation = block.props.presentation as
    | { tone?: string }
    | undefined;
  return presentation?.tone ?? 'paper';
}

/**
 * URLs de imagem de um bloco, validadas pelo schema. A segunda imagem do hero
 * só existe na composição atelier, então não conta fora dela.
 */
export function blockImageUrls(block: BlockInstance): string[] {
  if (!isBlockType(block.type) || CHROME.test(block.type)) return [];
  const parsed = blockSchemas[block.type].strict().safeParse(block.props);
  if (!parsed.success) return [];
  const props = { ...parsed.data } as Record<string, unknown>;
  if (block.type === 'hero.split' && props.layout !== 'atelier')
    delete props.secondaryImage;
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
  walk(props);
  return [...urls];
}

/** Somente imagens renderizadas por schemas válidos. Logo, link e texto não contam. */
export function pageImageUrls(blocks: BlockInstance[]): string[] {
  const urls = new Set<string>();
  for (const block of blocks)
    for (const url of blockImageUrls(block)) urls.add(url);
  return [...urls];
}

export function contentText(blocks: BlockInstance[]): string {
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
  blocks.filter((b) => !CHROME.test(b.type)).forEach((b) => walk(b.props));
  return copy.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Fotos produzidas pelo pipeline do próprio cliente. Upload e logo não entram. */
export function generatedPhotos(images: TenantImage[]): TenantImage[] {
  return images.filter(
    (i) =>
      i.kind === 'foto' &&
      i.blobPath.includes('/gerado/') &&
      Boolean(i.model) &&
      i.status !== 'rejeitada',
  );
}

export type PageMetrics = {
  slug: string;
  type: string;
  sections: number;
  families: number;
  layouts: string[];
  tones: string[];
  images: number;
  generated: number;
  motionMoments: number;
  words: number;
  /** Bloco que carrega a composição com fotos. Null quando a página é lista de texto. */
  protagonist: string | null;
};

export function pageMetrics(
  page: SitePage,
  images: TenantImage[],
): PageMetrics {
  const content = contentBlocks(page.blocks);
  const generatedUrls = new Set(generatedPhotos(images).map((i) => i.url));
  const generatedIn = (block: BlockInstance) =>
    blockImageUrls(block).filter((url) => generatedUrls.has(url));
  const rich = content.filter((b) => generatedIn(b).length >= 2);
  const heroRich = rich.filter((b) => familyOf(b.type) === 'hero');
  const otherRich = rich.filter((b) => familyOf(b.type) !== 'hero');
  const otherWithPhoto = content.filter(
    (b) => familyOf(b.type) !== 'hero' && generatedIn(b).length >= 1,
  );
  // O hero atelier já é uma composição de duas fotos; ele só sustenta a página
  // quando o miolo também mostra o negócio em imagem.
  const protagonist =
    otherRich[0] ??
    (heroRich.length && otherWithPhoto.length ? heroRich[0] : undefined);
  const urls = pageImageUrls(page.blocks);
  return {
    slug: page.slug,
    type: page.type,
    sections: content.length,
    families: new Set(content.map((b) => familyOf(b.type))).size,
    layouts: [...new Set(content.map(layoutOf).filter(Boolean))] as string[],
    tones: [...new Set(content.map(toneOf))],
    images: urls.length,
    generated: urls.filter((url) => generatedUrls.has(url)).length,
    motionMoments: content.filter((b) => {
      const motion = (b.props.presentation as { motion?: string } | undefined)
        ?.motion;
      return Boolean(motion) && motion !== 'none';
    }).length,
    words: contentText(page.blocks).split(/\s+/).filter(Boolean).length,
    protagonist: protagonist ? protagonist.type : null,
  };
}

export function siteMetrics(pages: SitePage[], images: TenantImage[]) {
  const perPage = pages.map((page) => pageMetrics(page, images));
  const organic = pages.filter(
    (p) =>
      ['page', 'post'].includes(p.type) && !p.seo.noindex && p.blocks.length,
  );
  return {
    pages: perPage,
    home: perPage.find((p) => p.slug === '') ?? null,
    organic: organic.length,
    generatedPhotos: generatedPhotos(images).length,
    pagesWithoutImage: perPage.filter(
      (p) => p.type === 'page' && p.slug !== '' && p.images === 0,
    ).length,
  };
}

/**
 * Contrato de composição, medido no rascunho. Estas regras existem porque
 * páginas aprovadas em todos os validadores anteriores ainda saíam como lista
 * de texto: sem foto no miolo, sem seção protagonista e com um tom só.
 */
export function structuralFindings(
  pages: SitePage[],
  images: TenantImage[],
): StructuralFinding[] {
  const findings: StructuralFinding[] = [];
  const generated = generatedPhotos(images);
  const byUrl = new Map(generated.map((i) => [i.url, i]));
  const libraryByUrl = new Map(
    images.filter((i) => i.kind === 'foto').map((i) => [i.url, i]),
  );
  const home = pages.find((p) => p.slug === '');

  for (const page of pages) {
    const metrics = pageMetrics(page, images);
    const content = contentBlocks(page.blocks);
    const path = `/${page.slug}`;
    const organic =
      ['page', 'post'].includes(page.type) &&
      !page.seo.noindex &&
      page.blocks.length > 0;

    if (organic && page.type === 'page' && metrics.images === 0) {
      findings.push({
        page: path,
        level: 'error',
        rule: 'pagina-sem-foto',
        message:
          'Página orgânica sem nenhuma imagem. Use uma foto da biblioteca em hero, narrativa, galeria ou recursos; se faltar cena, chame prepare_site_images.',
      });
    }

    // Proporção: o recorte é object-cover, então foto vertical em slot
    // panorâmico perde o assunto sem aviso nenhum.
    content.forEach((block, index) => {
      const expected = expectedRatio(block.type, layoutOf(block));
      for (const url of blockImageUrls(block)) {
        const image = libraryByUrl.get(url);
        if (!image || ratioFits(image.ratio, expected)) continue;
        findings.push({
          page: path,
          level: 'warn',
          rule: 'imagem-proporcao',
          blockId: block.id,
          blockIndex: index,
          blockType: block.type,
          message: `#${image.seq} é ${image.ratio} e ${block.type}${
            layoutOf(block) ? ` (${layoutOf(block)})` : ''
          } exibe ${expected}. Troque a imagem, mude o layout ou gere a cena na proporção certa.`,
        });
      }
    });

    // Sequência: dois blocos iguais em seguida repetem a mesma silhueta.
    content.forEach((block, index) => {
      const previous = content[index - 1];
      if (!previous) return;
      if (
        previous.type === block.type &&
        layoutOf(previous) === layoutOf(block)
      )
        findings.push({
          page: path,
          level: 'warn',
          rule: 'layout-repetido',
          blockId: block.id,
          blockIndex: index,
          blockType: block.type,
          message: `${block.type} repete o layout do bloco anterior. Varie o layout ou o tipo da seção.`,
        });
    });
  }

  if (home) {
    const metrics = pageMetrics(home, images);
    const used = pageImageUrls(home.blocks).filter((url) => byUrl.has(url));
    if (new Set(used).size < 2)
      findings.push({
        page: '/',
        level: 'error',
        rule: 'home-imagens-geradas',
        message:
          'A home precisa de 2 fotos geradas distintas da biblioteca deste cliente, com cenas coerentes. Logos, uploads e repetição da mesma foto não contam.',
      });
    if (!metrics.protagonist)
      findings.push({
        page: '/',
        level: 'error',
        rule: 'home-protagonista',
        message:
          'A home não tem seção protagonista: nenhuma seção reúne duas fotos do cliente. Use feature.explorer, media.gallery, feature.bento com imagens, editorial.resources com imagem, ou o hero atelier com outra seção ilustrada.',
      });
    const tones = new Set(metrics.tones);
    if (![...tones].some((t) => t === 'accent' || t === 'secondary'))
      findings.push({
        page: '/',
        level: 'error',
        rule: 'home-paleta',
        message:
          'Aplique a cor principal ou complementar em uma seção da home, além das áreas de leitura.',
      });
    else if (tones.size < 3)
      findings.push({
        page: '/',
        level: 'warn',
        rule: 'home-tons',
        message: `A home usa ${tones.size} tom(ns) (${[...tones].join(', ')}). Alterne pelo menos três entre paper, soft, accent, secondary e ink para criar ritmo.`,
      });
  }

  return findings;
}
