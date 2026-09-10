import { tool } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  blockInput,
  buildSiteInput,
  pageType,
  repairSiteDraft,
  repairSiteInput,
  type SiteDraft,
} from '@/lib/ai/site-draft';
import { accessibleAccent, contrastRatio } from '@/lib/blocks/contrast';
import { BLOCK_TYPES, blockSchemas, isBlockType } from '@/lib/blocks/registry';
import {
  completeDesignProfile,
  designProfileInputSchema,
  isDesignProfile,
  nearestDesign,
} from '@/lib/design/profile';
import { hasDuplicateComposition } from '@/lib/design/uniqueness';
import { listImages } from '@/lib/images/queries';
import { prepareSiteImages } from '@/lib/images/site-assets';
import { RATIOS } from '@/lib/images/ratios';
import { publishSite } from '@/lib/sites/publish';
import { formatFindings, lintPage } from '@/lib/taste/lint';
import { inboundSchema, lintSite, type SitePage } from '@/lib/taste/site';
import { getPage, listPages } from '@/lib/tenant-queries';
import type { BlockInstance, Tenant } from '@/lib/types';

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Normaliza blocos vindos da IA, atribuindo ids estáveis. */
function toBlocks(
  input: { type: string; props: Record<string, unknown> }[],
): BlockInstance[] {
  return input.map((block) => ({
    id: newId(),
    type: block.type,
    props: block.props,
  }));
}

export class ToolError extends Error {}

async function requirePage(tenantId: string, slug: string) {
  const clean = slug.replace(/^\/+|\/+$/g, '');
  const page = await getPage(tenantId, clean);
  if (!page)
    throw new ToolError(
      `Página "/${clean}" não existe. Use list_state para ver as páginas ou create_page para criar.`,
    );
  return page;
}

/**
 * Localiza um bloco por id, por tipo ("hero.split") ou por família ("hero").
 * O erro lista o que existe, para o agente acertar na próxima chamada.
 */
function findBlock(blocks: BlockInstance[], selector: string): BlockInstance {
  const byId = blocks.find((block) => block.id === selector);
  if (byId) return byId;
  const wanted = selector.toLowerCase();
  const matches = blocks.filter(
    (block) =>
      block.type.toLowerCase() === wanted ||
      block.type.toLowerCase().split('.')[0] === wanted,
  );
  if (matches.length === 1) return matches[0];
  const inventory = blocks
    .map((block, index) => `${index}: ${block.type} (id ${block.id})`)
    .join('; ');
  if (matches.length > 1) {
    throw new ToolError(
      `"${selector}" bate com ${matches.length} blocos. Use o id. Blocos: ${inventory}`,
    );
  }
  throw new ToolError(
    `Nenhum bloco "${selector}" nesta página. Blocos: ${inventory}`,
  );
}

/** Envolve o execute para devolver erro como resultado, sem derrubar o passo do agente. */
export function safe<I, O>(run: (input: I) => Promise<O>) {
  return async (input: I): Promise<O | { error: string }> => {
    try {
      return await run(input);
    } catch (error) {
      if (error instanceof ToolError) return { error: error.message };
      console.error('[tool] falha inesperada:', error);
      return {
        error: error instanceof Error ? error.message : 'Falha inesperada.',
      };
    }
  };
}

