import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const j = createJiti(import.meta.url);
const { lintSite, pageImageUrls, publicationState } = await j.import(
  '../lib/taste/site.ts',
);
const { blockSchemas } = await j.import('../lib/blocks/registry.ts');

const scene = (n) => `https://assets.test/scene-${n}.webp`;
const images = [1, 2].map((seq) => ({
  seq,
  url: scene(seq),
  kind: 'foto',
  model: 'openai/gpt-image-2',
  blobPath: `tenants/sample/gerado/batch/${seq}.webp`,
  status: 'aprovada',
}));
const body =
  'A escolha do ambiente depende da rotina e das preferências de quem usa o espaço. Compartilhe medidas, referências e o que já foi definido no projeto. A equipe pode então orientar a conversa sobre as possibilidades, os detalhes e o acabamento. Antes de confirmar uma proposta, confira a adequação do material real ao uso previsto. Fotos e amostras ajudam a visualizar o resultado, mas não substituem a avaliação das características do produto. Reúna as informações disponíveis, explique suas dúvidas e compare as alternativas. O próximo passo é uma conversa com escopo claro, incluindo as condições e as decisões que ainda precisam ser tomadas em conjunto.';
function project() {
  return ['', 'materiais', 'guia'].map((slug, i) => ({
    slug,
    type: 'page',
    title: `Página ${i}`,
    seo: {
      title: `Título específico ${i}`,
      description: `Descrição específica da página ${i}.`,
    },
    meta: {
      inbound: {
        stage: ['conversion', 'consideration', 'discovery'][i],
        intent: `Responder a uma necessidade distinta da etapa ${i}.`,
      },
    },
    blocks: [
      {
        id: 'nav',
        type: 'nav.bar',
        props: {
          logoText: 'Estúdio',
          links: [
            { label: 'Início', href: '/' },
            { label: 'Materiais', href: '/materiais' },
            { label: 'Guia', href: '/guia' },
          ],
        },
      },
      {
        id: 'hero',
        type: 'hero.split',
        props: {
          headline: 'Um ambiente para cada rotina',
          layout: 'atelier',
          image: scene(1),
          imageAlt: 'Cena de ambiente',
          secondaryImage: scene(2),
          secondaryImageAlt: 'Amostra do material',
          cta: { label: 'Materiais', href: '/materiais' },
        },
      },
      {
        id: 'text',
        type: 'editorial.text',
        props: {
          body: `${body} Contexto específico ${i}.`,
          presentation: { tone: 'accent' },
        },
      },
    ],
  }));
}
const rules = (pages, library = images, mode = 'publish') =>
  lintSite(pages, library, mode).map((f) => f.rule);

await test('aceita três páginas úteis conectadas e duas fotos geradas aprovadas', () =>
  assert.deepEqual(rules(project()), []));
