import { z } from 'zod';
import { relativeLuminance } from '@/lib/blocks/contrast';
import { DESIGN_AXES, type DesignProfileInput } from '@/lib/design/profile';
import {
  hasReferenceDirection,
  REFERENCE_ASPECTS,
  type ReferenceAspect,
} from './references';
import {
  allStructuresDirection,
  structureByKey,
  structureFor,
  structuresDirection,
  type SiteStructure,
} from './structures';

/**
 * Vibe do site, escolhida pelo operador no cadastro. Ela não substitui a
 * direção de arte: continua sendo o agente que decide conceito, estrutura e
 * tipografia. Referências visuais verificadas prevalecem sobre essa faixa;
 * sem elas, a direção permanece dentro da vibe. Todos os quatro contratos são
 * delimitados. A voz em lib/copy/policy.ts continua valendo quando uma
 * referência dirige o visual.
 *
 * Referências lidas em 10/09/2026: linear.app (moderno), 14islands.com
 * (ousado) e actionline.io (artistico). Em 12/09/2026 o moderno foi recriado
 * sobre linear.app, resend.com e untold.site/pt: sistema tipográfico com fio
 * de 1px, rótulos em mono e nenhuma grade decorativa. Elas orientam a
 * linguagem visual; o conteúdo continua vindo do briefing do cliente.
 */
export const VIBES = [
  'comercial',
  'moderno',
  'ousado',
  'artistico',
  'landing',
] as const;
export type Vibe = (typeof VIBES)[number];

export type SiteShape = 'multi' | 'landing';
export const SITE_SHAPE: Record<Vibe, SiteShape> = {
  comercial: 'multi',
  moderno: 'multi',
  ousado: 'multi',
  artistico: 'multi',
  landing: 'landing',
};
export function siteShape(
  brand: { vibe?: string } | null | undefined,
): SiteShape {
  return SITE_SHAPE[vibeOf(brand)];
}

export const vibeSchema = z.enum(VIBES);

export function isVibe(value: unknown): value is Vibe {
  return (
    typeof value === 'string' && (VIBES as readonly string[]).includes(value)
  );
}

/** Sem vibe gravada, o cliente continua no contrato comercial. */
export function vibeOf(brand: { vibe?: string } | null | undefined): Vibe {
  return isVibe(brand?.vibe) ? brand.vibe : 'comercial';
}

/**
 * Vibe usada pelo renderer. Nos perfis v2 e v3 uma referência verificada
 * desligava a vibe inteira e o site caía na base comercial: CSS, ícones e tom
 * da localização sumiam junto com a silhueta. Isso fica preservado para não
 * redesenhar o que já está publicado. V4/v5 modulam aspectos e preservam a
 * vibe; v6 usa a família da estrutura escolhida pela referência.
 */
export function renderingVibeOf(
  brand: { vibe?: string; design?: unknown } | null | undefined,
): Vibe {
  const design = brand?.design as
    | { version?: number; structure?: unknown }
    | undefined;
  const version = design?.version;
  if (version === 6 && hasReferenceDirection(brand))
    return structureByKey(design?.structure)?.vibe ?? vibeOf(brand);
  return (!version || version < 4) && hasReferenceDirection(brand)
    ? 'comercial'
    : vibeOf(brand);
}

export const VIBE_LABEL: Record<Vibe, string> = {
  landing: 'Landing Page',
  comercial: 'Comercial',
  moderno: 'Moderno',
  ousado: 'Ousado',
  artistico: 'Artístico',
};

export const VIBE_HINT: Record<Vibe, string> = {
  landing:
    'Uma página, uma ação: benefício, prova e formulário curto, com botão fixo no celular.',
  comercial:
    'Clareza acolhedora: benefício, prova e contato em um percurso direto e simples.',
  moderno:
    'Sistema tipográfico: papel quase preto, fios de 1px, rótulos em mono e muito respiro, com voz clara e tranquila.',
  ousado:
    'Impacto gráfico: título como imagem, escala extrema e texto curto e firme.',
  artistico:
    'Narrativa editorial: papel quente, serifas, colagem e texto próximo e cuidadoso.',
};

