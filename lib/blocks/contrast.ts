/** Mínimo do WCAG AA para texto normal. */
export const AA_NORMAL = 4.5;

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  if (value.length !== 6) return 0;
  const [r, g, b] = [0, 2, 4].map((i) =>
    channel(parseInt(value.slice(i, i + 2), 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
}

const NEAR_BLACK = '#14161a';
const NEAR_WHITE = '#ffffff';

/**
 * Escolhe a cor do texto sobre um fundo pelo contraste medido, não por um
 * limiar de luminância. Um laranja médio como #c45c26 dá 4,28 com branco e
 * 4,90 com preto: o chute pela luminância erra, a razão de contraste acerta.
 */
export function bestInk(background: string): {
  ink: string;
  ratio: number;
  passesAA: boolean;
} {
  const onWhite = contrastRatio(background, NEAR_WHITE);
  const onBlack = contrastRatio(background, NEAR_BLACK);
  const ink = onBlack >= onWhite ? NEAR_BLACK : NEAR_WHITE;
  const ratio = Math.max(onBlack, onWhite);
  return { ink, ratio, passesAA: ratio >= AA_NORMAL };
}

function toRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Mistura sRGB entre duas cores, para tokens que precisam de hex resolvido. */
export function mixHex(hex: string, target: string, amount: number): string {
  return mix(hex, target, amount);
}

function mix(hex: string, target: string, amount: number): string {
  const from = toRgb(hex);
  const to = toRgb(target);
  return toHex(
    [0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * amount) as [
      number,
      number,
      number,
    ],
  );
}

/**
 * Cor de texto secundário: começa na mistura desejada com o fundo e volta em
 * direção à tinta até alcançar o contraste mínimo.
 *
 * O texto de apoio é a maior parte do corpo da página. Uma mistura fixa passa
 * com uma marca e reprova com a seguinte, então a proporção precisa sair de
 * medição, não de um número escolhido a olho.
 */
export function readableMuted(
  ink: string,
  paper: string,
  start = 0.62,
): string {
  for (let amount = start; amount <= 1.0001; amount += 0.04) {
    const candidate = mix(paper, ink, Math.min(amount, 1));
    if (contrastRatio(candidate, paper) >= AA_NORMAL) return candidate;
  }
  return ink;
}

/**
 * Devolve a cor de fundo mais próxima da escolhida que passe no AA com alguma
 * cor de texto legível, escurecendo em passos pequenos.
 *
 * Existe porque um laranja de marca comum, #c45c26, fica em 4,28 com branco e
 * 4,31 com quase preto: reprova com as duas. Manter a cor crua faria o botão
 * principal do cliente reprovar em acessibilidade e sumir no sol do celular.
 * Escurecer alguns por cento preserva a matiz e resolve.
 */
export function accessibleAccent(accent: string): {
  accent: string;
  ink: string;
  ratio: number;
  adjusted: boolean;
} {
  const direct = bestInk(accent);
  if (direct.passesAA)
    return { accent, ink: direct.ink, ratio: direct.ratio, adjusted: false };

  for (let step = 1; step <= 14; step += 1) {
    const candidate = mix(accent, '#000000', step * 0.04);
    const result = bestInk(candidate);
    if (result.passesAA)
      return {
        accent: candidate,
        ink: result.ink,
        ratio: result.ratio,
        adjusted: true,
      };
  }
  // Nada passou: devolve o melhor par possível, e o painel avisa.
  return { accent, ink: direct.ink, ratio: direct.ratio, adjusted: false };
}
