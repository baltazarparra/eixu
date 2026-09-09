import { tool } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db';
import { BLOCK_TYPES, blockSchemas, isBlockType } from '@/lib/blocks/registry';
import { formatFindings, lintPage } from '@/lib/taste/lint';
import { getPage, listPages } from '@/lib/tenant-queries';
import type { BlockInstance, Tenant } from '@/lib/types';

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const blockInput = z.object({
  type: z.string().describe(`Um destes: ${BLOCK_TYPES.join(', ')}`),
  props: z.record(z.string(), z.unknown()).describe('Props conforme o schema do bloco.'),
});

/** Normaliza blocos vindos da IA, atribuindo ids estáveis. */
function toBlocks(input: { type: string; props: Record<string, unknown> }[]): BlockInstance[] {
  return input.map((block) => ({ id: newId(), type: block.type, props: block.props }));
}

async function requirePage(tenantId: string, slug: string) {
  const page = await getPage(tenantId, slug.replace(/^\//, ''));
  if (!page) throw new Error(`Página "${slug}" não existe. Crie com create_page antes.`);
  return page;
}

export function buildTools(tenant: Tenant) {
  return {
    list_state: tool({
      description: 'Lê o estado atual do site: páginas, tipos, quantidade de blocos e se estão publicadas.',
      inputSchema: z.object({}),
      execute: async () => {
        const pages = await listPages(tenant.id);
        return {
          brand: tenant.brand,
          dials: tenant.dials,
          pages: pages.map((page) => ({
            slug: page.slug || '(home)',
            type: page.type,
            title: page.title,
            blocks: page.blocks.length,
            published: Boolean(page.publishedBlocks),
          })),
        };
      },
    }),

    describe_block: tool({
      description: 'Mostra o schema exato de props de um bloco. Use antes de preencher um bloco que você não domina.',
      inputSchema: z.object({ type: z.string() }),
      execute: async ({ type }) => {
        if (!isBlockType(type)) return { error: `Bloco "${type}" não existe.`, available: BLOCK_TYPES };
        return { type, schema: z.toJSONSchema(blockSchemas[type]) };
      },
    }),

    set_brand: tool({
      description: 'Define paleta, raio, fonte e dials do site. Uma cor de acento por site.',
      inputSchema: z.object({
        accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        ink: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        paper: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).optional(),
        font: z.enum(['sans', 'serif', 'mono']).optional(),
        variance: z.number().int().min(1).max(10).optional(),
        motion: z.number().int().min(1).max(10).optional(),
        density: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (input) => {
        const brand = {
          ...tenant.brand,
          ...(input.accent ? { accent: input.accent } : {}),
          ...(input.ink ? { ink: input.ink } : {}),
          ...(input.paper ? { paper: input.paper } : {}),
          ...(input.radius ? { radius: input.radius } : {}),
          ...(input.font ? { font: input.font } : {}),
        };
        const dials = {
          variance: input.variance ?? tenant.dials.variance,
          motion: input.motion ?? tenant.dials.motion,
          density: input.density ?? tenant.dials.density,
        };
        await db()`
          update tenants set brand = ${JSON.stringify(brand)}::jsonb,
                             dials = ${JSON.stringify(dials)}::jsonb,
                             updated_at = now()
          where id = ${tenant.id}
        `;
        return { brand, dials };
      },
    }),

    create_page: tool({
      description: 'Cria uma página. Use slug vazio para a home. Tipos: page, paid_lp, post, thank_you.',
      inputSchema: z.object({
        slug: z.string().describe('Sem barra inicial. Vazio para a home. Ex: "sobre", "blog", "blog/meu-post".'),
        type: z.enum(['page', 'paid_lp', 'post', 'thank_you']),
        title: z.string().min(2).max(120),
        seoTitle: z.string().max(70).optional(),
        seoDescription: z.string().max(170).optional(),
        excerpt: z.string().max(220).optional().describe('Só para posts.'),
        date: z.string().optional().describe('Só para posts, formato AAAA-MM-DD.'),
      }),
      execute: async (input) => {
        const slug = input.slug.replace(/^\/+|\/+$/g, '');
        const noindex = input.type === 'thank_you' || input.type === 'paid_lp';
        const seo = {
          title: input.seoTitle ?? input.title,
          description: input.seoDescription,
          noindex,
        };
        const meta = input.type === 'post' ? { excerpt: input.excerpt, date: input.date } : {};
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
      description: 'Substitui todos os blocos de uma página. É a forma principal de montar ou refazer uma página.',
      inputSchema: z.object({
        page: z.string().describe('Slug da página. Vazio para a home.'),
        blocks: z.array(blockInput).min(1).max(20),
      }),
      execute: async ({ page: slug, blocks }) => {
        const page = await requirePage(tenant.id, slug);
        const next = toBlocks(blocks);
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        const findings = lintPage({ ...page, blocks: next });
        return {
          ok: true,
          blocks: next.length,
          preflight: formatFindings(findings),
          erros: findings.filter((f) => f.level === 'error').length,
        };
      },
    }),

    insert_block: tool({
      description: 'Insere um bloco em uma posição. Índice 0 é o topo. Omita o índice para colocar no fim, antes do rodapé.',
      inputSchema: z.object({
        page: z.string(),
        block: blockInput,
        index: z.number().int().min(0).optional(),
      }),
      execute: async ({ page: slug, block, index }) => {
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
        return { ok: true, blockId: created.id, position: at, total: next.length };
      },
    }),

    update_block: tool({
      description: 'Atualiza as props de um bloco existente. Passe apenas as props que mudam.',
      inputSchema: z.object({
        page: z.string(),
        blockId: z.string(),
        props: z.record(z.string(), z.unknown()),
      }),
      execute: async ({ page: slug, blockId, props }) => {
        const page = await requirePage(tenant.id, slug);
        if (!page.blocks.some((block) => block.id === blockId)) {
          throw new Error(`Bloco ${blockId} não encontrado nesta página.`);
        }
        const next = page.blocks.map((block) =>
          block.id === blockId ? { ...block, props: { ...block.props, ...props } } : block,
        );
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return { ok: true, preflight: formatFindings(lintPage({ ...page, blocks: next })) };
      },
    }),

    remove_block: tool({
      description: 'Remove um bloco da página.',
      inputSchema: z.object({ page: z.string(), blockId: z.string() }),
      execute: async ({ page: slug, blockId }) => {
        const page = await requirePage(tenant.id, slug);
        const next = page.blocks.filter((block) => block.id !== blockId);
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return { ok: true, remaining: next.length };
      },
    }),

    move_block: tool({
      description: 'Move um bloco para outra posição na página.',
      inputSchema: z.object({ page: z.string(), blockId: z.string(), toIndex: z.number().int().min(0) }),
      execute: async ({ page: slug, blockId, toIndex }) => {
        const page = await requirePage(tenant.id, slug);
        const from = page.blocks.findIndex((block) => block.id === blockId);
        if (from < 0) throw new Error(`Bloco ${blockId} não encontrado.`);
        const next = [...page.blocks];
        const [moved] = next.splice(from, 1);
        next.splice(Math.min(toIndex, next.length), 0, moved);
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return { ok: true, from, to: toIndex };
      },
    }),

    set_seo: tool({
      description: 'Define título, descrição e indexação de uma página.',
      inputSchema: z.object({
        page: z.string(),
        title: z.string().max(70).optional(),
        description: z.string().max(170).optional(),
        noindex: z.boolean().optional(),
      }),
      execute: async ({ page: slug, ...seoInput }) => {
        const page = await requirePage(tenant.id, slug);
        const seo = { ...page.seo, ...seoInput };
        await db()`
          update pages set seo = ${JSON.stringify(seo)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return { ok: true, seo };
      },
    }),

    lint_page: tool({
      description: 'Roda o pre-flight de qualidade em uma página. Corrija todo ERRO antes de considerar a página pronta.',
      inputSchema: z.object({ page: z.string() }),
      execute: async ({ page: slug }) => {
        const page = await requirePage(tenant.id, slug);
        const findings = lintPage(page);
        return {
          aprovado: !findings.some((f) => f.level === 'error'),
          relatorio: formatFindings(findings),
        };
      },
    }),

    publish_page: tool({
      description: 'Publica uma página. Só use quando o operador pedir. Bloqueia se o pre-flight tiver erro.',
      inputSchema: z.object({ page: z.string() }),
      execute: async ({ page: slug }) => {
        const page = await requirePage(tenant.id, slug);
        const findings = lintPage(page);
        if (findings.some((f) => f.level === 'error')) {
          return { publicado: false, motivo: 'Pre-flight com erro.', relatorio: formatFindings(findings) };
        }
        await db()`
          update pages
          set published_blocks = blocks, published_seo = seo, published_at = now(), updated_at = now()
          where id = ${page.id}
        `;
        await db()`update tenants set status = 'published' where id = ${tenant.id}`;
        return { publicado: true, url: `https://${tenant.slug}.eixu.com.br/${page.slug}` };
      },
    }),
  };
}
