import {
  DEFAULT_LAYOUT,
  blockSchemas,
  familyOf,
  isBlockType,
  type BlockType,
} from '../blocks/registry';
import { expectedRatio, ratioFits } from '../images/ratios';
import { signatureItemsInRenderOrder } from '../design/structures';
import {
  VIBE_LABEL,
  structureGrammar,
  vibeOf,
  type Vibe,
} from '../design/vibes';
import type { DesignProfile } from '../design/profile';
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

/**
 * Layout que o visitante realmente vê. Sem `layout` nas props, hero e
 * navegação caem na composição do perfil e os demais no padrão do componente.
 * A gramática da vibe compara essa leitura, não o que foi digitado.
 */
export function resolvedLayout(
  block: BlockInstance,
  design?: Pick<DesignProfile, 'heroComposition' | 'navigation'>,
): string {
  const explicit = layoutOf(block);
  if (explicit) return explicit;
  if (block.type === 'hero.split') return design?.heroComposition ?? 'split';
  if (block.type === 'nav.bar') return design?.navigation ?? 'bar';
  return isBlockType(block.type)
    ? (DEFAULT_LAYOUT[block.type as BlockType] ?? 'default')
    : 'default';
}

/** Silhueta da página: tipo e layout de cada seção, sem texto nem imagem. */
export function silhouette(
  blocks: BlockInstance[],
  design?: Pick<DesignProfile, 'heroComposition' | 'navigation'>,
): string[] {
  return contentBlocks(blocks).map(
    (block) => `${block.type}:${resolvedLayout(block, design)}`,
  );
}

/**
 * Silhueta usada entre tenants na v5. A composição autoral contribui com o
 * arranjo de papéis e de mídia, sem expor texto, URL ou outro dado do cliente.
 * Assim, dois sites podem partir da mesma estrutura sem repetir o mesmo bloco.
 */
export function uniquenessSilhouette(
  blocks: BlockInstance[],
  design?: Pick<DesignProfile, 'heroComposition' | 'navigation'>,
): string[] {
  return contentBlocks(blocks).flatMap((block) => {
    const layout = resolvedLayout(block, design);
    const base = `${block.type}:${layout}`;
    if (block.type !== 'signature.composition') return [base];
    const items = Array.isArray(block.props.items) ? block.props.items : [];
    const traits = signatureItemsInRenderOrder(layout, items).map((value) => {
      if (!value || typeof value !== 'object') return 'invalid';
      const item = value as Record<string, unknown>;
      const role = typeof item.role === 'string' ? item.role : 'unknown';
      const hasImage = item.image === true || typeof item.image === 'string';
      const hasCta =
        item.cta === true ||
        (item.cta !== null && typeof item.cta === 'object');
      return `${role}:${hasImage ? 'media' : 'text'}:${hasCta ? 'action' : 'plain'}`;
    });
    return [
      base,
      `signature.roles:${traits.map((trait) => trait.split(':')[0]).join('>')}`,
      `signature.arrangement:${traits.join('>')}`,
    ];
  });
}

/**
 * Quanto duas silhuetas se repetem, de 0 a 1. Conta pares tipo:layout em comum
 * sobre a página maior. A trava anterior exigia igualdade exata da sequência
 * inteira, então trocar só o tom de uma seção já passava: em 12/09/2026 duas
 * homes de vibes diferentes tinham 4 das 5 seções idênticas e nenhuma recusa.
 */
export function silhouetteSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const pool = [...b];
  let shared = 0;
  for (const item of a) {
    const index = pool.indexOf(item);
    if (index === -1) continue;
    pool.splice(index, 1);
    shared += 1;
  }
  return shared / Math.max(a.length, b.length);
}

/** Acima disto duas páginas são a mesma composição pintada de outra cor. */
export const SILHOUETTE_LIMIT = 0.75;

/**
 * Similaridade de sequência pela maior subsequência comum. A v5 usa esta
 * medida para preservar o papel narrativo da ordem: só pares que aparecem na
 * mesma sequência contribuem integralmente para a repetição.
 */
export function orderedSilhouetteSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const previous = Array.from({ length: b.length + 1 }, () => 0);
  for (const left of a) {
    const current = [0];
    for (let index = 1; index <= b.length; index += 1)
      current[index] =
        left === b[index - 1]
          ? previous[index - 1] + 1
          : Math.max(previous[index], current[index - 1]);
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length] / Math.max(a.length, b.length);
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

