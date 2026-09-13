import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';
import { createJiti } from 'jiti';
// O alias resolve os módulos que importam por '@', como lib/sites/.
const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { lintSite, pageImageUrls, publicationState } = await j.import(
  '../lib/taste/site.ts',
);
const { blockSchemas, catalogForPrompt } = await j.import(
  '../lib/blocks/registry.ts',
);

const scene = (n) => `https://assets.test/scene-${n}.webp`;
const images = [1, 2].map((seq) => ({
  id: `img-${seq}`,
  seq,
  url: scene(seq),
  kind: 'foto',
  model: 'openai/gpt-image-2',
  blobPath: `tenants/sample/gerado/batch/${seq}.webp`,
  status: 'aprovada',
  targetBlock: null,
  requestText: `Cena ${seq}`,
  alt: null,
  score: null,
  critique: {},
  createdAt: `2026-09-0${seq}T10:00:00.000Z`,
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
/**
 * O contrato exige uma seção protagonista com fotos na home. project() é o
 * piso estrutural antigo, que hoje reprova; rich() é o projeto conforme.
 */
function rich() {
  const pages = project();
  pages[0].blocks.push({
    id: 'explorer',
    type: 'feature.explorer',
    props: {
      title: 'Escolha pelo ambiente',
      items: [1, 2].map((n) => ({
        title: `Ambiente ${n}`,
        headline: 'Textura e luz no espaço',
        body: 'Uma composição coerente com a aplicação e o uso previsto.',
        image: scene(n),
        imageAlt: 'Ambiente ilustrativo gerado',
        cta: { label: 'Ver materiais', href: '/materiais' },
      })),
      presentation: { tone: 'soft' },
    },
  });
  return pages;
}
const rules = (pages, library = images, mode = 'publish') =>
  lintSite(pages, library, mode).map((f) => f.rule);

await test('aceita três páginas úteis conectadas e duas fotos geradas aprovadas', () =>
  assert.deepEqual(rules(rich()), []));
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
await test('imagem fora do acervo do tenant não conta na composição', () => {
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
await test('fotos enviadas ao acervo completam composição e publicação como as geradas', () => {
  const uploads = images.map((image) => ({
    ...image,
    model: 'upload',
    blobPath: `tenants/sample/uploads/${image.seq}.webp`,
    status: 'disponivel',
  }));
  assert.deepEqual(rules(rich(), uploads, 'draft'), []);
  assert.deepEqual(rules(rich(), uploads), []);
  assert.deepEqual(rules(rich(), [uploads[0], images[1]]), []);
  assert.ok(
    rules(rich(), uploads.slice(0, 1)).includes('home-imagens-geradas'),
  );
  assert.ok(
    rules(
      rich(),
      uploads.map((image) => ({ ...image, kind: 'logo' })),
    ).includes('home-imagens-geradas'),
  );
  assert.ok(
    rules(
      rich(),
      uploads.map((image) => ({ ...image, status: 'rejeitada' })),
    ).includes('imagens-rejeitadas'),
  );
});
for (const status of ['disponivel', 'candidata', 'aprovada'])
  await test(`imagem ${status} pode ser composta e publicada sem aprovação`, () => {
    const library = images.map((image) => ({
      ...image,
      status,
      critique: { aprovado: false },
    }));
    assert.deepEqual(rules(rich(), library, 'draft'), []);
    assert.deepEqual(rules(rich(), library), []);
  });
await test('imagem rejeitada anteriormente continua bloqueada na publicação', () => {
  assert.ok(
    rules(
      rich(),
      images.map((image) => ({ ...image, status: 'rejeitada' })),
    ).includes('imagens-rejeitadas'),
  );
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
  const pages = rich().map((p, i) => ({
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
  const pages = rich().map((p, i) => ({
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
await test('altura do logo é opcional, limitada e disponível no catálogo e pre-flight', () => {
  for (const type of ['nav.bar', 'footer.compact']) {
    const base = { logoText: 'Estúdio', links: [] };
    assert.deepEqual(blockSchemas[type].parse(base), base);
    for (const height of [16, 50, 160]) {
      const props = { ...base, logoHeight: height };
      assert.equal(blockSchemas[type].parse(props).logoHeight, height);
      const page = project()[0];
      page.blocks = [{ id: 'logo', type, props }];
      assert.equal(
        lintPage(page).some((f) => f.rule === 'props-invalidas'),
        false,
      );
    }
    for (const height of [0, 15, 161, 50.5, '50px', null]) {
      const props = { ...base, logoHeight: height };
      assert.equal(blockSchemas[type].safeParse(props).success, false);
      const page = project()[0];
      page.blocks = [{ id: 'logo', type, props }];
      assert.ok(lintPage(page).some((f) => f.rule === 'props-invalidas'));
    }
    const lines = catalogForPrompt().split('\n');
    const at = lines.findIndex((line) => line.startsWith(`${type} · `));
    assert.ok(at >= 0, `catálogo sem entrada de ${type}`);
    assert.ok(lines[at + 1].includes('logoHeight?:int[16..160]'));
  }
});

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
  const { describeTool } = await j.import('../lib/generation/labels.ts');
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

const { siteMetrics, structuralFindings } = await j.import(
  '../lib/taste/metrics.ts',
);
const { expectedRatio, ratioFits } = await j.import('../lib/images/ratios.ts');

await test('home sem seção protagonista com fotos é recusada', () => {
  // project() é a home pobre: hero com fotos e o resto em texto.
  assert.ok(rules(project()).includes('home-protagonista'));
  assert.equal(rules(rich()).includes('home-protagonista'), false);
  assert.equal(siteMetrics(project(), images).home.protagonist, null);
  assert.equal(
    siteMetrics(rich(), images).home.protagonist,
    'feature.explorer',
  );
});

await test('hero atelier sustenta a home quando o miolo também mostra o negócio', () => {
  const pages = project();
  pages[0].blocks.push({
    id: 'media',
    type: 'media.image',
    props: {
      src: scene(2),
      alt: 'Cena ilustrativa gerada',
      caption: 'Ambiente ilustrativo gerado para inspiração.',
      presentation: { tone: 'soft' },
    },
  });
  assert.equal(rules(pages).includes('home-protagonista'), false);
  assert.equal(siteMetrics(pages, images).home.protagonist, 'hero.split');
});

await test('página orgânica sem nenhuma imagem é recusada', () => {
  const pages = rich();
  delete pages[1].blocks[1].props.image;
  delete pages[1].blocks[1].props.imageAlt;
  delete pages[1].blocks[1].props.secondaryImage;
  delete pages[1].blocks[1].props.secondaryImageAlt;
  const found = lintSite(pages, images, 'draft').filter(
    (f) => f.rule === 'pagina-sem-foto',
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].page, '/materiais');
  assert.equal(rules(rich()).includes('pagina-sem-foto'), false);
});

await test('proporção incoerente com o layout vira aviso com o bloco apontado', () => {
  // O defeito real: foto 4:3 servida num hero editorial, que exibe 16:9.
  const library = images.map((i) => ({ ...i, ratio: '4:5' }));
  const pages = rich();
  pages[0].blocks[1].props.layout = 'editorial';
  const found = structuralFindings(pages, library).filter(
    (f) => f.rule === 'imagem-proporcao',
  );
  assert.ok(found.length >= 1);
  assert.equal(found[0].level, 'warn');
  assert.equal(found[0].blockType, 'hero.split');
  assert.equal(found[0].blockIndex, 0);
  assert.ok(found[0].message.includes('16:9'));
  // Na composição atelier a mesma foto vertical está correta; o aviso que
  // sobra é do explorer, que exibe paisagem e recebeu retrato.
  const atelier = structuralFindings(rich(), library);
  assert.equal(
    atelier.some(
      (f) => f.rule === 'imagem-proporcao' && f.blockType === 'hero.split',
    ),
    false,
  );
  assert.ok(
    atelier.some(
      (f) =>
        f.rule === 'imagem-proporcao' && f.blockType === 'feature.explorer',
    ),
  );
});

await test('proporção esperada acompanha a variante de layout', () => {
  assert.equal(expectedRatio('hero.split', 'atelier'), '4:5');
  assert.equal(expectedRatio('hero.split', 'editorial'), '16:9');
  assert.equal(expectedRatio('hero.split', 'cover'), '16:9');
  assert.equal(expectedRatio('narrative.split'), '5:6');
  assert.equal(expectedRatio('narrative.split', 'editorial'), '16:9');
  assert.equal(expectedRatio('media.image', 'portrait'), '4:5');
  assert.equal(expectedRatio('media.image', 'bleed'), '16:9');
  assert.equal(expectedRatio('feature.explorer'), '4:3');
  assert.equal(expectedRatio('editorial.resources'), '16:9');
  assert.equal(expectedRatio('hero.atelier'), '4:5');
  assert.equal(ratioFits('4:5', '5:6'), true);
  assert.equal(ratioFits('4:3', '16:9'), false);
  assert.equal(ratioFits('16:9', '4:5'), false);
});

await test('home com um tom só recebe aviso de ritmo', () => {
  const pages = rich();
  pages[0].blocks[2].props.presentation = { tone: 'accent' };
  pages[0].blocks[3].props.presentation = { tone: 'accent' };
  const found = lintSite(pages, images, 'draft').filter(
    (f) => f.rule === 'home-tons',
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].level, 'warn');
  assert.equal(rules(rich()).includes('home-tons'), false);
});

await test('duas seções iguais em sequência viram aviso de repetição', () => {
  const pages = rich();
  pages[0].blocks.splice(3, 0, structuredClone(pages[0].blocks[2]));
  pages[0].blocks[3].id = 'text-2';
  const found = structuralFindings(pages, images).filter(
    (f) => f.rule === 'layout-repetido',
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].blockType, 'editorial.text');
});

await test('catálogo entrega uso e proporção de cada bloco ao agente', () => {
  const catalog = catalogForPrompt();
  assert.ok(catalog.includes('feature.explorer · Compara aplicações'));
  assert.ok(catalog.includes('feature.explorer'));
  const explorer = catalog
    .split('\n')
    .find((line) => line.startsWith('feature.explorer · '));
  assert.ok(explorer.includes('[foto 4:3]'));
  const hero = catalog
    .split('\n')
    .find((line) => line.startsWith('hero.split · '));
  assert.ok(hero.includes('4:5 em split/poster/offset/atelier'));
  assert.ok(hero.includes('16:9 em cover/editorial'));
});

await test('gate de composição v2 acompanha o tamanho da página', () => {
  const design = { version: 2 };
  const section = (n) => ({
    id: `s${n}`,
    type: 'editorial.text',
    props: { body: `Conteúdo específico da seção ${n}.` },
  });
  const page = (count) => ({
    type: 'page',
    title: 'Página',
    seo: { title: 'Página' },
    blocks: [
      ...Array.from({ length: count }, (_, i) => section(i)),
      {
        id: 'cta',
        type: 'cta.band',
        props: {
          title: 'Fale com a equipe',
          cta: { label: 'Falar', href: '/#contato' },
        },
      },
    ],
  });
  const required = (count, rule) =>
    lintPage(page(count), design).find((f) => f.rule === rule)?.message ?? '';
  // 8 seções: o teto antigo pedia 3 layouts; agora pede 5 e 4 apresentações.
  assert.ok(required(7, 'composicao-generica').includes('pelo menos 4'));
  assert.ok(required(9, 'composicao-generica').includes('pelo menos 5'));
  assert.ok(required(9, 'ritmo-generico').includes('pelo menos 4'));
  assert.ok(required(3, 'composicao-generica').includes('pelo menos 2'));
});

const { extractReference, metaContent, readReference } = await j.import(
  '../lib/ai/reference.ts',
);
const { normalizeSocialUrl, socialSummary } = await j.import(
  '../lib/social-profile.ts',
);
const { parseSocialProfile, readSocialProfile, referenceFromSocial } =
  await j.import('../lib/ai/social.ts');
const {
  intakeForForm,
  intakeSchema,
  intakeSocialUrl,
  intakeSummary,
  intakeWriteSchema,
  lines,
} = await j.import('../lib/tenant-intake.ts');
const { scenePlan, sceneCoverage } = await j.import(
  '../lib/images/scene-plan.ts',
);
const { nextPhase, PHASE_TOOLS } = await j.import('../lib/taste/phases.ts');

await test('referência em rede social com login volta inacessível sem requisição', async () => {
  let called = 0;
  const fetchSpy = async () => {
    called += 1;
    return new Response('<html></html>');
  };
  for (const url of [
    'https://www.facebook.com/oficina/?locale=pt_BR',
    'https://instagram.com/oficina',
  ]) {
    const reference = await readReference(url, { fetch: fetchSpy });
    assert.equal(reference.status, 'inacessivel');
    assert.ok(reference.motivo.includes('login'));
  }
  assert.equal(called, 0);
});

await test('referência para rede interna ou protocolo estranho é recusada', async () => {
  let called = 0;
  const fetchSpy = async () => {
    called += 1;
    return new Response('<html></html>');
  };
  const local = await readReference('http://intranet.local/', {
    fetch: fetchSpy,
    lookup: async () => ({ address: '10.0.0.5', family: 4 }),
  });
  assert.equal(local.status, 'inacessivel');
  assert.equal(local.motivo, 'Endereço de rede interna');
  const scheme = await readReference('file:///etc/passwd', { fetch: fetchSpy });
  assert.equal(scheme.status, 'inacessivel');
  assert.equal(called, 0);
});

await test('extração de referência devolve título, texto e contatos reais', () => {
  const reference = extractReference(
    'https://oficina.test/',
    `<html><head><title>Oficina Sabi&aacute;</title>
     <meta name="description" content="Manuten&ccedil;&atilde;o e diagn&oacute;stico"></head>
     <body><script>var x = "ignorar"</script>
     <h1>Mec&acirc;nica de confian&ccedil;a</h1>
     <p>Atendemos carros nacionais e importados com diagnóstico eletrônico e revisão programada.</p>
     <p>curto</p>
     <a href="https://wa.me/5511999998888">WhatsApp</a>
     <span>(11) 4002-8922</span></body></html>`,
  );
  assert.equal(reference.status, 'ok');
  assert.equal(reference.titulo, 'Oficina Sabiá');
  assert.equal(reference.descricao, 'Manutenção e diagnóstico');
  assert.ok(reference.texto.includes('Mecânica de confiança'));
  assert.ok(reference.texto.includes('diagnóstico eletrônico'));
  assert.equal(reference.texto.includes('ignorar'), false);
  assert.equal(reference.texto.includes('curto'), false);
  assert.deepEqual(reference.whatsapp, ['wa.me/5511999998888']);
  assert.ok(reference.telefones.includes('(11) 4002-8922'));
});

await test('intake do operador vira resumo legível e ignora linha vazia', () => {
  const intake = intakeSchema.parse({
    segment: 'oficina mecânica',
    audience: 'motoristas de São Paulo',
    evidence: lines('Diagnóstico eletrônico\n\n  \nRevisão programada'),
    references: [],
  });
  assert.deepEqual(intake.evidence, [
    'Diagnóstico eletrônico',
    'Revisão programada',
  ]);
  const summary = intakeSummary(intake);
  assert.ok(summary.includes('Segmento: oficina mecânica'));
  assert.ok(summary.includes('Diagnóstico eletrônico; Revisão programada'));
  assert.equal(intakeSummary({}), '');
});

await test('história é obrigatória na escrita, incorpora o legado e aceita uma referência', () => {
  const legacy = intakeSchema.parse({
    segment: 'oficina mecânica',
    region: 'São Paulo',
    audience: 'motoristas',
    offer: 'diagnóstico e revisão',
    goal: 'iniciar uma conversa',
    references: [
      'https://one.test/',
      'https://two.test/',
      'https://three.test/',
    ],
  });
  const editable = intakeForForm(legacy);
  assert.match(editable.story, /Segmento: oficina mecânica/);
  assert.match(editable.story, /Região atendida: São Paulo/);
  assert.match(editable.story, /Para quem vende: motoristas/);
  assert.equal(intakeWriteSchema.safeParse({ references: [] }).success, false);
  assert.equal(
    intakeWriteSchema.safeParse({
      story: editable.story,
      references: ['https://one.test/', 'https://two.test/'],
    }).success,
    false,
  );
  assert.equal(
    intakeWriteSchema.safeParse({
      story: editable.story,
      references: ['mailto:referencia@example.test'],
    }).success,
    false,
  );
  const current = intakeWriteSchema.parse({
    story:
      'A oficina nasceu em São Paulo e atende motoristas com diagnóstico e revisão antes de iniciar uma conversa.',
    references: ['https://one.test/'],
  });
  const summary = intakeSummary(current);
  assert.match(summary, /História do cliente: A oficina nasceu/);
  assert.equal(summary.includes('Segmento:'), false);
  assert.match(summary, /Referência visual: https:\/\/one\.test\//);
  assert.deepEqual(
    [
      current.segment,
      current.region,
      current.audience,
      current.offer,
      current.goal,
    ],
    ['', '', '', '', ''],
  );
});

await test('plano de cenas cobre abertura, protagonista e páginas internas', () => {
  const atelier = scenePlan({ heroComposition: 'atelier' }, 3, 'artistico');
  assert.deepEqual(
    atelier.map((scene) => scene.role),
    [
      'hero',
      'hero-detail',
      'protagonista',
      'protagonista',
      'subpagina',
      'subpagina',
    ],
  );
  assert.equal(atelier[0].ratio, '4:5');
  assert.equal(atelier[2].targetBlock, 'media.gallery');
  assert.equal(atelier[2].ratio, '4:3');
  const editorial = scenePlan({ heroComposition: 'editorial' }, 3, 'moderno');
  assert.equal(editorial[0].targetBlock, 'hero.editorial');
  assert.equal(editorial[0].ratio, '16:9');
  assert.equal(
    editorial.some((scene) => scene.role === 'hero-detail'),
    false,
  );
});

await test('cada vibe pede um repertório próprio, e a abertura segue a gramática', () => {
  // A causa da estrutura repetida: o plano pedia sempre os mesmos alvos, a foto
  // nascia rotulada com o bloco e a composição montava exatamente aquilo.
  const alvos = (vibe, composition) =>
    scenePlan({ heroComposition: composition }, 3, vibe).map(
      (scene) => scene.targetBlock,
    );
  assert.deepEqual(alvos('comercial', 'split'), [
    'hero.split',
    'feature.explorer',
    'feature.explorer',
    'narrative.split',
    'media.image',
  ]);
  assert.deepEqual(alvos('moderno', 'editorial'), [
    'hero.editorial',
    'feature.bento',
    'feature.bento',
    'media.image',
    'narrative.split',
  ]);
  assert.deepEqual(alvos('ousado', 'cover'), [
    'hero.cover',
    'media.gallery',
    'media.gallery',
    'media.image',
    'media.image',
  ]);
  assert.deepEqual(alvos('artistico', 'offset'), [
    'hero.offset',
    'media.gallery',
    'media.gallery',
    'narrative.split',
    'narrative.split',
  ]);
  // Composição fora da faixa da vibe cai na que a vibe sustenta: a foto de
  // abertura precisa nascer na proporção que a home vai exibir.
  assert.equal(alvos('ousado', 'atelier')[0], 'hero.cover');
  assert.equal(alvos('comercial', 'editorial')[0], 'hero.split');
});

await test('a cobertura casa biblioteca aprovada com as vagas do plano', () => {
  const plan = scenePlan({ heroComposition: 'split' }, 3, 'comercial');
  const photo = (targetBlock, ratio) => ({ targetBlock, ratio });
  const exatas = plan.map((slot) => photo(slot.targetBlock, slot.ratio));
  assert.equal(sceneCoverage(plan, exatas).missing.length, 0);

  // Faltando a segunda aplicação, a próxima vaga é a que o plano pede.
  const parcial = sceneCoverage(plan, exatas.slice(0, 2));
  assert.equal(parcial.covered.length, 2);
  assert.equal(parcial.missing[0].role, 'protagonista');
  assert.equal(parcial.missing[0].targetBlock, 'feature.explorer');

  // Foto antiga de outro hero 4:5 cobre a vaga sem obrigar geração paga.
  const offset = scenePlan({ heroComposition: 'offset' }, 3, 'moderno');
  const herdada = sceneCoverage(offset, [photo('hero.split', '4:5')]);
  assert.equal(herdada.covered.length, 1);
  assert.equal(herdada.covered[0].role, 'hero');
  // Mesmo bloco, proporção errada, não cobre a abertura: o recorte comeria a
  // cena. Ela cai na vaga panorâmica, que é onde serve.
  const torta = sceneCoverage(offset, [photo('hero.offset', '16:9')]);
  assert.equal(torta.missing[0].role, 'hero');
  assert.equal(torta.covered[0].targetBlock, 'media.image');
  // Proporção ausente ou inválida não vale por cobertura. Uploads podem ter
  // proporções numéricas fora do vocabulário do gerador, como 3:2.
  for (const ratio of [undefined, '', 'inválida', '0:0'])
    assert.equal(
      sceneCoverage(offset, [photo('hero.offset', ratio)]).covered.length,
      0,
      String(ratio),
    );
  // Uma foto panorâmica ocupa a vaga panorâmica, não a abertura em retrato.
  const panoramica = sceneCoverage(offset, [photo('media.image', '16:9')]);
  assert.equal(panoramica.covered[0].targetBlock, 'media.image');
  assert.equal(panoramica.missing[0].role, 'hero');

  // As duas vagas do atelier precisam de duas fotos, não de uma repetida.
  const atelier = scenePlan({ heroComposition: 'atelier' }, 3, 'artistico');
  assert.equal(
    sceneCoverage(atelier, [photo('hero.atelier', '4:5')]).missing[0].role,
    'hero-detail',
  );
});

await test('a próxima etapa vem do estado persistido, não da conversa', () => {
  const base = {
    hasDesign: true,
    coveredScenes: 6,
    targetScenes: 6,
    organicPages: 3,
    blockingErrors: 0,
    reviewRounds: 1,
    reviewComplete: true,
  };
  const novo = { ...base, organicPages: 0 };
  assert.equal(nextPhase({ ...novo, hasDesign: false }), 'briefing');
  assert.equal(nextPhase({ ...novo, coveredScenes: 1 }), 'cenas');
  // Sem atalho: uma vaga aberta mantém a etapa de cenas.
  assert.equal(nextPhase({ ...novo, coveredScenes: 5 }), 'cenas');
  assert.equal(nextPhase({ ...base, organicPages: 1 }), 'composicao');
  // Com as páginas montadas, biblioteca menor que o plano não reabre a etapa
  // de cenas: foto faltando vira erro de pre-flight, tratado na revisão.
  assert.equal(nextPhase({ ...base, coveredScenes: 1 }), 'pronto');
  assert.equal(
    nextPhase({ ...base, coveredScenes: 1, blockingErrors: 1 }),
    'pronto',
  );
  assert.equal(nextPhase({ ...base, reviewRounds: 0 }), 'pronto');
  assert.equal(nextPhase({ ...base, blockingErrors: 2 }), 'pronto');
  assert.equal(nextPhase(base), 'pronto');
  // A composição não fica disponível antes da direção existir.
  assert.equal(PHASE_TOOLS.briefing.includes('build_site'), false);
  assert.equal(PHASE_TOOLS.composicao.includes('publish_site'), false);
  assert.equal(PHASE_TOOLS.revisao.includes('review_pages'), true);
  // A cobertura já vai no prompt da fase; e logo não é etapa da geração.
  assert.equal(PHASE_TOOLS.cenas.includes('list_images'), false);
  for (const tools of Object.values(PHASE_TOOLS))
    assert.equal(tools.includes('generate_logo'), false);
});

const { generationState } = await j.import('../lib/sites/generation.ts');

const tenantComDirecao = {
  brand: {
    design: {
      version: 2,
      concept: 'Oficina que mostra o serviço acontecendo',
      signatureElement: 'Faixa diagonal de cor sobre a foto de abertura',
      displayFont: 'geometric',
      bodyFont: 'sans',
      heroComposition: 'split',
      navigation: 'bar',
      rhythm: 'alternating',
      imageTreatment: 'full-bleed',
      surfaceStyle: 'flat',
      motif: 'grid',
    },
  },
  brief: { generation: { reviewRounds: 1 } },
};
const paginasRicas = () =>
  rich().map((page) => ({
    ...page,
    id: page.slug || 'home',
    publishedBlocks: null,
    publishedSeo: null,
  }));
/**
 * Biblioteca que cobre o plano inteiro do hero split, vaga por vaga. As duas
 * primeiras são as fotos que a home do fixture referencia.
 */
const VAGAS = [
  ['hero.split', '4:5'],
  ['feature.explorer', '4:3'],
  ['feature.explorer', '4:3'],
  ['narrative.split', '5:6'],
  ['media.image', '16:9'],
];
const biblioteca = () =>
  VAGAS.map(([targetBlock, ratio], index) => {
    const seq = index + 1;
    return {
      ...images[0],
      id: `img-${seq}`,
      seq,
      url: scene(seq),
      blobPath: `tenants/sample/gerado/batch/${seq}.webp`,
      createdAt: `2026-09-0${seq}T10:00:00.000Z`,
      targetBlock,
      ratio,
    };
  });

for (const status of ['disponivel', 'candidata', 'aprovada'])
  await test(`biblioteca ${status} cobre o plano sem interromper a composição`, () => {
    const library = biblioteca().map((image) => ({ ...image, status }));
    const state = generationState(tenantComDirecao, [], library);
    assert.equal(state.targetScenes, 5);
    assert.equal(state.coveredScenes, 5);
    assert.equal(state.nextScene, null);
    assert.equal(state.next, 'composicao');
    const rejected = generationState(
      tenantComDirecao,
      [],
      library.map((image) => ({ ...image, status: 'rejeitada' })),
    );
    assert.equal(rejected.coveredScenes, 0);
    assert.equal(rejected.next, 'cenas');
    const pages = paginasRicas();
    const complete = generationState(tenantComDirecao, pages, library);
    assert.equal(complete.next, 'pronto');
    const semFoto = structuredClone(pages);
    semFoto[1].blocks = semFoto[1].blocks.filter(
      (block) => block.type !== 'hero.split',
    );
    assert.ok(
      generationState(tenantComDirecao, semFoto, library).blockingErrors >
        complete.blockingErrors,
    );
  });

await test('o plano não cresce com as páginas gravadas', () => {
  // Com quatro páginas orgânicas o plano continua medindo três: crescer aqui
  // devolveria a geração para a etapa de cenas logo depois da composição.
  const pages = paginasRicas();
  const extra = structuredClone(pages[1]);
  extra.slug = 'processo';
  extra.id = 'processo';
  extra.seo = {
    title: 'Título específico do processo',
    description: 'Descrição específica da página de processo.',
  };
  const state = generationState(
    tenantComDirecao,
    [...pages, extra],
    biblioteca(),
  );
  assert.equal(state.targetScenes, 5);
  assert.equal(state.coveredScenes, 5);
  assert.notEqual(state.next, 'cenas');
});

await test('perfil de rede social é normalizado; outros hosts continuam fora do campo', () => {
  assert.deepEqual(normalizeSocialUrl('@Oficina.Sabia'), {
    url: 'https://www.instagram.com/oficina.sabia/',
    network: 'instagram',
    handle: 'oficina.sabia',
  });
  assert.equal(
    normalizeSocialUrl('instagram.com/oficina/?hl=pt').url,
    'https://www.instagram.com/oficina/',
  );
  assert.equal(
    normalizeSocialUrl('https://www.linkedin.com/company/Porto-Pedras/about/')
      .url,
    'https://www.linkedin.com/company/porto-pedras/',
  );
  assert.equal(
    normalizeSocialUrl('linkedin.com/in/pessoa').network,
    'linkedin',
  );
  for (const input of [
    '',
    'facebook.com/oficina',
    'https://oficina.test/',
    'instagram.com/p/Cabc123/',
    'linkedin.com/feed/',
  ])
    assert.equal(normalizeSocialUrl(input), null, input);
});

await test('meta lê o conteúdo da própria tag, com apóstrofo e ordem invertida', () => {
  const html = `<meta property="og:description" content="Bio d'água e sol">
    <meta name='description' content='Segunda leitura'>`;
  assert.equal(metaContent(html, 'og:description'), "Bio d'água e sol");
  assert.equal(metaContent(html, 'description'), 'Segunda leitura');
  // Atributos invertidos, como o Instagram escreve.
  assert.equal(
    metaContent(
      '<meta content="Perfil real" name="description" />',
      'description',
    ),
    'Perfil real',
  );
  // O LinkedIn entrega a bio codificada duas vezes: &amp;#39; é um apóstrofo.
  assert.equal(
    metaContent(
      '<meta name="description" content="ship what&amp;#39;s next" />',
      'description',
    ),
    "ship what's next",
  );
  // Uma entidade só continua com uma passada, sem estragar &amp;lt;.
  assert.equal(
    metaContent(
      '<meta name="description" content="a &amp;lt; b" />',
      'description',
    ),
    'a &lt; b',
  );
  // Sem a tag pedida, o padrão não pode varrer as tags anteriores.
  const semAlvo = `<meta name="robots" content="noarchive" /><meta charset="utf-8" />
    <meta property="og:title" content="Só título" />`;
  assert.equal(metaContent(semAlvo, 'description'), undefined);
  assert.equal(metaContent(semAlvo, 'og:title'), 'Só título');
});

await test('Instagram devolve nome, bio e avatar; casca de login vira bloqueio', () => {
  const lidoEm = '2026-09-10T12:00:00.000Z';
  const perfil = parseSocialProfile(
    normalizeSocialUrl('@padaria'),
    `<meta property="og:title" content="Padaria Santa Luzia (&#064;padaria) &#x2022; Instagram photos and videos" />
     <meta name="description" content="3,２01 Followers, 180 Following, 96 Posts - Padaria Santa Luzia on Instagram: &quot;P&atilde;o d'água todo dia &#xe0;s 6h&quot;" />
     <meta property="og:image" content="https://scontent.cdninstagram.com/v/avatar.jpg?token=1" />`,
    lidoEm,
  );
  assert.equal(perfil.status, 'ok');
  assert.equal(perfil.name, 'Padaria Santa Luzia');
  assert.equal(perfil.bio, "Pão d'água todo dia às 6h");
  assert.equal(
    perfil.sourceImage,
    'https://scontent.cdninstagram.com/v/avatar.jpg?token=1',
  );
  assert.equal(perfil.lidoEm, lidoEm);

  const casca = parseSocialProfile(
    normalizeSocialUrl('@padaria'),
    '<html><head><title>Instagram</title></head><body>challenge checkpoint</body></html>',
    lidoEm,
  );
  assert.equal(casca.status, 'inacessivel');
  assert.ok(casca.motivo.includes('login'));
  assert.equal(casca.sourceImage, undefined);
});

await test('LinkedIn de empresa devolve nome e tagline sem o prefixo de seguidores', () => {
  const perfil = parseSocialProfile(
    normalizeSocialUrl('linkedin.com/company/porto-pedras'),
    `<meta property="og:title" content="Porto Pedras | LinkedIn">
     <meta name="description" content="Porto Pedras | 1,240 followers on LinkedIn. Pedras naturais para arquitetura">
     <meta property="og:image" content="https://media.licdn.com/logo.png">`,
    '2026-09-10T12:00:00.000Z',
  );
  assert.equal(perfil.status, 'ok');
  assert.equal(perfil.name, 'Porto Pedras');
  assert.equal(perfil.bio, 'Pedras naturais para arquitetura');
  assert.equal(perfil.followers, '1,240 seguidores');
});

await test('resposta 999 do LinkedIn vira bloqueio explícito, sem segunda requisição', async () => {
  let called = 0;
  const reference = await readSocialProfile(
    normalizeSocialUrl('linkedin.com/in/pessoa'),
    {
      // O construtor Response recusa 999; o LinkedIn responde exatamente isso.
      fetch: async () => {
        called += 1;
        return {
          status: 999,
          ok: false,
          headers: new Headers(),
          text: async () => '',
        };
      },
    },
  );
  assert.equal(called, 1);
  assert.equal(reference.status, 'inacessivel');
  assert.ok(reference.motivo.includes('perfis pessoais'));
});

await test('perfil lido vira referência e resumo; bloqueado vira lacuna declarada', () => {
  const social = {
    url: 'https://www.instagram.com/padaria/',
    network: 'instagram',
    handle: 'padaria',
    status: 'ok',
    name: 'Padaria Santa Luzia',
    bio: 'Pão de fermentação natural',
    followers: '3,201 seguidores',
    avatarNotes: 'Logotipo bege sobre marrom',
    lidoEm: '2026-09-10T12:00:00.000Z',
  };
  const summary = socialSummary(social);
  assert.ok(summary.includes('Padaria Santa Luzia'));
  assert.ok(summary.includes('Pão de fermentação natural'));
  assert.ok(summary.includes('Logotipo bege'));

  const reference = referenceFromSocial(social);
  assert.equal(reference.status, 'ok');
  assert.equal(reference.titulo, 'Padaria Santa Luzia');
  assert.equal(reference.descricao, 'Pão de fermentação natural');

  const bloqueado = socialSummary({
    ...social,
    status: 'inacessivel',
    motivo: 'O Instagram devolveu a tela de login em vez do perfil.',
    bio: undefined,
  });
  assert.ok(bloqueado.includes('não foi possível ler'));
  assert.ok(bloqueado.includes('lacuna'));
  assert.equal(
    referenceFromSocial({ ...social, status: 'inacessivel' }).status,
    'inacessivel',
  );
  assert.equal(socialSummary({ ...social, status: 'lendo' }), '');
  assert.equal(socialSummary({ nada: true }), '');
  // Leitura pendente ainda declara a URL, sem prometer conteúdo.
  const pendente = socialSummary(null, 'https://www.instagram.com/padaria/');
  assert.ok(pendente.includes('instagram.com/padaria'));
  assert.ok(pendente.includes('não terminou'));
  assert.equal(bloqueado.includes('perfil..'), false);
});

await test('intake aceita perfil social, normaliza e recusa outra rede', () => {
  const intake = intakeSchema.parse({ socialUrl: ' @Padaria ' });
  assert.equal(intake.socialUrl, 'https://www.instagram.com/padaria/');
  // A URL fica na linha da rede social, não repetida no resumo do intake.
  assert.equal(intakeSummary(intake).includes('instagram.com/padaria'), false);
  assert.equal(intakeSocialUrl(intake), 'https://www.instagram.com/padaria/');
  const recusado = intakeSchema.safeParse({
    socialUrl: 'facebook.com/padaria',
  });
  assert.equal(recusado.success, false);
  assert.ok(recusado.error.issues[0].message.includes('Instagram'));
  assert.equal(intakeSchema.parse({}).socialUrl, '');
});

await test('ferramentas preservam o perfil e o intake atualizados durante o turno', async () => {
  const old = { intake: { segment: 'Antigo' }, social: { status: 'lendo' } };
  let brief = {
    intake: { segment: 'Atualizado pelo operador' },
    social: { status: 'ok', name: 'Perfil lido' },
  };
  const protectedFields = structuredClone(brief);
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          const sql = parts.join('');
          if (!sql.includes('update tenants')) return [];
          if (sql.includes("'{sources}'")) {
            brief = {
              ...brief,
              sources: [
                ...(brief.sources ?? []).filter(
                  (source) => source.url !== values[0],
                ),
                ...JSON.parse(values[1]),
              ],
            };
            return [];
          }
          // A gravação do recibo mexe só na chave generation, com merge no
          // banco: reescrever o brief inteiro apagava campos alheios.
          if (sql.includes("'{generation}'")) {
            const previous = brief.generation ?? {};
            brief = {
              ...brief,
              generation: {
                ...previous,
                ...JSON.parse(values[0]),
                reviewRounds: Number(previous.reviewRounds ?? 0) + 1,
              },
            };
            return [];
          }
          brief = { ...brief, ...JSON.parse(values[0]) };
          return [];
        },
    },
    '@/lib/ai/reference': {
      readReference: async (url) => ({
        url,
        status: 'ok',
        titulo: 'Fonte verificada',
        lidoEm: new Date().toISOString(),
      }),
    },
    '@/lib/tenant-queries': {
      listPages: async () => rich(),
      getTenantBySlug: async () => ({
        id: 'fixture',
        slug: 'fixture',
        brand: {},
        dials: {},
        brief,
        imageGuide: {},
      }),
    },
    '@/lib/images/queries': { listImages: async () => images },
  });
  const tools = buildTools({
    id: 'fixture',
    slug: 'fixture',
    brand: {},
    dials: {},
    brief: old,
  });
  const { designProfileInputSchema } = await j.import(
    '../lib/design/profile.ts',
  );
  const direction = designProfileInputSchema.parse({
    brief: {
      audience: 'Pessoas reformando a casa',
      offer: 'Pedras para arquitetura',
      goal: 'Solicitar orientação',
      personality: ['sóbria', 'natural'],
      evidence: ['Produção própria'],
      constraints: ['Nunca mostrar pessoas'],
    },
    concept: 'Recortes da matéria em escala arquitetônica',
    signatureElement: 'Janela vertical de matéria',
    structure: 'comercial-atendimento',
    structureRationale:
      'O atendimento guiado organiza as escolhas do cliente antes do contato.',
    accent: '#87522a',
    accentAlt: '#315b48',
    ink: '#111111',
    paper: '#ffffff',
    surface: '#eeeeee',
    radius: 'sm',
    displayFont: 'humanist',
    bodyFont: 'source',
    heroComposition: 'split',
    navigation: 'bar',
    rhythm: 'alternating',
    imageTreatment: 'framed',
    surfaceStyle: 'flat',
    motif: 'corners',
    variance: 5,
    motion: 3,
    density: 5,
  });
  for (const [name, input] of [
    ['read_reference', { url: 'https://example.test/' }],
    ['review_pages', {}],
    ['set_design', direction],
  ]) {
    const result = await tools[name].execute(input);
    assert.equal(result.error, undefined, name);
    assert.deepEqual(brief.intake, protectedFields.intake, name);
    assert.deepEqual(brief.social, protectedFields.social, name);
  }
  assert.equal(brief.sources[0].titulo, 'Fonte verificada');
  assert.equal(brief.generation.reviewRounds, 1);
  assert.deepEqual(brief.constraints, ['Nunca mostrar pessoas']);
});

const { systemPrompt } = await j.import('../lib/taste/prompt.ts');
const { designProfileInputSchema: designInput } = await j.import(
  '../lib/design/profile.ts',
);

const modernDirection = {
  brief: {
    audience: 'Times de produto que precisam de previsibilidade',
    offer: 'Implantação e operação de rotina de engenharia',
    goal: 'Agendar uma conversa técnica',
    personality: ['precisa', 'contida'],
    evidence: ['Operação própria desde 2019'],
    constraints: ['Não citar clientes'],
  },
  concept: 'Painel escuro com uma única linha de acento por capítulo',
  signatureElement: 'Régua de 1px separando os capítulos',
  structure: 'moderno-editorial',
  structureRationale:
    'Os capítulos editoriais explicam a operação técnica com ordem e precisão.',
  accent: '#4b6bdd',
  accentAlt: '#2f8f6b',
  ink: '#f5f6f8',
  paper: '#0b0c0e',
  surface: '#15171b',
  radius: 'sm',
  displayFont: 'geometric',
  bodyFont: 'sans',
  heroComposition: 'editorial',
  navigation: 'minimal',
  rhythm: 'chapters',
  imageTreatment: 'framed',
  surfaceStyle: 'outlined',
  motif: 'none',
  variance: 3,
  motion: 4,
  density: 4,
};

await test('set_design respeita a faixa da vibe e compara unicidade dentro dela', async () => {
  const queries = [];
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          queries.push({ sql: parts.join('?'), values });
          return [];
        },
    },
    '@/lib/tenant-queries': { listPages: async () => [] },
    '@/lib/images/queries': { listImages: async () => [] },
  });
  const tools = buildTools({
    id: 'fixture-moderno',
    slug: 'fixture-moderno',
    brand: { vibe: 'moderno' },
    dials: {},
    brief: {},
  });

  const claro = await tools.set_design.execute(
    designInput.parse({
      ...modernDirection,
      ink: '#111111',
      paper: '#ffffff',
      surface: '#eeeeee',
    }),
  );
  assert.match(claro.error, /Moderno/);
  assert.match(claro.error, /paper/);

  const fora = await tools.set_design.execute(
    designInput.parse({
      ...modernDirection,
      displayFont: 'editorial',
      radius: 'full',
    }),
  );
  assert.match(fora.error, /displayFont/);
  assert.match(fora.error, /radius/);

  const ok = await tools.set_design.execute(designInput.parse(modernDirection));
  assert.equal(ok.error, undefined);
  assert.equal(ok.vibe, 'moderno');
  // A comparação de unicidade só olha clientes da mesma vibe: as faixas se
  // sobrepõem em vários eixos e um moderno não repete um ousado.
  const uniqueness = queries.find((query) =>
    query.sql.includes("brand ? 'design'"),
  );
  assert.ok(uniqueness.sql.includes("brand->>'vibe'"));
  assert.ok(uniqueness.values.includes('moderno'));
});

await test('o prompt declara a vibe e os contatos já renderizados', () => {
  const tenant = {
    name: 'Fixture',
    slug: 'fixture',
    brand: { vibe: 'ousado' },
    dials: { variance: 7, motion: 5, density: 4 },
    brief: {},
    imageGuide: {},
    whatsapp: '5511988887777',
    contactEmail: 'oi@fixture.com.br',
    contacts: {
      phones: [{ number: '5511988887777', whatsapp: true }],
      addresses: [{ label: 'Loja', text: 'Rua das Pedras, 100, Bauru' }],
      social: ['https://www.instagram.com/fixture/'],
    },
  };
  const prompt = systemPrompt(tenant, '', '/', '');
  assert.match(prompt, /## Vibe do site: Ousado/);
  assert.match(prompt, /hero\.statement/);
  assert.match(prompt, /Rua das Pedras, 100, Bauru/);
  assert.match(prompt, /oi@fixture\.com\.br/);
  assert.match(prompt, /onde-estamos/);
  assert.match(prompt, /Direção de imagem da vibe/);

  const comercial = systemPrompt({ ...tenant, brand: {} }, '', '/', '');
  assert.match(comercial, /## Vibe do site: Comercial/);
  assert.equal(comercial.includes('11vw'), false);

  // Cliente sem contatos não ganha seção vazia nem quebra o prompt.
  const vazio = systemPrompt(
    { ...tenant, contacts: undefined, whatsapp: null, contactEmail: null },
    '',
    '/',
    '',
  );
  assert.match(vazio, /\(nenhum\)/);
});

await test('a âncora da seção de localização pertence ao cadastro', () => {
  const page = project()[0];
  page.blocks = [
    {
      id: 'mapa',
      type: 'media.map',
      props: {
        address: 'Rua das Pedras, 100',
        query: 'Rua das Pedras, 100',
        anchor: 'onde-estamos',
      },
    },
  ];
  const findings = lintPage(page);
  assert.ok(findings.some((finding) => finding.rule === 'anchor-reservada'));
  page.blocks[0].props.anchor = 'endereco';
  assert.equal(
    lintPage(page).some((finding) => finding.rule === 'anchor-reservada'),
    false,
  );
});

await test('o plano de cenas continua guiado pelo hero do perfil', () => {
  assert.deepEqual(
    scenePlan({ heroComposition: 'editorial' }, 3, 'moderno').map(
      (scene) => scene.ratio,
    ),
    ['16:9', '4:3', '4:3', '16:9', '5:6'],
  );
  assert.equal(
    scenePlan({ heroComposition: 'poster' }, 3, 'ousado')[0].ratio,
    '4:5',
  );
});

/* -------------------------------------------------------- gramática da vibe
 * Medido em 12/09/2026 em produção: dois clientes de vibes diferentes, com
 * referências diferentes, tinham 4 das 5 seções da home iguais e passavam em
 * todos os gates. A silhueta passa a pertencer à vibe.
 */
const { VIBE_GRAMMAR, grammarDirection, laneIssues } = await j.import(
  '../lib/design/vibes.ts',
);
const {
  silhouette,
  silhouetteSimilarity,
  structuralFindings: structural,
} = await j.import('../lib/taste/metrics.ts');

const designV4 = (over = {}) => ({
  version: 4,
  concept: 'Conceito concreto do negócio',
  signatureElement: 'Elemento repetido com intenção',
  displayFont: 'humanist',
  bodyFont: 'source',
  heroComposition: 'split',
  navigation: 'bar',
  rhythm: 'alternating',
  imageTreatment: 'framed',
  surfaceStyle: 'flat',
  motif: 'none',
  signature: 'x',
  definedAt: '2026-09-12T00:00:00.000Z',
  ...over,
});

await test('a gramática da vibe governa abertura e seção protagonista da home', () => {
  const brand = { vibe: 'comercial', design: designV4() };
  // rich() abre em hero.split atelier e usa feature.explorer showroom.
  const comercial = structural(rich(), images, brand).map((f) => f.rule);
  assert.ok(comercial.includes('abertura-fora-da-vibe'));
  assert.equal(comercial.includes('protagonista-fora-da-vibe'), false);

  // A mesma home numa vibe ousada erra as duas decisões: lá a home abre com a
  // foto cobrindo o hero e a seção protagonista é a galeria.
  const ousado = structural(rich(), images, {
    vibe: 'ousado',
    design: designV4({ heroComposition: 'cover' }),
  }).map((f) => f.rule);
  assert.ok(ousado.includes('protagonista-fora-da-vibe'));

  // Abertura conforme: o layout explícito entra na gramática comercial.
  const conforme = rich();
  conforme[0].blocks[1].props.layout = 'split';
  const ok = structural(conforme, images, brand).map((f) => f.rule);
  assert.equal(ok.includes('abertura-fora-da-vibe'), false);
  assert.equal(ok.includes('protagonista-fora-da-vibe'), false);
});

await test('perfis v2 e v3 publicados não recebem a gramática', () => {
  for (const version of [2, 3]) {
    const rules = structural(rich(), images, {
      vibe: 'ousado',
      design: designV4({ version }),
    }).map((f) => f.rule);
    assert.equal(rules.includes('abertura-fora-da-vibe'), false, `v${version}`);
    assert.equal(
      rules.includes('protagonista-fora-da-vibe'),
      false,
      `v${version}`,
    );
  }
  // Sem marca, o contrato antigo continua igual.
  assert.equal(
    structural(rich(), images).some((f) => f.rule.endsWith('-fora-da-vibe')),
    false,
  );
});

await test('a silhueta lê o layout que o visitante vê, não só o que foi digitado', () => {
  const home = rich()[0];
  // hero.split sem layout cai na composição do perfil; explorer no padrão.
  delete home.blocks[1].props.layout;
  assert.deepEqual(
    silhouette(home.blocks, designV4({ heroComposition: 'offset' })),
    ['hero.split:offset', 'editorial.text:narrow', 'feature.explorer:showroom'],
  );
  // nav e rodapé ficam fora: eles não são a composição da página.
  assert.equal(silhouette(home.blocks).includes('nav.bar:bar'), false);
});

await test('silhuetas quase iguais são medidas, não só as idênticas', () => {
  // As duas homes reais de 12/09/2026, com a única diferença observada.
  const chiquinho = [
    'hero.split:split',
    'feature.explorer:showroom',
    'editorial.facts:split',
    'faq.accordion:split',
    'cta.band:band',
  ];
  const tech = [
    'hero.split:editorial',
    'feature.explorer:showroom',
    'editorial.facts:split',
    'faq.accordion:split',
    'cta.band:band',
  ];
  assert.equal(silhouetteSimilarity(chiquinho, tech), 0.8);
  assert.equal(silhouetteSimilarity(chiquinho, chiquinho), 1);
  // A gramática afasta as duas: cada vibe tem abertura e protagonista próprios.
  const ousado = [
    'hero.split:cover',
    'media.gallery:collage',
    'proof.stats:strip',
    'faq.accordion:stack',
    'cta.band:poster',
  ];
  assert.ok(silhouetteSimilarity(chiquinho, ousado) < 0.75);
  assert.equal(silhouetteSimilarity([], tech), 0);
});

await test('cada vibe tem abertura, protagonista e fechamento próprios', () => {
  const entries = Object.entries(VIBE_GRAMMAR);
  for (const [vibe, grammar] of entries) {
    assert.ok(grammar.openings.length, vibe);
    assert.ok(grammar.protagonists.length, vibe);
    assert.ok(grammar.support.length, vibe);
    // A gramática precisa citar blocos que existem no catálogo.
    for (const entry of [
      ...grammar.openings,
      ...grammar.protagonists,
      ...grammar.innerOpenings,
      ...grammar.closings,
      ...grammar.avoid,
    ]) {
      const [type, layout] = entry.split(':');
      assert.ok(blockSchemas[type], `${vibe}: ${entry}`);
      const schema = blockSchemas[type].shape.layout;
      const options = schema?.def?.innerType?.options ?? schema?.options;
      if (options) assert.ok(options.includes(layout), `${vibe}: ${entry}`);
    }
    // Nenhuma vibe repete a seção protagonista de outra na mesma variante.
    for (const [other, otherGrammar] of entries) {
      if (other === vibe) continue;
      for (const entry of grammar.protagonists)
        assert.equal(
          otherGrammar.protagonists.includes(entry),
          false,
          `${vibe} repete ${entry} de ${other}`,
        );
    }
    assert.match(grammarDirection(vibe), /Abertura da home/);
  }
});

await test('somente a leitura completa libera a direção visual acima da vibe', () => {
  // Direção clara e serifada num cliente moderno: a leitura visual autoriza a
  // fonte, mas não o papel branco nem a superfície plana.
  const input = {
    ink: '#111111',
    paper: '#ffffff',
    surface: '#eeeeee',
    radius: 'lg',
    displayFont: 'editorial',
    bodyFont: 'sans',
    heroComposition: 'offset',
    navigation: 'bar',
    rhythm: 'alternating',
    imageTreatment: 'framed',
    surfaceStyle: 'flat',
    motif: 'none',
    variance: 7,
    motion: 3,
    density: 3,
  };
  const semReferencia = laneIssues('moderno', input).join(' ');
  assert.match(semReferencia, /displayFont/);
  assert.match(semReferencia, /navigation/);

  const parcial = laneIssues('moderno', input, [
    'layout',
    'typography',
    'imagery',
    'rhythm',
  ]).join(' ');
  assert.equal(parcial.includes('displayFont'), false);
  assert.equal(parcial.includes('navigation'), false);
  assert.match(parcial, /surfaceStyle/);
  assert.match(parcial, /paper/);
  assert.match(parcial, /variance/);

  const comSuperficie = laneIssues('moderno', input, [
    'layout',
    'typography',
    'imagery',
    'rhythm',
    'surface',
  ]).join(' ');
  assert.equal(comSuperficie.includes('surfaceStyle'), false);
  assert.equal(comSuperficie.includes('paper'), false);
  // Enquanto mobile não estiver documentado, a leitura ainda é incompleta e
  // preserva as decisões sem cobertura.
  assert.match(comSuperficie, /variance/);
  const completo = laneIssues(
    'moderno',
    { ...input, heroComposition: 'poster', motif: 'stripes', variance: 4 },
    ['layout', 'typography', 'imagery', 'rhythm', 'surface', 'mobile'],
  ).join(' ');
  assert.equal(completo, '');
});

await test('o catálogo diz o papel de cada bloco na vibe pedida', () => {
  const neutro = catalogForPrompt();
  assert.equal(neutro.includes('[vibe:'), false);
  const ousado = catalogForPrompt({ vibe: 'ousado' });
  assert.match(ousado, /media\.gallery · .*\[vibe: .*protagonista da home/);
  assert.match(ousado, /cta\.band · .*fechamento em cta\.band:poster/);
  const comercial = catalogForPrompt({ vibe: 'comercial' });
  assert.match(
    comercial,
    /feature\.explorer · .*protagonista da home em feature\.explorer:showroom/,
  );
  assert.match(comercial, /media\.gallery · .*evite media\.gallery:collage/);
});
