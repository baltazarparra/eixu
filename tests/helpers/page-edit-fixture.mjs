import { loadModule } from './load-module.mjs';
import { createJiti } from 'jiti';
import { referenceDirection } from './reference-fixture.mjs';
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
const { publicationPlan, pendenciasContext, evidenceContext } = await j.import(
  '../../lib/taste/pendencias.ts',
);
const { isPublicationRepairRequest } = await j.import(
  '../../lib/sites/publication-request.ts',
);

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

/** Caso do eval: vibe cadastrada moderna, mas referência v6 escolhe a faixa comercial. */
export const commercialEditTenant = {
  ...structuredClone(editTenant),
  brand: {
    ...editTenant.brand,
    vibe: 'moderno',
    accentAlt: '#64748b',
    surface: '#f4f4f5',
    design: {
      version: 6,
      structure: 'comercial-atendimento',
      structureRationale:
        'A estrutura comercial organiza orientação, comparação e contato em uma jornada objetiva.',
      referenceDirection,
      concept: 'Materiais comparados com clareza editorial',
      signature: 'Linhas de comparação entre escolhas',
      definedAt: '2026-09-13T00:00:00.000Z',
      displayFont: 'slab',
      bodyFont: 'source',
      heroComposition: 'split',
      navigation: 'bar',
      rhythm: 'chapters',
      imageTreatment: 'framed',
      surfaceStyle: 'flat',
      motif: 'wash',
    },
  },
};
/** `hero: 'bullets'` troca a abertura por um hero.split com selos, o caso que
 * motivou a guarda de remoção e o campo de posição. */