/** Paletas de demonstração e ponto de partida; só viram marca quando editadas. */
export const VIBE_PALETTE: Record<
  Vibe,
  { primary: string; secondary: string; highlight: string }
> = {
  landing: { primary: '#16a34a', secondary: '#ecfdf5', highlight: '#f59e0b' },
  comercial: {
    primary: '#1f6feb',
    secondary: '#dbeafe',
    highlight: '#b45309',
  },
  // Índigo apagado para a única seção colorida, grafite para a superfície
  // elevada e ação lavanda para links e numerais: o botão principal do moderno
  // é tinta sobre papel, não a cor de destaque.
  moderno: {
    primary: '#5b63d6',
    secondary: '#1b1e24',
    highlight: '#c9d1ff',
  },
  ousado: {
    primary: '#ff3d00',
    secondary: '#111111',
    highlight: '#ff3d00',
  },
  artistico: {
    primary: '#8b5e3c',
    secondary: '#eadbc8',
    highlight: '#9d174d',
  },
};

type Axis = (typeof DESIGN_AXES)[number];
type Range = readonly [number, number];

type Lane = {
  axes: { [K in Axis]: readonly DesignProfileInput[K][] };
  radius: readonly DesignProfileInput['radius'][];
  /** Faixa de luminância relativa exigida do papel e da superfície. */
  paper: Range;
  /** Faixa exigida da tinta, quando a vibe define claro sobre escuro. */
  ink?: Range;
  dials: { variance: Range; motion: Range; density: Range };
};

export const VIBE_LANE: Record<Vibe, Lane> = {
  landing: {
    axes: {
      displayFont: ['grotesk', 'geometric'],
      bodyFont: ['sans', 'geometric'],
      heroComposition: ['stage', 'form'],
      navigation: ['minimal'],
      rhythm: ['alternating', 'compact'],
      imageTreatment: ['framed'],
      surfaceStyle: ['outlined', 'layered'],
      motif: ['none', 'grid'],
    },
    radius: ['md', 'lg'],
    paper: [0.85, 1],
    dials: { variance: [3, 6], motion: [3, 6], density: [5, 8] },
  },
  comercial: {
    axes: {
      displayFont: ['humanist', 'slab'],
      bodyFont: ['humanist', 'source'],
      heroComposition: ['split', 'cover'],
      navigation: ['bar'],
      rhythm: ['alternating', 'compact'],
      imageTreatment: ['framed'],
      surfaceStyle: ['flat'],
      motif: ['none', 'corners'],
    },
    radius: ['sm', 'md'],
    paper: [0.82, 1],
    dials: { variance: [2, 5], motion: [2, 4], density: [4, 7] },
  },
  // O motivo grid saiu da faixa: a grade atravessava todas as seções e
  // nenhuma referência a usa. Perfis v2 já gravados com grid continuam sendo
  // renderizados como foram publicados.
  moderno: {
    axes: {
      displayFont: ['geometric', 'grotesk'],
      bodyFont: ['sans', 'source'],
      heroComposition: ['editorial', 'offset'],
      navigation: ['minimal'],
      rhythm: ['chapters'],
      imageTreatment: ['framed'],
      surfaceStyle: ['outlined'],
      motif: ['none'],
    },
    radius: ['sm', 'md'],
    paper: [0, 0.12],
    ink: [0.75, 1],
    dials: { variance: [3, 5], motion: [3, 5], density: [3, 5] },
  },
  ousado: {
    axes: {
      displayFont: ['condensed', 'expressive'],
      bodyFont: ['sans', 'work'],
      heroComposition: ['cover', 'poster'],
      navigation: ['contrast'],
      rhythm: ['continuous'],
      imageTreatment: ['full-bleed'],
      surfaceStyle: ['contrast'],
      motif: ['stripes'],
    },
    radius: ['none'],
    paper: [0.86, 1],
    dials: { variance: [8, 10], motion: [4, 7], density: [2, 4] },
  },
  artistico: {
    axes: {
      displayFont: ['editorial', 'classic'],
      bodyFont: ['editorial', 'literary', 'source'],
      heroComposition: ['offset', 'atelier'],
      navigation: ['floating'],
      rhythm: ['alternating'],
      imageTreatment: ['collage', 'cutout'],
      surfaceStyle: ['layered'],
      motif: ['rings', 'corners'],
    },
    radius: ['lg', 'full'],
    paper: [0.72, 1],
    dials: { variance: [6, 8], motion: [5, 8], density: [3, 5] },
  },
};

