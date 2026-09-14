import {
  bestInk,
  contrastRatio,
  isDarkSurface,
  readableHighlight,
  readableMuted,
} from '@/lib/blocks/contrast';
import type { Brand } from '@/lib/types';
import { surfaceOf, themeVars } from './theme';

/** Mesmos tokens do CSS, inclusive o papel elevado da vibe moderna. */
export function sectionBackgrounds(
  presentation: { background?: string; tone?: string } | undefined,
  brand: Brand,
): string[] {
  if (presentation?.background === 'transparent')
    return [themeVars(brand)['--paper']];
  if (presentation?.background || presentation?.tone)
    return [surfaceOf(brand, presentation.tone, presentation.background)];
  return [
    ...new Set([themeVars(brand)['--paper'], themeVars(brand)['--surface']]),
  ];
}

/** Cores locais: hex validado no catálogo; nunca CSS livre nem alteração da marca. */
export function sectionColorVars(
  presentation: { background?: string; foreground?: string } | undefined,
  brand: Brand,
): Record<string, string> | undefined {
  if (!presentation?.background) return undefined;
  if (presentation.background === 'transparent') {
    const vars = themeVars(brand);
    return { ...vars, backgroundColor: 'transparent', color: vars['--ink'] };
  }
  const paper = presentation.background;
  const best = bestInk(paper);
  const automatic = best.passesAA
    ? best.ink
    : contrastRatio('#000000', paper) >= contrastRatio('#ffffff', paper)
      ? '#000000'
      : '#ffffff';
  const ink = presentation.foreground ?? automatic;
  return {
    '--paper': paper,
    '--ink': ink,
    '--muted': readableMuted(ink, paper),
    // Cards e superfícies internas não podem herdar o papel claro da marca
    // junto de uma tinta branca escolhida para a seção escura.
    '--surface': paper,
    '--services-surface': paper,
    '--muted-soft': readableMuted(ink, paper),
    '--highlight-text-soft': readableHighlight(
      brand.highlight || brand.accent || '#1f6feb',
      paper,
    ),
    '--line': `color-mix(in oklab, ${ink} 18%, ${paper})`,
    '--highlight-text': readableHighlight(
      brand.highlight || brand.accent || '#1f6feb',
      paper,
    ),
    backgroundColor: presentation.background,
    color: ink,
  };
}

/**
 * Véu do hero `cover` quando a seção recebeu cor escura do operador. O véu
 * padrão é preto e nega a cor pedida: um vermelho escuro vira cinza. Com fundo
 * claro ele continua preto, porque a cópia do cover é branca.
 */
export function sectionScrim(
  presentation: { background?: string } | undefined,
): 'paper' | undefined {
  const background = presentation?.background;
  if (!background || !/^#[0-9a-f]{6}$/i.test(background)) return undefined;
  return isDarkSurface(background) ? 'paper' : undefined;
}
