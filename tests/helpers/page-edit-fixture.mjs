import { loadModule } from './load-module.mjs';
import { createJiti } from 'jiti';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { editPolicyFor, editScopeText } = await j.import(
  '../../lib/ai/edit-policy.ts',
);
const { pageRevision, editingPageContext } = await j.import(
  '../../lib/ai/page-edits.ts',
);
const { systemPrompt } = await j.import('../../lib/taste/prompt.ts');

export const editTenant = {
  id: 'edit-fixture',
  slug: 'edit-fixture',
  name: 'Ateliê de teste',
  brand: { accent: '#193f47', ink: '#14161a', paper: '#ffffff' },
  brief: {
    intake: {
      offer: 'Orientação sobre materiais para ambientes.',
      constraints: [],
    },
  },
  dials: { variance: 5, density: 5, motion: 1 },
  imageGuide: {},
  whatsapp: null,
};
export function editPages() {
  const page = {
    id: 'edit-page',
    tenantId: editTenant.id,
    slug: '',
    type: 'page',
    title: 'Início',
    seo: {
      title: 'Materiais para ambientes',
      description:
        'Orientações para escolher materiais de acordo com o ambiente.',
    },
    meta: {},
    blocks: [
      {
        id: 'nav',
        type: 'nav.bar',
        props: {
          logoText: editTenant.name,
          links: [{ label: 'Ver materiais', href: '/materiais' }],
        },
      },
      {
        id: 'hero',
        type: 'hero.statement',
        props: {
          headline: 'Materiais para cada ambiente',
          subtext:
            'Considere o uso e as referências do projeto antes da escolha.',
          cta: { label: 'Conferir opções', href: '/materiais' },
        },
      },
      {
        id: 'intro',
        type: 'editorial.text',
        props: {
          title: 'Como escolher',
          body: 'Escolha com calma. O material acompanha o uso do ambiente e as referências do projeto.',
          presentation: { tone: 'soft', width: 'wide' },
        },
      },
      {
        id: 'faq',
        type: 'faq.accordion',
        props: {
          title: 'Dúvidas sobre materiais',
          items: [
            {
              q: 'Como comparar materiais?',
              a: 'Considere o uso do ambiente e os cuidados que cada material pede.',
            },
            {
              q: 'O que observar no projeto?',
              a: 'Observe as dimensões, a iluminação e as referências de acabamento.',
            },
          ],
        },
      },
      {
        id: 'cta',
        type: 'cta.band',
        props: {
          title: 'Conheça os materiais',
          cta: { label: 'Ver materiais', href: '/materiais' },
        },
      },
      {
        id: 'footer',
        type: 'footer.compact',
        props: { logoText: editTenant.name },
      },
    ],
  };
  page.publishedBlocks = structuredClone(page.blocks);
  page.publishedSeo = structuredClone(page.seo);
  const second = structuredClone(page);
  Object.assign(second, {
    id: 'materials-page',
    slug: 'materiais',
    title: 'Materiais',
  });
  return [page, second];
}

/** Executores e schemas reais; somente o I/O é substituído. Nunca acessa Neon/Blob. */
export async function pageEditFixture(
  text = 'Ajuste a página em foco.',
  { race } = {},
) {
  const tenant = structuredClone(editTenant);
  const pages = editPages();
  const writes = [];
  const policy = editPolicyFor(text, pages);
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          const sql = parts.join('?');
          if (
            !sql.includes('update pages set blocks') ||
            !sql.includes('returning id')
          )
            throw new Error('I/O fora do escopo da fixture.');
          const [blocks, pageId, tenantId, expected] = values;
          const page = pages.find(
            (p) => p.id === pageId && p.tenantId === tenantId,
          );
          if (!page) return [];
          race?.(page);
          if (
            pageRevision(page) !==
            pageRevision({ blocks: JSON.parse(expected) })
          )
            return [];
          page.blocks = JSON.parse(blocks);
          writes.push({ page: page.slug, sql });
          return [{ id: pageId }];
        },
    },
    '@/lib/tenant-queries': {
      getPage: async (tenantId, slug) =>
        structuredClone(
          pages.find((p) => p.tenantId === tenantId && p.slug === slug),
        ),
      listPages: async (tenantId) =>
        structuredClone(pages.filter((p) => p.tenantId === tenantId)),
    },
    '@/lib/images/queries': { listImages: async () => [] },
  });
  const tools = buildTools(tenant, { lastUserText: text, editPolicy: policy });
  // Não deixe um modelo real executar I/O fora do ensaio autorizado.
  const allowed = new Set([
    'edit_page',
    'get_page',
    'describe_block',
    'list_state',
  ]);
  for (const [name, definition] of Object.entries(tools))
    if (!allowed.has(name))
      definition.execute = async () => ({
        error: `Ferramenta ${name} fora do escopo deste pedido de edição.`,
      });
  return {
    tenant,
    pages,
    tools,
    writes,
    instructions: systemPrompt(
      tenant,
      pages.map((p) => `- /${p.slug}: ${p.title}`).join('\n'),
      '/',
      '',
      {
        editing: true,
        editScope: editScopeText(policy),
        editPage: editingPageContext(pages[0]),
      },
    ),
  };
}