/* ------------------------------------------------------------------ gramática
 * A vibe deixou de ser só um preset de CSS: ela define a silhueta da página.
 * Sem isto, duas vibes com referências diferentes produziam a mesma sequência
 * de blocos, porque o plano de cenas pedia sempre os mesmos alvos e o agente
 * montava o que a biblioteca rotulava. Medido em 12/09/2026 nos clientes
 * chiquinho (artístico) e tech (ousado): 4 das 5 seções da home eram iguais.
 *
 * A notação é `tipo:layout`. O layout ausente nas props é resolvido pelo
 * padrão do bloco em lib/blocks/registry.ts; no hero, pela composição do
 * perfil. Os eixos continuam em VIBE_LANE; aqui ficam os blocos.
 */
export type VibeGrammar = {
  /** Aberturas válidas da home. Derivadas da composição de hero da faixa. */
  openings: readonly string[];
  /** Seções que podem carregar a home com duas fotos do cliente. */
  protagonists: readonly string[];
  /** Aberturas das páginas internas, além das aberturas da home. */
  innerOpenings: readonly string[];
  /** Fechamentos de página coerentes com a vibe. */
  closings: readonly string[];
  /** Combinações que contradizem a vibe. Viram aviso, não recusa. */
  avoid: readonly string[];
  /** Alvos de cena das páginas internas, usados em ordem. */
  support: readonly string[];
  /** Caracteres que o headline do hero sustenta na escala da display. */
  headline: number;
  /** Uma linha para o prompt e para a mensagem de recusa. */
  summary: string;
};

type GrammarProfile =
  | { version?: number; structure?: unknown; heroComposition?: string }
  | undefined;

/** V5 usa a família da vibe; v6 pode usar qualquer família guiada pela fonte. */
export function structureGrammar(
  vibe: Vibe,
  design?: GrammarProfile,
): VibeGrammar & { structure?: SiteStructure } {
  if (vibe === 'landing')
    return {
      ...VIBE_GRAMMAR.landing,
      ...(design?.version === 7 &&
      ['stage', 'form'].includes(design.heroComposition ?? '')
        ? { openings: [`hero.landing:${design.heroComposition}`] }
        : {}),
    };
  const selected =
    design?.version === 6
      ? structureByKey(design.structure)
      : design?.version === 5
        ? structureFor(vibe, design.structure)
        : null;
  const base =
    design?.version === 6 && selected
      ? VIBE_GRAMMAR[selected.vibe]
      : VIBE_GRAMMAR[vibe];
  const structure = selected;
  if (!structure) return base;
  return {
    ...base,
    openings: structure.openings,
    protagonists: structure.protagonists,
    innerOpenings: structure.innerOpenings,
    closings: structure.closings,
    support: structure.support,
    summary: `${structure.label}: ${structure.intent}`,
    structure,
  };
}

const openingsOf = (vibe: Vibe): string[] =>
  VIBE_LANE[vibe].axes.heroComposition.map(
    (composition) => `hero.split:${composition}`,
  );

