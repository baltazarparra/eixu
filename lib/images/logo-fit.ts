import { isDarkSurface } from '@/lib/blocks/contrast';
import { surfaceOf } from '@/lib/blocks/theme';
import type { Brand, LogoFit, TenantImage } from '@/lib/types';

export type LogoSurfaceIssue =
  | 'placa-clara-em-fundo-escuro'
  | 'tinta-escura-em-fundo-escuro'
  | 'placa-escura-em-fundo-claro'
  | 'tinta-clara-em-fundo-claro';

/**
 * O que um logo medido faz sobre uma superfície. Placa clara sobre papel
 * escuro vira um retângulo branco no cabeçalho; tinta escura sem nenhum pixel
 * claro some. Os limites vêm da medição dos logos reais em 12/09/2026: a
 * tinta escura de iterum tem luminância média 0,13 e nenhum pixel claro; o
 * Fisk, placa vermelha com texto vazado, tem 28% de pixels claros e passa.
 */
export function logoSurfaceIssue(
  fit: LogoFit,
  surface: string,
): LogoSurfaceIssue | null {
  if (isDarkSurface(surface)) {
    if (fit.plate === 'light') return 'placa-clara-em-fundo-escuro';
    if (!fit.plate && fit.opaqueLuminance < 0.25 && fit.lightFraction < 0.15)
      return 'tinta-escura-em-fundo-escuro';
    return null;
  }
  if (fit.plate === 'dark') return 'placa-escura-em-fundo-claro';
  if (!fit.plate && fit.opaqueLuminance > 0.8 && fit.darkFraction < 0.15)
    return 'tinta-clara-em-fundo-claro';
  return null;
}

export const ISSUE_TEXT: Record<LogoSurfaceIssue, string> = {
  'placa-clara-em-fundo-escuro':
    'o arquivo não tem fundo transparente e vira uma placa clara',
  'tinta-escura-em-fundo-escuro': 'a tinta é escura e some',
  'placa-escura-em-fundo-claro':
    'o arquivo não tem fundo transparente e vira uma placa escura',
  'tinta-clara-em-fundo-claro': 'a tinta é clara e some',
};

/** Texto do problema do logo aplicado sobre o papel da marca, para o painel. */
export function logoIssueText(
  brand: Pick<Brand, 'logoUrl' | 'logoFit' | 'paper'>,
): string | null {
  const fit = brand.logoFit;
  if (!brand.logoUrl || !fit || fit.source !== brand.logoUrl) return null;
  const issue = logoSurfaceIssue(fit, brand.paper ?? '#ffffff');
  return issue ? ISSUE_TEXT[issue] : null;
}

type LogoBrand = Pick<
  Brand,
  | 'logoUrl'
  | 'logoDarkUrl'
  | 'logoFit'
  | 'paper'
  | 'ink'
  | 'surface'
  | 'accent'
  | 'accentAlt'
> & { vibe?: string; design?: unknown };

type PageLike = {
  slug: string;
  blocks: { type: string; props: Record<string, unknown> }[];
};

type Presentation = { tone?: string; background?: string };

function presentationOf(
  page: PageLike | undefined,
  type: string,
): Presentation | undefined {
  const block = page?.blocks.find((b) => b.type === type);
  return block?.props.presentation as Presentation | undefined;
}

export type LogoFinding = {
  level: 'warn';
  rule: 'logo-fundo-escuro' | 'logo-fundo-claro';
  message: string;
};

/**
 * Achado de composição para o pre-flight: o logo aplicado, medido ao ser
 * aplicado, contra o papel real do cabeçalho e do rodapé da home. Sem medição
 * (logo anterior a ela) não há achado. A versão para fundo escuro resolve o
 * caso escuro; a biblioteca é consultada para citar o número dela.
 */
export function logoFindings(
  brand: LogoBrand,
  pages: PageLike[],
  images: Pick<
    TenantImage,
    'seq' | 'kind' | 'status' | 'referenceUrls' | 'url'
  >[],
): LogoFinding[] {
  const fit = brand.logoFit;
  if (!brand.logoUrl || !fit || fit.source !== brand.logoUrl) return [];
  const renderingBrand = brand as Brand;
  const home = pages.find((page) => page.slug === '');
  const nav = home?.blocks.find((block) => block.type === 'nav.bar');
  const navigation =
    typeof nav?.props.layout === 'string'
      ? nav.props.layout
      : renderingBrand.design?.navigation;
  const surfaces = [
    ['cabeçalho', presentationOf(home, 'nav.bar'), navigation],
    ['rodapé', presentationOf(home, 'footer.compact'), undefined],
  ] as const;
  const issues = surfaces
    .map(([where, presentation, navigation]) => ({
      where,
      issue: logoSurfaceIssue(
        fit,
        surfaceOf(
          renderingBrand,
          presentation?.tone,
          presentation?.background,
          navigation,
        ),
      ),
    }))
    .filter((entry) => entry.issue);
  const dark = issues.filter((entry) => entry.issue!.endsWith('escuro'));
  const light = issues.filter((entry) => entry.issue!.endsWith('claro'));
  const findings: LogoFinding[] = [];
  if (dark.length && !brand.logoDarkUrl) {
    const white = images.find(
      (image) =>
        image.kind === 'logo' &&
        image.status !== 'rejeitada' &&
        image.url !== brand.logoUrl &&
        image.referenceUrls?.includes(brand.logoUrl!),
    );
    findings.push({
      level: 'warn',
      rule: 'logo-fundo-escuro',
      message: `No ${dark.map((d) => d.where).join(' e no ')} escuro, ${ISSUE_TEXT[dark[0].issue!]}. ${
        white
          ? `Aplique a versão para fundo escuro #${white.seq} na biblioteca ou envie um PNG com fundo transparente.`
          : 'Envie um PNG com fundo transparente ou peça uma versão branca do logo pelo chat.'
      }`,
    });
  }
  if (light.length)
    findings.push({
      level: 'warn',
      rule: 'logo-fundo-claro',
      message: `No ${light.map((l) => l.where).join(' e no ')} claro, ${ISSUE_TEXT[light[0].issue!]}. Envie um PNG com fundo transparente e tinta legível sobre o papel.`,
    });
  return findings;
}
