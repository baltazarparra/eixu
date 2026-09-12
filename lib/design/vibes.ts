import { z } from 'zod';
import { relativeLuminance } from '@/lib/blocks/contrast';
import { DESIGN_AXES, type DesignProfileInput } from '@/lib/design/profile';
import { hasReferenceDirection } from './references';

/**
 * Vibe do site, escolhida pelo operador no cadastro. Ela não substitui a
 * direção de arte: continua sendo o agente que decide conceito, estrutura e
 * tipografia. Referências visuais verificadas prevalecem sobre essa faixa;
 * sem elas, a direção permanece dentro da vibe. Todos os quatro contratos são
 * delimitados. A voz em lib/copy/policy.ts continua valendo quando uma
 * referência dirige o visual.
 *
 * Referências lidas em 10/09/2026: linear.app (moderno), 14islands.com
 * (ousado) e actionline.io (artistico). Elas orientam a linguagem visual; o
 * conteúdo continua vindo do briefing do cliente.
 */
export const VIBES = ['comercial', 'moderno', 'ousado', 'artistico'] as const;
export type Vibe = (typeof VIBES)[number];

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

/** Referência aplicada usa os tokens e as props escolhidos, sem overrides da vibe. */
export function renderingVibeOf(
  brand: { vibe?: string; design?: unknown } | null | undefined,
): Vibe {
  return hasReferenceDirection(brand) ? 'comercial' : vibeOf(brand);
}

export const VIBE_LABEL: Record<Vibe, string> = {
  comercial: 'Comercial',
  moderno: 'Moderno',
  ousado: 'Ousado',
  artistico: 'Artístico',
};

