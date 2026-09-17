/** Catálogo compartilhado pelo schema, prompt e renderizador. IDs antigos são estáveis. */
export const DISPLAY_FONTS = [
  'sans',
  'editorial',
  'geometric',
  'humanist',
  'mono',
  'grotesk',
  'condensed',
  'expressive',
  'classic',
  'slab',
] as const;
export const BODY_FONTS = [
  'sans',
  'editorial',
  'geometric',
  'humanist',
  'work',
  'literary',
  'source',
] as const;

export const DISPLAY_TYPE = {
  sans: {
    name: 'Geist',
    variable: '--font-sans',
    weight: 600,
    leading: 1.04,
    tracking: '-0.04em',
  },
  editorial: {
    name: 'Fraunces',
    variable: '--font-display-editorial',
    weight: 500,
    leading: 1.08,
    tracking: '-0.025em',
  },
  geometric: {
    name: 'Space Grotesk',
    variable: '--font-geometric',
    weight: 600,
    leading: 1.05,
    tracking: '-0.04em',
  },
  humanist: {
    name: 'Manrope',
    variable: '--font-humanist',
    weight: 600,
    leading: 1.08,
    tracking: '-0.035em',
  },
  mono: {
    name: 'Geist Mono',
    variable: '--font-mono',
    weight: 500,
    leading: 1.12,
    tracking: '-0.04em',
  },
  grotesk: {
    name: 'Sora',
    variable: '--font-grotesk',
    weight: 600,
    leading: 1.06,
    tracking: '-0.045em',
  },
  condensed: {
    name: 'Barlow Condensed',
    variable: '--font-condensed',
    weight: 700,
    leading: 1,
    tracking: '-0.015em',
  },
  expressive: {
    name: 'Syne',
    variable: '--font-expressive',
    weight: 700,
    leading: 1.04,
    tracking: '-0.04em',
  },
  classic: {
    name: 'Bodoni Moda',
    variable: '--font-classic',
    weight: 500,
    leading: 1.1,
    tracking: '-0.025em',
  },
  slab: {
    name: 'Roboto Slab',
    variable: '--font-slab',
    weight: 600,
    leading: 1.1,
    tracking: '-0.03em',
  },
} as const;

export const BODY_TYPE = {
  sans: {
    name: 'Geist',
    variable: '--font-sans',
    leading: 1.65,
    measure: '64ch',
  },
  editorial: {
    name: 'Newsreader',
    variable: '--font-serif',
    leading: 1.65,
    measure: '60ch',
  },
  geometric: {
    name: 'Space Grotesk',
    variable: '--font-geometric',
    leading: 1.65,
    measure: '62ch',
  },
  humanist: {
    name: 'Manrope',
    variable: '--font-humanist',
    leading: 1.7,
    measure: '62ch',
  },
  work: {
    name: 'Work Sans',
    variable: '--font-work',
    leading: 1.65,
    measure: '64ch',
  },
  literary: {
    name: 'Literata',
    variable: '--font-literary',
    leading: 1.75,
    measure: '60ch',
  },
  source: {
    name: 'Source Sans 3',
    variable: '--font-source',
    leading: 1.7,
    measure: '65ch',
  },
} as const;

export const TYPOGRAPHY_DIRECTION = `Tipografia: escolha no máximo duas famílias por site, com funções claras. O renderer mantém escala fluida, entrelinha, medida e números tabulares. Não escolha duas sans parecidas só para variar.
- Display: ${DISPLAY_FONTS.map((id) => `${id} = ${DISPLAY_TYPE[id].name}`).join('; ')}.
- Corpo: ${BODY_FONTS.map((id) => `${id} = ${BODY_TYPE[id].name}`).join('; ')}. Condensadas e displays expressivas não servem para parágrafos.
- Comercial: slab + source para ofícios e serviços, humanist + humanist para uma voz acolhedora, editorial + work para leitura editorial.
- Moderno: grotesk + source ou geometric + sans; hierarquia precisa e rótulos discretos.
- Ousado: condensed + work ou expressive + sans; chamadas curtas, contraste de escala e corpo tranquilo.
- Artístico: classic + source ou editorial + literary; serifas, itálico real nas citações e legendas cuidadas. A escolha depende do negócio, não de rotação aleatória.`;
