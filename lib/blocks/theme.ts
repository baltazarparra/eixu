import {
  currentLogoAsset,
  currentDarkLogoAsset,
} from '@/lib/images/logo-schema';
import {
  accessibleAccent,
  contrastRatio,
  isDarkSurface,
  mixHex,
  mixOklabHex,
  readableHighlight,
  readableMuted,
} from '@/lib/blocks/contrast';
import type { Brand } from '@/lib/types';
import { BODY_TYPE, DISPLAY_TYPE } from '@/lib/design/typography';
import { renderingVibeOf } from '@/lib/design/vibes';
import { referenceAspects } from '@/lib/design/references';

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
  // Acento é a cor da ação: botão, link e destaque. Sem ela o site continua
  // usando a primária, que é como os clientes antigos foram publicados.
  const { accent: highlight, ink: highlightInk } = accessibleAccent(
    brand.highlight || brand.accent || '#1f6feb',
  );
  // A superfície precisa ser uma cor resolvida: readableMuted mede contraste
  // e não sabe ler um color-mix.
  // A lavagem artística precisa ser a mesma superfície usada nos cálculos
  // de texto. Se a mistura tirar o contraste da tinta, preserve o papel.
  const artisticSurface = mixHex(paper, accentAlt, 0.11);
  // A lavagem é decisão de superfície. Quando a referência documenta superfície,
  // a superfície escolhida na direção vale como está.
  const washes =
    renderingVibeOf(brand) === 'artistico' &&
    !referenceAspects(brand).has('surface');
  const surface = washes
    ? contrastRatio(ink, artisticSurface) >= 4.5
      ? artisticSurface
      : paper
    : brand.surface || mixHex(ink, paper, 0.04);
  const servicesSurface = mixHex(paper, ink, 0.03);
  const legacyFont =
    brand.font === 'serif'
      ? 'var(--font-serif)'
      : brand.font === 'mono'
        ? 'var(--font-mono)'
        : 'var(--font-sans)';
  const displayType =
    DISPLAY_TYPE[brand.design?.displayFont ?? 'sans'] ?? DISPLAY_TYPE.sans;
  const bodyType =
    BODY_TYPE[brand.design?.bodyFont ?? 'sans'] ?? BODY_TYPE.sans;
  const displayFont = brand.design
    ? `var(${displayType.variable})`
    : legacyFont;
  const bodyFont = brand.design ? `var(${bodyType.variable})` : legacyFont;
  return {
    '--brand-ink': ink,
    '--brand-paper': paper,
    '--ink': ink,
    '--paper': paper,
    '--accent': accent,
    '--accent-ink': accentInk,
    '--accent-2': accentAlt,
    '--accent-2-ink': accentAltInk,
    '--highlight': highlight,
    '--highlight-ink': highlightInk,
    // Botões usam o par de fundo/tinta acima; texto solto precisa contrastar
    // com a superfície da seção, inclusive quando o destaque escolhido é branco.
    '--highlight-text': readableHighlight(highlight, paper),
    '--highlight-text-paper': readableHighlight(highlight, paper),
    '--highlight-text-soft': readableHighlight(highlight, surface),
    '--highlight-text-services': readableHighlight(highlight, servicesSurface),
    '--highlight-text-ink': readableHighlight(highlight, ink),
    '--highlight-text-accent': readableHighlight(highlight, accent),
    '--highlight-text-accent-2': readableHighlight(highlight, accentAlt),
    '--surface': surface,
    '--services-surface': servicesSurface,
    '--muted': readableMuted(ink, paper),
    // Cada tom de seção troca ink e paper, então o texto de apoio precisa do
    // seu próprio valor medido. A mistura fixa do CSS dava 3,56 contra a cor
    // de marca, e o miolo das seções coloridas ficava ilegível.
    '--muted-soft': readableMuted(ink, surface, 0.64),
    '--muted-ink': readableMuted(paper, ink, 0.68),
    '--muted-accent': readableMuted(accentInk, accent, 0.72),
    '--muted-accent-2': readableMuted(accentAltInk, accentAlt, 0.72),
    '--muted-highlight': readableMuted(highlightInk, highlight, 0.72),
    '--line': `color-mix(in oklab, ${ink} 14%, ${paper})`,
    '--radius': RADIUS[brand.radius ?? 'md'] ?? '0.5rem',
    '--font-site': bodyFont,
    '--font-body': bodyFont,
    '--font-display': displayFont,
    '--display-weight': String(displayType.weight),
    '--display-leading': String(displayType.leading),
    '--display-tracking': displayType.tracking,
    '--body-leading': String(bodyType.leading),
    '--body-measure': bodyType.measure,
    '--quote-style':
      ['editorial', 'literary'].includes(brand.design?.bodyFont ?? '') ||
      (!brand.design && brand.font === 'serif')
        ? 'italic'
        : 'normal',
    '--panel-radius': `min(${RADIUS[brand.radius ?? 'md'] ?? '0.5rem'}, 1.5rem)`,
  };
}

/**
 * Papel efetivo de uma seção pelo tom, com as mesmas cores medidas acima. Uma
 * cor de fundo local válida prevalece sobre o tom. Serve para decidir o que
 * fica sobre a seção antes de renderizar, como a versão do logo.
 */
export function surfaceOf(
  brand: Brand,
  tone?: string,
  background?: string,
  navigation?: string,
): string {
  const ink = brand.ink || '#14161a';
  const paper = brand.paper || '#ffffff';
  // .site-nav-contrast redefine o papel dentro da ilha de navegação.
  if (navigation === 'contrast') return ink;
  if (background && /^#[0-9a-f]{6}$/i.test(background)) return background;
  switch (tone) {
    case 'ink':
      return renderingVibeOf(brand) === 'moderno'
        ? mixOklabHex(paper, ink, 0.12)
        : ink;
    case 'accent':
      return accessibleAccent(brand.accent || '#1f6feb').accent;
    case 'secondary':
      return accessibleAccent(brand.accentAlt || brand.accent || '#1f6feb')
        .accent;
    case 'soft':
      // Reutiliza a lavagem artística e o fallback efetivamente emitidos.
      return themeVars(brand)['--surface'];
    default:
      return paper;
  }
}

/**
 * Logo que a nav ou o rodapé mostram: a versão para fundo escuro quando a
 * seção é escura e ela existe; senão o logo principal. A escolha é medida no
 * servidor, não pelo tema do aparelho: o site não tem modo escuro, tem papel.
 */
export function logoFor(
  brand: Brand,
  presentation?: { tone?: string; background?: string },
  navigation?: string,
): string | undefined {
  if (!brand.logoUrl) return undefined;
  if (
    brand.logoDarkUrl &&
    isDarkSurface(
      surfaceOf(
        brand,
        presentation?.tone,
        presentation?.background,
        navigation,
      ),
    )
  )
    return brand.logoDarkUrl;
  return brand.logoUrl;
}

/** Acrescenta dimensões reais sem mudar a regra de escolha por superfície. */
export function logoImage(
  brand: Brand,
  presentation?: { tone?: string; background?: string },
  navigation?: string,
):
  | { src: string; width?: number; height?: number; displayHeight: number }
  | undefined {
  const src = logoFor(brand, presentation, navigation);
  if (!src) return undefined;
  const asset =
    src === brand.logoDarkUrl
      ? currentDarkLogoAsset(brand)
      : currentLogoAsset(brand);
  return asset
    ? {
        src: asset.nav.url,
        width: asset.nav.width,
        height: asset.nav.height,
        displayHeight: asset.displayHeight,
      }
    : { src, displayHeight: 48 };
}
