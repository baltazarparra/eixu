import type { BlockInstance, Brand } from '@/lib/types';
import type { Finding } from '@/lib/taste/lint';
import { blockFields } from './fields';
import { textStylesSchema } from './text-style-schema';
import { sectionBackgrounds, sectionColorVars } from './section-colors';
import { surfaceOf, themeVars } from './theme';
import { contrastRatio, mixHex, mixOklabHex } from './contrast';
import { renderingVibeOf } from '@/lib/design/vibes';

/** Superfícies internas que não usam o fundo externo do bloco. */
export function fieldBackgrounds(
  block: BlockInstance,
  field: string,
  brand: Brand,
): string[] {
  const p = block.props;
  const presentation = p.presentation as
    | { background?: string; foreground?: string; tone?: string }
    | undefined;
  const tokens = {
    ...themeVars(brand),
    ...sectionColorVars(presentation, brand),
  };
  const section = sectionBackgrounds(presentation, brand);
  const modern = renderingVibeOf(brand) === 'moderno';
  const version = brand.design?.version ?? 1;
  const paper = sectionBackgrounds(presentation, brand)[0];
  const cardInk = presentation?.background
    ? tokens['--ink']
    : presentation?.tone === 'ink' && !modern
      ? tokens['--brand-paper']
      : presentation?.tone === 'accent'
        ? tokens['--accent-ink']
        : presentation?.tone === 'secondary'
          ? tokens['--accent-2-ink']
          : tokens['--brand-ink'];
  const ink = presentation?.background
    ? tokens['--ink']
    : modern
      ? surfaceOf(brand, 'ink')
      : presentation?.tone === 'ink'
        ? tokens['--brand-paper']
        : presentation?.tone === 'accent'
          ? tokens['--accent-ink']
          : presentation?.tone === 'secondary'
            ? tokens['--accent-2-ink']
            : tokens['--ink'];
  if (block.type === 'hero.split') {
    const layout = p.layout ?? brand.design?.heroComposition ?? 'split';
    if (field === 'secondaryCaption') return [tokens['--brand-paper']];
    if (field === 'imageCaption')
      return layout === 'atelier'
        ? [
            mixHex(tokens['--brand-paper'], '#000000', 0.08),
            mixHex(tokens['--brand-paper'], '#ffffff', 0.08),
          ]
        : [tokens['--brand-paper']];
    // Foto com gradiente não oferece um papel uniforme que possa ser provado por tokens.
    if (layout === 'cover' && p.image && field !== 'secondaryCaption')
      return [];
    if (layout === 'poster' && !presentation?.background)
      return [tokens['--accent']];
  }
  if (block.type === 'feature.explorer' && field.startsWith('items.'))
    return [
      field.endsWith('.caption')
        ? tokens['--brand-paper']
        : tokens['--surface'],
    ];
  if (block.type === 'editorial.resources' && field.startsWith('items.'))
    return [
      Number(field.split('.')[1]) % 2
        ? tokens['--accent']
        : tokens['--surface'],
    ];
  if (block.type === 'feature.bento' && field.startsWith('items.')) {
    const first = field.startsWith('items.0.');
    if (modern && version >= 3) {
      // O showcase põe a foto atrás do texto, sem um painel opaco no perfil moderno.
      if (
        first &&
        p.layout === 'showcase' &&
        (p.items as { image?: string }[])[0]?.image
      )
        return [];
      return [mixOklabHex(paper, cardInk, 0.03)];
    }
    if (first) return [modern ? surfaceOf(brand, 'ink') : ink];
    if (
      brand.design?.surfaceStyle === 'outlined' ||
      (!modern && p.layout === 'gallery')
    )
      return section;
    return [mixOklabHex(paper, cardInk, modern ? 0.05 : 0.04)];
  }
  if (
    block.type === 'proof.testimonial' &&
    p.layout === 'spotlight' &&
    !presentation?.background
  )
    return [tokens['--accent-2']];
  if (
    block.type === 'editorial.facts' &&
    p.layout === 'poster' &&
    !presentation?.background
  )
    return [tokens['--accent-2']];
  if (
    block.type === 'proof.stats' &&
    p.layout === 'cards' &&
    field.startsWith('items.')
  )
    return [tokens['--surface']];
  if (
    p.layout === 'cards' &&
    /^(feature.numbered|narrative.steps|faq.accordion)$/.test(block.type) &&
    /^(items|steps)\./.test(field)
  ) {
    if (modern) return [mixOklabHex(paper, cardInk, 0.05)];
    if (brand.design?.surfaceStyle === 'outlined') return section;
    if (block.type === 'feature.numbered') return [paper];
  }
  if (
    block.type === 'signature.composition' &&
    p.layout === 'proof-route' &&
    field.startsWith('items.')
  ) {
    const item = (p.items as { role?: string }[])[Number(field.split('.')[1])];
    if (item?.role === 'focus') return [tokens['--surface']];
  }
  if (block.type === 'pricing.table' && /^plans\.\d+\./.test(field)) {
    const plan = (p.plans as { highlight?: boolean }[])[
      Number(field.split('.')[1])
    ];
    return plan?.highlight ? [modern ? surfaceOf(brand, 'ink') : ink] : section;
  }
  if (block.type === 'editorial.facts' && p.dark && !presentation?.background)
    return [ink];
  if (
    block.type === 'cta.band' &&
    !presentation?.tone &&
    !presentation?.background
  ) {
    if (p.layout === 'minimal') return section;
    return p.layout === 'split' ? [tokens['--accent-2']] : [ink];
  }
  if (
    block.type === 'feature.numbered' &&
    !presentation?.tone &&
    !presentation?.background
  )
    return [...new Set([...section, tokens['--services-surface']])];
  return section;
}

export type TextStyleFinding = Finding & { path: string };
export function lintTextStyles(
  page: { blocks: BlockInstance[] },
  brand: Brand,
): TextStyleFinding[] {
  return page.blocks.flatMap((block) => {
    if (block.props.textStyles === undefined) return [];
    const styles = textStylesSchema.safeParse(block.props.textStyles);
    const fail = (path: string, message: string): TextStyleFinding => ({
      level: 'error',
      rule: 'texto-estilo',
      blockId: block.id,
      path,
      message,
    });
    if (!styles.success)
      return [
        fail(
          'textStyles',
          'Estilos de texto inválidos: informe campos únicos, tamanho de -2 a 2 e cor hexadecimal.',
        ),
      ];
    const fields = blockFields(block, brand);
    return styles.data.flatMap((style) => {
      const field = fields.find((entry) => entry.path === style.field);
      if (!field?.stylable)
        return [
          fail(
            style.field,
            `O campo ${style.field} não permite estilo de texto.`,
          ),
        ];
      if ((style.size ?? 0) < field.minStep)
        return [
          fail(
            style.field,
            `O menor tamanho permitido em ${field.label} é ${field.minStep}.`,
          ),
        ];
      if (style.color) {
        const backgrounds = fieldBackgrounds(block, style.field, brand);
        if (!backgrounds.length)
          return [
            fail(
              style.field,
              'Texto sobre foto: mantenha a cor automática. O tamanho pode ser ajustado.',
            ),
          ];
        const ratio = Math.min(
          ...backgrounds.map((background) =>
            contrastRatio(style.color!, background),
          ),
        );
        if (ratio < 4.5)
          return [
            {
              ...fail(
                style.field,
                `${field.label}: contraste ${ratio.toFixed(2)}:1; use uma cor com pelo menos 4,5:1.`,
              ),
              rule: 'texto-contraste',
            },
          ];
      }
      return [];
    });
  });
}
