import { z } from 'zod';
import { bestInk, contrastRatio } from './contrast';

export const ELEMENT_STYLE_TARGETS = [
  'section',
  'container',
  'content',
  'heading',
  'body',
  'actions',
  'list',
  'item',
  'media',
  'image',
  'form',
  'action',
  'field',
] as const;

const pixel = (min: number, max: number) => z.number().int().min(min).max(max);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const elementStyleSchema = z
  .object({
    target: z
      .enum(ELEMENT_STYLE_TARGETS)
      .describe(
        'Parte semântica dentro do bloco. item representa cards ou filhos da lista principal.',
      ),
    index: z
      .number()
      .int()
      .min(0)
      .max(19)
      .optional()
      .describe('Índice zero-based quando target é item.'),
    viewport: z
      .enum(['all', 'mobile', 'desktop'])
      .default('all')
      .describe(
        'all vale sempre; mobile até 767 px; desktop a partir de 768 px.',
      ),
    display: z.enum(['block', 'flex', 'grid', 'inline-flex']).optional(),
    direction: z
      .enum(['row', 'column', 'row-reverse', 'column-reverse'])
      .optional(),
    wrap: z.enum(['wrap', 'nowrap']).optional(),
    justify: z
      .enum(['start', 'center', 'end', 'between', 'around', 'evenly'])
      .optional(),
    alignItems: z
      .enum(['start', 'center', 'end', 'stretch', 'baseline'])
      .optional(),
    alignSelf: z.enum(['auto', 'start', 'center', 'end', 'stretch']).optional(),
    textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
    columns: z.number().int().min(1).max(6).optional(),
    columnSpan: z.number().int().min(1).max(6).optional(),
    rowSpan: z.number().int().min(1).max(6).optional(),
    columnStart: z.number().int().min(1).max(7).optional(),
    rowStart: z.number().int().min(1).max(20).optional(),
    gap: pixel(0, 96).optional().describe('Espaço em pixels.'),
    widthPercent: z.number().min(10).max(100).optional(),
    maxWidth: pixel(120, 1600).optional(),
    minHeight: pixel(0, 1200).optional(),
    paddingX: pixel(0, 160).optional(),
    paddingY: pixel(0, 160).optional(),
    marginTop: pixel(-160, 320).optional(),
    marginBottom: pixel(-160, 320).optional(),
    marginInline: z.enum(['start', 'center', 'end']).optional(),
    order: pixel(-20, 20).optional(),
    offsetX: pixel(-240, 240).optional(),
    offsetY: pixel(-240, 240).optional(),
    radius: pixel(0, 80).optional(),
    opacity: pixel(10, 100).optional(),
    background: z.union([hex, z.literal('transparent')]).optional(),
    foreground: hex.optional(),
    borderColor: z.union([hex, z.literal('transparent')]).optional(),
    borderWidth: pixel(0, 12).optional(),
    shadow: z.enum(['none', 'soft', 'medium', 'strong']).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.index !== undefined && value.target !== 'item')
      ctx.addIssue({
        code: 'custom',
        path: ['index'],
        message: 'index existe somente para target item.',
      });
    const properties = Object.keys(value).filter(
      (key) => !['target', 'index', 'viewport'].includes(key),
    );
    if (!properties.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Informe ao menos uma propriedade visual.',
      });
    if (
      value.foreground &&
      (!value.background || value.background === 'transparent')
    )
      ctx.addIssue({
        code: 'custom',
        path: ['background'],
        message:
          'foreground exige background hexadecimal no mesmo alvo para validar contraste.',
      });
    if (
      value.foreground &&
      value.background &&
      value.background !== 'transparent' &&
      contrastRatio(value.foreground, value.background) < 4.5
    )
      ctx.addIssue({
        code: 'custom',
        path: ['foreground'],
        message: 'foreground e background precisam de contraste mínimo 4,5:1.',
      });
  });

