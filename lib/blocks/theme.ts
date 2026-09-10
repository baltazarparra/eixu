import { accessibleAccent, readableMuted } from '@/lib/blocks/contrast';
import type { Brand } from '@/lib/types';

const RADIUS: Record<string, string> = {
  none: '0px',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.875rem',
  full: '999px',
};

/** Traduz a marca do tenant em variáveis CSS aplicadas na raiz da página. */
export function themeVars(brand: Brand): Record<string, string> {
  const ink = brand.ink || '#14161a';
  const paper = brand.paper || '#ffffff';
  // O acento vira a cor mais próxima que passe no contraste mínimo.
  const { accent, ink: accentInk } = accessibleAccent(
    brand.accent || '#1f6feb',
  );
  const { accent: accentAlt, ink: accentAltInk } = accessibleAccent(
    brand.accentAlt || brand.accent || '#1f6feb',
  );
  const legacyFont =
    brand.font === 'serif'
      ? 'var(--font-serif)'
      : brand.font === 'mono'
        ? 'var(--font-mono)'
        : 'var(--font-sans)';
  const displayFontMap = {
    sans: 'var(--font-sans)',
    editorial: 'var(--font-display-editorial)',
    geometric: 'var(--font-geometric)',
    humanist: 'var(--font-humanist)',
    mono: 'var(--font-mono)',
  } as const;
  const bodyFontMap = {
    sans: 'var(--font-sans)',
    editorial: 'var(--font-serif)',
    geometric: 'var(--font-geometric)',
    humanist: 'var(--font-humanist)',
  } as const;
  const displayFont = brand.design
    ? displayFontMap[brand.design.displayFont]
    : legacyFont;
  const bodyFont = brand.design
    ? bodyFontMap[brand.design.bodyFont]
    : legacyFont;
  return {
    '--brand-ink': ink,
    '--brand-paper': paper,
    '--ink': ink,
    '--paper': paper,
    '--accent': accent,
    '--accent-ink': accentInk,
    '--accent-2': accentAlt,
    '--accent-2-ink': accentAltInk,
    '--surface': brand.surface || `color-mix(in oklab, ${ink} 4%, ${paper})`,
    '--muted': readableMuted(ink, paper),
    '--line': `color-mix(in oklab, ${ink} 14%, ${paper})`,
    '--radius': RADIUS[brand.radius ?? 'md'] ?? '0.5rem',
    '--font-site': bodyFont,
    '--font-body': bodyFont,
    '--font-display': displayFont,
    '--panel-radius': `min(${RADIUS[brand.radius ?? 'md'] ?? '0.5rem'}, 1.5rem)`,
  };
}