export const VIBE_GRAMMAR: Record<Vibe, VibeGrammar> = {
  landing: {
    openings: ['hero.landing:stage', 'hero.landing:form'],
    protagonists: [
      'feature.bento:showcase',
      'feature.showcase:steps',
      'feature.showcase:tabs',
    ],
    innerOpenings: [],
    closings: ['cta.band:band', 'form.lead:panel', 'form.lead:stack'],
    support: ['media.image'],
    avoid: [
      'hero.split:split',
      'hero.split:cover',
      'hero.statement:oversize',
      'feature.explorer:showroom',
      'media.gallery:collage',
      'media.gallery:masonry',
      'editorial.resources:feature',
    ],
    headline: 60,
    summary:
      'conduz uma única home indexável do benefício à prova e à mesma ação, com obrigado separado.',
  },
  comercial: {
    openings: openingsOf('comercial'),
    protagonists: ['feature.explorer:showroom', 'feature.bento:gallery'],
    innerOpenings: ['hero.statement:framed', 'hero.split:split'],
    closings: [
      'cta.band:band',
      'cta.band:split',
      'form.lead:split',
      'form.lead:panel',
    ],
    avoid: [
      'hero.statement:oversize',
      'media.gallery:collage',
      'cta.band:poster',
    ],
    support: ['narrative.split', 'media.image'],
    headline: 56,
    summary:
      'abre em hero.split split ou cover, carrega a home com feature.explorer showroom ou feature.bento gallery e fecha em cta.band band ou form.lead.',
  },
  moderno: {
    openings: openingsOf('moderno'),
    protagonists: ['feature.bento:showcase', 'feature.explorer:panorama'],
    innerOpenings: ['hero.statement:framed', 'hero.split:editorial'],
    closings: ['cta.band:minimal', 'cta.band:split', 'form.lead:panel'],
    avoid: [
      'feature.bento:gallery',
      'feature.numbered:cards',
      'proof.stats:cards',
      'hero.statement:oversize',
      'media.gallery:collage',
      'media.gallery:masonry',
      'cta.band:poster',
      'faq.accordion:cards',
    ],
    support: ['media.image', 'narrative.split'],
    headline: 56,
    summary:
      'abre em hero.split editorial ou offset, carrega a home com feature.bento showcase ou feature.explorer panorama e fecha em cta.band minimal ou split.',
  },
  ousado: {
    openings: openingsOf('ousado'),
    protagonists: ['media.gallery:collage', 'media.gallery:grid'],
    innerOpenings: ['hero.statement:oversize', 'hero.statement:center'],
    closings: ['cta.band:poster', 'cta.band:band'],
    avoid: [
      'feature.numbered:cards',
      'faq.accordion:cards',
      'proof.stats:cards',
      'feature.bento:gallery',
    ],
    support: ['media.image', 'media.image'],
    headline: 36,
    summary:
      'abre em hero.split cover ou poster, carrega a home com media.gallery collage ou grid em largura cheia e fecha em cta.band poster.',
  },
  artistico: {
    openings: openingsOf('artistico'),
    protagonists: ['media.gallery:masonry', 'editorial.resources:feature'],
    innerOpenings: ['hero.statement:center'],
    closings: ['cta.band:split', 'form.lead:stack', 'cta.band:band'],
    avoid: [
      'hero.statement:oversize',
      'proof.stats:strip',
      'feature.numbered:cards',
    ],
    support: ['narrative.split', 'narrative.split'],
    headline: 40,
    summary:
      'abre em hero.split offset ou atelier, carrega a home com media.gallery masonry ou editorial.resources feature e fecha em cta.band split ou form.lead stack.',
  },
};

/** A composição de hero que a vibe sustenta nos perfis até v5. */
export function heroCompositionFor(
  vibe: Vibe,
  composition: string | undefined,
): DesignProfileInput['heroComposition'] {
  const allowed = VIBE_LANE[vibe].axes.heroComposition;
  return allowed.includes(composition as DesignProfileInput['heroComposition'])
    ? (composition as DesignProfileInput['heroComposition'])
    : allowed[0];
}