export const elementStylesSchema = z
  .array(elementStyleSchema)
  .max(30)
  .refine(
    (entries) =>
      new Set(
        entries.map(
          (entry) =>
            `${entry.target}:${entry.index ?? '*'}:${entry.viewport ?? 'all'}`,
        ),
      ).size === entries.length,
    'Cada alvo, índice e viewport pode ter somente um ajuste.',
  );

export type ElementStyle = z.infer<typeof elementStyleSchema>;

type Declaration = { property: string; value: string };
export type ElementStyleMeasurement = {
  target: ElementStyle['target'];
  index?: number;
  viewport: ElementStyle['viewport'];
  selectors: string[];
  declarations: Declaration[];
  columns?: number;
  widthPercent?: number;
};

const justify = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
} as const;
const align = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
} as const;
const alignSelf = {
  auto: 'auto',
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
} as const;
const inlineMargin = {
  start: '0px auto',
  center: 'auto',
  end: 'auto 0px',
} as const;
const shadows = {
  none: 'none',
  soft: '0 8px 24px rgb(20 22 26 / 0.1)',
  medium: '0 16px 40px rgb(20 22 26 / 0.16)',
  strong: '0 24px 64px rgb(20 22 26 / 0.24)',
} as const;

function relativeSelectors(style: ElementStyle): string[] {
  const item =
    style.index === undefined ? '*' : `:nth-child(${style.index + 1})`;
  switch (style.target) {
    case 'section':
      return ['> :is(section, article, header, footer, nav)'];
    case 'container':
      return ['.site-shell'];
    case 'content':
      return [
        ':is(.site-hero-copy, .site-landing-hero-copy, .site-signature-copy, .site-cta-copy, .site-text-copy, .site-resource-copy, .site-showcase-copy, .site-explorer-copy, .site-form .site-shell > :first-child, .site-footer .site-shell > :first-child)',
      ];
    case 'heading':
      return [':is(h1, h2, h3, h4, h5, h6)'];
    case 'body':
      return [':is(p, blockquote, figcaption, address)'];
    case 'actions':
      return [
        ':is(.site-actions, .site-landing-actions, .site-hero-bullets, .site-landing-badges, .site-cta-items, .site-nav-desktop, .site-footer-nav)',
      ];
    case 'list':
      return [
        ':is(ul, ol, dl, .site-faq-list, .site-bento, .site-services-grid, .site-resources-grid, .site-testimonials-items, .site-cta-items)',
      ];
    case 'item':
      return [
        `:is(ul, ol, dl) > ${item}`,
        `:is(.site-faq-list, .site-bento, .site-services-grid, .site-resources-grid, .site-testimonials-items, .site-cta-items) > ${item}`,
      ];
    case 'media':
      return [
        ':is(figure, .site-hero-media, .site-signature-media, .site-hero-visual, .site-gallery-track)',
      ];
    case 'image':
      return ['img'];
    case 'form':
      return ['form'];
    case 'action':
      return [
        ':is(.site-action, .site-submit, .site-nav-cta, .site-plan-cta, .site-resource-link, .site-bento-link)',
      ];
    case 'field':
      return [":is(input:not([type='hidden']), textarea, select)"];
  }
}