export const VIBE_HINT: Record<Vibe, string> = {
  comercial:
    'Clareza acolhedora: benefício, prova e contato em um percurso direto e simples.',
  moderno:
    'Sistema preciso: fundo escuro, grade e capítulos espaçados, com voz clara e tranquila.',
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
  comercial: {
    primary: '#1f6feb',
    secondary: '#dbeafe',
    highlight: '#b45309',
  },
  moderno: {
    primary: '#111827',
    secondary: '#1f2937',
    highlight: '#22d3ee',
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
  moderno: {
    axes: {
      displayFont: ['geometric', 'grotesk'],
      bodyFont: ['sans', 'source'],
      heroComposition: ['editorial', 'offset'],
      navigation: ['minimal'],
      rhythm: ['chapters'],
      imageTreatment: ['framed'],
      surfaceStyle: ['outlined'],
      motif: ['none', 'grid'],
    },
    radius: ['sm'],
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
 * O que a direção proposta viola na faixa da vibe. Lista vazia quer dizer
 * aprovada. Serve tanto para o gate de set_design quanto para teste.
 */
export function laneIssues(vibe: Vibe, input: DesignProfileInput): string[] {
  const lane = VIBE_LANE[vibe];
  const issues: string[] = [];
  for (const axis of DESIGN_AXES) {
    const allowed = lane.axes[axis] as readonly string[];
    if (!allowed.includes(input[axis]))
      issues.push(
        `${AXIS_LABEL[axis]}: "${input[axis]}" não pertence à vibe ${VIBE_LABEL[vibe]}. Use ${allowed.join(', ')}.`,
      );
  }
  if (!(lane.radius as readonly string[]).includes(input.radius))
    issues.push(
      `radius: "${input.radius}" não pertence à vibe ${VIBE_LABEL[vibe]}. Use ${lane.radius.join(', ')}.`,
    );

  const paperLuminance = relativeLuminance(input.paper);
  const surfaceLuminance = relativeLuminance(input.surface);
  const [paperMin, paperMax] = lane.paper;
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
  if (lane.ink) {
    const inkLuminance = relativeLuminance(input.ink);
    if (inkLuminance < lane.ink[0] || inkLuminance > lane.ink[1])
      issues.push(
        `ink: ${input.ink} não serve para texto claro sobre fundo escuro. Use uma tinta quase branca.`,
      );
  }
  for (const dial of ['variance', 'motion', 'density'] as const) {
    const [min, max] = lane.dials[dial];
    if (input[dial] < min || input[dial] > max)
      issues.push(
        `${dial}: ${input[dial]} fora da faixa ${min}–${max} da vibe ${VIBE_LABEL[vibe]}.`,
      );
  }
  return issues;
}

/** Direção que entra no prompt junto com a seção de design. */
export const VIBE_DIRECTION: Record<Vibe, string> = {
  comercial: `Vibe comercial: percurso direto, acolhedor e orientado à decisão.
- Use display humanist ou slab com corpo humanist/source; hero split ou cover com benefício, foto documental e CTA visível.
- Navegação bar, imagem framed e superfície flat. Alterne oferta, aplicações/provas reais, dúvidas e contato; não transforme tudo em cartões.
- Ícones regulares e semânticos só onde aceleram leitura. Cantos discretos, movimento funcional e hierarquia de conversão clara.`,
  moderno: `Vibe moderno: superfície escura e monocromática, uma cor de acento só, linhas de 1px e muito respiro.
- paper e surface quase pretos, ink quase branco, radius sm. As cores do cadastro pintam acento, botões e uma única seção colorida.
- Componha em capítulos com hero editorial ou offset, navegação minimal, narrative.split layout editorial e feature.numbered layout rail. A grade e a linha fina precisam organizar a página inteira.
- proof.stats layout strip para números; nada de card decorado. Use presentation.edge "line" nas transições e no máximo duas seções com motion "reveal".
- Fotos de detalhe, produto ou processo, emolduradas. Evite pessoa posando para a câmera.`,
  ousado: `Vibe ousado: tipografia enorme na abertura, muito branco e imagem de borda a borda.
- Abra com hero.statement layout oversize e headline de até 36 caracteres: a fonte cresce até 11vw e uma frase longa vira quatro linhas.
- Use navegação contrast, hero cover ou poster e imagem full-bleed. Logo abaixo do statement, use a cena de abertura do plano em media.image layout bleed. O plano gera 16:9 em cover e 4:5 em poster.
- media.gallery layout grid ou collage com presentation.width "full"; blocos inteiros em presentation.tone "ink"; cta.band layout poster.
- Rótulos curtos em caixa alta, cantos retos, nenhuma sombra. Contraste alto e uma cor de acento só.`,
  artistico: `Vibe artístico: papel claro e quente, display serifada e composição editorial com sobreposição.
- Abra com hero.split layout offset ou atelier, navegação floating e tratamento collage/cutout. Deixe o texto sobrepor a foto e use legenda nas imagens.
- narrative.split layout overlap, editorial.text layout lead com presentation.align "center" nas declarações, faq.accordion layout cards em tom "soft", cta.band layout poster.
- Escolha motif rings ou corners como elemento-assinatura e realize-o nas props, não só no conceito.
- As cores do cadastro aparecem como lavagem suave entre seções; mantenha o texto sempre sobre superfície legível.`,
};

/** Direção de imagem por vibe, usada no briefing e na etapa de cenas. */
export const VIBE_IMAGE_DIRECTION: Record<Vibe, string> = {
  comercial:
    'Fotografia documental do negócio real, luz natural, sem cara de banco de imagens.',
  moderno:
    'Luz fria e controlada, foco em objeto, detalhe ou processo, fundo escuro ou neutro, pouca presença humana. Nada de sorriso para a câmera.',
  ousado:
    'Fotografia gráfica e contrastada, recorte fechado, ângulo incomum, cor em bloco. O assunto precisa sobreviver a um recorte panorâmico.',
  artistico:
    'Luz natural quente, pessoas em interação genuína, cores suaves e espaço negativo para sobreposição de texto.',
};

/** Tom da seção automática de localização, por vibe. */
export const VIBE_LOCATION_TONE: Record<Vibe, 'paper' | 'soft' | 'ink'> = {
  comercial: 'soft',
  moderno: 'soft',
  ousado: 'ink',
  artistico: 'soft',
};
