import {
  bestInk,
  contrastRatio,
  readableHighlight,
  readableMuted,
} from '@/lib/blocks/contrast';
import type { Brand } from '@/lib/types';

/** Cores locais: hex validado no catálogo; nunca CSS livre nem alteração da marca. */
export function sectionColorVars(
  presentation: { background?: string; foreground?: string } | undefined,
  brand: Brand,
): Record<string, string> | undefined {
  if (!presentation?.background) return undefined;
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
    backgroundColor: paper,
    color: ink,
  };
}