/** Texto da gramática para o prompt e para as mensagens de recusa. */
export function grammarDirection(
  vibe: Vibe,
  design?: GrammarProfile,
  referenceLed = design?.version === 6,
): string {
  const grammar = structureGrammar(vibe, design);
  if (vibe === 'landing')
    return `${VIBE_DIRECTION.landing}
Abertura da home: ${grammar.openings.join(' ou ')}. Protagonista: ${grammar.protagonists.join(' ou ')}.
Fechamento: ${grammar.closings.join(' ou ')}. Headline até 60 caracteres.
Perfil v7 sem structure nem structureRationale. pagePlan: apenas slug vazio, stage conversion. Cinco imageScenes, todas na home. Referência verificada preserva stage/form e navigation minimal; nunca escolha estrutura multipágina.`;
  if (referenceLed && !grammar.structure)
    return `Autoridade visual da referência. Compare as doze estruturas disponíveis e escolha a que mais se aproxima da composição observada; a vibe ${VIBE_LABEL[vibe]} serve apenas para voz e lacunas que a fonte não resolver.
Estruturas disponíveis para sites novos com referência:
${allStructuresDirection()}`;
  if (referenceLed && grammar.structure)
    return `Estrutura guiada pela referência: ${grammar.structure.label} (${grammar.structure.key}). A vibe ${VIBE_LABEL[vibe]} serve apenas para voz e fallback.
- Abertura da home: ${grammar.openings.join(' ou ')}.
- Seção protagonista da home, com duas fotos deste cliente: ${grammar.protagonists.join(' ou ')}.
- Abertura das páginas internas: ${[...grammar.innerOpenings, ...grammar.openings].join(', ')}.
- Fechamento de cada página: ${grammar.closings.join(' ou ')}.
- Headline de todo hero: até ${grammar.headline} caracteres.
- Sequência mínima: ${grammar.structure.sequence.join(' > ')}.
Realize as seis aplicações documentadas da referência em estrutura, hero, tipografia, imagens, ritmo, superfície, mobile, movimento e densidade. Adapte somente por factualidade, marca, acessibilidade e limites do catálogo.`;
  const choices =
    design?.version === 5
      ? ''
      : `\nEstruturas disponíveis para sites novos:\n${structuresDirection(vibe)}`;
  return `Gramática obrigatória da vibe ${VIBE_LABEL[vibe]}, em tipo:layout. A vibe ${grammar.summary}
- Abertura da home: ${grammar.openings.join(' ou ')}.
- Seção protagonista da home, com duas fotos deste cliente: ${grammar.protagonists.join(' ou ')}.
- Abertura das páginas internas: ${[...grammar.innerOpenings, ...grammar.openings].join(', ')}.
- Fechamento de cada página: ${grammar.closings.join(' ou ')}.
- Headline de todo hero: até ${grammar.headline} caracteres. O que sobrar vai para o subtext.
- Evite nesta vibe: ${grammar.avoid.join(', ')}.
${grammar.structure ? `- Estrutura selecionada: ${grammar.structure.key}. Sequência mínima: ${grammar.structure.sequence.join(' > ')}.` : ''}
Sem referência visual verificada, esta gramática define a direção completa.${choices}`;
}

const AXIS_LABEL: Record<Axis, string> = {
  displayFont: 'displayFont',
  bodyFont: 'bodyFont',
  heroComposition: 'heroComposition',
  navigation: 'navigation',
  rhythm: 'rhythm',
  imageTreatment: 'imageTreatment',
  surfaceStyle: 'surfaceStyle',
  motif: 'motif',
};

/**
 * O que cada aspecto de uma referência verificada libera na faixa. A leitura
 * visual documenta as decisões que serão realizadas no perfil v6. Perfis v4 e
 * v5 continuam usando o mapeamento histórico ao serem renderizados.
 */