export function editPages({ hero } = {}) {
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
  if (hero === 'bullets')
    page.blocks[1] = {
      id: 'hero',
      type: 'hero.split',
      props: {
        headline: 'Materiais para cada ambiente',
        subtext:
          'Considere o uso e as referências do projeto antes da escolha.',
        cta: { label: 'Conferir opções', href: '/materiais' },
        bullets: [
          'Amostras enviadas em 48 horas',
          'Orientação por ambiente',
          'Acabamentos comparados lado a lado',
        ],
      },
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
  {
    race,
    hero,
    initialPages,
    initialTenant,
    images = [],
    publication = false,
    toolContext = {},
    beforeRevisionInsert = async () => {},
    measureEditedBlocks = async () => ({
      status: 'complete',
      ok: true,
      issues: [],
      viewports: [],
    }),
  } = {},
) {
  const tenant = structuredClone(initialTenant ?? editTenant);
  const pages = initialPages
    ? structuredClone(initialPages)
    : editPages({ hero });
  const writes = [];
  // Histórico do rascunho em memória: o desfazer é testado pelo mesmo caminho
  // do servidor, sem Neon.
  const revisions = [];
  let revisionSeq = 0;
  const policy = editPolicyFor(text, pages);
  const executeQuery = async (sql, values = []) => {
    if (
      sql === 'SAVEPOINT page_revision_history' ||
      sql === 'RELEASE SAVEPOINT page_revision_history' ||
      sql === 'ROLLBACK TO SAVEPOINT page_revision_history'
    )
      return [];
    if (sql.includes('insert into page_revisions')) {
      await beforeRevisionInsert();
      const [tenantId, pageId, blocks, revision, origin, summary] = values;
      revisions.push({
        id: `rev-${++revisionSeq}`,
        tenant_id: tenantId,
        page_id: pageId,
        blocks: JSON.parse(blocks),
        revision,
        origin,
        summary,
        created_at: new Date(Date.now() + revisionSeq),
      });
      return [];
    }
    if (sql.includes('from page_revisions') && sql.includes('select')) {
      if (sql.includes('distinct p.slug'))
        return [
          ...new Set(
            revisions.map(
              (row) => pages.find((p) => p.id === row.page_id)?.slug,
            ),
          ),
        ]
          .filter((slug) => slug !== undefined)
          .map((slug) => ({ slug }));
      if (sql.includes('join pages') && sql.includes('order by r.created_at')) {
        const [tenantId] = values;
        const latest = revisions
          .filter((row) => row.tenant_id === tenantId)
          .sort((a, b) => b.created_at - a.created_at)[0];
        const slug = pages.find((page) => page.id === latest?.page_id)?.slug;
        return slug === undefined ? [] : [{ slug }];
      }
      const [pageId, tenantId] = values;
      const found = revisions
        .filter((row) => row.page_id === pageId && row.tenant_id === tenantId)
        .sort((a, b) => b.created_at - a.created_at);
      return found.slice(0, 1);
    }
    if (sql.includes('delete from page_revisions')) {
      // A poda por retenção não tem efeito no tamanho de um ensaio.
      if (sql.includes('id not in')) return [];
      const [target] = values;
      const remaining = revisions.filter((row) => row.id !== target);
      revisions.length = 0;
      revisions.push(...remaining);
      return [];
    }
    if (sql.includes('select id from pages') && sql.includes('for update')) {
      const [pageId, tenantId, expected] = values;
      const page = pages.find(
        (item) => item.id === pageId && item.tenantId === tenantId,
      );
      return page &&
        pageRevision(page) === pageRevision({ blocks: JSON.parse(expected) })
        ? [{ id: pageId }]
        : [];
    }
    if (sql.includes('update pages set blocks')) {
      const [blocks, pageId, tenantId, expected] = values;
      const page = pages.find(
        (item) =>
          item.id === pageId &&
          (tenantId === undefined || item.tenantId === tenantId),
      );
      if (!page) return [];
      if (sql.includes('returning id')) {
        race?.(page);
        if (
          pageRevision(page) !== pageRevision({ blocks: JSON.parse(expected) })
        )
          return [];
      }
      page.blocks = JSON.parse(blocks);
      writes.push({ page: page.slug, sql });
      return sql.includes('returning id') ? [{ id: pageId }] : [];
    }
    throw new Error('I/O fora do escopo da fixture.');
  };
  let transactionTail = Promise.resolve();
  const database = {
    db:
      () =>
      async (parts, ...values) =>
        executeQuery(parts.join('?'), values),
    transaction: async (run) => {
      const previous = transactionTail;
      let release;
      transactionTail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await run({
          query: async (sql, values) => ({
            rows: await executeQuery(sql, values),
          }),
        });
      } finally {
        release();
      }
    },
  };
  const mocks = {
    '@/lib/db': database,
    '@/lib/tenant-queries': {
      getPage: async (tenantId, slug) =>
        structuredClone(
          pages.find((p) => p.tenantId === tenantId && p.slug === slug),
        ),
      listPages: async (tenantId) =>
        structuredClone(pages.filter((p) => p.tenantId === tenantId)),
    },
    '@/lib/images/queries': { listImages: async () => images },
    '@/lib/review/capture': {
      capturePages: async () => [],
      measureEditedBlocks,
    },
  };
  // O histórico é dependência indireta: sem carregá-lo com o mesmo I/O falso,
  // ele cairia no Neon real e o desfazer ficaria sem versão anterior.
  mocks['@/lib/sites/revisions'] = await loadModule(
    'lib/sites/revisions.ts',
    mocks,
  );
  mocks['@/lib/sites/edits'] = await loadModule('lib/sites/edits.ts', mocks);
  const { buildTools } = await loadModule('lib/ai/tools.ts', mocks);
  const tools = buildTools(tenant, {
    ...toolContext,
    lastUserText: text,
    operatorText: text,
    editPolicy: policy,
  });
  // Não deixe um modelo real executar I/O fora do ensaio autorizado.
  const allowed = new Set([
    'edit_page',
    'undo_page_edit',
    'get_page',
    'describe_block',
    'list_state',
    ...(publication ? ['repair_publication', 'lint_site', 'lint_page'] : []),
  ]);
  for (const [name, definition] of Object.entries(tools))
    if (!allowed.has(name))
      definition.execute = async () => ({
        error: `Ferramenta ${name} fora do escopo deste pedido de edição.`,
      });
  return {
    tenant,
    pages,
    mocks,
    tools,
    revisions,
    writes,
    instructions: systemPrompt(
      tenant,
      pages.map((p) => `- /${p.slug}: ${p.title}`).join('\n'),
      '/',
      images
        .filter((image) => image.status !== 'rejeitada')
        .map(
          (image) =>
            `- #${image.seq} (${image.kind}${image.model === 'upload' ? ', enviada pelo operador' : ''}), ${image.ratio}, ${image.targetBlock ?? 'livre'}: ${image.url} | ${image.alt ?? image.description ?? image.requestText}`,
        )
        .join('\n'),
      {
        editing: true,
        editScope: editScopeText(policy),
        editPage: editingPageContext(pages[0], pages, policy),
        ...(publication
          ? {
              pendencias: pendenciasContext(
                publicationPlan({
                  pages,
                  images,
                  brand: tenant.brand,
                  brief: tenant.brief,
                  operatorText: text,
                }),
                20,
                isPublicationRepairRequest(text),
              ),
              evidencia: evidenceContext(tenant.brief),
            }
          : {}),
      },
    ),
  };
}