await test('obrigado e paid_lp não completam o mínimo orgânico', () => {
  const pages = project();
  pages[1].type = 'thank_you';
  pages[2].type = 'paid_lp';
  assert.ok(rules(pages).includes('inbound-paginas'));
});
await test('repetir a mesma foto não satisfaz duas imagens', () => {
  const pages = project();
  pages[0].blocks[1].props.secondaryImage = scene(1);
  assert.ok(rules(pages).includes('home-imagens-geradas'));
});
await test('imagem de outro tenant ou upload não conta como geração própria', () => {
  assert.ok(
    rules(project(), images.slice(0, 1)).includes('home-imagens-geradas'),
  );
  assert.ok(
    rules(
      project(),
      images.map((i) => ({ ...i, blobPath: 'uploads/file.webp' })),
    ).includes('home-imagens-geradas'),
  );
});
await test('candidatas podem ser compostas no rascunho e bloqueiam publicação', () => {
  const candidates = images.map((i) => ({
    ...i,
    status: 'candidata',
    critique: { aprovado: true },
  }));
  assert.deepEqual(rules(project(), candidates, 'draft'), []);
  assert.ok(rules(project(), candidates).includes('imagens-aprovacao'));
});
await test('imagem em props inválidas ou segunda imagem oculta não conta', () => {
  const pages = project();
  pages[0].blocks[1].props.layout = 'split';
  assert.deepEqual(pageImageUrls(pages[0].blocks), [scene(1)]);
  pages[0].blocks[1].props.layout = 'inventado';
  assert.deepEqual(pageImageUrls(pages[0].blocks), []);
});
await test('ciclo isolado entre duas páginas não torna a jornada conectada', () => {
  const pages = project();
  pages[0].blocks[0].props.links = [];
  pages[0].blocks[1].props.cta.href = '#inicio';
  pages[0].blocks[1].props.anchor = 'inicio';
  assert.ok(rules(pages).includes('pagina-isolada'));
});
await test('bloqueia destinos e âncoras inexistentes', () => {
  const pages = project();
  pages[0].blocks[0].props.links.push(
    { label: 'Ausente', href: '/ausente' },
    { label: 'Âncora', href: '/materiais#inexistente' },
  );
  assert.ok(rules(pages).includes('link-interno'));
  assert.ok(rules(pages).includes('anchor-inexistente'));
});
await test('link com codificação inválida vira recusa, sem derrubar o pre-flight', () => {
  const pages = project();
  pages[0].blocks[0].props.links.push({ label: 'Inválido', href: '/%zz' });
  assert.ok(rules(pages).includes('link-interno'));
});
await test('publicação pontual não conta páginas disponíveis apenas em rascunho', () => {
  const pages = project().map((p, i) => ({
    ...p,
    id: `p${i}`,
    publishedBlocks: null,
    publishedSeo: null,
  }));
  assert.ok(
    rules(publicationState(pages, new Set(['p0']))).includes('inbound-paginas'),
  );
  assert.deepEqual(
    rules(publicationState(pages, new Set(pages.map((p) => p.id)))),
    [],
  );
});
await test('páginas fora do lote são verificadas com os blocos e SEO publicados', () => {
  const pages = project().map((p, i) => ({
    ...p,
    id: `p${i}`,
    publishedBlocks: structuredClone(p.blocks),
    publishedSeo: p.seo,
  }));
  pages[1].publishedSeo = { ...pages[1].seo, noindex: true };
  assert.ok(
    rules(publicationState(pages, new Set(['p0']))).includes('inbound-paginas'),
  );
  assert.deepEqual(rules(publicationState(pages, new Set(['p0', 'p1']))), []);
});
await test('páginas sem conteúdo, intenção ou etapas distintas são recusadas', () => {
  const pages = project();
  pages[1].blocks[2].props.body = 'Pouco conteúdo';
  pages[2].meta.inbound = pages[0].meta.inbound;
  const result = rules(pages);
  assert.ok(result.includes('inbound-conteudo'));
  assert.ok(result.includes('inbound-repetido'));
  assert.ok(result.includes('inbound-jornada'));
});
await test('bloqueia título e conteúdo duplicados', () => {
  const pages = project();
  pages[2].blocks = structuredClone(pages[1].blocks);
  pages[2].seo.title = pages[1].seo.title;
  assert.ok(rules(pages).includes('seo-repetido'));
  assert.ok(rules(pages).includes('inbound-copia'));
});
await test('novos blocos aceitam composição válida e recusam imagem inválida', () => {
  const valid = {
    title: 'Escolha o ambiente',
    items: [1, 2].map((n) => ({
      title: `Ambiente ${n}`,
      headline: 'Textura e luz no espaço',
      body: 'Uma composição coerente com a aplicação e o uso.',
      image: scene(n),
      imageAlt: 'Ambiente ilustrativo',
      cta: { label: 'Saiba mais', href: '/materiais' },
    })),
  };
  assert.ok(blockSchemas['feature.explorer'].safeParse(valid).success);
  valid.items[0].image = 'javascript:alert(1)';
  assert.equal(
    blockSchemas['feature.explorer'].safeParse(valid).success,
    false,
  );
});