const ASPECT_AXES: Record<ReferenceAspect, readonly (Axis | 'radius')[]> = {
  layout: ['navigation'],
  typography: ['displayFont', 'bodyFont'],
  imagery: ['imageTreatment'],
  rhythm: ['rhythm'],
  surface: ['surfaceStyle', 'radius'],
  mobile: [],
};

/** Compatibilidade v4/v5; a cobertura completa libera todos os dials na v6. */
const ASPECT_DIALS: Partial<
  Record<ReferenceAspect, readonly ('variance' | 'motion' | 'density')[]>
> = { rhythm: ['density'] };

function relaxedBy(aspects: Iterable<ReferenceAspect> | undefined) {
  const axes = new Set<string>();
  const dials = new Set<string>();
  let luminance = false;
  for (const aspect of aspects ?? []) {
    for (const axis of ASPECT_AXES[aspect] ?? []) axes.add(axis);
    for (const dial of ASPECT_DIALS[aspect] ?? []) dials.add(dial);
    if (aspect === 'surface') luminance = true;
  }
  return { axes, dials, luminance };
}

/**
 * O que a direção proposta viola na faixa da vibe. Lista vazia quer dizer
 * aprovada. Serve tanto para o gate de set_design quanto para teste.
 * `aspects` traz a cobertura visual verificada. Cobertura parcial mantém o
 * comportamento v4/v5; os seis aspectos juntos autorizam toda a faixa v6.
 */
export function laneIssues(
  vibe: Vibe,
  input: DesignProfileInput,
  aspects?: Iterable<ReferenceAspect>,
): string[] {
  const lane = VIBE_LANE[vibe];
  const aspectList = [...(aspects ?? [])];
  const referenceLed = REFERENCE_ASPECTS.every((aspect) =>
    aspectList.includes(aspect),
  );
  const relaxed = relaxedBy(aspectList);
  if (referenceLed) {
    for (const axis of DESIGN_AXES) relaxed.axes.add(axis);
    relaxed.axes.add('radius');
    for (const dial of ['variance', 'motion', 'density'])
      relaxed.dials.add(dial);
    relaxed.luminance = true;
  }
  const issues: string[] = [];
  const landingHero = ['stage', 'form'].includes(input.heroComposition);
  if ((vibe === 'landing') !== landingHero)
    issues.push(
      'heroComposition precisa corresponder à forma: stage/form somente em Landing Page.',
    );
  if (vibe === 'landing' && input.structure !== undefined)
    issues.push(
      'Landing Page usa a gramática de conversão, sem estrutura multipágina. Omita structure.',
    );
  if (vibe === 'landing' && input.navigation !== 'minimal')
    issues.push('Landing Page mantém navigation minimal mesmo com referência.');
  // O schema de set_design exige estrutura em v5/v6. A ausência segue aceita
  // aqui porque esta função também audita perfis v2-v4 publicados.
  if (input.structure !== undefined) {
    const selectedStructure = referenceLed
      ? structureByKey(input.structure)
      : structureFor(vibe, input.structure);
    if (!selectedStructure)
      issues.push(
        referenceLed
          ? `structure: "${input.structure}" não é uma estrutura disponível. Use ${allStructuresDirection().replaceAll('\n', ' ')}`
          : `structure: "${input.structure}" não pertence à vibe ${VIBE_LABEL[vibe]}. Use ${structuresDirection(vibe).replaceAll('\n', ' ')}`,
      );
    else if (
      !selectedStructure.openings.includes(
        `hero.split:${input.heroComposition}`,
      )
    )
      issues.push(
        `heroComposition: "${input.heroComposition}" não abre a estrutura ${selectedStructure.label}. Use ${selectedStructure.openings.join(' ou ')}.`,
      );
  }
  for (const axis of DESIGN_AXES) {
    const allowed = lane.axes[axis] as readonly string[];
    if (!relaxed.axes.has(axis) && !allowed.includes(input[axis]))
      issues.push(
        `${AXIS_LABEL[axis]}: "${input[axis]}" não pertence à vibe ${VIBE_LABEL[vibe]}. Use ${allowed.join(', ')}.`,
      );
  }
  if (
    !relaxed.axes.has('radius') &&
    !(lane.radius as readonly string[]).includes(input.radius)
  )
    issues.push(
      `radius: "${input.radius}" não pertence à vibe ${VIBE_LABEL[vibe]}. Use ${lane.radius.join(', ')}.`,
    );

  const paperLuminance = relativeLuminance(input.paper);
  const surfaceLuminance = relativeLuminance(input.surface);
  const [paperMin, paperMax] = relaxed.luminance ? [0, 1] : lane.paper;
  if (paperLuminance < paperMin || paperLuminance > paperMax)
    issues.push(
      paperMax <= 0.2
        ? `paper: ${input.paper} é claro demais. A vibe ${VIBE_LABEL[vibe]} pede superfície escura, quase preta.`
        : `paper: ${input.paper} é escuro demais. A vibe ${VIBE_LABEL[vibe]} pede papel claro.`,
    );
  if (surfaceLuminance < paperMin || surfaceLuminance > paperMax)
    issues.push(
      paperMax <= 0.2
        ? `surface: ${input.surface} é claro demais. Use um tom escuro um pouco acima do papel.`
        : `surface: ${input.surface} é escuro demais. Use um tom claro próximo do papel.`,
    );
  if (lane.ink && !relaxed.luminance) {
    const inkLuminance = relativeLuminance(input.ink);
    if (inkLuminance < lane.ink[0] || inkLuminance > lane.ink[1])
      issues.push(
        `ink: ${input.ink} não serve para texto claro sobre fundo escuro. Use uma tinta quase branca.`,
      );
  }
  for (const dial of ['variance', 'motion', 'density'] as const) {
    if (relaxed.dials.has(dial)) continue;
    const [min, max] = lane.dials[dial];
    if (input[dial] < min || input[dial] > max)
      issues.push(
        `${dial}: ${input[dial]} fora da faixa ${min}–${max} da vibe ${VIBE_LABEL[vibe]}.`,
      );
  }
  return issues;
}

