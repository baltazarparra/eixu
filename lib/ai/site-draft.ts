import { z } from 'zod';
import { BLOCK_TYPES } from '../blocks/registry';
import { inboundSchema } from '../taste/site';

export const pageType = z.enum(['page', 'paid_lp', 'post', 'thank_you']);
export const blockInput = z.object({
  type: z.string().describe(`Um destes: ${BLOCK_TYPES.join(', ')}`),
  props: z
    .record(z.string(), z.unknown())
    .describe('Props conforme o schema do bloco.'),
});
export const sitePageInput = z.object({
  slug: z.string().describe('Sem barra inicial. Vazio para a home.'),
  type: pageType,
  title: z.string().min(2).max(120),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(170).optional(),
  excerpt: z.string().max(220).optional(),
  date: z.string().optional(),
  inbound: inboundSchema.describe(
    'Obrigatório para páginas orgânicas: intenção de busca e etapa da jornada.',
  ),
  blocks: z.array(blockInput).min(1).max(20),
});
export const buildSiteInput = z.object({
  pages: z.array(sitePageInput).min(1).max(12),
});
export type SiteDraft = z.infer<typeof buildSiteInput>;
/**
 * O discriminante faltando invalidava a correção inteira, e o lote recusado
 * ficava sem saída na fase de composição: o que a correção toca já diz o que
 * ela é. Nada mais é afrouxado — as props seguem validadas pelo catálogo.
 */
const withKind = z.preprocess(
  (value) => {
    if (!value || typeof value !== 'object') return value;
    const change = value as Record<string, unknown>;
    if (typeof change.kind === 'string') return change;
    const isBlock =
      typeof change.block === 'number' ||
      'props' in change ||
      'unset' in change;
    return {
      ...change,
      kind: isBlock ? 'block' : 'page',
      ...(isBlock && !('props' in change) ? { props: {} } : {}),
    };
  },
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('block'),
      page: z.string().describe('Slug. Vazio para home.'),
      block: z
        .number()
        .int()
        .min(0)
        .describe(
          'Índice do bloco, começando em zero; retornado no erro do lote.',
        ),
      type: z.string().optional(),
      props: z
        .record(z.string(), z.unknown())
        .describe(
          'Somente props alteradas. presentation é mesclada; arrays são substituídos.',
        ),
      unset: z
        .array(z.string())
        .max(20)
        .optional()
        .describe('Props que devem ser removidas, como um campo inválido.'),
    }),
    z.object({
      kind: z.literal('page'),
      page: z.string(),
      title: sitePageInput.shape.title.optional(),
      seoTitle: sitePageInput.shape.seoTitle,
      seoDescription: sitePageInput.shape.seoDescription,
      inbound: inboundSchema.optional(),
    }),
  ]),
);

export const repairSiteInput = z.object({
  changes: z.array(withKind).min(1).max(40),
});

/** Reparo isolado em memória: nunca edita o lote original nem páginas persistidas. */
export function repairSiteDraft(
  draft: SiteDraft,
  input: z.infer<typeof repairSiteInput>,
): SiteDraft {
  const next = structuredClone(draft);
  for (const change of input.changes) {
    const slug = change.page.replace(/^\/+|\/+$/g, '');
    const matches = next.pages.filter(
      (p) => p.slug.replace(/^\/+|\/+$/g, '') === slug,
    );
    if (matches.length !== 1)
      throw new Error(
        `Página /${slug} ausente ou ambígua no lote. Reenvie build_site se precisar adicionar/remover páginas.`,
      );
    const page = matches[0];
    if (change.kind === 'block') {
      const block = page.blocks[change.block];
      if (!block)
        throw new Error(`Bloco ${change.block} não existe em /${slug}.`);
      if (change.type) block.type = change.type;
      const previous = block.props.presentation;
      block.props = { ...block.props, ...change.props };
      if (
        change.props.presentation &&
        typeof change.props.presentation === 'object' &&
        !Array.isArray(change.props.presentation)
      ) {
        block.props.presentation = {
          ...(previous &&
          typeof previous === 'object' &&
          !Array.isArray(previous)
            ? previous
            : {}),
          ...change.props.presentation,
        };
      }
      for (const key of change.unset ?? []) delete block.props[key];
    } else {
      for (const key of [
        'title',
        'seoTitle',
        'seoDescription',
        'inbound',
      ] as const) {
        if (change[key] !== undefined)
          Object.assign(page, { [key]: change[key] });
      }
    }
  }
  return buildSiteInput.parse(next);
}