const { repairSiteDraft, repairSiteInput, buildSiteInput } = await j.import(
  '../lib/ai/site-draft.ts',
);
const { lintPage } = await j.import('../lib/taste/lint.ts');
function draft() {
  return {
    pages: project().map((p) => ({
      slug: p.slug,
      type: p.type,
      title: p.title,
      inbound: p.meta.inbound,
      seoTitle: p.seo.title,
      seoDescription: p.seo.description,
      blocks: p.blocks.map(({ type, props }) => ({ type, props })),
    })),
  };
}
await test('reparo conserva páginas e props inalteradas, mescla apresentação e revalida o lote', () => {
  const original = draft();
  original.pages[0].blocks[1].props.presentation = {
    tone: 'accent',
    motion: 'image',
  };
  const before = structuredClone(original);
  const result = repairSiteDraft(
    original,
    repairSiteInput.parse({
      changes: [
        {
          kind: 'block',
          page: '/',
          block: 1,
          props: {
            headline: 'Outra composição',
            presentation: { width: 'wide' },
          },
        },
        {
          kind: 'page',
          page: 'materiais',
          seoTitle: 'Materiais para o projeto',
        },
      ],
    }),
  );
  assert.deepEqual(original, before);
  assert.deepEqual(result.pages[2], original.pages[2]);
  assert.equal(
    result.pages[0].blocks[1].props.image,
    original.pages[0].blocks[1].props.image,
  );
  assert.deepEqual(result.pages[0].blocks[1].props.presentation, {
    tone: 'accent',
    motion: 'image',
    width: 'wide',
  });
  assert.equal(result.pages[1].seoTitle, 'Materiais para o projeto');
  assert.ok(buildSiteInput.safeParse(result).success);
});
await test('reparo inválido não altera o lote nem alcança outra página', () => {
  const original = draft(),
    before = structuredClone(original);
  assert.throws(
    () =>
      repairSiteDraft(original, {
        changes: [
          {
            kind: 'block',
            page: '',
            block: 1,
            props: { headline: 'Tentativa' },
          },
          { kind: 'block', page: 'fora-do-lote', block: 0, props: {} },
        ],
      }),
    /ausente/,
  );
  assert.deepEqual(original, before);
  assert.throws(
    () =>
      repairSiteDraft(original, {
        changes: [{ kind: 'block', page: '', block: 99, props: {} }],
      }),
    /não existe/,
  );
});
await test('reparo remove props inválidas sem afrouxar o schema do bloco', () => {
  const original = draft();
  original.pages[0].blocks[1].props.inexistente = true;
  assert.ok(
    lintPage({ ...project()[0], blocks: original.pages[0].blocks }).some(
      (f) => f.rule === 'props-invalidas',
    ),
  );
  const result = repairSiteDraft(original, {
    changes: [
      { kind: 'block', page: '', block: 1, props: {}, unset: ['inexistente'] },
    ],
  });
  assert.equal(
    lintPage({ ...project()[0], blocks: result.pages[0].blocks }).some(
      (f) => f.rule === 'props-invalidas',
    ),
    false,
  );
});
await test('motion sozinho não substitui decisões de composição v2', () => {
  const page = project()[0];
  page.blocks[1].props.presentation = { motion: 'image' };
  page.blocks[2].props.presentation = { motion: 'reveal' };
  assert.ok(
    lintPage(page, { version: 2 }).some((f) => f.rule === 'ritmo-generico'),
  );
  page.blocks[1].props.presentation.tone = 'paper';
  page.blocks[2].props.presentation.tone = 'accent';
  assert.equal(
    lintPage(page, { version: 2 }).some((f) => f.rule === 'ritmo-generico'),
    false,
  );
});

await test('ferramenta de reparo isola o lote por instância e preserva a recusa antes de gravar', async () => {
  const jt = createJiti(import.meta.url, {
    alias: { '@': new URL('..', import.meta.url).pathname.replace(/\/$/, '') },
  });
  const { buildTools } = await jt.import('../lib/ai/tools.ts');
  const tenant = {
    id: 'test-draft-only',
    slug: 'test-draft-only',
    name: 'Teste',
    brief: {},
    dials: { motion: 6, variance: 7, density: 5 },
    brand: {
      design: {
        version: 2,
        concept: 'Composição para o teste',
        signatureElement: 'Recorte fotográfico no hero',
        displayFont: 'geometric',
        bodyFont: 'sans',
        heroComposition: 'split',
        navigation: 'bar',
        rhythm: 'compact',
        imageTreatment: 'full-bleed',
        surfaceStyle: 'flat',
        motif: 'none',
      },
    },
  };
  const first = buildTools(tenant),
    other = buildTools({ ...tenant, id: 'test-other' });
  const rejected = await first.build_site.execute(draft());
  assert.equal(rejected.ok, false, JSON.stringify(rejected));
  assert.ok(rejected.pages.every((p) => p.preflight.includes('sem-conversao')));
  assert.deepEqual(rejected.pages[0].blocks[1], {
    index: 1,
    type: 'hero.split',
  });
  const change = {
    changes: [
      {
        kind: 'block',
        page: '',
        block: 1,
        props: { presentation: { tone: 'paper' } },
      },
    ],
  };
  assert.match((await other.repair_site.execute(change)).error, /Não há lote/);
  assert.match(
    (
      await first.repair_site.execute({
        changes: [{ kind: 'block', page: 'outro-tenant', block: 0, props: {} }],
      })
    ).error,
    /ausente/,
  );
  const stillRejected = await first.repair_site.execute(change);
  assert.equal(stillRejected.ok, false);
  assert.ok(
    stillRejected.pages.some((p) => p.preflight.includes('sem-conversao')),
  );
});

await test('painel distingue lote recusado de projeto salvo', async () => {
  const jui = createJiti(import.meta.url, { jsx: true });
  const { describeTool } = await jui.import(
    '../app/(admin)/admin/[tenant]/chat-parts.tsx',
  );
  for (const name of ['build_site', 'repair_site']) {
    assert.equal(
      describeTool(
        name,
        {},
        { ok: false, pages: [{ page: '/', preflight: 'ERRO' }] },
        'output-available',
      ),
      'O projeto precisa de ajustes antes de salvar',
    );
    assert.equal(
      describeTool(
        name,
        {},
        { ok: true, pages: [{}, {}, {}], publicationPending: [] },
        'output-available',
      ),
      'Projeto salvo: 3 páginas',
    );
  }
});
