import {
  AA_NORMAL,
  bestInkFor,
  contrastRatio,
  mixHex,
} from '@/lib/blocks/contrast';
import type { Brand } from '@/lib/types';
import {
  decoratedSurfaceColors,
  surfaceOf,
  themeVars,
  type SectionSurfaceContext,
} from './theme';

export type SectionPresentation = {
  background?: string;
  backgroundEnd?: string;
  decoration?: 'vibe' | 'none';
  foreground?: string;
  gradient?: 'down' | 'diagonal' | 'right';
  tone?: string;
};

const GRADIENT_ANGLES: Record<
  NonNullable<SectionPresentation['gradient']>,
  string
> = {
  down: '180deg',
  diagonal: '160deg',
  right: '90deg',
};

/** Mesmos tokens do CSS, inclusive o papel elevado da vibe moderna. */
export function sectionBackgrounds(
  presentation: SectionPresentation | undefined,
  brand: Brand,
  context: SectionSurfaceContext = {},
): string[] {
  if (presentation?.background === 'transparent')
    return [themeVars(brand)['--paper']];
  if (presentation?.background) {
    if (presentation.backgroundEnd && presentation.gradient)
      return [presentation.background, presentation.backgroundEnd];
    return [surfaceOf(brand, presentation.tone, presentation.background)];
  }
  const decorated = decoratedSurfaceColors(brand, presentation, context);
  if (decorated) return decorated;
  if (presentation?.tone)
    return [surfaceOf(brand, presentation.tone, presentation.background)];
  return [
    ...new Set([themeVars(brand)['--paper'], themeVars(brand)['--surface']]),
  ];
}

function readableAcross(
  color: string,
  ink: string,
  backgrounds: string[],
): string {
  if (
    backgrounds.every((background) => contrastRatio(color, background) >= 4.5)
  )
    return color;
  for (let step = 1; step <= 25; step += 1) {
    const candidate = mixHex(color, ink, step / 25);
    if (
      backgrounds.every(
        (background) => contrastRatio(candidate, background) >= 4.5,
      )
    )
      return candidate;
  }
  return ink;
}

/** Cores locais: hex validado no catálogo; nunca CSS livre nem alteração da marca. */
export function sectionColorVars(
  presentation: SectionPresentation | undefined,
  brand: Brand,
  context: SectionSurfaceContext = {},
): Record<string, string> | undefined {
  const decorated = decoratedSurfaceColors(brand, presentation, context);
  if (!presentation?.background && !decorated) return undefined;
  if (presentation?.background === 'transparent') {
    const vars = themeVars(brand);
    return { ...vars, backgroundColor: 'transparent', color: vars['--ink'] };
  }
  const backgrounds = sectionBackgrounds(presentation, brand, context);
  const paper = backgrounds[0];
  const theme = themeVars(brand);
  const toneInk = (() => {
    switch (presentation?.tone) {
      case 'ink': {
        const surface = surfaceOf(brand, 'ink');
        return contrastRatio(theme['--brand-ink'], surface) >=
          contrastRatio(theme['--brand-paper'], surface)
          ? theme['--brand-ink']
          : theme['--brand-paper'];
      }
      case 'accent':
        return theme['--accent-ink'];
      case 'secondary':
        return theme['--accent-2-ink'];
      default:
        return theme['--brand-ink'];
    }
  })();
  const preferredPasses = backgrounds.every(
    (background) => contrastRatio(toneInk, background) >= 4.5,
  );
  const ink =
    presentation?.foreground ??
    (presentation?.background
      ? bestInkFor(backgrounds).ink
      : preferredPasses
        ? toneInk
        : bestInkFor(backgrounds).ink);
  const muted = readableAcross(mixHex(paper, ink, 0.62), ink, backgrounds);
  const highlight = brand.highlight || brand.accent || '#1f6feb';
  const highlightText = readableAcross(highlight, ink, backgrounds);
  const textVars = {
    '--ink': ink,
    '--muted': muted,
    '--muted-soft': muted,
    '--highlight-text-soft': highlightText,
    '--line': `color-mix(in oklab, ${ink} 18%, ${paper})`,
    '--highlight-text': highlightText,
    color: ink,
  };
  // A decoração da vibe continua pintando seus próprios tokens. O wrapper só
  // fornece uma tinta comum calculada a partir da tabela de superfícies.
  if (!presentation?.background) return textVars;
  return {
    ...textVars,
    '--paper': paper,
    // Cards e superfícies internas não podem herdar o papel claro da marca
    // junto de uma tinta branca escolhida para a seção escura.
    '--surface': paper,
    '--services-surface': paper,
    backgroundColor: presentation.background,
    ...(presentation.backgroundEnd && presentation.gradient
      ? {
          backgroundImage: `linear-gradient(${GRADIENT_ANGLES[presentation.gradient]}, ${presentation.background}, ${presentation.backgroundEnd})`,
        }
      : {}),
  };
}

/**
 * Véu do hero `cover` na cor do operador quando ela sustenta a cópia branca.
 * O limiar usado para logos também aceita tons médios e não serve para texto.
 * Recusa a cor se nem o extremo de 78% do véu, composto sobre uma foto branca,
 * sustenta o apoio branco a 78% em AA. As opacidades vêm de operator.css e
 * site.css; a dissolução do gradiente ainda exige verificar os pixels.
 */
export function sectionScrim(
  presentation: { background?: string } | undefined,
): 'paper' | undefined {
  const background = presentation?.background;
  if (!background || !/^#[0-9a-f]{6}$/i.test(background)) return undefined;
  const scrimOnWhite = mixHex('#ffffff', background, 0.78);
  const copyOnScrim = mixHex(scrimOnWhite, '#ffffff', 0.78);
  return contrastRatio(copyOnScrim, scrimOnWhite) >= AA_NORMAL
    ? 'paper'
    : undefined;
}
