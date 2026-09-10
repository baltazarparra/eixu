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
  const font =
    brand.font === 'serif'
      ? 'var(--font-serif)'
      : brand.font === 'mono'
        ? 'var(--font-mono)'
        : 'var(--font-sans)';
  return {
    '--ink': ink,
    '--paper': paper,
    '--accent': accent,
    '--accent-ink': accentInk,
    '--muted': readableMuted(ink, paper),
    '--line': `color-mix(in oklab, ${ink} 14%, ${paper})`,
    '--radius': RADIUS[brand.radius ?? 'md'] ?? '0.5rem',
    '--font-site': font,
    '--panel-radius': `min(${RADIUS[brand.radius ?? 'md'] ?? '0.5rem'}, 1.5rem)`,
  };
}