export function buildTools(tenant: Tenant) {
  let activeBrand = { ...tenant.brand };
  let activeDials = { ...tenant.dials };
  let activeBrief = { ...tenant.brief };
  let imagesPrepared = false;
  let pendingDraft: SiteDraft | undefined;

  async function saveSiteDraft(input: SiteDraft) {
    const { pages } = input;
    if (!isDesignProfile(activeBrand.design)) {
      throw new ToolError(
        'build_site exige uma direção v2 persistida. Chame set_design antes de montar as páginas.',
      );
    }
    const staged = pages.map((input) => {
      const slug = input.slug.replace(/^\/+|\/+$/g, '');
      const noindex = input.type === 'thank_you' || input.type === 'paid_lp';
      const seo = {
        title: input.seoTitle ?? input.title,
        description: input.seoDescription,
        noindex,
      };
      const meta = {
        ...(input.type === 'post'
          ? { excerpt: input.excerpt, date: input.date }
          : {}),
        ...(input.inbound ? { inbound: input.inbound } : {}),
      };
      const blocks = toBlocks(input.blocks);
      const findings = lintPage(
        { type: input.type, title: input.title, seo, blocks },
        activeBrand.design,
      );
      return { input, slug, seo, meta, blocks, findings };
    });
    const invalid = staged.filter((page) =>
      page.findings.some((finding) => finding.level === 'error'),
    );
    if (invalid.length) {
      return {
        ok: false,
        error:
          'Nenhuma página foi gravada. O lote está em memória neste turno. Use repair_site com somente as correções e os índices abaixo; não reenvie páginas inalteradas nem use update_block.',
        pages: invalid.map((page) => ({
          page: `/${page.slug}`,
          preflight: formatFindings(page.findings),
          blocks: page.blocks.map((block, index) => ({
            index,
            type: block.type,
          })),
        })),
      };
    }
    const home = staged.find((page) => page.slug === '');
    const [existing, images] = await Promise.all([
      listPages(tenant.id),
      listImages(tenant.id),
    ]);
    const stagedSlugs = new Set(staged.map((p) => p.slug));
    const prospective: SitePage[] = [
      ...existing.filter((p) => !stagedSlugs.has(p.slug)),
      ...staged.map((p) => ({
        slug: p.slug,
        title: p.input.title,
        type: p.input.type,
        seo: p.seo,
        blocks: p.blocks,
        meta: p.meta,
      })),
    ];
    const projectFindings = lintSite(prospective, images, 'draft');
    if (projectFindings.length)
      return {
        ok: false,
        error:
          'Projeto incompleto. O lote está em memória; use repair_site para corrigir blocos/SEO/intenção. Para adicionar ou remover páginas, reenvie build_site. Nenhuma página foi gravada.',
        findings: projectFindings,
      };
    if (home && (await hasDuplicateComposition(tenant.id, home.blocks))) {
      throw new ToolError(
        'A silhueta da home repete outro cliente. Troque tipos, layouts ou ritmo de apresentação antes de salvar.',
      );
    }

    const report: {
      page: string;
      blocks: number;
      erros: number;
      preflight: string;
    }[] = [];
    const sql = db();
    await sql.transaction(
      staged.map(
        (page) => sql`
            insert into pages (tenant_id, slug, type, title, seo, meta, blocks)
            values (${tenant.id}, ${page.slug}, ${page.input.type}, ${page.input.title},
                    ${JSON.stringify(page.seo)}::jsonb, ${JSON.stringify(page.meta)}::jsonb, ${JSON.stringify(page.blocks)}::jsonb)
            on conflict (tenant_id, slug) do update
              set type = excluded.type, title = excluded.title, seo = excluded.seo,
                  meta = excluded.meta, blocks = excluded.blocks, updated_at = now()
          `,
      ),
    );
    for (const page of staged) {
      report.push({
        page: `/${page.slug}`,
        blocks: page.blocks.length,
        erros: 0,
        preflight: formatFindings(page.findings),
      });
    }
    if (pendingDraft === input) pendingDraft = undefined;
    return {
      ok: true,
      pages: report,
      publicationPending: lintSite(prospective, images, 'publish'),
    };
  }

  return {
    prepare_site_images: tool({
      description:
        'Gera até duas cenas distintas pelo estúdio EIXU, com guia do cliente e crítica. Use quando faltam as 2 imagens da home. Candidatas podem entrar no rascunho, mas só o operador aprova para publicação. Uma chamada por turno.',
      inputSchema: z.object({
        scenes: z
          .array(
            z.object({
              request: z.string().min(30).max(500),
              targetBlock: z.enum([
                'hero.cover',
                'hero.split',
                'hero.atelier',
                'narrative.split',
                'feature.explorer',
                'media.image',
              ]),
              ratio: z.enum(RATIOS),
            }),
          )
          .min(1)
          .max(2),
      }),
      execute: safe(async ({ scenes }) => {
        if (imagesPrepared)
          throw new ToolError(
            'As cenas deste turno já foram solicitadas. Consulte a biblioteca e reutilize as candidatas.',
          );
        imagesPrepared = true;
        return prepareSiteImages(
          {
            ...tenant,
            brand: activeBrand,
            dials: activeDials,
            brief: activeBrief,
          },
          scenes,
        );
      }),
    }),

    lint_site: tool({
      description:
        'Valida o projeto completo: 3 páginas orgânicas, jornada de inbound, links internos e 2 fotos geradas na home. Indica aprovação de imagens pendente.',
      inputSchema: z.object({}),
      execute: safe(async () => {
        const [pages, images] = await Promise.all([
          listPages(tenant.id),
          listImages(tenant.id),
        ]);
        return { findings: lintSite(pages, images, 'publish') };
      }),
    }),
    list_images: tool({
      description:
        'Lista imagens aprovadas e candidatas do cliente, com status explícito. Candidatas só entram no rascunho. Use quando a imagem citada não está no resumo recebido.',
      inputSchema: z.object({}),
      execute: safe(async () => {
        const images = (await listImages(tenant.id)).filter(
          (image) => image.status !== 'rejeitada',
        );
        return {
          imagens: images.map((image) => ({
            numero: `#${image.seq}`,
            status: image.status,
            kind: image.kind,
            url: image.url,
            alt: image.alt,
            ratio: image.ratio,
            bloco_sugerido: image.targetBlock,
            descricao: image.description ?? image.requestText,
          })),
        };
      }),
    }),

    list_state: tool({
      description:
        'Lê o estado atual do site: páginas, tipos, quantidade de blocos e se estão publicadas.',
      inputSchema: z.object({}),
      execute: async () => {
        const pages = await listPages(tenant.id);
        return {
          brief: activeBrief,
          brand: activeBrand,
          dials: activeDials,
          pages: pages.map((page) => ({
            slug: `/${page.slug}`,
            type: page.type,
            title: page.title,
            blocks: page.blocks.map((block) => `${block.type}#${block.id}`),
            published: Boolean(page.publishedBlocks),
          })),
        };
      },
    }),

    get_page: tool({
      description:
        'Lê uma página com os blocos, seus ids, tipos e props completas. Chame antes de update_block, move_block ou remove_block para saber o que existe.',
      inputSchema: z.object({
        page: z.string().describe('Slug. Vazio para a home.'),
      }),
      execute: safe(async ({ page: slug }) => {
        const page = await requirePage(tenant.id, slug);
        return {
          slug: `/${page.slug}`,
          type: page.type,
          title: page.title,
          seo: page.seo,
          blocks: page.blocks.map((block, index) => ({
            index,
            id: block.id,
            type: block.type,
            props: block.props,
          })),
        };
      }),
    }),

    describe_block: tool({
      description:
        'Mostra o schema exato de props de um bloco. Use antes de preencher um bloco que você não domina.',
      inputSchema: z.object({ type: z.string() }),
      execute: async ({ type }) => {
        if (!isBlockType(type))
          return {
            error: `Bloco "${type}" não existe.`,
            available: BLOCK_TYPES,
          };
        return { type, schema: z.toJSONSchema(blockSchemas[type]) };
      },
    }),

    set_brand: tool({
      description:
        'Faz um ajuste pontual de marca existente. Para site novo ou reconstrução, use set_design.',
      inputSchema: z.object({
        accent: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        ink: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        paper: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).optional(),
        font: z.enum(['sans', 'serif', 'mono']).optional(),
        variance: z.number().int().min(1).max(10).optional(),
        motion: z.number().int().min(1).max(10).optional(),
        density: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (input) => {
        const brand = {
          ...activeBrand,
          ...(input.accent ? { accent: input.accent } : {}),
          ...(input.ink ? { ink: input.ink } : {}),
          ...(input.paper ? { paper: input.paper } : {}),
          ...(input.radius ? { radius: input.radius } : {}),
          ...(input.font ? { font: input.font } : {}),
        };
        const dials = {
          variance: input.variance ?? activeDials.variance,
          motion: input.motion ?? activeDials.motion,
          density: input.density ?? activeDials.density,
        };
        await db()`
          update tenants set brand = ${JSON.stringify(brand)}::jsonb,
                             dials = ${JSON.stringify(dials)}::jsonb,
                             updated_at = now()
          where id = ${tenant.id}
        `;
        activeBrand = brand;
        activeDials = dials;

        // O site escurece sozinho um acento que reprova no contraste. Avisar
        // aqui evita o agente insistir numa cor que nunca vai aparecer igual.
        const contrast = accessibleAccent(brand.accent ?? '#1f6feb');
        const aviso = contrast.adjusted
          ? `O acento ${brand.accent} reprovava no contraste mínimo. O site vai usar ${contrast.accent}, a cor mais próxima que passa.`
          : null;
        return { brand, dials, ...(aviso ? { aviso } : {}) };
      },
    }),

    set_design: tool({
      description:
        'Define briefing e direção de arte v2 em uma chamada. Obrigatória antes de build_site. A direção é recusada quando repete a arquitetura visual de outro cliente.',
      inputSchema: designProfileInputSchema,
      execute: safe(async (input) => {
        if (input.accent.toLowerCase() === input.accentAlt.toLowerCase()) {
          throw new ToolError(
            'accent e accentAlt precisam cumprir papéis diferentes. Escolha duas cores distintas.',
          );
        }
        if (input.paper.toLowerCase() === input.surface.toLowerCase()) {
          throw new ToolError(
            'paper e surface estão iguais. A página precisa de profundidade tonal perceptível.',
          );
        }
        if (contrastRatio(input.ink, input.paper) < 4.5) {
          throw new ToolError(
            'ink e paper não alcançam contraste AA para texto. Ajuste a paleta.',
          );
        }
        if (contrastRatio(input.ink, input.surface) < 4.5) {
          throw new ToolError(
            'ink e surface não alcançam contraste AA para texto. Ajuste a superfície.',
          );
        }

        const profile = completeDesignProfile(input);
        const rows = (await db()`
          select brand->'design' as design
          from tenants
          where id <> ${tenant.id} and brand ? 'design'
        `) as { design?: unknown }[];
        const nearest = nearestDesign(
          profile,
          rows.map((row) => row.design),
        );
        if (nearest && nearest.distance < 3) {
          throw new ToolError(
            `Direção estrutural muito parecida com outro site: distância ${nearest.distance}/8. Mude pelo menos ${3 - nearest.distance} decisões entre heroComposition, navigation, rhythm, imageTreatment, surfaceStyle, motif e tipografia.`,
          );
        }

        const legacyFont =
          profile.displayFont === 'editorial'
            ? 'serif'
            : profile.displayFont === 'mono'
              ? 'mono'
              : 'sans';
        const brand = {
          ...activeBrand,
          accent: input.accent,
          accentAlt: input.accentAlt,
          ink: input.ink,
          paper: input.paper,
          surface: input.surface,
          radius: input.radius,
          font: legacyFont as 'sans' | 'serif' | 'mono',
          design: profile,
        };
        const dials = {
          variance: input.variance,
          motion: input.motion,
          density: input.density,
        };
        await db()`
          update tenants
          set brief = ${JSON.stringify(input.brief)}::jsonb,
              brand = ${JSON.stringify(brand)}::jsonb,
              dials = ${JSON.stringify(dials)}::jsonb,
              updated_at = now()
          where id = ${tenant.id}
        `;
        activeBrief = input.brief;
        activeBrand = brand;
        activeDials = dials;
        return {
          ok: true,
          concept: profile.concept,
          signatureElement: profile.signatureElement,
          structuralDistance: nearest?.distance ?? null,
          signature: profile.signature,
        };
      }),
    }),

    build_site: tool({
      description:
        'Cria ou substitui o projeto completo. Valida antes de gravar. Se houver erro, o lote fica em memória para repair_site neste turno.',
      inputSchema: buildSiteInput,
      execute: safe(async (input) => {
        pendingDraft = input;
        return saveSiteDraft(input);
      }),
    }),

    repair_site: tool({
      description:
        'Corrige apenas campos de um build_site recusado neste turno. Revalida o lote completo e grava atomicamente se válido. Não edita páginas fora do lote nem publica.',
      inputSchema: repairSiteInput,
      execute: safe(async (input) => {
        if (!pendingDraft)
          throw new ToolError(
            'Não há lote recusado neste turno. Para editar páginas salvas, use get_page e update_block.',
          );
        try {
          pendingDraft = repairSiteDraft(pendingDraft, input);
        } catch (error) {
          throw new ToolError(
            error instanceof Error ? error.message : 'Reparo inválido.',
          );
        }
        return saveSiteDraft(pendingDraft);
      }),
    }),

    delete_page: tool({
      description: 'Apaga uma página. Use só quando o operador pedir.',
      inputSchema: z.object({ page: z.string() }),
      execute: safe(async ({ page: slug }) => {
        const page = await requirePage(tenant.id, slug);
        await db()`delete from pages where id = ${page.id}`;
        return { ok: true, removida: `/${page.slug}` };
      }),
    }),

    create_page: tool({
      description:
        'Cria uma página. Use slug vazio para a home. Tipos: page, paid_lp, post, thank_you.',
      inputSchema: z.object({
        slug: z
          .string()
          .describe(
            'Sem barra inicial. Vazio para a home. Ex: "sobre", "blog", "blog/meu-post".',
          ),
        type: pageType,
        title: z.string().min(2).max(120),
        seoTitle: z.string().max(70).optional(),
        seoDescription: z.string().max(170).optional(),
        excerpt: z.string().max(220).optional().describe('Só para posts.'),
        inbound: inboundSchema.optional(),
        date: z
          .string()
          .optional()
          .describe('Só para posts, formato AAAA-MM-DD.'),
      }),
      execute: async (input) => {
        const slug = input.slug.replace(/^\/+|\/+$/g, '');
        const noindex = input.type === 'thank_you' || input.type === 'paid_lp';
        const seo = {
          title: input.seoTitle ?? input.title,
          description: input.seoDescription,
          noindex,
        };
        const meta = {
          ...(input.type === 'post'
            ? { excerpt: input.excerpt, date: input.date }
            : {}),
          ...(input.inbound ? { inbound: input.inbound } : {}),
        };
        await db()`
          insert into pages (tenant_id, slug, type, title, seo, meta, blocks)
          values (${tenant.id}, ${slug}, ${input.type}, ${input.title},
                  ${JSON.stringify(seo)}::jsonb, ${JSON.stringify(meta)}::jsonb, '[]'::jsonb)
          on conflict (tenant_id, slug) do update
            set type = excluded.type, title = excluded.title, seo = excluded.seo,
                meta = excluded.meta, updated_at = now()
        `;
        return { slug: slug || '(home)', type: input.type, created: true };
      },
    }),

    set_blocks: tool({
      description:
        'Substitui todos os blocos de uma página. É a forma principal de montar ou refazer uma página.',
      inputSchema: z.object({
        page: z.string().describe('Slug da página. Vazio para a home.'),
        blocks: z.array(blockInput).min(1).max(20),
      }),
      execute: safe(async ({ page: slug, blocks }) => {
        const page = await requirePage(tenant.id, slug);
        const next = toBlocks(blocks);
        if (
          page.slug === '' &&
          isDesignProfile(activeBrand.design) &&
          (await hasDuplicateComposition(tenant.id, next))
        ) {
          throw new ToolError(
            'A silhueta da home repete outro cliente. Troque tipos, layouts ou apresentação.',
          );
        }
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        const findings = lintPage(
          { ...page, blocks: next },
          activeBrand.design,
        );
        return {
          ok: true,
          blocks: next.length,
          preflight: formatFindings(findings),
          erros: findings.filter((f) => f.level === 'error').length,
        };
      }),
    }),

    insert_block: tool({
      description:
        'Insere um bloco em uma posição. Índice 0 é o topo. Omita o índice para colocar no fim, antes do rodapé.',
      inputSchema: z.object({
        page: z.string(),
        block: blockInput,
        index: z.number().int().min(0).optional(),
      }),
      execute: safe(async ({ page: slug, block, index }) => {
        const page = await requirePage(tenant.id, slug);
        const next = [...page.blocks];
        const [created] = toBlocks([block]);
        const footerAt = next.findIndex((b) => b.type.startsWith('footer.'));
        const at = index ?? (footerAt >= 0 ? footerAt : next.length);
        next.splice(at, 0, created);
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return {
          ok: true,
          blockId: created.id,
          position: at,
          total: next.length,
        };
      }),
    }),

    update_block: tool({
      description:
        'Atualiza as props de um bloco existente. Passe apenas as props que mudam.',
      inputSchema: z.object({
        page: z.string(),
        block: z
          .string()
          .describe(
            'Id do bloco, ou o tipo ("hero.split") ou a família ("hero") quando só existe um.',
          ),
        props: z
          .record(z.string(), z.unknown())
          .describe(
            'Só as props que mudam. Objetos e listas são substituídos inteiros.',
          ),
        type: z
          .string()
          .optional()
          .describe(
            'Novo tipo do bloco, para trocar a variante mantendo as props em comum. Ex: hero.statement para hero.split.',
          ),
      }),
      execute: safe(async ({ page: slug, block: selector, props, type }) => {
        const page = await requirePage(tenant.id, slug);
        const target = findBlock(page.blocks, selector);
        if (type && !isBlockType(type))
          throw new ToolError(
            `Tipo "${type}" não existe. Tipos: ${BLOCK_TYPES.join(', ')}`,
          );
        const next = page.blocks.map((block) =>
          block.id === target.id
            ? {
                ...block,
                type: type ?? block.type,
                props: { ...block.props, ...props },
              }
            : block,
        );
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return {
          ok: true,
          blockId: target.id,
          preflight: formatFindings(
            lintPage({ ...page, blocks: next }, activeBrand.design),
          ),
        };
      }),
    }),

    remove_block: tool({
      description: 'Remove um bloco da página. Aceita id, tipo ou família.',
      inputSchema: z.object({ page: z.string(), block: z.string() }),
      execute: safe(async ({ page: slug, block: selector }) => {
        const page = await requirePage(tenant.id, slug);
        const target = findBlock(page.blocks, selector);
        const next = page.blocks.filter((block) => block.id !== target.id);
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return { ok: true, remaining: next.length };
      }),
    }),

    move_block: tool({
      description:
        'Move um bloco para outra posição na página. Aceita id, tipo ou família.',
      inputSchema: z.object({
        page: z.string(),
        block: z.string(),
        toIndex: z.number().int().min(0),
      }),
      execute: safe(async ({ page: slug, block: selector, toIndex }) => {
        const page = await requirePage(tenant.id, slug);
        const target = findBlock(page.blocks, selector);
        const from = page.blocks.findIndex((block) => block.id === target.id);
        const next = [...page.blocks];
        const [moved] = next.splice(from, 1);
        next.splice(Math.min(toIndex, next.length), 0, moved);
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return { ok: true, from, to: toIndex };
      }),
    }),

    set_seo: tool({
      description: 'Define título, descrição e indexação de uma página.',
      inputSchema: z.object({
        page: z.string(),
        title: z.string().max(70).optional(),
        description: z.string().max(170).optional(),
        noindex: z.boolean().optional(),
        inbound: inboundSchema.optional(),
      }),
      execute: safe(async ({ page: slug, inbound, ...seoInput }) => {
        const page = await requirePage(tenant.id, slug);
        const seo = { ...page.seo, ...seoInput };
        await db()`
          update pages set seo = ${JSON.stringify(seo)}::jsonb, meta = ${JSON.stringify({ ...page.meta, ...(inbound ? { inbound } : {}) })}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return { ok: true, seo };
      }),
    }),

    lint_page: tool({
      description:
        'Roda o pre-flight de qualidade em uma página. Corrija todo ERRO antes de considerar a página pronta.',
      inputSchema: z.object({ page: z.string() }),
      execute: safe(async ({ page: slug }) => {
        const page = await requirePage(tenant.id, slug);
        const findings = lintPage(page, activeBrand.design);
        return {
          aprovado: !findings.some((f) => f.level === 'error'),
          relatorio: formatFindings(findings),
        };
      }),
    }),

    publish_page: tool({
      description:
        'Publica uma página. Só use quando o operador pedir. Bloqueia se o pre-flight tiver erro.',
      inputSchema: z.object({ page: z.string() }),
      execute: safe(async ({ page: slug }) => {
        return publishSite({ ...tenant, brand: activeBrand }, slug);
      }),
    }),
    publish_site: tool({
      description:
        'Publica todas as páginas em uma transação após validar jornada, imagens e pre-flight. Use somente quando o operador pedir publicação.',
      inputSchema: z.object({}),
      execute: safe(async () => publishSite({ ...tenant, brand: activeBrand })),
    }),
  };
}