function declarations(style: ElementStyle): Declaration[] {
  const values: Declaration[] = [];
  const add = (property: string, value: string | undefined) => {
    if (value !== undefined) values.push({ property, value });
  };
  const display = style.columns
    ? 'grid'
    : style.direction && !style.display
      ? 'flex'
      : style.display;
  add('display', display);
  add('flex-direction', style.direction);
  add('flex-wrap', style.wrap);
  add('justify-content', style.justify ? justify[style.justify] : undefined);
  add('align-items', style.alignItems ? align[style.alignItems] : undefined);
  add('align-self', style.alignSelf ? alignSelf[style.alignSelf] : undefined);
  add('text-align', style.textAlign);
  add(
    'grid-template-columns',
    style.columns ? `repeat(${style.columns}, minmax(0, 1fr))` : undefined,
  );
  add(
    'grid-column',
    style.columnStart
      ? `${style.columnStart} / span ${style.columnSpan ?? 1}`
      : style.columnSpan
        ? `span ${style.columnSpan} / span ${style.columnSpan}`
        : undefined,
  );
  add(
    'grid-row',
    style.rowStart
      ? `${style.rowStart} / span ${style.rowSpan ?? 1}`
      : style.rowSpan
        ? `span ${style.rowSpan} / span ${style.rowSpan}`
        : undefined,
  );
  add('gap', style.gap === undefined ? undefined : `${style.gap}px`);
  add(
    'width',
    style.widthPercent === undefined ? undefined : `${style.widthPercent}%`,
  );
  add(
    'max-width',
    style.maxWidth === undefined ? undefined : `${style.maxWidth}px`,
  );
  add(
    'min-height',
    style.minHeight === undefined ? undefined : `${style.minHeight}px`,
  );
  add(
    'padding-inline',
    style.paddingX === undefined ? undefined : `${style.paddingX}px`,
  );
  add(
    'padding-block',
    style.paddingY === undefined ? undefined : `${style.paddingY}px`,
  );
  add(
    'margin-top',
    style.marginTop === undefined ? undefined : `${style.marginTop}px`,
  );
  add(
    'margin-bottom',
    style.marginBottom === undefined ? undefined : `${style.marginBottom}px`,
  );
  add(
    'margin-inline',
    style.marginInline ? inlineMargin[style.marginInline] : undefined,
  );
  add('order', style.order === undefined ? undefined : String(style.order));
  add(
    'translate',
    style.offsetX === undefined && style.offsetY === undefined
      ? undefined
      : `${style.offsetX ?? 0}px ${style.offsetY ?? 0}px`,
  );
  add(
    'border-radius',
    style.radius === undefined ? undefined : `${style.radius}px`,
  );
  add(
    'opacity',
    style.opacity === undefined ? undefined : String(style.opacity / 100),
  );
  add('background-color', style.background);
  add(
    'color',
    style.foreground ??
      (style.background && style.background !== 'transparent'
        ? bestInk(style.background).ink
        : undefined),
  );
  add('border-color', style.borderColor);
  add(
    'border-width',
    style.borderWidth === undefined ? undefined : `${style.borderWidth}px`,
  );
  if (style.borderWidth !== undefined) add('border-style', 'solid');
  add('box-shadow', style.shadow ? shadows[style.shadow] : undefined);
  if (
    style.paddingX !== undefined ||
    style.paddingY !== undefined ||
    style.borderWidth !== undefined
  )
    add('box-sizing', 'border-box');
  return values;
}

function scopeSelector(scope: string, relative: string) {
  return `[data-element-style-scope='${scope}'] ${relative}`;
}

export function elementStyleMeasurements(
  styles: ElementStyle[] | undefined,
): ElementStyleMeasurement[] {
  return (styles ?? []).map((style) => ({
    target: style.target,
    index: style.index,
    viewport: style.viewport ?? 'all',
    selectors: relativeSelectors(style),
    declarations: declarations(style).filter(
      ({ property }) =>
        ![
          'grid-template-columns',
          'width',
          'background-color',
          'color',
          'border-color',
          'box-shadow',
          'margin-inline',
        ].includes(property),
    ),
    columns: style.columns,
    widthPercent: style.widthPercent,
  }));
}

export function elementStyleCss(
  scope: string,
  styles: ElementStyle[] | undefined,
): string | undefined {
  const rules = (styles ?? []).map((style) => {
    const selectors = relativeSelectors(style)
      .map((selector) => scopeSelector(scope, selector))
      .join(',\n');
    const body = declarations(style)
      .map(({ property, value }) => `  ${property}: ${value};`)
      .join('\n');
    const rule = `${selectors} {\n${body}\n}`;
    if (style.viewport === 'mobile')
      return `@media (max-width: 767px) {\n${rule}\n}`;
    if (style.viewport === 'desktop')
      return `@media (min-width: 768px) {\n${rule}\n}`;
    return rule;
  });
  return rules.length ? rules.join('\n') : undefined;
}