/** Fotos do acervo do tenant, incluindo uploads registrados pela biblioteca. */
export function availablePhotos(images: TenantImage[]): TenantImage[] {
  const generated = new Set(generatedPhotos(images).map((image) => image.id));
  return images.filter(
    (image) =>
      image.kind === 'foto' &&
      image.status !== 'rejeitada' &&
      (generated.has(image.id) ||
        (image.model === 'upload' &&
          /^tenants\/[^/]+\/uploads\/[^/]+$/.test(image.blobPath))),
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
  const availableUrls = new Set(availablePhotos(images).map((i) => i.url));
  const availableIn = (block: BlockInstance) =>
    blockImageUrls(block).filter((url) => availableUrls.has(url));
  const rich = content.filter((b) => availableIn(b).length >= 2);
  const heroRich = rich.filter((b) => familyOf(b.type) === 'hero');
  const otherRich = rich.filter((b) => familyOf(b.type) !== 'hero');
  const otherWithPhoto = content.filter(
    (b) => familyOf(b.type) !== 'hero' && availableIn(b).length >= 1,
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

export function siteMetrics(
  pages: SitePage[],
  images: TenantImage[],
  design?: Pick<DesignProfile, 'heroComposition' | 'navigation'>,
) {
  const perPage = pages.map((page) => pageMetrics(page, images));
  const home = pages.find((page) => page.slug === '');
  const organic = pages.filter(
    (p) =>
      ['page', 'post'].includes(p.type) && !p.seo.noindex && p.blocks.length,
  );
  return {
    pages: perPage,
    home: perPage.find((p) => p.slug === '') ?? null,
    /** Sequência tipo:layout da home, para comparar composições entre clientes. */
    silhouette: home ? silhouette(home.blocks, design) : [],
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
/**
 * V4 usa a faixa ampla da vibe; v5 usa uma de suas três estruturas; v6 usa a
 * estrutura que mais se aproxima da referência, mesmo quando pertence a outra
 * família. Sites v2 e v3 mantêm a composição publicada.
 */
function grammarFindings(
  pages: SitePage[],
  vibe: Vibe,
  design: DesignProfile,
  generatedUrls: Set<string>,
): StructuralFinding[] {
  const grammar = structureGrammar(vibe, design);
  const findings: StructuralFinding[] = [];
  const referenceAuthority = design.version === 6;
  const label = referenceAuthority
    ? `estrutura guiada pela referência ${grammar.structure?.label ?? ''}`.trim()
    : `vibe ${VIBE_LABEL[vibe]}`;
  for (const page of pages) {
    if (page.type === 'thank_you' || page.type === 'post') continue;
    const content = contentBlocks(page.blocks);
    if (!content.length) continue;
    const marks = content.map((block) => ({
      block,
      signature: `${block.type}:${resolvedLayout(block, design)}`,
    }));
    const path = `/${page.slug}`;
    const home = page.slug === '';

    if (home && grammar.structure) {
      let cursor = -1;
      const missing: string[] = [];
      for (const expected of grammar.structure.sequence) {
        const next = marks.findIndex(
          (mark, index) => index > cursor && mark.signature === expected,
        );
        if (next === -1) missing.push(expected);
        else cursor = next;
      }
      if (missing.length)
        findings.push({
          page: path,
          level: 'error',
          rule: 'estrutura-v5-incompleta',
          message: `A estrutura ${grammar.structure.label} precisa preservar esta ordem mínima: ${grammar.structure.sequence.join(' > ')}. Ausentes ou fora de ordem: ${missing.join(', ')}.`,
        });
      const signatureBlocks = marks.filter(
        (mark) => mark.block.type === 'signature.composition',
      );
      if (signatureBlocks.length !== 1)
        findings.push({
          page: path,
          level: 'error',
          rule: 'composicao-autoral-obrigatoria',
          message: `A home com perfil v${design.version} precisa de exatamente uma signature.composition; recebeu ${signatureBlocks.length}.`,
        });
    }
    const opening = marks[0];
    const allowedOpenings = home
      ? [...grammar.openings]
      : [...new Set([...grammar.innerOpenings, ...grammar.openings])];
    if (!allowedOpenings.includes(opening.signature))
      findings.push({
        page: path,
        level: home ? 'error' : 'warn',
        rule: home ? 'abertura-fora-da-vibe' : 'abertura-interna-fora-da-vibe',
        blockId: opening.block.id,
        blockIndex: 0,
        blockType: opening.block.type,
        message: `A abertura ${opening.signature} não pertence à ${label}. Use uma destas: ${allowedOpenings.join(', ')}.`,
      });
    for (const [index, mark] of marks.entries()) {
      if (!mark.block.type.startsWith('hero.')) continue;
      const headline = mark.block.props.headline;
      if (typeof headline !== 'string' || headline.length <= grammar.headline)
        continue;
      findings.push({
        page: path,
        level: 'warn',
        rule: 'headline-fora-da-vibe',
        blockId: mark.block.id,
        blockIndex: index,
        blockType: mark.block.type,
        message: `Headline com ${headline.length} caracteres. A ${label} sustenta até ${grammar.headline}: encurte o título e leve o resto para o subtext.`,
      });
    }
    if (
      home &&
      !marks.some(
        (m) =>
          grammar.protagonists.includes(m.signature) &&
          blockImageUrls(m.block).filter((url) => generatedUrls.has(url))
            .length >= 2,
      )
    )
      findings.push({
        page: path,
        level: 'error',
        rule: 'protagonista-fora-da-vibe',
        message: `A home precisa da seção protagonista da ${label}: ${grammar.protagonists.join(' ou ')}. Coloque duas fotos distintas da biblioteca deste cliente no próprio bloco.`,
      });
    const closing = marks[marks.length - 1];
    if (!grammar.closings.includes(closing.signature))
      findings.push({
        page: path,
        level: 'warn',
        rule: 'fechamento-fora-da-vibe',
        blockId: closing.block.id,
        blockIndex: marks.length - 1,
        blockType: closing.block.type,
        message: `O fechamento ${closing.signature} não é o da ${label}. Prefira uma destas: ${grammar.closings.join(', ')}.`,
      });
    for (const [index, mark] of marks.entries())
      if (grammar.avoid.includes(mark.signature))
        findings.push({
          page: path,
          level: 'warn',
          rule: 'secao-vetada',
          blockId: mark.block.id,
          blockIndex: index,
          blockType: mark.block.type,
          message: `${mark.signature} contradiz a ${label}. Escolha outro layout para esta seção.`,
        });
  }
  return findings;
}

export function structuralFindings(
  pages: SitePage[],
  images: TenantImage[],
  brand?: { vibe?: string; design?: unknown },
): StructuralFinding[] {
  const findings: StructuralFinding[] = [];
  const design = brand?.design as DesignProfile | undefined;
  const available = availablePhotos(images);
  const byUrl = new Map(available.map((i) => [i.url, i]));
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
          'A home precisa de 2 fotos distintas da biblioteca deste cliente, geradas ou enviadas, com cenas coerentes. Logos, arquivos fora do acervo e repetição da mesma foto não contam.',
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
    const referenceAuthority = design?.version === 6;
    if (referenceAuthority && tones.size < 2)
      findings.push({
        page: '/',
        level: 'warn',
        rule: 'home-tons',
        message:
          'A home usa um único tom. Confirme que esse ritmo contínuo vem da referência; caso contrário, crie ao menos uma transição de superfície.',
      });
    else if (
      !referenceAuthority &&
      ![...tones].some((t) => t === 'accent' || t === 'secondary')
    )
      findings.push({
        page: '/',
        level: 'error',
        rule: 'home-paleta',
        message:
          'Aplique a cor principal ou complementar em uma seção da home, além das áreas de leitura.',
      });
    else if (!referenceAuthority && tones.size < 3)
      findings.push({
        page: '/',
        level: 'warn',
        rule: 'home-tons',
        message: `A home usa ${tones.size} tom(ns) (${[...tones].join(', ')}). Alterne pelo menos três entre paper, soft, accent, secondary e ink para criar ritmo.`,
      });
  }

  if (design && design.version >= 4)
    findings.push(
      ...grammarFindings(
        pages,
        vibeOf({ vibe: brand?.vibe }),
        design,
        new Set(byUrl.keys()),
      ),
    );

  return findings;
}