/**
 * Direção que entra no prompt junto com a seção de design. A gramática vem
 * de VIBE_GRAMMAR e é verificada no pre-flight; aqui fica o estilo que o
 * catálogo sozinho não comunica.
 */
export const VIBE_DIRECTION: Record<Vibe, string> = {
  landing: `Vibe Landing Page: uma página, uma ação. Menu minimal em pílulas e âncoras; hero.landing stage com produto em moldura ou form com formulário curto. Benefício concreto, prova real, protagonista com duas fotos, passos, FAQ e fechamento sobre acento. De 6 a 11 seções de conteúdo. Repita o destino primário na abertura, no meio e no fechamento. nav.bar com stickyCta true e position fixed. A referência modula os eixos visuais, mas nunca a forma de página única.`,
  comercial: `Vibe comercial: percurso direto, acolhedor e orientado à decisão.
- Display humanist ou slab com corpo humanist/source. Navegação bar, imagem framed e superfície flat.
- A home abre com benefício, foto documental e CTA visível, e o miolo alterna oferta, aplicações reais, dúvidas e contato. Não transforme tudo em cartões.
- feature.numbered layout ledger para serviços, proof.testimonial só com depoimento real, faq.accordion layout split.
- Ícones regulares e semânticos só onde aceleram leitura. Cantos discretos, movimento funcional e hierarquia de conversão clara.`,
  moderno: `Vibe moderno: papel quase preto e liso, fios de 1px entre capítulos, rótulos em mono e muito respiro, como linear.app e resend.com.
- paper e surface quase pretos, ink quase branco, radius sm ou md, motif none. Não existe grade nem textura de fundo: os capítulos se separam por um fio de 1px.
- nav.bar layout minimal com position "fixed". Abra com hero.split layout editorial: headline de até 56 caracteres, lead curto e o painel de foto largo abaixo, que some no papel.
- Componha em capítulos: feature.numbered layout rail (índice em mono e fio vertical), proof.stats layout strip para números, editorial.text layout lead como declaração em duas cores e narrative.split layout editorial. Nada de card decorado.
- O botão principal é uma pílula clara. As cores do cadastro pintam links, numerais e no máximo uma seção com presentation.tone "accent". Use presentation.edge "line" só onde o fio ajuda e no máximo duas seções com motion "reveal".
- Fotos de detalhe, produto ou processo com borda fina, sem moldura. Evite pessoa posando para a câmera.`,
  ousado: `Vibe ousado: escala tipográfica extrema, imagem de borda a borda e faixas de cor.
- A home abre com o hero coberto pela foto e headline de até 36 caracteres: a fonte cresce até 11vw e uma frase longa vira quatro linhas. Nas páginas internas, hero.statement layout oversize sustenta a abertura sem foto.
- Navegação contrast, imagem full-bleed, superfície contrast e motif stripes. A galeria da home usa presentation.width "full".
- Blocos inteiros em presentation.tone "ink"; rótulos curtos em caixa alta; cantos retos e nenhuma sombra.
- Contraste alto e uma cor de acento só. Texto curto e firme, com a explicação logo abaixo do título.`,
  artistico: `Vibe artístico: papel claro e quente, display serifada e composição editorial com sobreposição.
- Navegação floating com position "fixed": a ilha flutua sobre a abertura. Tratamento collage ou cutout e superfície layered. Deixe o texto sobrepor a foto e use legenda nas imagens.
- Headline do hero com até 40 caracteres, de preferência três ou quatro palavras: a display serifada cresce até 8vw e uma frase longa vira uma palavra por linha. A explicação fica no subtext.
- media.gallery layout masonry aceita duas fotos: elas viram uma dupla em largura inteira. Com três ou mais, as colunas alternam alturas.
- narrative.split layout overlap, editorial.text layout lead com presentation.align "center" nas declarações, faq.accordion layout cards em tom "soft".
- Escolha motif rings ou corners como elemento-assinatura e realize-o nas props, não só no conceito.
- As cores do cadastro aparecem como lavagem suave entre seções; mantenha o texto sempre sobre superfície legível.`,
};

/** Direção de imagem por vibe, usada no briefing e na etapa de cenas. */
export const VIBE_IMAGE_DIRECTION: Record<Vibe, string> = {
  landing:
    'Produto ou resultado em primeiro plano, fundo limpo e luz uniforme. Sem pessoa posando. Upload de produto ou tela fornecido pelo cliente prevalece no hero; não invente interface nem use foto gerada como depoimento.',
  comercial:
    'Fotografia documental do negócio real, luz natural, sem cara de banco de imagens.',
  moderno:
    'Luz fria e controlada, foco em objeto, detalhe ou processo, fundo escuro ou neutro e liso, pouca presença humana. Nada de sorriso para a câmera. Um painel de produto ou processo aceita sumir no papel pela borda de baixo.',
  ousado:
    'Fotografia gráfica e contrastada, recorte fechado, ângulo incomum, cor em bloco. O assunto precisa sobreviver a um recorte panorâmico.',
  artistico:
    'Luz natural quente, pessoas em interação genuína, cores suaves e espaço negativo para sobreposição de texto.',
};

/** Tom da seção automática de localização, por vibe. */
export const VIBE_LOCATION_TONE: Record<Vibe, 'paper' | 'soft' | 'ink'> = {
  landing: 'paper',
  comercial: 'soft',
  moderno: 'soft',
  ousado: 'ink',
  artistico: 'soft',
};
